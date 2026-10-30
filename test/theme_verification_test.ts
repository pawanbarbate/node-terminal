import { theme, getServiceBadgeStyle } from '../src/theme/theme.js';
import assert from 'node:assert';

console.log('--- STARTING THEME & ANSI CANVAS VERIFICATION ---');

// 1. Verify ANSI Escape codes (Universal OSC 11 + 24-bit TrueColor BCE)
console.log('[1] Verifying ANSI sequences...');
assert.strictEqual(
  theme.ansi.setCanvasBg,
  '\x1b]11;#0B0F19\x07\x1b[48;2;11;15;25m\x1b[2J',
  'OSC 11 + TrueColor BCE setCanvasBg match'
);
assert.strictEqual(
  theme.ansi.resetCanvasBg,
  '\x1b]111\x07\x1b[0m\x1b[2J',
  'OSC 111 + ANSI Reset resetCanvasBg match'
);
console.log('✔ OSC 11 and TrueColor BCE escape sequences valid');

// 2. Verify Theme Color Tokens (Midnight Slate)
console.log('[2] Verifying Midnight Slate color tokens...');
assert.strictEqual(theme.colors.canvas, '#0B0F19');
assert.strictEqual(theme.colors.surface, '#0F172A');
assert.strictEqual(theme.colors.card, '#131F31');
assert.strictEqual(theme.colors.cardHover, '#14283A');
assert.strictEqual(theme.colors.cardSelected, '#14283A');
assert.strictEqual(theme.colors.borderDefault, '#25344A');
assert.strictEqual(theme.colors.borderFocus, '#38BDF8');
assert.strictEqual(theme.colors.borderSubtle, '#1B293B');
assert.strictEqual(theme.colors.textPrimary, '#FFFFFF');
assert.strictEqual(theme.colors.accent, '#38BDF8');
assert.strictEqual(theme.colors.running, '#22C55E');
assert.strictEqual(theme.colors.stopped, '#EF4444');
assert.strictEqual(theme.colors.warning, '#F59E0B');
console.log('✔ All Midnight Slate color tokens confirmed');

// 3. Verify Microservice Badge Generator
console.log('[3] Verifying deterministic badge generator...');
const badge1 = getServiceBadgeStyle('auth-service');
const badge2 = getServiceBadgeStyle('auth-service');
const badge3 = getServiceBadgeStyle('billing-service');

assert.strictEqual(badge1.bg, badge2.bg, 'Deterministic hash matching');
assert.strictEqual(badge1.fg, badge2.fg, 'Deterministic foreground matching');
assert.strictEqual(badge1.label, ' AUTH-SER ');
assert(badge1.bg.startsWith('#'), 'Badge BG is valid hex');
assert(badge1.fg.startsWith('#'), 'Badge FG is valid hex');
console.log(`✔ auth-service badge: ${badge1.label} (${badge1.bg} / ${badge1.fg})`);
console.log(`✔ billing-service badge: ${badge3.label} (${badge3.bg} / ${badge3.fg})`);

console.log('\n✅ ALL THEME & CANVAS CONTROL VERIFICATIONS PASSED!');
