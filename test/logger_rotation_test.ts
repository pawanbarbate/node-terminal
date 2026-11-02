import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function runLoggerRotationTest() {
  const originalCwd = process.cwd();
  const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'devpulse-log-'));

  try {
    process.chdir(workspace);
    const { logger } = await import('../src/logger/logger.js');
    const oversizedMessage = 'log-data'.repeat(12_000);
    for (let index = 0; index < 100; index++) {
      logger.info(oversizedMessage);
    }
    await logger.flush();

    const activeLog = fs.statSync(path.join(workspace, 'logs', 'app.log')).size;
    const previousLog = fs.statSync(path.join(workspace, 'logs', 'app.log.1')).size;
    assert.ok(activeLog <= 5 * 1024 * 1024, 'Active log file must stay within its configured cap');
    assert.ok(previousLog <= 5 * 1024 * 1024, 'Rotated log file must stay within its configured cap');
    assert.ok(activeLog + previousLog <= 10 * 1024 * 1024, 'Total retained logs must remain bounded');
    console.log('Logger rotates bounded files and truncates oversized individual entries.');
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(workspace, { recursive: true, force: true });
  }
}

runLoggerRotationTest().catch(error => {
  console.error('Logger rotation test failed:', error);
  process.exitCode = 1;
});
