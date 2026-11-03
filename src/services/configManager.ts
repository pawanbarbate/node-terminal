import fs from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { CONFIG_SCHEMA_URL, DevPulseConfig, ServiceConfig } from '../types/config.js';
import { logger } from '../logger/logger.js';
import { resolveDependencyTiers } from './dependencyGraph.js';

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
  help?: boolean;
  version?: boolean;
}

export interface ConfigFileSummary {
  path: string;
  filename: string;
  name: string;
  version?: string;
  servicesCount: number;
  services: Array<{ name: string; port?: number; command: string | string[] }>;
  isValid: boolean;
  error?: string;
}

export function validateConfig(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Configuration must be a JSON object'];
  }

  const config = value as Record<string, unknown>;
  const errors: string[] = [];
  if (config.$schema !== undefined && typeof config.$schema !== 'string') {
    errors.push('$schema must be a string');
  }
  if (config.name !== undefined && typeof config.name !== 'string') {
    errors.push('name must be a string');
  }
  if (config.version !== undefined && typeof config.version !== 'string') {
    errors.push('version must be a string');
  }
  if (!Array.isArray(config.services)) {
    return [...errors, 'services must be an array'];
  }

  const services: ServiceConfig[] = [];
  const names = new Set<string>();
  config.services.forEach((value, index) => {
    const prefix = `services[${index}]`;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      errors.push(`${prefix} must be an object`);
      return;
    }

    const service = value as Record<string, unknown>;
    if (typeof service.name !== 'string' || !service.name.trim()) {
      errors.push(`${prefix}.name must be a non-empty string`);
    } else {
      const normalizedName = service.name.trim().toLowerCase();
      if (names.has(normalizedName)) errors.push(`${prefix}.name duplicates "${service.name}"`);
      names.add(normalizedName);
    }
    if (typeof service.path !== 'string' || !service.path.trim()) {
      errors.push(`${prefix}.path must be a non-empty string`);
    }
    if (service.command !== undefined &&
        typeof service.command !== 'string' && !Array.isArray(service.command)) {
      errors.push(`${prefix}.command must be a string or an array of strings`);
    }
    if (typeof service.command === 'string' && !service.command.trim()) {
      errors.push(`${prefix}.command must be a non-empty string`);
    }

    const hasCommand = typeof service.command === 'string'
      ? Boolean(service.command.trim())
      : Array.isArray(service.command) && service.command.length > 0 &&
        service.command.every(command => typeof command === 'string' && command.trim().length > 0);
    if (Array.isArray(service.command) &&
        !service.command.every(command => typeof command === 'string' && command.trim().length > 0)) {
      errors.push(`${prefix}.command must contain only non-empty strings`);
    }
    const hasCommandPipeline = Array.isArray(service.commands) &&
      service.commands.length > 0 &&
      service.commands.every(command => typeof command === 'string' && command.trim().length > 0);
    const hasPreStart = Array.isArray(service.preStart) && service.preStart.length > 0 &&
      service.preStart.every(command => typeof command === 'string' && command.trim().length > 0);
    if (!hasCommand && !hasCommandPipeline && !hasPreStart) {
      errors.push(`${prefix} must define a non-empty command, commands, or preStart pipeline`);
    }
    if (service.commands !== undefined && !Array.isArray(service.commands)) {
      errors.push(`${prefix}.commands must be an array of non-empty strings`);
    }
    if (Array.isArray(service.commands) &&
        (service.commands.length === 0 ||
          !service.commands.every(command => typeof command === 'string' && command.trim().length > 0))) {
      errors.push(`${prefix}.commands must contain only non-empty strings`);
    }
    if (service.preStart !== undefined && !Array.isArray(service.preStart)) {
      errors.push(`${prefix}.preStart must be an array of non-empty strings`);
    }
    if (Array.isArray(service.preStart) &&
        (service.preStart.length === 0 ||
          !service.preStart.every(command => typeof command === 'string' && command.trim().length > 0))) {
      errors.push(`${prefix}.preStart must contain only non-empty strings`);
    }
    if (service.dependsOn !== undefined &&
        (!Array.isArray(service.dependsOn) ||
          !service.dependsOn.every(dependency => typeof dependency === 'string' && dependency.trim().length > 0))) {
      errors.push(`${prefix}.dependsOn must contain non-empty service names`);
    }
    if (service.port !== undefined &&
        (typeof service.port !== 'number' || !Number.isInteger(service.port) || service.port < 1 || service.port > 65535)) {
      errors.push(`${prefix}.port must be an integer from 1 to 65535`);
    }
    if (service.autoStart !== undefined && typeof service.autoStart !== 'boolean') {
      errors.push(`${prefix}.autoStart must be a boolean`);
    }
    if (service.readyPattern !== undefined && typeof service.readyPattern !== 'string') {
      errors.push(`${prefix}.readyPattern must be a string`);
    }

    const graphCommand = typeof service.command === 'string'
      ? service.command
      : Array.isArray(service.command)
        ? service.command.filter((command): command is string => typeof command === 'string')
        : '';
    const graphDependencies = Array.isArray(service.dependsOn)
      ? service.dependsOn.filter((dependency): dependency is string => typeof dependency === 'string')
      : undefined;
    services.push({
      name: typeof service.name === 'string' ? service.name : '',
      path: typeof service.path === 'string' ? service.path : '',
      command: graphCommand,
      dependsOn: graphDependencies
    });
  });

  if (config.settings !== undefined) {
    if (!config.settings || typeof config.settings !== 'object' || Array.isArray(config.settings)) {
      errors.push('settings must be an object');
    } else {
      const settings = config.settings as Record<string, unknown>;
      if (settings.bootStaggerMs !== undefined &&
          (typeof settings.bootStaggerMs !== 'number' ||
            !Number.isInteger(settings.bootStaggerMs) || settings.bootStaggerMs < 0)) {
        errors.push('settings.bootStaggerMs must be a non-negative integer');
      }
      if (settings.maxConcurrentBoot !== undefined &&
          (typeof settings.maxConcurrentBoot !== 'number' ||
            !Number.isInteger(settings.maxConcurrentBoot) || settings.maxConcurrentBoot < 1)) {
        errors.push('settings.maxConcurrentBoot must be a positive integer');
      }
    }
  }

  if (errors.length === 0) {
    const dependencies = resolveDependencyTiers(services);
    for (const [serviceName, missing] of dependencies.missingDependencies) {
      errors.push(`Service "${serviceName}" depends on missing services: ${missing.join(', ')}`);
    }
    if (dependencies.hasCycle) {
      errors.push(`Service dependencies contain a cycle: ${(dependencies.cycleNodes || []).join(', ')}`);
    }
  }

  return errors;
}

