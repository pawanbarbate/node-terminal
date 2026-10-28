import path from 'path';
import fs from 'fs';
import React from 'react';
import { renderToString } from 'ink';
import {
  findAllConfigFiles,
  getConfigFileSummaries,
  parseCliArgs,
  loadConfigFile
} from '../src/services/configManager.js';
import { ConfigSelectorScreen } from '../src/components/selector/ConfigSelectorScreen.js';
import { DevPulseConfig } from '../src/types/config.js';

console.log('--- STARTING MULTI-CONFIG SELECTOR TESTS ---');

const tmpDir = path.resolve(process.cwd(), 'test/fixtures/multi-config-sandbox');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

function cleanSandbox() {
  if (fs.existsSync(tmpDir)) {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      fs.unlinkSync(path.join(tmpDir, f));
    }
  }
}

try {
  cleanSandbox();

  // -------------------------------------------------------------
  // Test 1: findAllConfigFiles with 0 configs
  // -------------------------------------------------------------
  console.log('[TEST 1] Testing with 0 configurations in workspace...');
  const emptyConfigs = findAllConfigFiles(tmpDir);
  const emptySummaries = getConfigFileSummaries(tmpDir);
  if (emptyConfigs.length !== 0 || emptySummaries.length !== 0) {
    throw new Error('Expected 0 configurations in empty directory');
  }
  console.log('✔ Empty directory returns 0 configs');

  // -------------------------------------------------------------
  // Test 2: findAllConfigFiles with 1 config (single config flow)
  // -------------------------------------------------------------
  console.log('[TEST 2] Testing with 1 single configuration in workspace...');
  const configA: DevPulseConfig = {
    $schema: 'https://devpulse.dev/schema.json',
    name: 'dev-cluster',
    version: '1.0.0',
    services: [
      { name: 'auth', path: './services/auth', command: 'npm run dev', port: 3001, autoStart: true },
      { name: 'api', path: './services/api', command: 'npm run dev', port: 4000, autoStart: true }
    ]
  };
  fs.writeFileSync(path.join(tmpDir, 'dev.devpulse.json'), JSON.stringify(configA, null, 2), 'utf-8');

  const singleConfigs = findAllConfigFiles(tmpDir);
  const singleSummaries = getConfigFileSummaries(tmpDir);
  if (singleConfigs.length !== 1 || singleSummaries.length !== 1) {
    throw new Error(`Expected exactly 1 configuration, got ${singleConfigs.length}`);
  }
  if (singleSummaries[0]?.filename !== 'dev.devpulse.json' || singleSummaries[0]?.servicesCount !== 2) {
    throw new Error('Summary metadata does not match single config');
  }
  console.log('✔ Single config detected correctly (qualifies for direct auto-boot)');

  // -------------------------------------------------------------
  // Test 3: Multiple configurations (> 1 files, triggers selector)
  // -------------------------------------------------------------
  console.log('[TEST 3] Testing multiple configurations discovery and summaries...');
  const configB: DevPulseConfig = {
    $schema: 'https://devpulse.dev/schema.json',
    name: 'staging-environment',
    version: '1.0.0',
    services: [
      { name: 'web-client', path: './web', command: 'pnpm dev', port: 5173, autoStart: true },
      { name: 'backend', path: './backend', command: 'python main.py', port: 8000, autoStart: true },
      { name: 'worker', path: './worker', command: 'pnpm start', autoStart: false }
    ]
  };
  const configC: DevPulseConfig = {
    $schema: 'https://devpulse.dev/schema.json',
    name: 'production-local',
    version: '1.0.0',
    services: [
      { name: 'gateway', path: './gateway', command: 'npm start', port: 80, autoStart: true }
    ]
  };

  fs.writeFileSync(path.join(tmpDir, 'staging.devpulse.json'), JSON.stringify(configB, null, 2), 'utf-8');
  fs.writeFileSync(path.join(tmpDir, 'production.devpulse.json'), JSON.stringify(configC, null, 2), 'utf-8');

  const multiConfigs = findAllConfigFiles(tmpDir);
  const multiSummaries = getConfigFileSummaries(tmpDir);

  if (multiConfigs.length !== 3 || multiSummaries.length !== 3) {
    throw new Error(`Expected exactly 3 configurations, got ${multiConfigs.length}`);
  }

  const filenames = multiSummaries.map(s => s.filename);
  if (!filenames.includes('dev.devpulse.json') || !filenames.includes('staging.devpulse.json') || !filenames.includes('production.devpulse.json')) {
    throw new Error(`Missing expected filenames in summaries: ${filenames.join(', ')}`);
  }

  // Check details of staging summary
  const stagingSummary = multiSummaries.find(s => s.filename === 'staging.devpulse.json');
  if (!stagingSummary || stagingSummary.servicesCount !== 3 || stagingSummary.name !== 'staging-environment') {
    throw new Error('Staging summary metadata was not parsed accurately');
  }
  console.log('✔ All 3 configuration profiles discovered with full service metadata');

  // -------------------------------------------------------------
  // Test 4: Handling malformed / corrupt JSON config file gracefully
  // -------------------------------------------------------------
  console.log('[TEST 4] Testing graceful handling of corrupt JSON files...');
  fs.writeFileSync(path.join(tmpDir, 'corrupted.devpulse.json'), '{ invalid json string content', 'utf-8');

  const corruptSummaries = getConfigFileSummaries(tmpDir);
  const corruptItem = corruptSummaries.find(s => s.filename === 'corrupted.devpulse.json');
  if (!corruptItem) {
    throw new Error('Corrupted config file was omitted from summaries');
  }
  if (corruptItem.isValid !== false || !corruptItem.error) {
    throw new Error('Expected isValid to be false and error message to be present');
  }
  console.log('✔ Corrupted config file identified with isValid: false and clear error message');

  // -------------------------------------------------------------
  // Test 5: CLI Flag bypass verification
  // -------------------------------------------------------------
  console.log('[TEST 5] Testing CLI flags bypassing selector...');
  const parsedDirect = parseCliArgs(['--config', path.join(tmpDir, 'staging.devpulse.json')]);
  if (!parsedDirect.configPath) {
    throw new Error('Failed to parse --config path');
  }
  const loadedExplicit = loadConfigFile(parsedDirect.configPath);
  if (!loadedExplicit || loadedExplicit.name !== 'staging-environment') {
    throw new Error('Explicit config flag failed to load correct target');
  }
  console.log('✔ Explicit CLI flag directly targets and loads intended configuration');

  // -------------------------------------------------------------
  // Test 6: ConfigSelectorScreen UI Render Verification
  // -------------------------------------------------------------
  console.log('[TEST 6] Testing ConfigSelectorScreen component rendering...');
  let selectedResult: string | null = null;
  let wizardRequested = false;
  let cancelRequested = false;

  const validSummaries = multiSummaries.filter(s => s.isValid);

  const output = renderToString(
    React.createElement(ConfigSelectorScreen, {
      configs: validSummaries,
      onSelect: (p: string) => { selectedResult = p; },
      onNewConfig: () => { wizardRequested = true; },
      onCancel: () => { cancelRequested = true; },
      width: 100,
      height: 30
    })
  );

  if (!output.includes('MULTIPLE CONFIGURATIONS DETECTED')) {
    throw new Error('ConfigSelectorScreen header not found in rendered output');
  }
  if (!output.includes('dev.devpulse.json') || !output.includes('staging.devpulse.json')) {
    throw new Error('Discovered config filenames missing from UI render');
  }
  if (!output.includes('Launch Profile (Enter)') || !output.includes('New Profile (w)')) {
    throw new Error('Action bar buttons missing from UI render');
  }
  console.log('✔ ConfigSelectorScreen renders beautiful Cyber Pulse cards and action controls');

  console.log('\n✅ ALL MULTI-CONFIG SELECTOR TESTS PASSED PERFECTLY!\n');
} finally {
  cleanSandbox();
  if (fs.existsSync(tmpDir)) {
    fs.rmdirSync(tmpDir);
  }
}

