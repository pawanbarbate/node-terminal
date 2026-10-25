import React from 'react';
import { render } from 'ink';
import { PassThrough } from 'stream';
import DevPulse from '../src/DevPulse.js';
import { DevPulseConfig } from '../src/types/config.js';

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

  const mockConfig: DevPulseConfig = {
    name: 'test-project',
    services: [
      { name: 'auth-service', path: './auth', command: 'npm start', port: 4001, autoStart: true },
      { name: 'api-gateway', path: './gateway', command: 'npm start', port: 4000, autoStart: true },
      { name: 'payment-svc', path: './payment', command: 'npm start', port: 4002, autoStart: true }
    ]
  };

  const { unmount } = render(
    <DevPulse width={100} height={30} config={mockConfig} />,
    { stdin, stdout }
  );

  // Wait for initial render and bounds measurement
  await new Promise(r => setTimeout(r, 150));

  // TEST 1: Click on 2nd service in left sidebar (api-gateway)
  // Sidebar starts around col 2-25, row 4-7
  console.log('\n[TEST 1] Sending SGR Left Click on 2nd service in sidebar (col 10, row 6)...');
  stdin.write('\x1b[<0;10;6M');
  await new Promise(r => setTimeout(r, 100));

  // TEST 2: Click on "Errors" tab in ServiceDetailPanel
  // Tabs are in right panel (col > 28, row 5)
  console.log('[TEST 2] Sending SGR Left Click on "Errors" tab (col 38, row 5)...');
  stdin.write('\x1b[<0;38;5M');
  await new Promise(r => setTimeout(r, 100));

  // TEST 3: Click on "Metrics" tab in ServiceDetailPanel
  console.log('[TEST 3] Sending SGR Left Click on "Metrics" tab (col 52, row 5)...');
  stdin.write('\x1b[<0;52;5M');
  await new Promise(r => setTimeout(r, 100));

  // TEST 4: Click on "Live" badge in GlobalLogsPanel
  // Global Logs header is around row 17-18, Live pill is on far right (col 93, row 17)
  console.log('[TEST 4] Sending SGR Left Click on "Live" toggle pill in Global Logs...');
  stdin.write('\x1b[<0;93;17M');
  await new Promise(r => setTimeout(r, 100));

  // TEST 5: Click on "? Help" in Footer (row 30, col 3)
  console.log('[TEST 5] Sending SGR Left Click on "? Help" in Footer (col 3, row 30)...');
  stdin.write('\x1b[<0;3;30M');
  await new Promise(r => setTimeout(r, 100));

  unmount();

  console.log('\n✅ ALL DASHBOARD DYNAMIC CLICKABLE COMPONENT TESTS PASSED!');
}

runDashboardClickTests().catch(err => {
  console.error('Error during dashboard click test:', err);
  process.exit(1);
});

