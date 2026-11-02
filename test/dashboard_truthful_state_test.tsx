import assert from 'node:assert/strict';
import React from 'react';
import { renderToString } from 'ink';
import SystemPanel from '../src/components/SystemPanel.js';
import GlobalLogsPanel from '../src/components/GlobalLogsPanel.js';
import { ClickProvider, ClickManagerContextValue } from '../src/components/common/ClickManager.js';
import {
  configToServices,
  createInitialDashboardState,
  dashboardReducer
} from '../src/state/dashboardReducer.js';

const emptyState = createInitialDashboardState({ name: 'empty', services: [] });
assert.deepStrictEqual(emptyState.services, []);
assert.deepStrictEqual(emptyState.globalLogs, []);
assert.deepStrictEqual(emptyState.filterOptions, ['All Services']);
assert.deepStrictEqual(emptyState.summary, {
  servicesRunning: 0,
  servicesTotal: 0,
  uptime: '0m 0s'
});
const emptySystemOutput = renderToString(
  <SystemPanel summary={emptyState.summary} panelWidth={60} height={8} />
);
assert.match(emptySystemOutput, /No services configured/);
assert.doesNotMatch(emptySystemOutput, /CPU|Memory|Latency|Healthy|Degraded/);
const compactSystemOutput = renderToString(
  <SystemPanel summary={emptyState.summary} panelWidth={30} height={3} isUltraCompact />
);
assert.match(compactSystemOutput, /none/);
const clickManagerRef = { current: null as ClickManagerContextValue | null };
const emptyLogsOutput = renderToString(
  <ClickProvider clickManagerRef={clickManagerRef}>
    <GlobalLogsPanel logs={[]} panelWidth={80} />
  </ClickProvider>
);
assert.match(emptyLogsOutput, /No logs captured yet/);

const services = configToServices({
  name: 'configured',
  services: [
    { name: 'api', path: './api', command: 'npm start', autoStart: true },
    { name: 'worker', path: './worker', command: 'npm run worker', autoStart: false }
  ]
});

assert.strictEqual(services.length, 2);
assert.strictEqual(services[0]?.port, '');
assert.deepStrictEqual(services[0]?.logs, []);
assert.deepStrictEqual(services[0]?.errorLogs, []);
assert.strictEqual(services[1]?.status, 'stopped');

let state = createInitialDashboardState({ name: 'configured', services: [
  { name: 'api', path: './api', command: 'npm start', autoStart: true }
] });
state = dashboardReducer(state, {
  type: 'PROCESS_STATUS_CHANGED',
  serviceName: 'api',
  status: 'running',
  pid: 4321
});
assert.strictEqual(state.summary.servicesRunning, 1);
assert.strictEqual(state.summary.servicesTotal, 1);
assert.strictEqual(state.services[0]?.pid, '4321');

state = dashboardReducer(state, {
  type: 'APPEND_REAL_LOG',
  serviceName: 'api',
  log: {
    id: 'api-error-1',
    timestamp: '12:00:00',
    service: 'api',
    level: 'error',
    message: 'real process error'
  }
});
assert.strictEqual(state.globalLogs.length, 1);
assert.strictEqual(state.services[0]?.errorLogs?.[0]?.message, 'real process error');
assert.strictEqual(state.services[0]?.errors, 1);

for (let index = 0; index < 205; index++) {
  state = dashboardReducer(state, {
    type: 'APPEND_REAL_LOG',
    serviceName: 'api',
    log: {
      id: `bounded-${index}`,
      timestamp: '12:00:00',
      service: 'api',
      level: 'error',
      message: `bounded log ${index}`
    }
  });
}
assert.strictEqual(state.globalLogs.length, 200);
assert.strictEqual(state.services[0]?.logs?.length, 200);
assert.strictEqual(state.services[0]?.errorLogs?.length, 100);
assert.strictEqual(state.globalLogs.at(-1)?.id, 'bounded-204');

console.log('Dashboard state contains only configured services and observed runtime data.');
