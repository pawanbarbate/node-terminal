
import fs from "node:fs";
import path from "node:path";

const logDir = path.join(process.cwd(), "logs");
const logFile = path.join(logDir, "app.log");
let dirChecked = false;

function ensureLogDir(): void {
  if (dirChecked) return;
  try {
    fs.mkdirSync(logDir, { recursive: true });
    dirChecked = true;
  } catch {
    // Silently continue if directory cannot be created (e.g., read-only filesystem)
  }
}

function writeLog(level: string, message: string): void {
  ensureLogDir();
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] [${level}] ${message}\n`;

  try {
    fs.appendFile(logFile, log, () => {
      // Intentionally silent on error to prevent corrupting the TUI terminal screen
    });
  } catch {
    // Ignore synchronous write errors
  }
}

export const logger = {
  info: (message: string) => writeLog("INFO", message),
  warn: (message: string) => writeLog("WARN", message),
  error: (message: string) => writeLog("ERROR", message),
};
