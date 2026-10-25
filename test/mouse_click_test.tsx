import React from 'react';
import { render } from 'ink';
import { PassThrough } from 'stream';
import SetupWizard from '../src/components/wizard/SetupWizard.js';
import { DevPulseConfig } from '../types/config.js';

async function runMouseClickTests() {
  console.log('--- STARTING SGR MOUSE & TOUCHPAD CLICK VERIFICATION ---');

  const stdin = new PassThrough() as any;
  stdin.setRawMode = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};
  stdin.isTTY = true;

  const stdout = new PassThrough() as any;
  stdout.isTTY = true;
  stdout.columns = 80;
  stdout.rows = 24;

  let completedConfig: DevPulseConfig | null = null;

  const { unmount } = render(
    <SetupWizard 
      width={80} 
      height={24} 
      onComplete={(cfg) => {
        completedConfig = cfg;
      }} 
    />,
    { stdin, stdout }
  );

  // Wait for initial render and listeners attachment
  await new Promise(r => setTimeout(r, 100));

  // TEST 1: Click "+ Add (a)" button in Left Panel at col 8, row 20
  console.log('\n[TEST 1] Sending SGR Left Click on "+ Add (a)" button (col 8, row 20)...');
  stdin.write('\x1b[<0;8;20M'); // SGR press: baseButton 0, col 8, row 20
  await new Promise(r => setTimeout(r, 80));

  // TEST 2: Click on "Name" field in Right Panel (col 45, row 6)
  console.log('[TEST 2] Sending SGR Left Click on "Name" field (col 45, row 6)...');
  stdin.write('\x1b[<0;45;6M');
  await new Promise(r => setTimeout(r, 80));

  // Type a service name "orders-service"
  console.log('[TEST 2b] Typing "orders-service" into focused Name field...');
  stdin.write('orders-service');
  await new Promise(r => setTimeout(r, 80));

  // TEST 3: Click on "Folder Path" field in Right Panel (col 45, row 7)
  console.log('[TEST 3] Sending SGR Left Click on "Folder Path" field (col 45, row 7)...');
  stdin.write('\x1b[<0;45;7M');
  await new Promise(r => setTimeout(r, 80));

  // Type path "./services/orders"
  console.log('[TEST 3b] Typing "./services/orders" into focused Path field...');
  stdin.write('./services/orders');
  await new Promise(r => setTimeout(r, 80));

  // TEST 4: Click on "Command" field in Right Panel (col 45, row 8)
  console.log('[TEST 4] Sending SGR Left Click on "Command" field (col 45, row 8)...');
  stdin.write('\x1b[<0;45;8M');
  await new Promise(r => setTimeout(r, 80));

  // TEST 5: Click on "Auto-Start" toggle (col 45, row 10)
  console.log('[TEST 5] Sending SGR Left Click on "Auto-Start" toggle (col 45, row 10)...');
  stdin.write('\x1b[<0;45;10M'); // should toggle from true to false
  await new Promise(r => setTimeout(r, 80));

  // TEST 6: Click "+ Add to Registry" button (col 40, row 12)
  console.log('[TEST 6] Sending SGR Left Click on "+ Add to Registry" button (col 40, row 12)...');
  stdin.write('\x1b[<0;40;12M');
  await new Promise(r => setTimeout(r, 80));

  // TEST 7: Click "▶ Save & Launch" CTA button in Left Panel (col 15, row 22)
  console.log('[TEST 7] Sending SGR Left Click on "Save & Launch" CTA (col 15, row 22)...');
  stdin.write('\x1b[<0;15;22M');
  await new Promise(r => setTimeout(r, 120));

  unmount();

  if (completedConfig) {
    console.log('\n✅ TEST PASSED: SetupWizard successfully saved config and launched via mouse clicks!');
    console.log('Saved config summary:', {
      name: completedConfig.name,
      servicesCount: completedConfig.services.length,
      services: completedConfig.services.map(s => ({ name: s.name, path: s.path, cmd: s.command, auto: s.autoStart }))
    });
  } else {
    console.error('\n❌ TEST FAILED: onComplete was not triggered by mouse clicks.');
    process.exit(1);
  }
}

runMouseClickTests().catch(err => {
  console.error('Error during test:', err);
  process.exit(1);
});

