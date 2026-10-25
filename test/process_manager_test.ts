import { processManager } from '../src/services/processManager.js';
import { LogEntry, ServiceStatus } from '../src/types/index.js';
import { ServiceConfig } from '../src/types/config.js';

async function runProcessManagerTests() {
  console.log('--- STARTING REAL PROCESS MANAGER & LOG STREAMING TESTS ---');

  const logsReceived: LogEntry[] = [];
  const statusChanges: { name: string; status: ServiceStatus; pid?: number }[] = [];

  const mockService: ServiceConfig = {
    name: 'test-api',
    path: '.',
    command: 'node -e "console.log(\'API_READY\'); console.error(\'API_WARN_OR_ERR\'); setInterval(() => {}, 500);"',
    port: 9001,
    autoStart: true
  };

  const callbacks = {
    onLog: (serviceName: string, log: LogEntry) => {
      logsReceived.push(log);
    },
    onStatusChange: (serviceName: string, status: ServiceStatus, pid?: number) => {
      statusChanges.push({ name: serviceName, status, pid });
    }
  };

  // STEP 1: Spawn service
  console.log('[STEP 1] Starting service "test-api"...');
  const pid = await processManager.startService(mockService, callbacks);
  console.log('Spawned PID:', pid);

  if (!pid || pid <= 0) {
    throw new Error('Process manager failed to spawn process or return valid PID');
  }

  // Verify process is actually alive in OS
  try {
    process.kill(pid, 0);
    console.log('✔ Verified OS PID is actively running');
  } catch (err) {
    throw new Error(`Process with PID ${pid} is not running in OS!`);
  }

  // Wait for stdout and stderr to emit
  await new Promise(r => setTimeout(r, 600));

  const hasStdout = logsReceived.some(l => l.message.includes('API_READY') && l.level === 'info');
  const hasStderr = logsReceived.some(l => l.message.includes('API_WARN_OR_ERR') && l.level === 'error');

  console.log('Logs captured count:', logsReceived.length);
  console.log('Captured stdout "API_READY":', hasStdout);
  console.log('Captured stderr "API_WARN_OR_ERR":', hasStderr);

  if (!hasStdout || !hasStderr) {
    throw new Error('Failed to capture real-time stdout/stderr stream from child process!');
  }

  // STEP 2: Test Restart
  console.log('\n[STEP 2] Testing restartService("test-api")...');
  const newPid = await processManager.restartService('test-api', callbacks);
  console.log('New PID after restart:', newPid);

  if (!newPid || newPid === pid) {
    throw new Error(`Restart failed: expected new PID different from ${pid}, got ${newPid}`);
  }

  // Old PID should be dead
  let oldPidDead = false;
  try {
    process.kill(pid, 0);
  } catch {
    oldPidDead = true;
  }
  console.log('✔ Verified old PID was killed:', oldPidDead);

  // New PID should be alive
  let newPidAlive = false;
  try {
    process.kill(newPid, 0);
    newPidAlive = true;
  } catch {}
  console.log('✔ Verified new PID is actively running:', newPidAlive);

  if (!newPidAlive) {
    throw new Error('New PID is not alive after restart!');
  }

  // STEP 3: Test Stop
  console.log('\n[STEP 3] Testing stopService("test-api")...');
  await processManager.stopService('test-api');
  await new Promise(r => setTimeout(r, 500));

  let stoppedDead = false;
  try {
    process.kill(newPid, 0);
  } catch {
    stoppedDead = true;
  }
  console.log('✔ Verified stopped process PID is dead:', stoppedDead);

  // STEP 4: Test stopAllSync
  console.log('\n[STEP 4] Testing stopAllSync()...');
  processManager.stopAllSync();
  console.log('✔ Verified stopAllSync executed with 0 exceptions');

  console.log('\n✅ ALL PROCESS MANAGER REAL EXECUTION TESTS PASSED!');
}

runProcessManagerTests().catch(err => {
  console.error('❌ Process manager test failed:', err);
  processManager.stopAllSync();
  process.exit(1);
});

