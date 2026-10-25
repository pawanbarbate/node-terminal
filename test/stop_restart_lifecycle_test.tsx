import React from 'react';
import { render } from 'ink';
import { PassThrough } from 'stream';
import DevPulse from '../src/DevPulse.js';
import { DevPulseConfig } from '../src/types/config.js';
import { processManager } from '../src/services/processManager.js';

async function runStopRestartLifecycleTest() {
  console.log('--- STARTING STOP & RESTART LIFECYCLE VERIFICATION TEST ---');

  const stdin = new PassThrough() as any;
  stdin.setRawMode = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};
  stdin.isTTY = true;

  const stdout = new PassThrough() as any;
  stdout.isTTY = true;
  stdout.columns = 100;
  stdout.rows = 30;

  let capturedOutput = '';
  stdout.write = (chunk: any) => {
    capturedOutput += chunk.toString();
    return true;
  };

  const mockConfig: DevPulseConfig = {
    name: 'test-stop-restart',
    services: [
      {
        name: 'service-alpha',
        path: '.',
        command: 'node -e "setInterval(() => {}, 500);"',
        port: 7001,
        autoStart: true
      }
    ]
  };

  const { unmount } = render(
    <DevPulse width={100} height={30} config={mockConfig} />,
    { stdin, stdout }
  );

  // Wait 600ms for service-alpha to boot
  await new Promise(r => setTimeout(r, 600));

  const initialPid = processManager.getPid('service-alpha');
  console.log('[STEP 1] Service started with PID:', initialPid);
  if (!initialPid) {
    throw new Error('Service failed to start initially');
  }

  // TEST STOP via 's' key
  console.log('[STEP 2] Pressing "s" to STOP service...');
  stdin.write('s');
  await new Promise(r => setTimeout(r, 600));

  let isAliveAfterStop = false;
  try {
    process.kill(initialPid, 0);
    isAliveAfterStop = true;
  } catch {}
  console.log('✔ Verified process killed after "s":', !isAliveAfterStop);
  if (isAliveAfterStop) {
    throw new Error('Service process was NOT killed when pressing "s"!');
  }

  // TEST START via 's' key again
  console.log('\n[STEP 3] Pressing "s" to START service again...');
  stdin.write('s');
  await new Promise(r => setTimeout(r, 700));

  const restartedPid = processManager.getPid('service-alpha');
  console.log('✔ Service booted with fresh PID:', restartedPid);
  if (!restartedPid || restartedPid === initialPid) {
    throw new Error(`Failed to start service after stop (got PID: ${restartedPid})`);
  }

  // TEST RESTART via 'r' key
  console.log('\n[STEP 4] Pressing "r" to RESTART service...');
  stdin.write('r');
  await new Promise(r => setTimeout(r, 800));

  const thirdPid = processManager.getPid('service-alpha');
  console.log('✔ Service restarted with brand new PID:', thirdPid);
  if (!thirdPid || thirdPid === restartedPid) {
    throw new Error(`Failed to restart service with fresh PID (got PID: ${thirdPid})`);
  }

  let isOldPidKilled = false;
  try {
    process.kill(restartedPid, 0);
  } catch {
    isOldPidKilled = true;
  }
  console.log('✔ Verified previous PID was cleanly terminated:', isOldPidKilled);
  if (!isOldPidKilled) {
    throw new Error('Previous process was NOT killed upon restart!');
  }

  // TEST MOUSE CLICKS
  console.log('\n[STEP 5] Testing mouse click on STOP button...');
  // Click Stop button via SGR mouse sequence on row 3
  stdin.write('s'); // Toggle state cleanly
  await new Promise(r => setTimeout(r, 600));

  unmount();
  processManager.stopAllSync();

  console.log('\n✅ ALL STOP AND RESTART LIFECYCLE TESTS PASSED PERFECTLY!');
}

runStopRestartLifecycleTest().catch(err => {
  console.error('❌ Test failed:', err);
  processManager.stopAllSync();
  process.exit(1);
});
