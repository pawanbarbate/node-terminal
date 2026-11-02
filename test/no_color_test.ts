import assert from 'node:assert/strict';

async function runNoColorTest() {
  process.env.NO_COLOR = '';
  process.env.COLORTERM = 'truecolor';
  const { theme } = await import('../src/theme/theme.js');
  assert.strictEqual(theme.ansi.setCanvasBg, '');
  assert.strictEqual(theme.ansi.resetCanvasBg, '');
  console.log('NO_COLOR disables DevPulse truecolor background control sequences.');
}

runNoColorTest().catch(error => {
  console.error('NO_COLOR test failed:', error);
  process.exitCode = 1;
});
