process.env.FORCE_COLOR = '3';
import { PassThrough } from 'stream';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

const React = (await import('react')).default;
const { render } = await import('ink');
const { LoadingScreen } = await import('../src/components/common/LoadingScreen.js');
const {
  getConfigFileSummaries,
  getConfigFileSummariesAsync,
  resolveInitialAppState
} = await import('../src/services/configManager.js');

console.log('--- STARTING LOADING SCREEN & FAST STARTUP VERIFICATION ---');

// Helper to capture rendered frames from Ink
function captureRender(element: React.ReactElement): Promise<string> {
  return new Promise((resolve) => {
    const out = new PassThrough() as any;
    out.isTTY = true;
    out.columns = 80;
    out.rows = 24;
    out.getColorDepth = () => 24;
    let buf = '';
    out.on('data', (d: any) => (buf += d.toString()));
    const inst = render(element, { stdout: out, debug: true });
    setTimeout(() => {
      inst.unmount();
      resolve(buf);
    }, 150);
  });
}

// 1. Verify LoadingScreen renders with progress bar, spinner, and zero background leak
console.log('[1] Verifying LoadingScreen rendering and styling...');
const loadingOutput = await captureRender(
  React.createElement(LoadingScreen, {
    progress: 68,
    statusText: 'Scanning workspace microservices...',
    width: 80,
    height: 24
  })
);

assert(loadingOutput.includes('DevPulse'), 'LoadingScreen must contain DevPulse branding');
assert(loadingOutput.includes('68%'), 'LoadingScreen must display current progress percentage');
assert(loadingOutput.includes('Scanning workspace microservices...'), 'LoadingScreen must display status message');

