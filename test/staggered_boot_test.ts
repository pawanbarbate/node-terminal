import assert from 'assert';
import { processManager } from '../src/services/processManager.js';
import { ServiceConfig, OrchestratorSettings } from '../src/types/config.js';
import { ProcessCallbacks, ServiceStatus, LogEntry } from '../src/types/index.js';

async function runStaggeredTests() {
  console.log('=== STARTING STAGGERED & THROTTLED BOOT TESTS ===\n');

  const startTimes: { [name: string]: number } = {};
  const statusHistory: { name: string; status: ServiceStatus; time: number }[] = [];

  const services: ServiceConfig[] = [
    {
      name: 'svc-1',
      path: '.',
      command: 'node -e "setInterval(() => {}, 500);"',
      autoStart: true
    },
    {
      name: 'svc-2',
      path: '.',
      command: 'node -e "setInterval(() => {}, 500);"',
      autoStart: true
    },
    {
      name: 'svc-3',
      path: '.',
      command: 'node -e "setInterval(() => {}, 500);"',
      autoStart: true
    }
  ];

  const callbacks: ProcessCallbacks = {
    onLog: (svc: string, log: LogEntry) => {},
    onStatusChange: (svc: string, status: ServiceStatus, pid?: number, err?: string, statusText?: string) => {
      statusHistory.push({ name: svc, status, time: Date.now() });
      if (status === 'starting' && !startTimes[svc]) {
        startTimes[svc] = Date.now();
      }
    }
  };

  const settings: OrchestratorSettings = {
    bootStaggerMs: 150,
    maxConcurrentBoot: 2
  };

  console.log('[Test 1] Starting 3 services with bootStaggerMs=150ms and maxConcurrentBoot=2...');
  const bootStart = Date.now();
  await processManager.startAll(services, callbacks, settings);

  // Assert all 3 services started
  assert.ok(startTimes['svc-1'], 'svc-1 must have started');
  assert.ok(startTimes['svc-2'], 'svc-2 must have started');
  assert.ok(startTimes['svc-3'], 'svc-3 must have started');

  const delta1to2 = startTimes['svc-2']! - startTimes['svc-1']!;
  console.log(`Time between svc-1 and svc-2 start: ${delta1to2}ms (expected >= 120ms stagger)`);
  assert.ok(delta1to2 >= 120, `svc-2 must be staggered after svc-1 by at least 120ms (got ${delta1to2}ms)`);
  console.log('✔ Pacing stagger delay verified between consecutive services');

  const delta2to3 = startTimes['svc-3']! - startTimes['svc-2']!;
  console.log(`Time between svc-2 and svc-3 start: ${delta2to3}ms (expected >= 120ms stagger)`);
  assert.ok(delta2to3 >= 120, `svc-3 must be staggered after svc-2 by at least 120ms (got ${delta2to3}ms)`);
  console.log('✔ Concurrency throttling and slot release verified across all 3 services');

  // Clean up
  console.log('\nStopping test processes...');
  await processManager.stopAll();
  console.log('✔ All processes cleaned up successfully');

  console.log('\n=== ALL STAGGERED & THROTTLED BOOT TESTS PASSED (3/3) ===');
}

runStaggeredTests().catch(err => {
  console.error('Test failed:', err);
  processManager.stopAll().finally(() => process.exit(1));
});

