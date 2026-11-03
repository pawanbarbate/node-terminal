
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function resolveLogDir(): string {
  if (process.env.DEVPULSE_LOG_DIR) {
    return path.resolve(process.env.DEVPULSE_LOG_DIR);
  }
  try {
    const home = os.homedir();
    if (home) {
      return path.join(home, ".devpulse", "logs");
    }
  } catch {}
  return path.join(os.tmpdir(), "devpulse", "logs");
}

export function getLogDir(): string {
  return resolveLogDir();
}

export function getLogFilePath(): string {
  return path.join(resolveLogDir(), "app.log");
}

const maxLogFileBytes = 5 * 1024 * 1024;
const maxLogEntryBytes = 64 * 1024;

let writeQueue = Promise.resolve();

async function appendBoundedLog(entry: string): Promise<void> {
  const logDir = resolveLogDir();
  const logFile = path.join(logDir, "app.log");
  const previousLogFile = `${logFile}.1`;

  try {
    await fs.promises.mkdir(logDir, { recursive: true });
  } catch {}

  const encoded = Buffer.from(entry);
  const suffix = "\n[log entry truncated]\n";
  const truncatedEntry = encoded.byteLength <= maxLogEntryBytes
    ? entry
    : `${encoded.subarray(0, maxLogEntryBytes - Buffer.byteLength(suffix) - 4).toString("utf8")}${suffix}`;

  let currentSize = 0;
  try {
    currentSize = (await fs.promises.stat(logFile)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
  }

  if (currentSize + Buffer.byteLength(truncatedEntry) > maxLogFileBytes) {
    try {
      await fs.promises.unlink(previousLogFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
    }
    if (currentSize > maxLogFileBytes) {
      try {
        const handle = await fs.promises.open(logFile, "r");
        try {
          const tail = Buffer.alloc(maxLogFileBytes);
          const { bytesRead } = await handle.read(tail, 0, tail.length, currentSize - maxLogFileBytes);
          await fs.promises.writeFile(previousLogFile, tail.subarray(0, bytesRead));
        } finally {
          await handle.close();
        }
        await fs.promises.truncate(logFile, 0);
      } catch {}
    } else {
      try {
        await fs.promises.rename(logFile, previousLogFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") return;
      }
    }
  }

  try {
    await fs.promises.appendFile(logFile, truncatedEntry);
  } catch {}
}

function writeLog(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] [${level}] ${message}\n`;

  writeQueue = writeQueue
    .then(() => appendBoundedLog(log))
    .catch(() => {
      // Silently swallow write failures to prevent corrupting active terminal UI
    });
}

export const logger = {
  info: (message: string) => writeLog("INFO", message),
  warn: (message: string) => writeLog("WARN", message),
  error: (message: string) => writeLog("ERROR", message),
  flush: () => writeQueue,
  getLogDir,
  getLogFilePath
};
