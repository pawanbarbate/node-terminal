import path from 'path';
import fs from 'fs';
import {
  getConfigFilePath,
  hasConfigFile,
  loadConfigFile,
  saveConfigFile,
  parseCliArgs,
  CONFIG_FILENAMES
} from '../src/services/configManager.js';
import { DevPulseConfig } from '../src/types/config.js';

console.log('--- STARTING CONFIG.DEVPULSE.JSON & DYNAMIC LOADER TESTS ---');

const tmpTestDir = path.resolve(process.cwd(), 'test/fixtures/config-loader-sandbox');
if (!fs.existsSync(tmpTestDir)) {
  fs.mkdirSync(tmpTestDir, { recursive: true });
}

function cleanupSandbox() {
  if (fs.existsSync(tmpTestDir)) {
    const files = fs.readdirSync(tmpTestDir);
    for (const file of files) {
      fs.unlinkSync(path.join(tmpTestDir, file));
    }
  }
}

try {
  cleanupSandbox();

  // -------------------------------------------------------------
  // Test 1: Empty directory returns null
  // -------------------------------------------------------------
  console.log('[TEST 1] Verifying empty directory returns null...');
  if (hasConfigFile(tmpTestDir)) {
    throw new Error('Expected hasConfigFile to be false for empty directory');
  }
  if (getConfigFilePath(tmpTestDir) !== null) {
    throw new Error('Expected getConfigFilePath to return null for empty directory');
  }
  console.log('✔ Empty directory returns null');

  // -------------------------------------------------------------
  // Test 2: Auto-detect config.devpulse.json
  // -------------------------------------------------------------
  console.log('[TEST 2] Verifying auto-detection of config.devpulse.json...');
  const sampleConfig: DevPulseConfig = {
    $schema: 'https://devpulse.dev/schema.json',
    name: 'test-workspace',
    version: '1.0.0',
    services: [
      { name: 'web', path: './web', command: 'npm start', port: 3000, autoStart: true },
      { name: 'api', path: './api', command: 'npm run dev', port: 8080, autoStart: true }
    ]
  };

  const configPath1 = path.join(tmpTestDir, 'config.devpulse.json');
  fs.writeFileSync(configPath1, JSON.stringify(sampleConfig, null, 2), 'utf-8');

  if (!hasConfigFile(tmpTestDir)) {
    throw new Error('Expected hasConfigFile to be true when config.devpulse.json exists');
  }
  const detectedPath1 = getConfigFilePath(tmpTestDir);
  if (detectedPath1 !== configPath1) {
    throw new Error(`Expected getConfigFilePath to resolve to ${configPath1}, got ${detectedPath1}`);
  }

  const loadedConfig1 = loadConfigFile(tmpTestDir);
  if (!loadedConfig1 || loadedConfig1.services.length !== 2) {
    throw new Error('Failed to load config.devpulse.json properly');
  }
  if (loadedConfig1.services[0]?.name !== 'web' || loadedConfig1.services[1]?.port !== 8080) {
    throw new Error('Loaded service configuration does not match expected values');
  }
  console.log('✔ config.devpulse.json is detected and loaded perfectly');

  // -------------------------------------------------------------
  // Test 3: Auto-detect (anyname).devpulse.json (e.g. backend.devpulse.json)
  // -------------------------------------------------------------
  console.log('[TEST 3] Verifying auto-detection of (anyname).devpulse.json pattern...');
  cleanupSandbox();

  const customNamedPath = path.join(tmpTestDir, 'my-microservices.devpulse.json');
  fs.writeFileSync(customNamedPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');

  if (!hasConfigFile(tmpTestDir)) {
    throw new Error('Expected hasConfigFile to find my-microservices.devpulse.json');
  }
  const detectedDynamic = getConfigFilePath(tmpTestDir);
  if (detectedDynamic !== customNamedPath) {
    throw new Error(`Expected ${customNamedPath}, got ${detectedDynamic}`);
  }
  const loadedDynamic = loadConfigFile(tmpTestDir);
  if (!loadedDynamic || loadedDynamic.services.length !== 2) {
    throw new Error('Failed to load my-microservices.devpulse.json');
  }
  console.log('✔ Any custom file ending with .devpulse.json is automatically recognized');

  // -------------------------------------------------------------
  // Test 4: Priority resolution when both config.devpulse.json and others exist
  // -------------------------------------------------------------
  console.log('[TEST 4] Verifying priority resolution (config.devpulse.json takes priority)...');
  const otherPath = path.join(tmpTestDir, 'other.devpulse.json');
  fs.writeFileSync(otherPath, JSON.stringify(sampleConfig, null, 2), 'utf-8');
  fs.writeFileSync(configPath1, JSON.stringify({ ...sampleConfig, name: 'priority-test' }, null, 2), 'utf-8');

  const resolvedPriority = getConfigFilePath(tmpTestDir);
  if (resolvedPriority !== configPath1) {
    throw new Error(`Expected config.devpulse.json to have priority over other.devpulse.json, got: ${resolvedPriority}`);
  }
  const loadedPriority = loadConfigFile(tmpTestDir);
  if (loadedPriority?.name !== 'priority-test') {
    throw new Error('Loaded incorrect config during priority test');
  }
  console.log('✔ config.devpulse.json successfully takes priority when multiple devpulse files exist');

  // -------------------------------------------------------------
  // Test 5: Direct file path loading
  // -------------------------------------------------------------
  console.log('[TEST 5] Verifying direct file path loading...');
  const directLoaded = loadConfigFile(customNamedPath);
  if (!directLoaded || directLoaded.services.length !== 2) {
    throw new Error('Direct file path loading failed');
  }
  console.log('✔ Direct file path loading works seamlessly');

  // -------------------------------------------------------------
  // Test 6: CLI Argument Parsing
  // -------------------------------------------------------------
  console.log('[TEST 6] Verifying CLI argument parser...');
  // Case A: --config
  const argsA = parseCliArgs(['--config', './test.devpulse.json']);
  if (argsA.configPath !== './test.devpulse.json') {
    throw new Error(`CLI --config parsing failed: ${argsA.configPath}`);
  }

  // Case B: -c
  const argsB = parseCliArgs(['-c', 'custom.devpulse.json']);
  if (argsB.configPath !== 'custom.devpulse.json') {
    throw new Error(`CLI -c parsing failed: ${argsB.configPath}`);
  }

  // Case C: --config=value
  const argsC = parseCliArgs(['--config=config.devpulse.json']);
  if (argsC.configPath !== 'config.devpulse.json') {
    throw new Error(`CLI --config= parsing failed: ${argsC.configPath}`);
  }

  // Case D: Positional devpulse file
  const argsD = parseCliArgs(['production.devpulse.json']);
  if (argsD.configPath !== 'production.devpulse.json') {
    throw new Error(`CLI positional parsing failed: ${argsD.configPath}`);
  }

  // Case E: Empty
  const argsE = parseCliArgs([]);
  if (argsE.configPath !== undefined) {
    throw new Error(`CLI empty args parsing failed: ${argsE.configPath}`);
  }
  console.log('✔ All CLI argument variations (-c, --config, --config=..., positional) parse correctly');

  // -------------------------------------------------------------
  // Test 7: saveConfigFile preserves detected file path
  // -------------------------------------------------------------
  console.log('[TEST 7] Verifying saveConfigFile preserves the existing config file...');
  cleanupSandbox();

  const activeTestFile = path.join(tmpTestDir, 'staging.devpulse.json');
  fs.writeFileSync(activeTestFile, JSON.stringify(sampleConfig, null, 2), 'utf-8');

  // Update a service in config
  const updatedConfig: DevPulseConfig = {
    ...sampleConfig,
    services: [
      ...sampleConfig.services,
      { name: 'worker', path: './worker', command: 'npm run worker', autoStart: true }
    ]
  };

  const savedTarget = saveConfigFile(updatedConfig, tmpTestDir);
  if (savedTarget !== activeTestFile) {
    throw new Error(`Expected saveConfigFile to write to ${activeTestFile}, got: ${savedTarget}`);
  }

  const reloaded = JSON.parse(fs.readFileSync(activeTestFile, 'utf-8')) as DevPulseConfig;
  if (reloaded.services.length !== 3) {
    throw new Error(`Expected 3 services in saved config, got ${reloaded.services.length}`);
  }
  console.log('✔ saveConfigFile preserves and writes back to staging.devpulse.json');

  console.log('\n✅ ALL CONFIG.DEVPULSE.JSON & DYNAMIC LOADER TESTS PASSED PERFECTLY!\n');
} finally {
  cleanupSandbox();
  if (fs.existsSync(tmpTestDir)) {
    fs.rmdirSync(tmpTestDir);
  }
}

