process.env.FORCE_COLOR = '3';
import { PassThrough } from 'stream';
import assert from 'node:assert';

const React = (await import('react')).default;
const { render } = await import('ink');
const { theme } = await import('../src/theme/theme.js');
const { ClickProvider } = await import('../src/components/common/ClickManager.js');
const { ServicesPanel } = await import('../src/components/ServicesPanel.js');
const { ConfigSelectorScreen } = await import('../src/components/selector/ConfigSelectorScreen.js');

console.log('--- STARTING CROSS-PLATFORM TERMINAL BACKGROUND VERIFICATION ---');

// 1. Verify ANSI Escape Sequences (TrueColor BCE + Buffer Isolation)
console.log('[1] Verifying enhanced theme.ansi tokens...');
assert.strictEqual(theme.ansi.setCanvasBg, '\x1b[48;2;11;15;25m\x1b[2J');
assert.strictEqual(theme.ansi.resetCanvasBg, '\x1b[0m\x1b[2J');
assert(!theme.ansi.initScreen.includes('11;#0B0F19'), 'initScreen MUST NOT pollute host window with OSC 11');
assert(theme.ansi.initScreen.includes('48;2;11;15;25m'), 'initScreen applies TrueColor BCE to canvas color');
assert(theme.ansi.restoreScreen.includes('\x1b[?1049l'), 'restoreScreen cleanly leaves alternate buffer');
assert(theme.ansi.restoreScreen.includes('\x1b[0m'), 'restoreScreen resets SGR text/bg attributes');
console.log('✔ Terminal buffer ANSI sequences verified (clean alternate buffer isolation, 0 host pollution)');

// Helper to capture rendered frames from Ink
function captureRender(element: React.ReactElement): Promise<string> {
  return new Promise((resolve) => {
    const out = new PassThrough() as any;
    out.isTTY = true;
    out.columns = 80;
    out.rows = 24;
    out.getColorDepth = () => 24;
    let buf = '';
    out.on('data', (d: any) => (buf += d.toString()));
    const inst = render(element, { stdout: out, debug: true });
    setTimeout(() => {
      inst.unmount();
      resolve(buf);
    }, 150);
  });
}

// 2. Verify ServicesPanel has zero \u001b[49m resets on borders and unselected cards
console.log('[2] Verifying ServicesPanel border & card background styling...');
const services = [
  { id: '1', name: 'gateway', status: 'running' as const, uptime: '1s', port: 3000, command: 'npm run dev' },
  { id: '2', name: 'orders', status: 'running' as const, uptime: '0s', port: 3002, command: 'npm run dev' },
  { id: '3', name: 'payments', status: 'running' as const, uptime: '0s', port: 3003, command: 'npm run dev' },
  { id: '4', name: 'products', status: 'running' as const, uptime: '0s', port: 3001, command: 'npm run dev' }
];

const servicesOutput = await captureRender(
  React.createElement(ClickProvider, {},
    React.createElement(ServicesPanel, {
      services,
      selectedIndex: 0,
      isFocused: true,
      isCompactHeight: false,
      panelWidth: 40,
      height: 25
    })
  )
);

const serviceLines = servicesOutput.split('\n');
let serviceBadResets = 0;
for (const line of serviceLines) {
  const m = line.match(/\u001b\[49m[^\u001b]*[╭─╮│╰╯]/);
  if (m) {
    serviceBadResets++;
  }
}
assert.strictEqual(serviceBadResets, 0, 'ServicesPanel must have 0 border glyphs preceded by \\u001b[49m reset');

// Verify unselected card background is explicit #131F31 (RGB 19, 31, 49)
assert(
  servicesOutput.includes('\u001b[48;2;19;31;49m'),
  'ServicesPanel must explicitly render unselected cards with #131F31'
);
console.log('✔ ServicesPanel has 0 border reset leaks and explicit card backgrounds');

// 3. Verify ConfigSelectorScreen has zero \u001b[49m resets on borders
console.log('[3] Verifying ConfigSelectorScreen border & modal background styling...');
const configs = [
  {
    path: '/var/www/html/node-terminal/config.devpulse.json',
    filename: 'config.devpulse.json',
    name: 'config.devpulse.json',
    servicesCount: 4,
    isValid: true,
    services: [
      { name: 'gateway', port: 3000 },
      { name: 'orders', port: 3002 }
    ]
  },
  {
    path: '/var/www/html/node-terminal/staging.devpulse.json',
    filename: 'staging.devpulse.json',
    name: 'staging.devpulse.json',
    servicesCount: 2,
    isValid: true,
    services: []
  }
];

const selectorOutput = await captureRender(
  React.createElement(ConfigSelectorScreen, {
    configs,
    onSelect: () => {},
    onNewConfig: () => {},
    onCancel: () => {},
    width: 80,
    height: 25
  })
);

const selectorLines = selectorOutput.split('\n');
let selectorBadResets = 0;
for (const line of selectorLines) {
  const m = line.match(/\u001b\[49m[^\u001b]*[╭─╮│╰╯]/);
  if (m) {
    selectorBadResets++;
  }
}
assert.strictEqual(selectorBadResets, 0, 'ConfigSelectorScreen must have 0 border glyphs preceded by \\u001b[49m reset');
console.log('✔ ConfigSelectorScreen has 0 border reset leaks');

console.log('\n✅ ALL CROSS-PLATFORM TERMINAL BACKGROUND VERIFICATIONS PASSED PERFECTLY!\n');
