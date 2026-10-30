import React from 'react';
import { renderToString, render } from 'ink';
import assert from 'assert';
import { PassThrough } from 'stream';
import { ClickProvider } from '../src/components/common/ClickManager.js';
import { WizardRegistryPanel } from '../src/components/wizard/WizardRegistryPanel.js';
import SetupWizard from '../src/components/wizard/SetupWizard.js';
import { ServiceConfig } from '../src/types/config.js';

async function runWizardRegistryScrollTests() {
  console.log('=== STARTING WIZARD REGISTRY SCROLL & WINDOWING TESTS ===\n');

  const testServices: ServiceConfig[] = [
    { name: 'gateway', path: './gateway', command: 'npm run dev', port: 3000 },
    { name: 'orders', path: './orders', command: 'npm run dev', port: 3001 },
    { name: 'payments', path: './payments', command: 'npm run dev', port: 3002 },
    { name: 'products', path: './products', command: 'npm run dev', port: 3003 },
    { name: 'users', path: './users', command: 'npm run dev', port: 3004 },
    { name: 'notifications', path: './notifications', command: 'npm run dev', port: 3005 }
  ];

  // Test 1: Windowing calculation at contentHeight = 22 (maxVisible = 3)
  console.log('[Test 1] Testing initial windowing at selectedIndex = 0...');
  const output1 = renderToString(
    <ClickProvider>
      <WizardRegistryPanel
        services={testServices}
        selectedIndex={0}
        isEditingNew={false}
        isFocused={true}
        panelWidth={32}
        contentHeight={22}
      />
    </ClickProvider>
  );

  assert.ok(output1.includes('gateway'), 'gateway must be visible in window 1');
  assert.ok(output1.includes('orders'), 'orders must be visible in window 1');
  assert.ok(output1.includes('payments'), 'payments must be visible in window 1');
  assert.ok(!output1.includes('notifications'), 'notifications must be hidden initially (buried below)');
  assert.ok(output1.includes('[1/6]'), 'Header must show scroll position [1/6]');
  console.log('✔ Initial window correctly bounds visible services (1-3 of 6) with [1/6] position indicator');

  // Test 2: Window sliding when selecting a buried service (selectedIndex = 4 -> users)
  console.log('\n[Test 2] Testing window slide when navigating to buried service (selectedIndex = 4)...');
  const output2 = renderToString(
    <ClickProvider>
      <WizardRegistryPanel
        services={testServices}
        selectedIndex={4}
        isEditingNew={false}
        isFocused={true}
        panelWidth={32}
        contentHeight={22}
      />
    </ClickProvider>
  );

  assert.ok(output2.includes('users'), 'users must be visible in window when selectedIndex = 4');
  assert.ok(output2.includes('products'), 'products must be visible in window when selectedIndex = 4');
  assert.ok(!output2.includes('gateway'), 'gateway must now be scrolled out above');
  assert.ok(output2.includes('▲'), 'Header must show upward scroll indicator ▲');
  assert.ok(output2.includes('[5/6]'), 'Header must show scroll position [5/6]');
  console.log('✔ Window smoothly slides down: buried services become visible with ▲ scroll indicator');

  // Test 3: SGR Mouse Wheel scrolling in interactive SetupWizard
  console.log('\n[Test 3] Testing SGR Mouse Wheel Up/Down (buttons 64/65) in SetupWizard...');
  const stdin = new PassThrough() as any;
  stdin.setRawMode = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};
  stdin.isTTY = true;

  const stdout = new PassThrough() as any;
  stdout.isTTY = true;
  stdout.columns = 80;
  stdout.rows = 24;

  const { unmount } = render(
    <SetupWizard
      width={80}
      height={24}
      onComplete={() => {}}
    />,
    { stdin, stdout }
  );

  await new Promise(r => setTimeout(r, 100));

  // Send SGR Wheel Down: baseButton 65
  console.log('Sending SGR Wheel Down event (\\x1b[<65;15;10M)...');
  stdin.write('\x1b[<65;15;10M');
  await new Promise(r => setTimeout(r, 80));

  // Send SGR Wheel Up: baseButton 64
  console.log('Sending SGR Wheel Up event (\\x1b[<64;15;10M)...');
  stdin.write('\x1b[<64;15;10M');
  await new Promise(r => setTimeout(r, 80));

  unmount();
  console.log('✔ Mouse wheel scrolling events successfully processed without errors');

  console.log('\n=== ALL WIZARD REGISTRY SCROLL & WINDOWING TESTS PASSED (3/3) ===');
}

runWizardRegistryScrollTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
