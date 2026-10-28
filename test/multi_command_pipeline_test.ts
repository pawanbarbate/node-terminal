import assert from 'assert';
import { normalizeServiceCommands } from '../src/services/dependencyGraph.js';
import { processManager } from '../src/services/processManager.js';
import { LogEntry, ServiceStatus } from '../src/types/index.js';
import { ServiceConfig } from '../src/types/config.js';

async function runMultiCommandPipelineTests() {
  console.log('=== STARTING MULTI-COMMAND PIPELINE TESTS ===');

  // Test 1: Normalize Command Pipelines
  console.log('\n[Test 1] Testing normalizeServiceCommands variations...');
  
  // Single string
  const p1 = normalizeServiceCommands({ name: 's1', path: '.', command: 'npm run start' });
  assert.deepStrictEqual(p1.preCommands, []);
  assert.strictEqual(p1.finalCommand, 'npm run start');
  assert.strictEqual(p1.totalSteps, 1);

  // Array of 3 commands
  const p2 = normalizeServiceCommands({
    name: 's2',
    path: '.',
    command: ['npm run migrate', 'npm run build', 'npm run start']
  });
  assert.deepStrictEqual(p2.preCommands, ['npm run migrate', 'npm run build']);
  assert.strictEqual(p2.finalCommand, 'npm run start');
  assert.strictEqual(p2.totalSteps, 3);

  // commands field
  const p3 = normalizeServiceCommands({
    name: 's3',
    path: '.',
    command: '',
    commands: ['npx prisma db push', 'node server.js']
  });
  assert.deepStrictEqual(p3.preCommands, ['npx prisma db push']);
  assert.strictEqual(p3.finalCommand, 'node server.js');
  assert.strictEqual(p3.totalSteps, 2);

  // preStart field
  const p4 = normalizeServiceCommands({
    name: 's4',
    path: '.',
    command: 'node daemon.js',
    preStart: ['echo "setup 1"', 'echo "setup 2"']
  });
  assert.deepStrictEqual(p4.preCommands, ['echo "setup 1"', 'echo "setup 2"']);
  assert.strictEqual(p4.finalCommand, 'node daemon.js');
  assert.strictEqual(p4.totalSteps, 3);

  console.log('✔ Normalization correctly separates pre-flight tasks from daemon command');

  // Test 2: Real Sequential Execution of Multi-Command Pipeline
  console.log('\n[Test 2] Testing real sequential execution (echo step 1 -> echo step 2 -> daemon)...');
  const executionOrder: string[] = [];
  const logs: LogEntry[] = [];
  const statusHistory: { status: ServiceStatus; statusText?: string }[] = [];

  const sequentialService: ServiceConfig = {
    name: 'test-sequential',
    path: '.',
    command: [
      'node -e "console.log(\'EXEC_STEP_1\'); process.exit(0);"',
      'node -e "console.log(\'EXEC_STEP_2\'); process.exit(0);"',
      'node -e "console.log(\'EXEC_DAEMON_RUNNING\'); setInterval(() => {}, 500);"'
    ],
    port: 9871,
    autoStart: true
  };

  const callbacks = {
    onLog: (svc: string, log: LogEntry) => {
      logs.push(log);
      if (log.message.includes('  EXEC_STEP_1')) executionOrder.push('STEP_1');
      if (log.message.includes('  EXEC_STEP_2')) executionOrder.push('STEP_2');
      if (log.message.trim() === 'EXEC_DAEMON_RUNNING') executionOrder.push('DAEMON');
    },
    onStatusChange: (svc: string, status: ServiceStatus, pid?: number, err?: string, statusText?: string) => {
      statusHistory.push({ status, statusText });
    }
  };

  const pid = await processManager.startService(sequentialService, callbacks);
  assert.ok(pid && pid > 0, 'Expected positive PID for running daemon');

  // Allow daemon output to stream
  await new Promise(r => setTimeout(r, 600));

  assert.deepStrictEqual(executionOrder, ['STEP_1', 'STEP_2', 'DAEMON'], 'Commands must execute in strict order');
  console.log('✔ Commands executed in exact sequential order: Step 1 -> Step 2 -> Daemon');

  // Verify step status indicators were broadcast
  const step1Status = statusHistory.some(s => s.statusText?.includes('STEP 1/3'));
  const step2Status = statusHistory.some(s => s.statusText?.includes('STEP 2/3'));
  assert.ok(step1Status, 'Expected broadcast of STEP 1/3');
  assert.ok(step2Status, 'Expected broadcast of STEP 2/3');
  console.log('✔ Live status text correctly displayed step progress');

  // Clean up daemon
  processManager.stopService('test-sequential');

  // Test 3: Pipeline Abort on Pre-Flight Command Failure
  console.log('\n[Test 3] Testing pipeline abort on non-zero exit code...');
  const abortLogs: LogEntry[] = [];
  let finalStatus: ServiceStatus | null = null;
  let finalStatusText: string | undefined = undefined;

  const failingService: ServiceConfig = {
    name: 'test-failing-pipeline',
    path: '.',
    command: [
      'node -e "console.log(\'FAILS_HERE\'); process.exit(1);"',
      'node -e "console.log(\'NEVER_RUNS\'); process.exit(0);"'
    ]
  };

  const failCallbacks = {
    onLog: (svc: string, log: LogEntry) => abortLogs.push(log),
    onStatusChange: (svc: string, status: ServiceStatus, pid?: number, err?: string, statusText?: string) => {
      finalStatus = status;
      finalStatusText = statusText;
    }
  };

  const failPid = await processManager.startService(failingService, failCallbacks);
  assert.strictEqual(failPid, null, 'Must return null when pre-flight command fails');
  assert.strictEqual(finalStatus, 'stopped');
  assert.ok(finalStatusText?.includes('FAILED'), 'Status text must show FAILED');

  const ranStep2 = abortLogs.some(l => l.message.includes('NEVER_RUNS'));
  assert.strictEqual(ranStep2, false, 'Step 2 must NEVER run when step 1 fails');
  console.log('✔ Pipeline successfully aborted upon non-zero exit code without running subsequent steps');

  console.log('\n=== ALL MULTI-COMMAND PIPELINE TESTS PASSED (3/3) ===');
}

runMultiCommandPipelineTests().catch(err => {
  console.error('Multi-command pipeline test failed:', err);
  process.exit(1);
});
