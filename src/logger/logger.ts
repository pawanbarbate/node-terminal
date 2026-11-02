
import fs from "node:fs";
import path from "node:path";

const logDir = path.join(process.cwd(), "logs");
const logFile = path.join(logDir, "app.log");
const previousLogFile = `${logFile}.1`;
const maxLogFileBytes = 5 * 1024 * 1024;
const maxLogEntryBytes = 64 * 1024;

fs.mkdirSync(logDir, { recursive: true });

let writeQueue = Promise.resolve();

async function appendBoundedLog(entry: string): Promise<void> {
  const encoded = Buffer.from(entry);
  const suffix = "\n[log entry truncated]\n";
  const truncatedEntry = encoded.byteLength <= maxLogEntryBytes
    ? entry
    : `${encoded.subarray(0, maxLogEntryBytes - Buffer.byteLength(suffix) - 4).toString("utf8")}${suffix}`;

  let currentSize = 0;
  try {
    currentSize = (await fs.promises.stat(logFile)).size;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  if (currentSize + Buffer.byteLength(truncatedEntry) > maxLogFileBytes) {
    try {
      await fs.promises.unlink(previousLogFile);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (currentSize > maxLogFileBytes) {
      const handle = await fs.promises.open(logFile, "r");
      try {
        const tail = Buffer.alloc(maxLogFileBytes);
        const { bytesRead } = await handle.read(tail, 0, tail.length, currentSize - maxLogFileBytes);
        await fs.promises.writeFile(previousLogFile, tail.subarray(0, bytesRead));
      } finally {
        await handle.close();
      }
      await fs.promises.truncate(logFile, 0);
    } else {
      try {
        await fs.promises.rename(logFile, previousLogFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
    }
  }

  await fs.promises.appendFile(logFile, truncatedEntry);
}

function writeLog(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] [${level}] ${message}\n`;

  writeQueue = writeQueue
    .then(() => appendBoundedLog(log))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to write log:", message);
    });
}

export const logger = {
  info: (message: string) => writeLog("INFO", message),
  warn: (message: string) => writeLog("WARN", message),
  error: (message: string) => writeLog("ERROR", message),
  flush: () => writeQueue,
};
