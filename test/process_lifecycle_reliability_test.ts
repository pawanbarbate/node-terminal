import assert from 'node:assert/strict';
import net from 'node:net';
import { processManager } from '../src/services/processManager.js';
import { ProcessCallbacks, ServiceStatus } from '../src/types/index.js';
import { ServiceConfig } from '../src/types/config.js';

async function runProcessLifecycleReliabilityTests() {
  const statuses = new Map<string, ServiceStatus>();
  const logs: string[] = [];
  const originalNoColor = process.env.NO_COLOR;
  const originalForceColor = process.env.FORCE_COLOR;
  const callbacks: ProcessCallbacks = {
    onLog: (_name, log) => logs.push(log.message),
    onStatusChange: (name, status) => statuses.set(name, status)
  };

  try {
    const patternReady: ServiceConfig = {
      name: 'pattern-ready',
      path: '.',
      command: 'node -e "setTimeout(() => console.log(\'READY_TOKEN\'), 50); setInterval(() => {}, 500);"',
      readyPattern: 'READY_TOKEN'
    };
    await processManager.startAll([patternReady], callbacks, { bootStaggerMs: 0 });
    assert.ok(logs.some(message => message.includes('READY_TOKEN')));
    assert.ok(processManager.isRunning(patternReady.name), 'Pattern-ready process should remain active');
    await processManager.stopAll();
    assert.strictEqual(processManager.isRunning(patternReady.name), false);

    const longOutput: ServiceConfig = {
      name: 'long-output',
      path: '.',
      command: 'node -e "process.stdout.write(\'X\'.repeat(20000)); setInterval(() => {}, 500);"'
    };
    const priorLogCount = logs.length;
    await processManager.startAll([longOutput], callbacks, { bootStaggerMs: 0 });
    const longOutputLogs = logs.slice(priorLogCount).filter(message => message.includes('X'));
    assert.ok(longOutputLogs.length >= 2, 'Long unbroken output should be emitted in bounded chunks');
    assert.ok(longOutputLogs.every(message => message.length <= 8192), 'No process output log should exceed the line bound');
    await processManager.stopAll();

    process.env.NO_COLOR = '';
    process.env.FORCE_COLOR = '1';
    const noColorService: ServiceConfig = {
      name: 'no-color-child',
      path: '.',
      command: 'node -e "console.log(\'COLOR_ENV=\' + process.env.FORCE_COLOR + \',\' + (\'NO_COLOR\' in process.env)); setInterval(() => {}, 500);"'
    };
    const noColorLogStart = logs.length;
    await processManager.startAll([noColorService], callbacks, { bootStaggerMs: 0 });
    assert.ok(
      logs.slice(noColorLogStart).some(message => message.includes('COLOR_ENV=0,true')),
      'Child commands should inherit the no-color preference'
    );
    await processManager.stopAll();

    const manualDependency: ServiceConfig = {
      name: 'manual-database',
      path: '.',
      command: 'node -e "setInterval(() => {}, 500);"',
      autoStart: false
    };
    const dependent: ServiceConfig = {
      name: 'manual-dependent',
      path: '.',
      command: 'node -e "console.log(\'MUST_NOT_START\'); setInterval(() => {}, 500);"',
      dependsOn: ['manual-database']
    };
    await processManager.startAll([manualDependency, dependent], callbacks, { bootStaggerMs: 0 });
    assert.strictEqual(statuses.get(dependent.name), 'blocked');
    assert.strictEqual(processManager.isRunning(dependent.name), false);

    const controller = new AbortController();
    const first: ServiceConfig = {
      name: 'cancel-first',
      path: '.',
      command: 'node -e "setInterval(() => {}, 500);"'
    };
    const second: ServiceConfig = {
      name: 'cancel-second',
      path: '.',
      command: 'node -e "console.log(\'MUST_NOT_START\'); setInterval(() => {}, 500);"'
    };
    const boot = processManager.startAll([first, second], callbacks, {
      bootStaggerMs: 5000,
      maxConcurrentBoot: 1
    }, controller.signal);
    await new Promise(resolve => setTimeout(resolve, 100));
    controller.abort();
    await processManager.stopAll();
    await boot;
    assert.strictEqual(processManager.isRunning(first.name), false);
    assert.strictEqual(processManager.isRunning(second.name), false);
    assert.ok(!logs.some(message => message.includes('MUST_NOT_START')));

    const server = net.createServer();
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const occupiedPort = address.port;
    const occupiedPortService: ServiceConfig = {
      name: 'occupied-port',
      path: '.',
      command: 'node -e "setInterval(() => {}, 500);"',
      port: occupiedPort
    };
    assert.strictEqual(await processManager.startService(occupiedPortService, callbacks), null);
    assert.strictEqual(statuses.get(occupiedPortService.name), 'stopped');
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } finally {
    await processManager.stopAll();
    if (originalNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = originalNoColor;
    if (originalForceColor === undefined) delete process.env.FORCE_COLOR;
    else process.env.FORCE_COLOR = originalForceColor;
  }
}

runProcessLifecycleReliabilityTests()
  .then(() => console.log('✔ Readiness, manual dependency, cancellation and occupied-port checks passed'))
  .catch(error => {
    console.error('Process lifecycle reliability test failed:', error);
    processManager.stopAllSync();
    process.exitCode = 1;
  });
