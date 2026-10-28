import assert from 'assert';
import { processManager } from '../src/services/processManager.js';
import { LogEntry, ServiceStatus } from '../src/types/index.js';
import { ServiceConfig } from '../src/types/config.js';

async function runCascadingBootTests() {
  console.log('=== STARTING CASCADING BOOT & DEPENDENCY ORCHESTRATION TESTS ===');

  // Test 1: Service B starts only after Service A becomes ready on port
  console.log('\n[Test 1] Testing dependency wave execution with port readiness...');
  const bootOrder: string[] = [];
  const serviceStatuses = new Map<string, { status: ServiceStatus; statusText?: string }>();

  const serviceA: ServiceConfig = {
    name: 'svc-database',
    path: '.',
    command: 'node -e "const http = require(\'http\'); const s = http.createServer((q, r) => r.end(\'ok\')); s.listen(9881, () => { console.log(\'DB_READY\'); }); setInterval(() => {}, 1000);"',
    port: 9881,
    autoStart: true
  };

  const serviceB: ServiceConfig = {
    name: 'svc-api',
    path: '.',
    command: 'node -e "console.log(\'API_BOOTED\'); setInterval(() => {}, 1000);"',
    port: 9882,
    autoStart: true,
    dependsOn: ['svc-database']
  };

  const callbacks = {
    onLog: (svc: string, log: LogEntry) => {
      if (log.message.includes('DB_READY')) bootOrder.push('DATABASE_READY');
      if (log.message.includes('API_BOOTED')) bootOrder.push('API_BOOTED');
    },
    onStatusChange: (svc: string, status: ServiceStatus, pid?: number, err?: string, statusText?: string) => {
      serviceStatuses.set(svc, { status, statusText });
    }
  };

  await processManager.startAll([serviceA, serviceB], callbacks);

  // Allow short moment for child process outputs
  await new Promise(r => setTimeout(r, 800));

  assert.strictEqual(bootOrder[0], 'DATABASE_READY', 'Database must be ready before API boots');
  assert.strictEqual(bootOrder[1], 'API_BOOTED', 'API booted after Database');
  console.log('✔ Cascading boot order verified: Database ready -> API booted');

  // Clean up
  processManager.stopService('svc-database');
  processManager.stopService('svc-api');

  // Test 2: Dependency Failure Cascades BLOCKED status
  console.log('\n[Test 2] Testing cascading BLOCKED status on upstream failure...');
  const failStatuses = new Map<string, { status: ServiceStatus; statusText?: string }>();

  const badUpstream: ServiceConfig = {
    name: 'failing-core',
    path: '.',
    command: 'node -e "process.exit(1);"',
    autoStart: true
  };

  const dependentService: ServiceConfig = {
    name: 'blocked-app',
    path: '.',
    command: 'node -e "console.log(\'SHOULD_NEVER_RUN\');"',
    autoStart: true,
    dependsOn: ['failing-core']
  };

  const failCallbacks = {
    onLog: (_s: string, _l: LogEntry) => {},
    onStatusChange: (svc: string, status: ServiceStatus, pid?: number, err?: string, statusText?: string) => {
      failStatuses.set(svc, { status, statusText });
    }
  };

  await processManager.startAll([badUpstream, dependentService], failCallbacks);
  await new Promise(r => setTimeout(r, 400));

  const appStatus = failStatuses.get('blocked-app');
  assert.strictEqual(appStatus?.status, 'blocked', 'Dependent service must be BLOCKED');
  assert.ok(appStatus?.statusText?.includes('failing-core'), 'Status text must name the failed dependency');
  console.log('✔ Dependent service successfully blocked with status:', appStatus?.statusText);

  // Test 3: Cyclic Dependency Detection in startAll
  console.log('\n[Test 3] Testing cycle detection in startAll...');
  const cycleStatuses = new Map<string, { status: ServiceStatus; statusText?: string }>();

  const cycleA: ServiceConfig = {
    name: 'cycle-1',
    path: '.',
    command: 'node -e "setInterval(() => {}, 1000);"',
    autoStart: true,
    dependsOn: ['cycle-2']
  };

  const cycleB: ServiceConfig = {
    name: 'cycle-2',
    path: '.',
    command: 'node -e "setInterval(() => {}, 1000);"',
    autoStart: true,
    dependsOn: ['cycle-1']
  };

  const cycleCallbacks = {
    onLog: (_s: string, _l: LogEntry) => {},
    onStatusChange: (svc: string, status: ServiceStatus, pid?: number, err?: string, statusText?: string) => {
      cycleStatuses.set(svc, { status, statusText });
    }
  };

  await processManager.startAll([cycleA, cycleB], cycleCallbacks);

  const status1 = cycleStatuses.get('cycle-1');
  const status2 = cycleStatuses.get('cycle-2');
  assert.strictEqual(status1?.statusText, 'CYCLE ERROR');
  assert.strictEqual(status2?.statusText, 'CYCLE ERROR');
  console.log('✔ Cycle prevented execution and marked services with CYCLE ERROR');

  console.log('\n=== ALL CASCADING BOOT TESTS PASSED (3/3) ===');
}

runCascadingBootTests().catch(err => {
  console.error('Cascading boot test failed:', err);
  process.exit(1);
});

