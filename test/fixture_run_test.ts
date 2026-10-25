import path from 'path';
import fs from 'fs';
import { autoDetectServices, saveConfigFile, loadConfigFile, hasConfigFile } from '../src/services/configManager.js';
import { DevPulseConfig } from '../src/types/config.js';

const fixtureDir = path.resolve(process.cwd(), 'test/fixtures/sample-microservices');

console.log('--- TESTING DEVPULSE AS A PACKAGE IN EXTERNAL FIXTURE ---');
console.log('Fixture directory:', fixtureDir);

// 1. Verify no config exists initially
const initialCheck = hasConfigFile(fixtureDir);
console.log('[STEP 1] Has config initially:', initialCheck);
if (initialCheck) {
  // Clean up if left from previous run
  const cfgPath = path.join(fixtureDir, 'devpulse.config.json');
  if (fs.existsSync(cfgPath)) fs.unlinkSync(cfgPath);
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
  console.error('❌ Failed: Expected web and api services to be detected!');
  process.exit(1);
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

if (loaded && loaded.services.length === 2 && hasLoadedApi && hasLoadedWeb) {
  console.log('✅ ALL EXTERNAL PACKAGE FIXTURE TESTS PASSED!');
} else {
  console.error('❌ Config verification failed!');
  process.exit(1);
}

// Cleanup
fs.unlinkSync(savedPath);
console.log('Cleaned up test devpulse.config.json.');
