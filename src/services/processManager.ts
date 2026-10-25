import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { ServiceConfig } from '../types/config.js';
import { LogEntry, ProcessCallbacks, ServiceStatus } from '../types/index.js';
import { logger } from '../logger/logger.js';

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
   * Start a single service
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

    try {
      const child = spawn(service.command, {
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
      callbacks.onStatusChange(service.name, 'running', pid);

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
   * Start all services where autoStart !== false
   */
  public startAll(services: ServiceConfig[], callbacks: ProcessCallbacks): void {
    for (const service of services) {
      this.knownConfigs.set(service.name, service);
      if (service.autoStart !== false) {
        this.startService(service, callbacks);
      }
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
