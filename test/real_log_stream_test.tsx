import React from 'react';
import { render } from 'ink';
import { PassThrough } from 'stream';
import DevPulse from '../src/DevPulse.js';
import { DevPulseConfig } from '../src/types/config.js';
import { processManager } from '../src/services/processManager.js';

async function runRealLogStreamTest() {
  console.log('--- STARTING DEVPULSE REAL SUBPROCESS TUI INTEGRATION TEST ---');

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
    name: 'live-test-workspace',
    services: [
      {
        name: 'backend-worker',
        path: '.',
        command: 'node -e "console.log(\'WORKER_BOOTED_SUCCESS\'); setInterval(() => console.log(\'WORKER_BEAT\'), 300);"',
        port: 5050,
        autoStart: true
      }
    ]
  };

  const { unmount } = render(
    <DevPulse width={100} height={30} config={mockConfig} />,
    { stdin, stdout }
  );

  // Wait 1.2s for subprocess to boot and emit stdout logs into the TUI
  await new Promise(r => setTimeout(r, 1200));

  unmount();
  processManager.stopAllSync();

  const hasWorkerLog = capturedOutput.includes('WORKER_BOOTED_SUCCESS') || capturedOutput.includes('WORKER_BEAT');
  console.log('Subprocess output captured in TUI render:', hasWorkerLog);

  if (hasWorkerLog) {
    console.log('✅ ALL SUBPROCESS TUI STREAMING TESTS PASSED!');
  } else {
    console.error('❌ Subprocess output was not found in TUI stdout!');
    process.exit(1);
  }
}

runRealLogStreamTest().catch(err => {
  console.error('Test error:', err);
  processManager.stopAllSync();
  process.exit(1);
});

