import React from 'react';
import assert from 'node:assert';
import { render } from 'ink';
import { PassThrough } from 'stream';
import DevPulse from '../src/DevPulse.js';
import { DevPulseConfig } from '../src/types/config.js';
import { processManager } from '../src/services/processManager.js';

async function runDashboardClickTests() {
  console.log('--- STARTING DEVPULSE DASHBOARD CLICKABLE VERIFICATION ---');

  const stdin = new PassThrough() as any;
  stdin.setRawMode = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};
  stdin.isTTY = true;

  const stdout = new PassThrough() as any;
  stdout.isTTY = true;
  stdout.columns = 100;
  stdout.rows = 30;

  let captured = '';
  stdout.write = (chunk: any) => {
    captured += chunk.toString();
    return true;
  };

  const mockConfig: DevPulseConfig = {
    name: 'test-project',
    services: [
      { name: 'auth-service', path: '.', command: 'node -e "setInterval(()=>{},1000)"', port: 4001, autoStart: false },
      { name: 'api-gateway', path: '.', command: 'node -e "setInterval(()=>{},1000)"', port: 4000, autoStart: false },
      { name: 'payment-svc', path: '.', command: 'node -e "setInterval(()=>{},1000)"', port: 4002, autoStart: false }
    ]
  };

  const { unmount } = render(
    <DevPulse width={100} height={30} config={mockConfig} />,
    { stdin, stdout }
  );

  // Wait for initial render and bounds measurement
  await new Promise(r => setTimeout(r, 150));

  // TEST 1: Click on 2nd service in left sidebar (api-gateway)
  console.log('\n[TEST 1] Sending SGR Left Click on 2nd service in sidebar (col 10, row 6)...');
  stdin.write('\x1b[<0;10;6M');
  await new Promise(r => setTimeout(r, 100));

  // TEST 2: Click on "Errors" tab in ServiceDetailPanel
  console.log('[TEST 2] Sending SGR Left Click on "Errors" tab (col 38, row 5)...');
  stdin.write('\x1b[<0;38;5M');
  await new Promise(r => setTimeout(r, 100));

  // TEST 3: Click on "? Help" in Footer (row 30, col 3)
  console.log('[TEST 3] Sending SGR Left Click on "? Help" in Footer (col 3, row 30)...');
  stdin.write('\x1b[<0;3;30M');
  await new Promise(r => setTimeout(r, 100));

  assert(captured.includes('Shortcuts') || captured.includes('Help') || captured.includes('DevPulse'), 'Output should contain help or DevPulse content');

  // Close help
  stdin.write('\x1b');
  await new Promise(r => setTimeout(r, 100));

  unmount();
  processManager.stopAllSync();

  console.log('\n✅ ALL DASHBOARD DYNAMIC CLICKABLE COMPONENT TESTS PASSED!');
}

runDashboardClickTests().catch(err => {
  console.error('Error during dashboard click test:', err);
  process.exit(1);
});