/**
 * Parse command line arguments for configuration path flags:
 * -c <path>, --config <path>, --config=<path>, or positional <file>.json / <file>.devpulse.json
 */
export function parseCliArgs(argv: string[] = process.argv.slice(2)): CliArgs {
  let configPath: string | undefined;
  let help = false;
  let version = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg) continue;

    if (arg === '-h' || arg === '--help') {
      help = true;
    } else if (arg === '-v' || arg === '--version') {
      version = true;
    } else if (arg === '-c' || arg === '--config') {
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

  return { configPath, help, version };
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
      const parsed: unknown = JSON.parse(raw);
      const errors = validateConfig(parsed);
      if (errors.length === 0) {
        const validConfig = parsed as DevPulseConfig;
        return {
          path: filePath,
          filename,
          name: validConfig.name || filename.replace(/\.devpulse\.json$/i, ''),
          version: validConfig.version,
          servicesCount: validConfig.services.length,
          services: validConfig.services.map(s => ({
            name: s.name,
            port: s.port,
            command: s.command ?? s.commands ?? s.preStart ?? ''
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
        error: errors.join('; ')
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
    const parsed: unknown = JSON.parse(raw);
    const errors = validateConfig(parsed);
    if (errors.length === 0) return parsed as DevPulseConfig;
    console.error(`Invalid config at ${filePath}: ${errors.join('; ')}`);
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
  const targetPath = customFilePath
    ? (path.isAbsolute(customFilePath) ? customFilePath : path.resolve(cwd, customFilePath))
    : getNewConfigFilePath(cwd, config.name);
  const payload = {
    $schema: CONFIG_SCHEMA_URL,
    name: config.name || path.basename(cwd) || 'Workspace',
    version: config.version || '1.0.0',
    settings: config.settings,
    services: config.services
  };

  const serialized = `${JSON.stringify(payload, null, 2)}\n`;
  const temporaryPath = `${targetPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let descriptor: number | undefined;

  try {
    descriptor = fs.openSync(temporaryPath, 'wx', 0o600);
    fs.writeFileSync(descriptor, serialized, 'utf-8');
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
    descriptor = undefined;

    if (customFilePath && fs.existsSync(targetPath)) {
      fs.copyFileSync(targetPath, `${targetPath}.bak`);
      fs.renameSync(temporaryPath, targetPath);
    } else {
      fs.linkSync(temporaryPath, targetPath);
      fs.unlinkSync(temporaryPath);
    }
  } catch (err) {
    if (descriptor !== undefined) fs.closeSync(descriptor);
    try {
      fs.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw cleanupError;
    }
    throw err;
  }

  logger.info(`Saved configuration to ${targetPath}`);
  return targetPath;
}

function getNewConfigFilePath(cwd: string, configName?: string): string {
  const slug = (configName || path.basename(cwd) || 'workspace')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'workspace';
  const preferredPath = path.resolve(cwd, 'config.devpulse.json');
  if (!fs.existsSync(preferredPath)) return preferredPath;

  const baseName = slug === 'config' ? 'config' : slug;
  let suffix = 1;
  for (;;) {
    const filename = suffix === 1
      ? `${baseName}.devpulse.json`
      : `${baseName}-${suffix}.devpulse.json`;
    const candidate = path.resolve(cwd, filename);
    if (!fs.existsSync(candidate)) return candidate;
    suffix++;
  }
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
    let entries: fs.Dirent[];
    try {
      if (!fs.existsSync(parentDir) || !fs.statSync(parentDir).isDirectory()) continue;
      entries = fs.readdirSync(parentDir, { withFileTypes: true });
    } catch (error) {
      logger.warn(`Unable to inspect service directory "${parentDir}": ${error instanceof Error ? error.message : String(error)}`);
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const subDirPath = path.join(parentDir, entry.name);
      const relPath = `./${path.relative(cwd, subDirPath)}`;

      const pkgPath = path.join(subDirPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const packageInfo = readPackageStartCommand(pkgPath);
        if (packageInfo?.command) {
          detected.push({
            name: entry.name,
            path: relPath,
            command: packageInfo.command,
            port: assignedPort++,
            autoStart: true
          });
        }
        continue;
      }

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

      const mainPy = path.join(subDirPath, 'main.py');
      const appPy = path.join(subDirPath, 'app.py');
      if (fs.existsSync(mainPy) || fs.existsSync(appPy)) {
        detected.push({
          name: entry.name,
          path: relPath,
          command: `python ${fs.existsSync(mainPy) ? 'main.py' : 'app.py'}`,
          port: assignedPort++,
          autoStart: true
        });
        continue;
      }

      if (fs.existsSync(path.join(subDirPath, 'requirements.txt'))) {
        logger.warn(`Skipping Python service "${relPath}": no main.py or app.py entry point was found`);
        continue;
      }

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
  }

  // If no subfolder services found, check if root folder has a package.json or service
  if (detected.length === 0) {
    const rootPkg = path.resolve(cwd, 'package.json');
    if (fs.existsSync(rootPkg)) {
      const packageInfo = readPackageStartCommand(rootPkg);
      if (packageInfo?.command) {
        detected.push({
          name: packageInfo.name || path.basename(cwd) || 'main-app',
          path: '.',
          command: packageInfo.command,
          port: 3000,
          autoStart: true
        });
      }
    }
  }

  return detected;
}

function readPackageStartCommand(packagePath: string): { name?: string; command?: string } | null {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('package.json must contain a JSON object');
    }

    const packageData = parsed as Record<string, unknown>;
    const scripts = packageData.scripts;
    if (!scripts || typeof scripts !== 'object' || Array.isArray(scripts)) {
      logger.warn(`Skipping package "${packagePath}": no runnable "dev" or "start" script was found`);
      return { name: typeof packageData.name === 'string' ? packageData.name : undefined };
    }

    const scriptMap = scripts as Record<string, unknown>;
    const command = typeof scriptMap.dev === 'string' && scriptMap.dev.trim()
      ? 'npm run dev'
      : typeof scriptMap.start === 'string' && scriptMap.start.trim()
        ? 'npm start'
        : undefined;
    if (!command) {
      logger.warn(`Skipping package "${packagePath}": no runnable "dev" or "start" script was found`);
    }
    return {
      name: typeof packageData.name === 'string' ? packageData.name : undefined,
      command
    };
  } catch (error) {
    logger.warn(`Unable to read package "${packagePath}": ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}
