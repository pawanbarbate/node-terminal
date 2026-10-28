import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import net from 'net';
import { ServiceConfig } from '../types/config.js';
import { LogEntry, ProcessCallbacks, ServiceStatus } from '../types/index.js';
import { logger } from '../logger/logger.js';
import { normalizeServiceCommands, resolveDependencyTiers } from './dependencyGraph.js';

interface ActiveProcessInfo {
  child: ChildProcess;
  config: ServiceConfig;
  pid: number;
  stdoutRemainder: string;
  stderrRemainder: string;
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

  /**
   * Kill an entire process group cleanly across POSIX and Windows
   */
  private killProcessTree(pid: number, signal: NodeJS.Signals = 'SIGTERM') {
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process');
        execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
      } catch {}
    } else {
      try {
        // Negative PID targets the entire process group
        process.kill(-pid, signal);
      } catch (err: any) {
        if (err.code !== 'ESRCH') {
          try {
            process.kill(pid, signal);
          } catch {}
        }
      }
    }
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
    callbacks: ProcessCallbacks
  ): Promise<{ exitCode: number | null }> {
    return new Promise((resolve) => {
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
        env: {
          ...process.env,
          ...env,
          FORCE_COLOR: '1'
        }
      });

      let stdoutRemainder = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        stdoutRemainder += chunk.toString();
        const lines = stdoutRemainder.split(/\r?\n/);
        stdoutRemainder = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          callbacks.onLog(service.name, {
            id: `out-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: `  ${line}`,
            level: 'info'
          });
        }
      });

      let stderrRemainder = '';
      child.stderr?.on('data', (chunk: Buffer) => {
        stderrRemainder += chunk.toString();
        const lines = stderrRemainder.split(/\r?\n/);
        stderrRemainder = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          callbacks.onLog(service.name, {
            id: `err-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: `  ${line}`,
            level: 'error'
          });
        }
      });

      child.on('close', (code) => {
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
        callbacks.onLog(service.name, {
          id: `step-err-${service.name}-${Date.now()}-${this.logCounter++}`,
          timestamp: this.formatTime(),
          service: service.name,
          message: `[Step ${stepIndex + 1}/${totalSteps}] ✖ Execution error: ${err.message}`,
          level: 'error'
        });
        resolve({ exitCode: -1 });
      });
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
    pollIntervalMs = 250
  ): Promise<boolean> {
    const startTime = Date.now();

    // If service has a configured port, wait until the TCP port is listening
    if (service.port && typeof service.port === 'number') {
      while (Date.now() - startTime < timeoutMs) {
        if (!this.activeProcesses.has(service.name)) {
          return false;
        }
        const isOpen = await this.probeTcpPort(service.port);
        if (isOpen) {
          return true;
        }
        await new Promise(r => setTimeout(r, pollIntervalMs));
      }
      return false;
    }

    // Default: verify process spawned and running
    await new Promise(r => setTimeout(r, 400));
    return this.activeProcesses.has(service.name);
  }

  /**
   * Start a single service (executing pre-commands sequentially, then spawning the persistent daemon)
   */
  public async startService(
    service: ServiceConfig,
    callbacks: ProcessCallbacks
  ): Promise<number | null> {
    this.knownConfigs.set(service.name, service);

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

    callbacks.onStatusChange(service.name, 'starting');

    // Parse env file if specified
    const customEnv: Record<string, string> = {};
    if (service.envFile) {
      const envPath = path.resolve(resolvedCwd, service.envFile);
      if (fs.existsSync(envPath)) {
        try {
          const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
              const [k, ...v] = trimmed.split('=');
              customEnv[k.trim()] = v.join('=').trim();
            }
          }
        } catch {}
      }
    }

    // Normalize command pipeline
    const pipeline = normalizeServiceCommands(service);

    // Execute pre-flight commands sequentially if any exist
    if (pipeline.preCommands.length > 0) {
      for (let i = 0; i < pipeline.preCommands.length; i++) {
        const cmd = pipeline.preCommands[i]!;
        const res = await this.runPreCommand(service, cmd, i, pipeline.totalSteps, resolvedCwd, customEnv, callbacks);
        if (res.exitCode !== 0) {
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
          FORCE_COLOR: '1'
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
        stderrRemainder: ''
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
        info.stdoutRemainder += chunk.toString();
        const lines = info.stdoutRemainder.split(/\r?\n/);
        info.stdoutRemainder = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          callbacks.onLog(service.name, {
            id: `out-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: line,
            level: 'info'
          });
        }
      });

      // Stream stderr line-by-line
      child.stderr?.on('data', (chunk: Buffer) => {
        info.stderrRemainder += chunk.toString();
        const lines = info.stderrRemainder.split(/\r?\n/);
        info.stderrRemainder = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          callbacks.onLog(service.name, {
            id: `err-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: line,
            level: 'error'
          });
        }
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
    this.activeProcesses.delete(serviceName);

    if (callbacks) {
      callbacks.onStatusChange(serviceName, 'stopped');
      callbacks.onLog(serviceName, {
        id: `stop-${serviceName}-${Date.now()}-${this.logCounter++}`,
        timestamp: this.formatTime(),
        service: serviceName,
        message: `■ Stopped service "${serviceName}" (PID: ${pid})`,
        level: 'info'
      });
    }

    return new Promise<boolean>((resolve) => {
      let resolved = false;
      const done = () => {
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      };

      if (child.exitCode !== null || child.killed) {
        done();
        return;
      }

      child.once('close', done);
      child.once('exit', done);

      // Send SIGTERM to process group
      this.killProcessTree(pid, 'SIGTERM');

      // Hard kill fallback after 800ms
      setTimeout(() => {
        if (!resolved) {
          try {
            process.kill(pid, 0);
            this.killProcessTree(pid, 'SIGKILL');
          } catch {}
          setTimeout(done, 150);
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
    await this.stopService(serviceName, callbacks);
    await new Promise(r => setTimeout(r, 200));

    // Start fresh
    return this.startService(config, callbacks);
  }

  /**
   * Dependency-aware startAll: computes topological tiers and boots services wave-by-wave
   */
  public async startAll(services: ServiceConfig[], callbacks: ProcessCallbacks): Promise<void> {
    for (const service of services) {
      this.knownConfigs.set(service.name, service);
    }

    const autoServices = services.filter(s => s.autoStart !== false);
    if (autoServices.length === 0) return;

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

    // Boot tier by tier
    for (let tierIdx = 0; tierIdx < tiers.length; tierIdx++) {
      const tier = tiers[tierIdx]!;
      const readyPromises: Promise<boolean>[] = [];

      for (const service of tier) {
        // Check if any upstream dependency failed
        const deps = service.dependsOn || [];
        const failedDep = deps.find(d => failedServices.has(d.toLowerCase()));
        if (failedDep) {
          failedServices.add(service.name.toLowerCase());
          callbacks.onStatusChange(service.name, 'blocked', undefined, `Dependency ${failedDep} failed`, `BLOCKED (${failedDep})`);
          callbacks.onLog(service.name, {
            id: `blocked-${service.name}-${Date.now()}-${this.logCounter++}`,
            timestamp: this.formatTime(),
            service: service.name,
            message: `✖ Blocked: Upstream dependency "${failedDep}" failed to start.`,
            level: 'error'
          });
          continue;
        }

        // Start service
        const startPromise = (async () => {
          const pid = await this.startService(service, callbacks);
          if (pid === null) {
            failedServices.add(service.name.toLowerCase());
            return false;
          }

          // Wait for readiness before downstream tiers can proceed
          const isReady = await this.waitForServiceReady(service);
          if (!isReady) {
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
    const pids = Array.from(this.activeProcesses.values()).map(info => info.pid);
    this.activeProcesses.clear();

    for (const pid of pids) {
      this.killProcessTree(pid, 'SIGTERM');
    }

    await new Promise(r => setTimeout(r, 200));

    for (const pid of pids) {
      try {
        process.kill(pid, 0);
        this.killProcessTree(pid, 'SIGKILL');
      } catch {}
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
