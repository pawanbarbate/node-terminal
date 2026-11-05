import { spawn } from 'child_process';
import { LogEntry, Service } from '../types/index.js';

/**
 * Generate OSC 52 terminal clipboard escape sequence
 */
export function getOsc52Sequence(text: string): string {
  const base64 = Buffer.from(text, 'utf8').toString('base64');
  return `\x1b]52;c;${base64}\x07`;
}

/**
 * Copy text to system clipboard using native OS commands
 */
export function copyViaOsCommand(text: string): Promise<boolean> {
  return new Promise((resolve) => {
    const platform = process.platform;
    let cmd = '';
    let args: string[] = [];

    if (platform === 'darwin') {
      cmd = 'pbcopy';
      args = [];
    } else if (platform === 'win32') {
      cmd = 'clip.exe';
      args = [];
    } else {
      // Linux: Try wl-copy (Wayland), xclip (X11), or xsel
      if (process.env.WAYLAND_DISPLAY) {
        cmd = 'wl-copy';
      } else {
        cmd = 'xclip';
        args = ['-selection', 'clipboard'];
      }
    }

    try {
      const child = spawn(cmd, args, { stdio: ['pipe', 'ignore', 'ignore'] });
      
      child.on('error', () => {
        // Fallback for Linux if xclip failed, try xsel
        if (platform === 'linux' && cmd === 'xclip') {
          try {
            const fallback = spawn('xsel', ['--clipboard', '--input'], { stdio: ['pipe', 'ignore', 'ignore'] });
            fallback.on('error', () => resolve(false));
            fallback.on('close', (code) => resolve(code === 0));
            fallback.stdin?.write(text);
            fallback.stdin?.end();
            return;
          } catch {
            return resolve(false);
          }
        }
        resolve(false);
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.stdin?.write(text);
      child.stdin?.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Universal dual-engine clipboard writer:
 * 1. Writes OSC 52 escape code to stdout (works across SSH, tmux, modern terminals)
 * 2. Asynchronously writes to OS native clipboard (pbcopy, xclip, clip.exe)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (!text) return false;

  // 1. Emit OSC 52 sequence directly to stdout
  try {
    const osc52 = getOsc52Sequence(text);
    process.stdout.write(osc52);
  } catch {}

  // 2. Concurrently execute OS clipboard command
  const osSuccess = await copyViaOsCommand(text);
  return osSuccess || true;
}

/**
 * Format a single LogEntry into clean, shareable plain text
 */
export function formatLogEntry(log: LogEntry, serviceName?: string): string {
  const svc = serviceName || log.service || 'unknown';
  const lvl = (log.level || 'info').toUpperCase();
  const time = log.timestamp || new Date().toLocaleTimeString();
  return `[${time}] [${svc}] [${lvl}] ${log.message}`;
}

/**
 * Format a service's full status summary into a shareable report
 */
export function formatServiceErrorSummary(service: Service): string {
  const lines: string[] = [
    `=== DevPulse Service Report: ${service.name} ===`,
    `Status: ${service.status.toUpperCase()}${service.statusText ? ` (${service.statusText})` : ''}`,
    `Command: ${Array.isArray(service.command) ? service.command.join(' && ') : service.command}`,
    `Directory: ${service.path || '.'}`,
    service.port ? `Port: ${service.port}` : null,
    service.pid ? `PID: ${service.pid}` : null,
    service.uptime !== undefined ? `Uptime: ${service.uptime}s` : null,
    service.restarts !== undefined ? `Restarts: ${service.restarts}` : null,
    service.errors !== undefined ? `Error Count: ${service.errors}` : null,
    service.lastError ? `\nLast Error:\n${service.lastError}` : null
  ].filter(Boolean) as string[];

  if (service.errorLogs && service.errorLogs.length > 0) {
    lines.push('\nRecent Error Logs:');
    service.errorLogs.slice(-5).forEach((err) => {
      lines.push(`  [${err.timestamp}] ${err.message}`);
    });
  }

  return lines.join('\n');
}

/**
 * Format all error logs of a service into a formatted code block
 */
export function formatAllErrors(service: Service): string {
  const errors = service.errorLogs || [];
  if (errors.length === 0) {
    if (service.lastError) {
      return `[${service.name}] ${service.lastError}`;
    }
    return `[${service.name}] No recorded errors.`;
  }

  const header = `=== DevPulse Error Log Dump: ${service.name} (${errors.length} error${errors.length === 1 ? '' : 's'}) ===\n`;
  const body = errors
    .map((err, i) => `#${i + 1} [${err.timestamp}] [${(err.level || 'ERROR').toUpperCase()}]:\n${err.message}`)
    .join('\n\n');
  return header + body;
}

