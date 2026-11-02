import { spawn, ChildProcess, execFileSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { ServiceConfig, OrchestratorSettings } from '../types/config.js';
import { LogEntry, ProcessCallbacks, ServiceStatus } from '../types/index.js';
import { logger } from '../logger/logger.js';
import { normalizeServiceCommands, resolveDependencyTiers } from './dependencyGraph.js';

interface ActiveProcessInfo {
  child: ChildProcess;
  config: ServiceConfig;
  pid: number;
  stdoutRemainder: string;
  stderrRemainder: string;
  readinessBuffer: string;
  isReady: boolean;
}

const MAX_LOG_LINE_CHARS = 8192;

function getChildColorEnvironment(): Record<string, string> {
  const disableColor =
    'NO_COLOR' in process.env ||
    process.env.FORCE_COLOR === '0' ||
    process.env.FORCE_COLOR === 'false' ||
    process.env.TERM === 'dumb';
  return disableColor
    ? { NO_COLOR: process.env.NO_COLOR ?? '', FORCE_COLOR: '0' }
    : { FORCE_COLOR: '1' };
}

class ProcessManager {
  private activeProcesses = new Map<string, ActiveProcessInfo>();
  private knownConfigs = new Map<string, ServiceConfig>();
  private logCounter = 0;

  /**
   * Helper to format current time HH:MM:SS
   */
  private formatTime(date: Date = new Date()): string {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private appendOutputChunk(
    serviceName: string,
    remainder: string,
    chunk: string,
    level: 'info' | 'error',
    callbacks: ProcessCallbacks,
    prefix = ''
  ): string {
    const text = remainder + chunk;
    let lineStart = 0;
    let lineEnd = text.indexOf('\n');

    while (lineEnd !== -1) {
      const line = text.slice(lineStart, lineEnd).replace(/\r$/, '');
      this.emitOutputLine(serviceName, line, level, callbacks, prefix);
      lineStart = lineEnd + 1;
      lineEnd = text.indexOf('\n', lineStart);
    }

    let pending = text.slice(lineStart);
    while (pending.length >= MAX_LOG_LINE_CHARS) {
      this.emitOutputLine(serviceName, pending.slice(0, MAX_LOG_LINE_CHARS), level, callbacks, prefix);
      pending = pending.slice(MAX_LOG_LINE_CHARS);
    }
    return pending;
  }

  private emitOutputLine(
    serviceName: string,
    line: string,
    level: 'info' | 'error',
    callbacks: ProcessCallbacks,
    prefix = ''
  ): void {
    if (!line.trim()) return;
    const chunkLength = MAX_LOG_LINE_CHARS - prefix.length;
    for (let offset = 0; offset < line.length; offset += chunkLength) {
      callbacks.onLog(serviceName, {
        id: `${level === 'error' ? 'err' : 'out'}-${serviceName}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: serviceName,
        message: `${prefix}${line.slice(offset, offset + chunkLength)}`,
        level
      });
    }
  }

  /**
   * Kill an entire process group cleanly across POSIX and Windows
   */
  private killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGTERM') {
    if (process.platform === 'win32') {
      try {
        execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {}
    } else {
      try {
        // Negative PID targets the entire process group
        process.kill(-pid, signal);
      } catch (err) {
        const error = err as NodeJS.ErrnoException;
        if (error.code !== 'ESRCH') {
          try {
            process.kill(pid, signal);
          } catch {}
        }
      }
    }
  }

  private isProcessTreeAlive(pid: number): boolean {
    try {
      process.kill(process.platform === 'win32' ? pid : -pid, 0);
      return true;
    } catch (error) {
      return (error as NodeJS.ErrnoException).code !== 'ESRCH';
    }
  }

  private delay(ms: number, signal?: AbortSignal): Promise<boolean> {
    if (signal?.aborted) return Promise.resolve(false);
    return new Promise(resolve => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve(true);
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        signal?.removeEventListener('abort', onAbort);
        resolve(false);
      };
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /**
   * Run a pre-flight setup command in the multi-command pipeline
   */
  private runPreCommand(
    service: ServiceConfig,
    cmd: string,
    stepIndex: number,
    totalSteps: number,
    cwd: string,
    env: Record<string, string>,
    callbacks: ProcessCallbacks,
    signal?: AbortSignal
  ): Promise<{ exitCode: number | null }> {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve({ exitCode: null });
        return;
      }

      callbacks.onStatusChange(service.name, 'starting', undefined, undefined, `STEP ${stepIndex + 1}/${totalSteps}`);
      callbacks.onLog(service.name, {
        id: `step-${service.name}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: service.name,
        message: `[Step ${stepIndex + 1}/${totalSteps}] Running: "${cmd}"`,
        level: 'info'
      });

      const child = spawn(cmd, {
        cwd,
        shell: true,
        detached: process.platform !== 'win32',
        env: {
          ...process.env,
          ...env,
          ...getChildColorEnvironment()
        }
      });
      let abortKillTimer: NodeJS.Timeout | undefined;
      const abortChild = () => {
        if (!child.pid) return;
        this.killProcessTree(child.pid, 'SIGTERM');
        abortKillTimer = setTimeout(() => {
          if (child.pid && child.exitCode === null) this.killProcessTree(child.pid, 'SIGKILL');
        }, 800);
      };

      let stdoutRemainder = '';
      let stderrRemainder = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutRemainder = this.appendOutputChunk(service.name, stdoutRemainder, chunk.toString(), 'info', callbacks, '  ');
      });

      child.stderr?.on('data', (chunk: Buffer) => {
        stderrRemainder = this.appendOutputChunk(service.name, stderrRemainder, chunk.toString(), 'error', callbacks, '  ');
      });

      child.on('close', (code) => {
        signal?.removeEventListener('abort', abortChild);
        if (abortKillTimer) clearTimeout(abortKillTimer);
        this.emitOutputLine(service.name, stdoutRemainder, 'info', callbacks, '  ');
        this.emitOutputLine(service.name, stderrRemainder, 'error', callbacks, '  ');
        if (code === 0) {
          callbacks.onLog(service.name, {
            id: `step-done-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: `[Step ${stepIndex + 1}/${totalSteps}] ✔ Command "${cmd}" finished (exit code 0)`,
            level: 'info'
          });
        } else {
          callbacks.onLog(service.name, {
            id: `step-fail-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: `[Step ${stepIndex + 1}/${totalSteps}] ✖ Command "${cmd}" failed with code ${code}. Pipeline aborted.`,
            level: 'error'
          });
        }
        resolve({ exitCode: code });
      });

      child.on('error', (err) => {
        signal?.removeEventListener('abort', abortChild);
        if (abortKillTimer) clearTimeout(abortKillTimer);
        callbacks.onLog(service.name, {
          id: `step-err-${service.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: service.name,
          message: `[Step ${stepIndex + 1}/${totalSteps}] ✖ Execution error: ${err.message}`,
          level: 'error'
        });
        resolve({ exitCode: -1 });
      });

      signal?.addEventListener('abort', abortChild, { once: true });
      if (signal?.aborted) abortChild();
    });
  }

  /**
   * Probe whether a local TCP port is open and listening
   */
  public probeTcpPort(port: number, host = '127.0.0.1', timeoutMs = 300): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeoutMs);
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.once('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  }

  /**
   * Wait until a service is ready (port listening or process active)
   */
  public async waitForServiceReady(
    service: ServiceConfig,
    timeoutMs = 15000,
    pollIntervalMs = 250,
    signal?: AbortSignal
  ): Promise<boolean> {
    const startTime = Date.now();

    if (service.readyPattern) {
      while (Date.now() - startTime < timeoutMs) {
        if (signal?.aborted) return false;
        const info = this.activeProcesses.get(service.name);
        if (!info) return false;
        if (info.isReady) return true;
        if (!await this.delay(pollIntervalMs, signal)) return false;
      }
      return false;
    }

    // If service has a configured port, wait until the TCP port is listening
    if (service.port && typeof service.port === 'number') {
      while (Date.now() - startTime < timeoutMs) {
        if (signal?.aborted || !this.activeProcesses.has(service.name)) {
          return false;
        }
        const isOpen = await this.probeTcpPort(service.port);
        if (isOpen) {
          return true;
        }
        if (!await this.delay(pollIntervalMs, signal)) return false;
      }
      return false;
    }

    // Default: verify process spawned and running
    if (!await this.delay(400, signal)) return false;
    return this.activeProcesses.has(service.name);
  }

  /**
   * Start a single service (executing pre-commands sequentially, then spawning the persistent daemon)
   */
  public async startService(
    service: ServiceConfig,
    callbacks: ProcessCallbacks,
    signal?: AbortSignal
  ): Promise<number | null> {
    this.knownConfigs.set(service.name, service);
    if (signal?.aborted) return null;

    // If already running, return existing PID
    if (this.activeProcesses.has(service.name)) {
      return this.activeProcesses.get(service.name)!.pid;
    }

    const resolvedCwd = path.isAbsolute(service.path)
      ? service.path
      : path.resolve(process.cwd(), service.path);

    if (!fs.existsSync(resolvedCwd)) {
      const errMsg = `Directory not found: "${service.path}" (resolved: ${resolvedCwd})`;
      callbacks.onLog(service.name, {
        id: `err-${service.name}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: service.name,
        message: `✖ ${errMsg}`,
        level: 'error'
      });
      callbacks.onStatusChange(service.name, 'stopped', undefined, errMsg);
      return null;
    }

    const unavailableDependency = (service.dependsOn || []).find(dependency => {
      const dependencyConfig = Array.from(this.knownConfigs.values())
        .find(config => config.name.toLowerCase() === dependency.toLowerCase());
      return !dependencyConfig || !this.activeProcesses.has(dependencyConfig.name);
    });
    if (unavailableDependency) {
      const error = `Dependency "${unavailableDependency}" is not running`;
      callbacks.onStatusChange(service.name, 'blocked', undefined, error, `BLOCKED (${unavailableDependency})`);
      callbacks.onLog(service.name, {
        id: `blocked-${service.name}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: service.name,
        message: `✖ ${error}; start it before "${service.name}".`,
        level: 'error'
      });
      return null;
    }

    callbacks.onStatusChange(service.name, 'starting');

    const customEnv: Record<string, string> = {};

    // Normalize command pipeline
    const pipeline = normalizeServiceCommands(service);

    // Execute pre-flight commands sequentially if any exist
    if (pipeline.preCommands.length > 0) {
      for (let i = 0; i < pipeline.preCommands.length; i++) {
        const cmd = pipeline.preCommands[i]!;
        const res = await this.runPreCommand(service, cmd, i, pipeline.totalSteps, resolvedCwd, customEnv, callbacks, signal);
        if (res.exitCode !== 0) {
          if (signal?.aborted) return null;
          callbacks.onStatusChange(
            service.name,
            'stopped',
            undefined,
            `Pre-flight command ${i + 1} failed`,
            `FAILED (step ${i + 1}/${pipeline.totalSteps})`
          );
          return null;
        }
      }
    }

    // If there is no final daemon command (e.g. one-shot task service)
    if (!pipeline.finalCommand) {
      callbacks.onStatusChange(service.name, 'stopped', undefined, undefined, 'COMPLETED');
      callbacks.onLog(service.name, {
        id: `done-${service.name}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: service.name,
        message: `✔ All pipeline tasks for "${service.name}" completed successfully.`,
        level: 'info'
      });
      return 0;
    }

    try {
      if (signal?.aborted) return null;
      if (service.port && await this.probeTcpPort(service.port)) {
        const error = `Port ${service.port} is already in use`;
        callbacks.onLog(service.name, {
          id: `port-${service.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: service.name,
          message: `✖ ${error}`,
          level: 'error'
        });
        callbacks.onStatusChange(service.name, 'stopped', undefined, error);
        return null;
      }
      if (signal?.aborted) return null;
      callbacks.onStatusChange(
        service.name,
        'starting',
        undefined,
        undefined,
        pipeline.preCommands.length > 0 ? `STEP ${pipeline.totalSteps}/${pipeline.totalSteps}` : 'STARTING'
      );

      const child = spawn(pipeline.finalCommand, {
        cwd: resolvedCwd,
        shell: true,
        env: {
          ...process.env,
          ...customEnv,
          ...getChildColorEnvironment()
        },
        detached: process.platform !== 'win32'
      });

      const pid = child.pid;
      if (!pid) {
        throw new Error('Failed to obtain PID for spawned process');
      }

      const info: ActiveProcessInfo = {
        child,
        config: service,
        pid,
        stdoutRemainder: '',
        stderrRemainder: '',
        readinessBuffer: '',
        isReady: false
      };

      this.activeProcesses.set(service.name, info);
      callbacks.onStatusChange(service.name, 'running', pid, undefined, 'RUNNING');

      callbacks.onLog(service.name, {
        id: `start-${service.name}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: service.name,
        message: `✔ Started "${service.name}" (PID: ${pid}) in ${service.path}`,
        level: 'info'
      });

      // Stream stdout line-by-line
      child.stdout?.on('data', (chunk: Buffer) => {
        this.checkReadinessPattern(info, chunk.toString());
        info.stdoutRemainder = this.appendOutputChunk(
          service.name,
          info.stdoutRemainder,
          chunk.toString(),
          'info',
          callbacks
        );
      });

      // Stream stderr line-by-line
      child.stderr?.on('data', (chunk: Buffer) => {
        this.checkReadinessPattern(info, chunk.toString());
        info.stderrRemainder = this.appendOutputChunk(
          service.name,
          info.stderrRemainder,
          chunk.toString(),
          'error',
          callbacks
        );
      });

      // Error handler
      child.on('error', (err) => {
        const current = this.activeProcesses.get(service.name);
        if (current && current.child !== child) return;

        callbacks.onLog(service.name, {
          id: `fatal-${service.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: service.name,
          message: `✖ Process error: ${err.message}`,
          level: 'error'
        });
        this.activeProcesses.delete(service.name);
        callbacks.onStatusChange(service.name, 'stopped', undefined, err.message);
      });

      // Exit / Close handler
      child.on('close', (code, signal) => {
        // If processManager now has a different active child for this service, ignore old close
        const current = this.activeProcesses.get(service.name);
        if (current && current.child !== child) {
          return;
        }

        // Flush remaining buffer lines
        if (info.stdoutRemainder.trim()) {
          callbacks.onLog(service.name, {
            id: `out-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: info.stdoutRemainder,
            level: 'info'
          });
          info.stdoutRemainder = '';
        }
        if (info.stderrRemainder.trim()) {
          callbacks.onLog(service.name, {
            id: `err-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: info.stderrRemainder,
            level: 'error'
          });
          info.stderrRemainder = '';
        }

        this.activeProcesses.delete(service.name);

        const exitMsg = code !== null
          ? `Process exited with code ${code}`
          : `Process terminated by signal ${signal}`;

        callbacks.onLog(service.name, {
          id: `exit-${service.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: service.name,
          message: code === 0 ? `■ ${exitMsg}` : `✖ ${exitMsg}`,
          level: code === 0 ? 'info' : 'warn'
        });

        callbacks.onStatusChange(service.name, 'stopped');
      });

      return pid;
    } catch (err: any) {
      callbacks.onLog(service.name, {
        id: `fail-${service.name}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: service.name,
        message: `✖ Failed to spawn command "${service.command}": ${err.message}`,
        level: 'error'
      });
      callbacks.onStatusChange(service.name, 'stopped', undefined, err.message);
      return null;
    }
  }

  private checkReadinessPattern(info: ActiveProcessInfo, chunk: string): void {
    if (info.isReady || !info.config.readyPattern) return;
    info.readinessBuffer = (info.readinessBuffer + chunk).slice(-8192);
    if (info.readinessBuffer.includes(info.config.readyPattern)) info.isReady = true;
  }

  /**
   * Stop a single running service and notify callbacks
   */
  public stopService(
    serviceName: string,
    callbacks?: ProcessCallbacks
  ): Promise<boolean> {
    const info = this.activeProcesses.get(serviceName);
    if (!info) {
      if (callbacks) callbacks.onStatusChange(serviceName, 'stopped');
      return Promise.resolve(false);
    }

    const { child, pid } = info;

    if (callbacks) {
      callbacks.onLog(serviceName, {
        id: `stop-${serviceName}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: serviceName,
        message: `■ Stopping service "${serviceName}" (PID: ${pid})`,
        level: 'info'
      });
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      let escalationTimer: NodeJS.Timeout | undefined;
      let timeoutTimer: NodeJS.Timeout | undefined;
      const done = (stopped: boolean) => {
        if (!resolved) {
          resolved = true;
          if (escalationTimer) clearTimeout(escalationTimer);
          if (timeoutTimer) clearTimeout(timeoutTimer);
          child.off('close', onClose);
          resolve(stopped);
        }
      };
      const onClose = () => done(true);

      child.once('close', onClose);

      // Send SIGTERM to process group
      if (child.exitCode === null && child.signalCode === null) {
        this.killProcessTree(pid, 'SIGTERM');
      }

      // Hard kill fallback after 800ms
      escalationTimer = setTimeout(() => {
        if (!resolved) {
          if (this.isProcessTreeAlive(pid)) {
            this.killProcessTree(pid, 'SIGKILL');
          } else {
            done(true);
            return;
          }
          timeoutTimer = setTimeout(() => {
            if (callbacks) {
              callbacks.onStatusChange(serviceName, 'warning', pid, 'Process did not exit after SIGKILL', 'STOP TIMEOUT');
            }
            done(false);
          }, 1500);
        }
      }, 800);
    });
  }

  /**
   * Restart a service
   */
  public async restartService(
    serviceName: string,
    callbacks: ProcessCallbacks,
    fallbackConfig?: ServiceConfig
  ): Promise<number | null> {
    const config =
      this.activeProcesses.get(serviceName)?.config ||
      fallbackConfig ||
      this.knownConfigs.get(serviceName);

    if (!config) return null;

    callbacks.onStatusChange(serviceName, 'starting');
    callbacks.onLog(serviceName, {
      id: `restarting-${serviceName}-${Date.now()}-${this.logCounter++}`,
      timestamp: this.formatTime(),
      service: serviceName,
      message: `↻ Restarting service "${serviceName}"...`,
      level: 'info'
    });

    // Wait until old process has actually exited
    const stopped = await this.stopService(serviceName, callbacks);
    if (!stopped) return null;
    await new Promise(r => setTimeout(r, 200));

    // Start fresh
    return this.startService(config, callbacks);
  }

  /**
   * Dependency-aware startAll: computes topological tiers and boots services wave-by-wave
   * with pacing (stagger delay) and concurrency throttling to prevent CPU/memory exhaustion.
   */
  public async startAll(
    services: ServiceConfig[], 
    callbacks: ProcessCallbacks,
    settings?: OrchestratorSettings,
    signal?: AbortSignal
  ): Promise<void> {
    for (const service of services) {
      this.knownConfigs.set(service.name, service);
    }

    const autoServices = services.filter(s => s.autoStart !== false);
    if (autoServices.length === 0) return;
    const allServiceNames = new Set(services.map(service => service.name.toLowerCase()));
    const autoServiceNames = new Set(autoServices.map(service => service.name.toLowerCase()));

    const bootStaggerMs = settings?.bootStaggerMs ?? 400;
    const maxConcurrentBoot = Math.max(1, settings?.maxConcurrentBoot ?? 2);

    // Resolve dependency tiers using Kahn's algorithm
    const { tiers, hasCycle, cycleNodes, missingDependencies } = resolveDependencyTiers(autoServices);

    if (hasCycle) {
      const cycleStr = (cycleNodes || []).join(', ');
      for (const s of autoServices) {
        callbacks.onStatusChange(s.name, 'stopped', undefined, 'Cyclic dependency', 'CYCLE ERROR');
        callbacks.onLog(s.name, {
          id: `cycle-${s.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: s.name,
          message: `✖ Cyclic dependency detected among services: ${cycleStr}. Orchestration aborted.`,
          level: 'error'
        });
      }
      return;
    }

    // Check for missing dependencies
    if (missingDependencies.size > 0) {
      for (const [svcName, missing] of missingDependencies.entries()) {
        callbacks.onLog(svcName, {
          id: `missing-dep-${svcName}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: svcName,
          message: `⚠ Warning: Service "${svcName}" references non-existent dependencies: ${missing.join(', ')}`,
          level: 'warn'
        });
      }
    }

    // Mark services with dependencies as WAITING initially
    const failedServices = new Set<string>();
    for (const s of autoServices) {
      if (s.dependsOn && s.dependsOn.length > 0) {
        callbacks.onStatusChange(s.name, 'waiting', undefined, undefined, `WAITING (${s.dependsOn.join(', ')})`);
        callbacks.onLog(s.name, {
          id: `wait-${s.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: s.name,
          message: `⏳ Waiting for dependencies: ${s.dependsOn.join(', ')} to become ready...`,
          level: 'info'
        });
      }
    }

    // Boot tier by tier with concurrency throttling & pacing stagger
    for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
      const tier = tiers[tierIdx]!;
      const readyPromises: Promise<boolean>[] = [];

      // Concurrency slot controller for current tier
      let activeBooting = 0;
      const waitingResolvers: (() => void)[] = [];

      const acquireSlot = async () => {
        if (activeBooting < maxConcurrentBoot) {
          activeBooting++;
          return;
        }
        await new Promise<void>(resolve => waitingResolvers.push(resolve));
        activeBooting++;
      };

      const releaseSlot = () => {
        activeBooting--;
        const next = waitingResolvers.shift();
        if (next) next();
      };

      for (let sIdx = 0; sIdx < tier.length; sIdx++) {
        const service = tier[sIdx]!;

        // Check if any upstream dependency failed
        if (signal?.aborted) return;
        const deps = service.dependsOn || [];
        const failedDep = deps.find(d =>
          failedServices.has(d.toLowerCase()) ||
          !allServiceNames.has(d.toLowerCase()) ||
          !autoServiceNames.has(d.toLowerCase())
        );
        if (failedDep) {
          failedServices.add(service.name.toLowerCase());
          const dependencyIsManual = allServiceNames.has(failedDep.toLowerCase()) &&
            !autoServiceNames.has(failedDep.toLowerCase());
          const reason = dependencyIsManual ? 'is configured for manual start' : 'failed or is missing';
          callbacks.onStatusChange(service.name, 'blocked', undefined, `Dependency ${failedDep} ${reason}`, `BLOCKED (${failedDep})`);
          callbacks.onLog(service.name, {
            id: `blocked-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: `✖ Blocked: Upstream dependency "${failedDep}" ${reason}.`,
            level: 'error'
          });
          continue;
        }

        // Wait for an available concurrency slot before proceeding
        await acquireSlot();
        if (signal?.aborted) {
          releaseSlot();
          return;
        }

        // Stagger spacing between consecutive process spawns in this wave
        if (sIdx > 0 && bootStaggerMs > 0) {
          if (!await this.delay(bootStaggerMs, signal)) {
            releaseSlot();
            return;
          }
        }

        // Start service
        const startPromise = (async () => {
          try {
            const pid = await this.startService(service, callbacks, signal);
            if (pid === null) {
              failedServices.add(service.name.toLowerCase());
              return false;
            }

            // Wait for readiness before downstream tiers can proceed
            const isReady = await this.waitForServiceReady(service, 15000, 250, signal);
            if (!isReady) {
              if (signal?.aborted) return false;
              await this.stopService(service.name, callbacks);
              failedServices.add(service.name.toLowerCase());
              callbacks.onLog(service.name, {
                id: `warn-ready-${service.name}-${Date.now()}-${this.logCounter++}`,
                timestamp: this.formatTime(),
                service: service.name,
                message: `⚠ Service "${service.name}" did not reach ready state. Downstream dependent services will be blocked.`,
                level: 'warn'
              });
            } else {
              callbacks.onLog(service.name, {
                id: `ready-${service.name}-${Date.now()}-${this.logCounter++}`,
                timestamp: this.formatTime(),
                service: service.name,
                message: `✔ Service "${service.name}" is READY${service.port ? ` on port :${service.port}` : ''}.`,
                level: 'info'
              });
            }
            return isReady;
          } finally {
            // Release slot as soon as this service finishes booting/probing so next can spawn
            releaseSlot();
          }
        })();

        readyPromises.push(startPromise);
      }

      // Wait for all services in this tier before launching next tier
      await Promise.all(readyPromises);
    }
  }

  /**
   * Asynchronously stop all active processes
   */
  public async stopAll(): Promise<void> {
    const serviceNames = Array.from(this.activeProcesses.keys());
    const results = await Promise.all(serviceNames.map(async name => {
      const stopped = await this.stopService(name);
      return stopped || !this.activeProcesses.has(name);
    }));
    if (results.some(stopped => !stopped)) {
      throw new Error('One or more child processes did not stop');
    }
  }

  /**
   * Synchronous stop for process.on('exit') and SIGINT handlers
   */
  public stopAllSync(): void {
    const pids = Array.from(this.activeProcesses.values()).map(info => info.pid);
    this.activeProcesses.clear();

    for (const pid of pids) {
      this.killProcessTree(pid, 'SIGKILL');
    }
  }

  /**
   * Check if service is currently running
   */
  public isRunning(serviceName: string): boolean {
    return this.activeProcesses.has(serviceName);
  }

  /**
   * Get PID of a running service
   */
  public getPid(serviceName: string): number | undefined {
    return this.activeProcesses.get(serviceName)?.pid;
  }

  /**
   * Get active processes map
   */
  public getActiveProcesses(): Map<string, number> {
    const map = new Map<string, number>();
    for (const [name, info] of this.activeProcesses.entries()) {
      map.set(name, info.pid);
    }
    return map;
  }
}

export const processManager = new ProcessManager();
