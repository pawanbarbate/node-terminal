import assert from 'assert';
import { dashboardReducer, createInitialDashboardState, DashboardState } from '../src/state/dashboardReducer.js';
import { DevPulseConfig } from '../src/types/config.js';

async function runUptimePrecisionTests() {
  console.log('=== STARTING UPTIME & CLOCK PRECISION TESTS ===\n');

  const config: DevPulseConfig = {
    name: 'test-app',
    services: [
      { name: 'api', path: '.', command: 'node server.js', port: 3000, autoStart: true },
      { name: 'worker', path: '.', command: 'node worker.js', autoStart: true }
    ]
  };

  let state: DashboardState = createInitialDashboardState(config);

  // Test 1: Service transition to RUNNING records startedAt timestamp
  console.log('[Test 1] Transitioning service "api" to RUNNING...');
  const bootTime = Date.now() - 5000; // pretend it started 5 seconds ago
  state = dashboardReducer(state, {
    type: 'PROCESS_STATUS_CHANGED',
    serviceName: 'api',
    status: 'running',
    pid: 1234
  });

  const apiSvc = state.services.find(s => s.name === 'api')!;
  assert.strictEqual(apiSvc.status, 'running');
  assert.ok(apiSvc.startedAt && apiSvc.startedAt > 0, 'startedAt must be populated');
  console.log('✔ startedAt timestamp initialized upon running status');

  // Override startedAt to exactly 3000ms ago for deterministic math
  state = {
    ...state,
    startedAt: Date.now() - 3000,
    services: state.services.map(s => s.name === 'api' ? { ...s, startedAt: Date.now() - 3000 } : s)
  };

  // Test 2: TICK_CLOCK increments by exactly 1s delta, not 2s
  console.log('[Test 2] Verifying TICK_CLOCK delta calculation...');
  state = dashboardReducer(state, {
    type: 'TICK_CLOCK',
    time: '12:00:03',
    cpuChange: 1
  });

  const updatedApi = state.services.find(s => s.name === 'api')!;
  assert.strictEqual(updatedApi.uptimeSeconds, 3, 'Uptime must be exactly 3s');
  assert.strictEqual(updatedApi.uptime, '3s');
  assert.strictEqual(state.uptimeSeconds, 3, 'System uptime must be 3s');
  console.log('✔ Uptime exactly reflects 3s without duplicate 2s jumping');

  // Test 3: Multiple rapid TICK_CLOCK calls within the same second do not duplicate seconds
  console.log('[Test 3] Verifying immunity to rapid duplicate TICK_CLOCK dispatches...');
  state = dashboardReducer(state, {
    type: 'TICK_CLOCK',
    time: '12:00:03',
    cpuChange: 0
  });
  const afterDuplicateApi = state.services.find(s => s.name === 'api')!;
  assert.strictEqual(afterDuplicateApi.uptimeSeconds, 3, 'Multiple dispatches within same second must NOT jump to 4s or 5s');
  console.log('✔ Clock is completely drift-free and immune to duplicate dispatch calls');

  // Test 4: Format conversion for minutes and seconds (e.g. 125s -> 2m 5s)
  console.log('[Test 4] Verifying minute/second string formatting...');
  state = {
    ...state,
    services: state.services.map(s => s.name === 'api' ? { ...s, startedAt: Date.now() - 125000 } : s)
  };
  state = dashboardReducer(state, {
    type: 'TICK_CLOCK',
    time: '12:02:05',
    cpuChange: 0
  });
  const formattedApi = state.services.find(s => s.name === 'api')!;
  assert.strictEqual(formattedApi.uptimeSeconds, 125);
  assert.strictEqual(formattedApi.uptime, '2m 5s');
  console.log(`✔ Formatted string matches expected: "${formattedApi.uptime}"`);

  console.log('\n=== ALL UPTIME & CLOCK PRECISION TESTS PASSED (4/4) ===');
}

runUptimePrecisionTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

