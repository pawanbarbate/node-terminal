import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { autoDetectServices } from '../src/services/configManager.js';

const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'devpulse-detect-'));

function createFile(relativePath: string, contents = '') {
  const filePath = path.join(workspace, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf-8');
}

try {
  createFile('apps/api/package.json', JSON.stringify({
    name: 'api',
    scripts: { start: 'node server.js' }
  }));
  createFile('apps/no-script/package.json', JSON.stringify({ name: 'no-script' }));
  createFile('backend/python-app/app.py');
  createFile('services/requirements-only/requirements.txt');

  const detected = autoDetectServices(workspace);
  assert.deepStrictEqual(
    detected.map(service => [service.path, service.command]),
    [
      ['./apps/api', 'npm start'],
      ['./backend/python-app', 'python app.py']
    ]
  );
  console.log('Auto-detection only returns services with a discoverable runnable entry point.');
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}
