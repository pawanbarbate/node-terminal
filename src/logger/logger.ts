
import fs from "node:fs";
import path from "node:path";

const logDir = path.join(process.cwd(), "logs");
const logFile = path.join(logDir, "app.log");

fs.mkdirSync(logDir, { recursive: true });

function writeLog(level: string, message: string): void {
  const timestamp = new Date().toISOString();
  const log = `[${timestamp}] [${level}] ${message}\n`;

  fs.appendFile(logFile, log, (err) => {
    if (err) {
      console.error("Failed to write log:", err.message);
    }
  });
}

export const logger = {
  info: (message: string) => writeLog("INFO", message),
  warn: (message: string) => writeLog("WARN", message),
  error: (message: string) => writeLog("ERROR", message),
};
