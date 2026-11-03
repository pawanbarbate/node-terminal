import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { parseCliArgs } from '../src/services/configManager.js';
import { logger } from '../src/logger/logger.js';

async function runCliFlagsAndSafetyTest() {
  console.log('--- RUNNING CLI FLAGS AND SAFETY TEST ---');

  // 1. Test parseCliArgs directly
  const argsHelp = parseCliArgs(['--help']);
  assert.strictEqual(argsHelp.help, true, 'parseCliArgs must recognize --help');

  const argsShortHelp = parseCliArgs(['-h']);
  assert.strictEqual(argsShortHelp.help, true, 'parseCliArgs must recognize -h');

  const argsVersion = parseCliArgs(['--version']);
  assert.strictEqual(argsVersion.version, true, 'parseCliArgs must recognize --version');

  const argsShortVersion = parseCliArgs(['-v']);
  assert.strictEqual(argsShortVersion.version, true, 'parseCliArgs must recognize -v');

  const argsConfig = parseCliArgs(['-c', 'custom.devpulse.json']);
  assert.strictEqual(argsConfig.configPath, 'custom.devpulse.json', 'parseCliArgs must parse -c');

  // 2. Test logger directory resolution
  const defaultLogDir = logger.getLogDir();
  assert.ok(
    defaultLogDir.includes('.devpulse') || defaultLogDir.includes(os.tmpdir()),
    `Logger must store outside current project root by default: ${defaultLogDir}`
  );

  const isolatedWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'devpulse-cwd-check-'));
  const originalCwd = process.cwd();
  try {
    process.chdir(isolatedWorkspace);
    logger.info('Test log entry in isolated cwd');
    await logger.flush();
    assert.strictEqual(
      fs.existsSync(path.join(isolatedWorkspace, 'logs')),
      false,
      'Logger must not create logs directory in cwd'
    );
  } finally {
    process.chdir(originalCwd);
    fs.rmSync(isolatedWorkspace, { recursive: true, force: true });
  }

  // 3. Test CLI process with --help
  const cliPath = path.resolve(process.cwd(), 'src/cli.tsx');
  const tsxPath = path.resolve(process.cwd(), 'node_modules/.bin/tsx');

  const helpRun = spawnSync(tsxPath, [cliPath, '--help'], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
  assert.strictEqual(helpRun.status, 0, 'CLI with --help must exit with code 0');
  assert.ok(helpRun.stdout.includes('Usage:'), 'CLI with --help must print usage information');
  assert.ok(helpRun.stdout.includes('Options:'), 'CLI with --help must print options');

  // 4. Test CLI process with --version
  const versionRun = spawnSync(tsxPath, [cliPath, '--version'], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
  assert.strictEqual(versionRun.status, 0, 'CLI with --version must exit with code 0');
  assert.ok(versionRun.stdout.includes('devpulse v'), 'CLI with --version must print version info');

  // 5. Test CLI process in non-interactive mode (piped stdio, no TTY)
  const nonTtyRun = spawnSync(tsxPath, [cliPath], {
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, NO_COLOR: '1' }
  });
  assert.strictEqual(nonTtyRun.status, 1, 'CLI in non-interactive mode must exit with code 1');
  assert.ok(
    nonTtyRun.stderr.includes('requires an interactive TTY'),
    'CLI in non-interactive mode must print informative error to stderr'
  );

  console.log('✔ CLI flags and non-TTY safety tests passed successfully.');
}

runCliFlagsAndSafetyTest().catch(err => {
  console.error('CLI flags and safety test failed:', err);
  process.exitCode = 1;
});
