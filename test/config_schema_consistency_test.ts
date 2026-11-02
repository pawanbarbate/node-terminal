import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CONFIG_SCHEMA_URL } from '../src/types/config.js';
import { validateConfig } from '../src/services/configManager.js';

const schema = JSON.parse(
  fs.readFileSync(new URL('../schema/devpulse.schema.json', import.meta.url), 'utf-8')
) as { $id: string; required: string[]; properties: Record<string, unknown> };

assert.strictEqual(schema.$id, CONFIG_SCHEMA_URL);
assert.deepStrictEqual(schema.required, ['services']);
assert.ok('services' in schema.properties);

const validConfig = {
  $schema: CONFIG_SCHEMA_URL,
  name: 'local-stack',
  settings: { bootStaggerMs: 200, maxConcurrentBoot: 2 },
  services: [
    { name: 'api', path: './api', command: 'npm run dev', port: 4000, readyPattern: 'listening' },
    { name: 'web', path: './web', commands: ['npm ci', 'npm run dev'], dependsOn: ['api'] },
    { name: 'cleanup', path: '.', preStart: ['npm run clean'], autoStart: false }
  ]
};

assert.deepStrictEqual(validateConfig(validConfig), []);
assert.ok(validateConfig({ ...validConfig, $schema: 3 }).some(error => error.includes('$schema must be a string')));
assert.ok(validateConfig({
  services: [{ name: 'api', path: '.', command: ['npm start', '  '] }]
}).some(error => error.includes('command must contain only non-empty strings')));
assert.ok(validateConfig({
  services: [{ name: 'api', path: '.', command: 'npm start', commands: [] }]
}).some(error => error.includes('commands must contain only non-empty strings')));
assert.ok(validateConfig({
  services: [{ name: 'api', path: '.', command: 'npm start', preStart: [] }]
}).some(error => error.includes('preStart must contain only non-empty strings')));

console.log('Published schema reference and runtime config validation agree for supported config forms.');
