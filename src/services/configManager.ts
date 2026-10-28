import fs from 'fs';
import path from 'path';
import { DevPulseConfig, ServiceConfig } from '../types/config.js';
import { logger } from '../logger/logger.js';

export const CONFIG_FILENAMES = [
  'config.devpulse.json',
  'devpulse.config.json',
  'devpulse.json',
  '.devpulserc.json',
  '.devpulserc',
  '.devpulse.json'
];

export interface CliArgs {
  configPath?: string;
}

export interface ConfigFileSummary {
  path: string;
  filename: string;
  name: string;
  version?: string;
  servicesCount: number;
  services: Array<{ name: string; port?: number; command: string }>;
  isValid: boolean;
  error?: string;
}

/**
 * Parse command line arguments for configuration path flags:
 * -c <path>, --config <path>, --config=<path>, or positional <file>.json / <file>.devpulse.json
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  let configPath: string | undefined;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === '-c' || arg === '--config') {
      if (argv[i + 1] && !argv[i + 1]?.startsWith('-')) {
        configPath = argv[i + 1];
        i++;
      }
    } else if (arg.startsWith('--config=')) {
      configPath = arg.slice('--config='.length);
    } else if (!arg.startsWith('-') && (arg.endsWith('.json') || arg.includes('devpulse'))) {
      configPath = arg;
    }
  }

  return { configPath };
}

/**
 * Find all available DevPulse configuration files in the directory.
 * Matches priority static filenames and any `*.devpulse.json` files.
 */
export function findAllConfigFiles(cwd: string = process.cwd()): string[] {
  const found = new Set<string>();

  // 1. Priority static filenames
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.resolve(cwd, filename);
    if (fs.existsSync(fullPath)) {
      try {
        if (fs.statSync(fullPath).isFile()) {
          found.add(fullPath);
        }
      } catch {}
    }
  }

  // 2. Dynamic pattern matching: scan cwd for any `*.devpulse.json` file
  try {
    if (fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()) {
      const entries = fs.readdirSync(cwd);
      const dynamicMatches = entries
        .filter(entry => /^.+\.devpulse\.json$/i.test(entry))
        .sort((a, b) => {
          if (a.toLowerCase() === 'config.devpulse.json') return -1;
          if (b.toLowerCase() === 'config.devpulse.json') return 1;
          return a.localeCompare(b);
        });

      for (const match of dynamicMatches) {
        const fullPath = path.resolve(cwd, match);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          found.add(fullPath);
        }
      }
    }
  } catch {}

  return Array.from(found);
}

/**
 * Retrieve metadata summaries for all configuration files in the workspace.
 */
export function getConfigFileSummaries(cwd: string = process.cwd()): ConfigFileSummary[] {
  const filePaths = findAllConfigFiles(cwd);
  return filePaths.map(filePath => {
    const filename = path.basename(filePath);
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(raw) as DevPulseConfig;
      if (parsed && Array.isArray(parsed.services)) {
        return {
          path: filePath,
          filename,
          name: parsed.name || filename.replace(/\.devpulse\.json$/i, ''),
          version: parsed.version,
          servicesCount: parsed.services.length,
          services: parsed.services.map(s => ({
            name: s.name,
            port: s.port,
            command: s.command
          })),
          isValid: true
        };
      }
      return {
        path: filePath,
        filename,
        name: filename,
        servicesCount: 0,
        services: [],
        isValid: false,
        error: 'Missing services array'
      };
    } catch (err: any) {
      return {
        path: filePath,
        filename,
        name: filename,
        servicesCount: 0,
        services: [],
        isValid: false,
        error: err?.message || 'JSON parse error'
      };
    }
  });
}

/**
 * Check if a DevPulse configuration file exists in the directory or at the given path.
 */
export function hasConfigFile(cwdOrPath: string = process.cwd()): boolean {
  return getConfigFilePath(cwdOrPath) !== null;
}

/**
 * Locate the path to an existing config file in the directory or verify direct file path.
 * Supports standard names as well as any dynamic `(anyname).devpulse.json` pattern.
 */
export function getConfigFilePath(cwdOrPath: string = process.cwd()): string | null {
  // If target path is directly an existing file, resolve and return it
  try {
    if (fs.existsSync(cwdOrPath) && fs.statSync(cwdOrPath).isFile()) {
      return path.resolve(cwdOrPath);
    }
  } catch {}

  const cwd = cwdOrPath;

  // 1. Check priority static filenames first
  for (const filename of CONFIG_FILENAMES) {
    const fullPath = path.resolve(cwd, filename);
    if (fs.existsSync(fullPath)) {
      try {
        if (fs.statSync(fullPath).isFile()) {
          return fullPath;
        }
      } catch {}
    }
  }

  // 2. Dynamic pattern matching: scan cwd for any `*.devpulse.json` file
  try {
    if (fs.existsSync(cwd) && fs.statSync(cwd).isDirectory()) {
      const entries = fs.readdirSync(cwd);
      const dynamicMatches = entries
        .filter(entry => /^.+\.devpulse\.json$/i.test(entry))
        .sort((a, b) => {
          if (a.toLowerCase() === 'config.devpulse.json') return -1;
          if (b.toLowerCase() === 'config.devpulse.json') return 1;
          return a.localeCompare(b);
        });

      for (const match of dynamicMatches) {
        const fullPath = path.resolve(cwd, match);
        if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
          return fullPath;
        }
      }
    }
  } catch {}

  return null;
}

/**
 * Load and parse the DevPulse config file from a directory or specific path.
 */
export function loadConfigFile(cwdOrPath: string = process.cwd()): DevPulseConfig | null {
  const filePath = getConfigFilePath(cwdOrPath);
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
 * Save configuration to devpulse.config.json or the active configuration file in the directory.
 */
export function saveConfigFile(
  config: DevPulseConfig,
  cwd: string = process.cwd(),
  customFilePath?: string
): string {
  logger.info(JSON.stringify(config));
  const targetPath = customFilePath
    ? (path.isAbsolute(customFilePath) ? customFilePath : path.resolve(cwd, customFilePath))
    : (getConfigFilePath(cwd) || path.resolve(cwd, 'config.devpulse.json'));
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

