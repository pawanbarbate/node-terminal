import fs from 'fs';
import path from 'path';
import { DevPulseConfig, ServiceConfig } from '../types/config.js';
import { logger } from '../logger/logger.js';

export const CONFIG_FILENAMES = [
  'devpulse.config.json',
  '.devpulserc.json',
  '.devpulse.json'
];

/**
 * Check if a DevPulse configuration file exists in the directory.
 */
export function hasConfigFile(cwd: string = process.cwd()): boolean {
  return getConfigFilePath(cwd) !== null;
}

/**
 * Locate the path to an existing config file in the directory.
 */
export function getConfigFilePath(cwd: string = process.cwd()): string | null {
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.resolve(cwd, filename);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Load and parse the DevPulse config file.
 */
export function loadConfigFile(cwd: string = process.cwd()): DevPulseConfig | null {
  const filePath = getConfigFilePath(cwd);
  if (!filePath) return null;

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as DevPulseConfig;
    if (parsed && Array.isArray(parsed.services)) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.error(`Failed to parse config at ${filePath}:`, err);
    return null;
  }
}

/**
 * Save configuration to devpulse.config.json in the directory.
 */
export function saveConfigFile(config: DevPulseConfig, cwd: string = process.cwd()): string {
  const targetPath = path.resolve(cwd, 'devpulse.config.json');
  const payload = {
    $schema: 'https://devpulse.dev/schema.json',
    name: config.name || path.basename(cwd) || 'Workspace',
    version: config.version || '1.0.0',
    services: config.services
  };

  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf-8');
  return targetPath;
}

/**
 * Validate whether a relative or absolute folder exists and is a directory.
 */
export function validateDirectory(dirPath: string, cwd: string = process.cwd()): boolean {
  try {
    const fullPath = path.isAbsolute(dirPath) ? dirPath : path.resolve(cwd, dirPath);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  } catch {
    return false;
  }
}

/**
 * Auto-detect services in the workspace (microservices, monorepos, fullstack apps).
 */
export function autoDetectServices(cwd: string = process.cwd()): Partial<ServiceConfig>[] {
  const detected: Partial<ServiceConfig>[] = [];
  const searchDirs = ['services', 'apps', 'packages', 'backend', 'frontend', 'server', 'client'];

  let assignedPort = 3001;

  for (const dirName of searchDirs) {
    const parentDir = path.resolve(cwd, dirName);
    if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) {
      continue;
    }

    try {
      const entries = fs.readdirSync(parentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const subDirPath = path.join(parentDir, entry.name);
        const relPath = `./${path.relative(cwd, subDirPath)}`;

        // Check for Node / package.json
        const pkgPath = path.join(subDirPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
          let command = 'npm run dev';
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.scripts) {
              if (pkg.scripts.dev) command = 'npm run dev';
              else if (pkg.scripts.start) command = 'npm start';
            }
          } catch {}

          detected.push({
            name: entry.name,
            path: relPath,
            command,
            port: assignedPort++,
            autoStart: true
          });
          continue;
        }

        // Check for Cargo / Rust
        if (fs.existsSync(path.join(subDirPath, 'Cargo.toml'))) {
          detected.push({
            name: entry.name,
            path: relPath,
            command: 'cargo run',
            port: assignedPort++,
            autoStart: true
          });
          continue;
        }

        // Check for Python
        if (
          fs.existsSync(path.join(subDirPath, 'requirements.txt')) ||
          fs.existsSync(path.join(subDirPath, 'main.py')) ||
          fs.existsSync(path.join(subDirPath, 'app.py'))
        ) {
          detected.push({
            name: entry.name,
            path: relPath,
            command: 'python main.py',
            port: assignedPort++,
            autoStart: true
          });
          continue;
        }

        // Check for Go
        if (fs.existsSync(path.join(subDirPath, 'go.mod'))) {
          detected.push({
            name: entry.name,
            path: relPath,
            command: 'go run .',
            port: assignedPort++,
            autoStart: true
          });
        }
      }
    } catch {}
  }

  // If no subfolder services found, check if root folder has a package.json or service
  if (detected.length === 0) {
    const rootPkg = path.resolve(cwd, 'package.json');
    if (fs.existsSync(rootPkg)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(rootPkg, 'utf-8'));
        const name = pkg.name || path.basename(cwd) || 'main-app';
        let command = 'npm run dev';
        if (pkg.scripts?.dev) command = 'npm run dev';
        else if (pkg.scripts?.start) command = 'npm start';

        detected.push({
          name,
          path: '.',
          command,
          port: 3000,
          autoStart: true
        });
      } catch {}
    }
  }

  return detected;
}

