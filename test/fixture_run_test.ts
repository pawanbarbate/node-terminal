import path from 'path';
import fs from 'fs';
import os from 'os';
import { autoDetectServices, saveConfigFile, loadConfigFile, hasConfigFile } from '../src/services/configManager.js';
import { DevPulseConfig } from '../src/types/config.js';

const fixtureSource = path.resolve(process.cwd(), 'test/fixtures/sample-microservices');
const testWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'devpulse-fixture-test-'));
const fixtureDir = path.join(testWorkspace, 'sample-microservices');

try {
  fs.cpSync(fixtureSource, fixtureDir, { recursive: true });

  console.log('--- TESTING DEVPULSE AS A PACKAGE IN EXTERNAL FIXTURE ---');
  console.log('Fixture directory:', fixtureDir);

  // 1. Verify no config exists initially
  const initialCheck = hasConfigFile(fixtureDir);
  console.log('[STEP 1] Has config initially:', initialCheck);
  if (initialCheck) {
    throw new Error('The isolated fixture unexpectedly contains a DevPulse config.');
  }

  // 2. Run auto-detection as if DevPulse started in that directory
  const detected = autoDetectServices(fixtureDir);
  console.log('[STEP 2] Detected services count:', detected.length);
  detected.forEach(d => {
    console.log(` - ${d.name} (${d.path}) command: "${d.command}" port: ${d.port}`);
  });

  const hasWeb = detected.some(d => d.name === 'web' && d.path === './apps/web');
  const hasApi = detected.some(d => d.name === 'api' && d.path === './services/api');

  if (!hasWeb || !hasApi) {
    throw new Error('Expected web and api services to be detected.');
  }

  // 3. Simulate Wizard saving configuration
  const mockConfig: DevPulseConfig = {
    $schema: 'https://devpulse.dev/schema.json',
    name: 'sample-microservices',
    version: '1.0.0',
    services: detected.map(d => ({
      name: d.name || 'service',
      path: d.path || '.',
      command: d.command || 'npm run dev',
      port: d.port,
      autoStart: true
    }))
  };

  const savedPath = saveConfigFile(mockConfig, fixtureDir);
  console.log('[STEP 3] Saved config file to:', savedPath);

  // 4. Verify config file is created and parseable
  const loaded = loadConfigFile(fixtureDir);
  console.log('[STEP 4] Loaded saved config:', {
    name: loaded?.name,
    servicesCount: loaded?.services.length
  });

  const hasLoadedApi = loaded?.services.some(s => s.name === 'api' && s.path === './services/api');
  const hasLoadedWeb = loaded?.services.some(s => s.name === 'web' && s.path === './apps/web');

  if (!loaded || loaded.services.length !== 2 || !hasLoadedApi || !hasLoadedWeb) {
    throw new Error('Saved fixture config did not reload with the expected services.');
  }
  console.log('✅ ALL EXTERNAL PACKAGE FIXTURE TESTS PASSED!');
} finally {
  fs.rmSync(testWorkspace, { recursive: true, force: true });
}