// Check for \u001b[49m border background resets (cross-platform zero-leakage guarantee)
const lines = loadingOutput.split('\n');
let borderBadResets = 0;
for (const line of lines) {
  const m = line.match(/\u001b\[49m[^\u001b]*[╭─╮│╰╯]/);
  if (m) {
    borderBadResets++;
  }
}
assert.strictEqual(borderBadResets, 0, `LoadingScreen should have 0 default bg resets on borders, found ${borderBadResets}`);
console.log('✔ LoadingScreen rendered cleanly with zero border color leakage');

// 2. Verify getConfigFileSummariesAsync progress events and parity with multiple configs
console.log('[2] Verifying getConfigFileSummariesAsync progress events and parity with multiple configs...');

const tempFixtureDir = path.join(process.cwd(), '.test-multi-configs-fixture');
fs.mkdirSync(tempFixtureDir, { recursive: true });

try {
  fs.writeFileSync(
    path.join(tempFixtureDir, 'config.devpulse.json'),
    JSON.stringify({
      name: 'Primary Config',
      version: '1.0.0',
      services: [
        { name: 'gateway', port: 3000, command: 'npm run dev' },
        { name: 'orders', port: 3002, command: 'npm run dev' }
      ]
    })
  );

  fs.writeFileSync(
    path.join(tempFixtureDir, 'prod.devpulse.json'),
    JSON.stringify({
      name: 'Production Config',
      version: '1.0.0',
      services: [
        { name: 'gateway', port: 3000, command: 'npm run start' }
      ]
    })
  );

  fs.writeFileSync(
    path.join(tempFixtureDir, 'staging.devpulse.json'),
    JSON.stringify({
      name: 'Staging Config',
      version: '1.0.0',
      services: [
        { name: 'staging-api', port: 4000, command: 'npm run staging' }
      ]
    })
  );

  const progressEvents: Array<{ percent: number; status: string }> = [];
  const asyncSummaries = await getConfigFileSummariesAsync(tempFixtureDir, (percent, status) => {
    progressEvents.push({ percent, status });
  });

  assert(progressEvents.length >= 4, 'Async scan must fire progress events for each parsed file');
  assert.strictEqual(progressEvents[0]?.percent, 15, 'Initial progress should start at 15%');
  assert.strictEqual(progressEvents[progressEvents.length - 1]?.percent, 100, 'Final progress should reach 100%');

  // Monotonic progress check
  for (let i = 1; i < progressEvents.length; i++) {
    assert(
      progressEvents[i]!.percent >= progressEvents[i - 1]!.percent,
      `Progress should be monotonic: ${progressEvents[i]!.percent} >= ${progressEvents[i - 1]!.percent}`
    );
  }

  const syncSummaries = getConfigFileSummaries(tempFixtureDir);
  assert.strictEqual(asyncSummaries.length, 3, 'Async scan must discover all 3 config files');
  assert.strictEqual(syncSummaries.length, 3, 'Sync scan must discover all 3 config files');
  for (let i = 0; i < syncSummaries.length; i++) {
    assert.strictEqual(asyncSummaries[i]?.path, syncSummaries[i]?.path, `Summary ${i} path parity mismatch`);
    assert.strictEqual(asyncSummaries[i]?.servicesCount, syncSummaries[i]?.servicesCount, `Summary ${i} servicesCount mismatch`);
  }
  console.log(`✔ getConfigFileSummariesAsync matched ${syncSummaries.length} configurations across ${progressEvents.length} progress events`);

  // 3. Verify resolveInitialAppState single-pass resolver
  console.log('[3] Verifying resolveInitialAppState state resolution paths...');

  // Case A: Multi-config workspace without CLI flag -> mode 'selector'
  const stateA = resolveInitialAppState({ configPath: null }, tempFixtureDir, asyncSummaries);
  assert.strictEqual(stateA.mode, 'selector', 'Multi-config directory must route to selector mode');
  assert.strictEqual(stateA.summaries.length, 3);

  // Case B: Explicit config path -> mode 'dashboard'
  const chosenPath = syncSummaries[0]!.path;
  const stateB = resolveInitialAppState({ configPath: chosenPath }, tempFixtureDir);
  assert.strictEqual(stateB.mode, 'dashboard', 'Explicit config path should resolve directly to dashboard');
  assert.strictEqual(stateB.activeConfigPath, chosenPath);
  assert(stateB.config !== null, 'Config must be loaded for explicit valid path');
  assert.strictEqual(stateB.config?.name, 'Primary Config');

} finally {
  fs.rmSync(tempFixtureDir, { recursive: true, force: true });
}

// Case C: Explicit non-existent path -> mode 'wizard'
const stateC = resolveInitialAppState({ configPath: 'does-not-exist.json' }, process.cwd());
assert.strictEqual(stateC.mode, 'wizard', 'Non-existent explicit config path must route to wizard');
assert.strictEqual(stateC.config, null);

// Case D: Empty directory with zero configs -> mode 'welcome'
const emptyDir = path.join(process.cwd(), '.empty-test-dir-for-devpulse');
try {
  if (!fs.existsSync(emptyDir)) fs.mkdirSync(emptyDir, { recursive: true });
  const stateD = resolveInitialAppState({ configPath: null }, emptyDir);
  assert.strictEqual(stateD.mode, 'welcome', 'Zero configs found should resolve to welcome mode');
  assert.strictEqual(stateD.summaries.length, 0);
} finally {
  try {
    if (fs.existsSync(emptyDir)) fs.rmdirSync(emptyDir);
  } catch {}
}
console.log('✔ resolveInitialAppState correctly routed all state combinations');

// 4. Performance Benchmark: Startup resolution time
console.log('[4] Benchmarking startup resolution latency...');
const t0 = performance.now();
const perfState = resolveInitialAppState({ configPath: null }, process.cwd());
const elapsed = performance.now() - t0;
console.log(`✔ Single-pass startup resolution executed in ${elapsed.toFixed(2)} ms (< 100 ms target)`);
assert(elapsed < 100, `Startup resolution exceeded 100ms threshold: ${elapsed.toFixed(2)} ms`);

console.log('--- ALL LOADING SCREEN & FAST STARTUP TESTS PASSED SUCCESSFULLY ---');
process.exit(0);
