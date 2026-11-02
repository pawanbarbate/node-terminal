import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'devpulse-package-smoke-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

try {
  const packOutput = execFileSync(
    npm,
    ['pack', '--json', '--ignore-scripts', '--pack-destination', workspace],
    { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const packResult = JSON.parse(packOutput)[0];
  assert.ok(packResult?.filename, 'npm pack should return the generated tarball name');
  const packedFiles = new Set(packResult.files.map(file => file.path));
  for (const requiredFile of ['package.json', 'README.md', 'dist/cli.js', 'dist/version.js', 'schema/devpulse.schema.json']) {
    assert.ok(packedFiles.has(requiredFile), `Package is missing ${requiredFile}`);
  }
  for (const file of packedFiles) {
    assert.ok(!/^(test|logs?|node_modules)\//.test(file), `Package must not contain ${file}`);
    assert.ok(!/\.devpulse\.json$|\.bak$|(^|\/)\.env(?:\.|$)/.test(file), `Package must not contain local data: ${file}`);
  }

  const tarball = path.join(workspace, packResult.filename);
  const consumer = path.join(workspace, 'consumer');
  fs.mkdirSync(consumer);
  execFileSync(
    npm,
    ['install', '--prefix', consumer, '--ignore-scripts', '--no-audit', '--no-fund', tarball],
    { cwd: consumer, stdio: 'inherit' }
  );

  const executable = path.join(consumer, 'node_modules', '.bin', process.platform === 'win32' ? 'devpulse.cmd' : 'devpulse');
  const smoke = spawnSync(executable, [], { cwd: consumer, encoding: 'utf-8' });
  assert.equal(smoke.status, 1, `Installed CLI exited with ${smoke.status}: ${smoke.error || ''}`);
  assert.match(`${smoke.stdout || ''}${smoke.stderr || ''}`, /requires an interactive TTY/);
  console.log('Packed CLI installs cleanly and its executable starts with the expected TTY guard.');
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
