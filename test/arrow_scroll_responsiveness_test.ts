import { describe, it } from 'node:test';
import assert from 'node:assert';
import { 
  dashboardReducer, 
  initialDashboardState, 
  DashboardState 
} from '../src/state/dashboardReducer.js';

console.log('--- STARTING ARROW KEY SCROLL & RESPONSIVENESS TESTS ---');

// Test 1: SCROLL_SERVICE_LOGS runaway protection and instant 1st-press responsiveness
{
  const stateWithLogs: DashboardState = {
    ...initialDashboardState,
    services: [
      {
        ...initialDashboardState.services[0],
        logs: Array.from({ length: 15 }, (_, i) => ({
          timestamp: '10:00:00',
          message: `Log line ${i + 1}`,
          service: 'AUTH'
        }))
      }
    ],
    selectedIndex: 0,
    serviceLogScroll: 0,
    activePanel: 'serviceLogs'
  };

  const maxLogs = 5;
  const maxScroll = 15 - maxLogs; // 10

  // 1a. Up arrow pressed 1 time from 0 -> should immediately scroll to 1
  const step1 = dashboardReducer(stateWithLogs, { 
    type: 'SCROLL_SERVICE_LOGS', 
    delta: 1, 
    maxScroll 
  });
  assert.strictEqual(step1.serviceLogScroll, 1, 'Step 1: First Up Arrow must increment scroll to 1');
  console.log('✔ First Up Arrow immediately increments serviceLogScroll from 0 to 1');

  // 1b. Up arrow pressed up to maxScroll
  let current = step1;
  for (let i = 2; i <= maxScroll; i++) {
    current = dashboardReducer(current, { 
      type: 'SCROLL_SERVICE_LOGS', 
      delta: 1, 
      maxScroll 
    });
  }
  assert.strictEqual(current.serviceLogScroll, maxScroll, `At top: serviceLogScroll must equal maxScroll (${maxScroll})`);

  // 1c. Up arrow pressed again beyond maxScroll -> must clamp to maxScroll (NO UNBOUNDED RUNAWAY!)
  const overScroll = dashboardReducer(current, { 
    type: 'SCROLL_SERVICE_LOGS', 
    delta: 1, 
    maxScroll 
  });
  assert.strictEqual(overScroll.serviceLogScroll, maxScroll, 'Over-scroll must be clamped to maxScroll');
  console.log('✔ Over-scroll beyond maxScroll is strictly clamped (prevents scroll runaway)');

  // 1d. Down arrow pressed from top (at maxScroll = 10) -> ON THE VERY FIRST PRESS, it must be 9!
  const stepDown = dashboardReducer(overScroll, { 
    type: 'SCROLL_SERVICE_LOGS', 
    delta: -1, 
    maxScroll 
  });
  assert.strictEqual(stepDown.serviceLogScroll, 9, 'StepDown: First Down Arrow MUST immediately scroll down to 9 (0 delayed presses)');
  console.log('✔ First Down Arrow IMMEDIATELY decrements from maxScroll (0 delayed start presses)');

  // 1e. Simulating previous runaway state (scroll was somehow 999 or 50)
  const legacyRunawayState: DashboardState = {
    ...stateWithLogs,
    serviceLogScroll: 999
  };
  const recovered = dashboardReducer(legacyRunawayState, { 
    type: 'SCROLL_SERVICE_LOGS', 
    delta: -1, 
    maxScroll 
  });
  assert.strictEqual(recovered.serviceLogScroll, 9, 'Runaway recovery: pressing Down Arrow immediately snaps to maxScroll - 1 = 9');
  console.log('✔ Runaway recovery: Down Arrow immediately snaps excessive offset down on very 1st press');
}

// Test 2: SCROLL_GLOBAL_LOGS runaway protection and instant 1st-press responsiveness
{
  const stateWithGlobalLogs: DashboardState = {
    ...initialDashboardState,
    globalLogs: Array.from({ length: 20 }, (_, i) => ({
      timestamp: '10:00:00',
      message: `Global log ${i + 1}`,
      service: 'AUTH'
    })),
    globalLogScroll: 0,
    activePanel: 'globalLogs'
  };

  const maxLogs = 8;
  const maxScroll = 20 - maxLogs; // 12

  // 2a. First up arrow
  const up1 = dashboardReducer(stateWithGlobalLogs, { 
    type: 'SCROLL_GLOBAL_LOGS', 
    delta: 1, 
    maxScroll 
  });
  assert.strictEqual(up1.globalLogScroll, 1, 'First Global Up Arrow must increment to 1');

  // 2b. Home key sets to maxScroll
  const atHome = dashboardReducer(up1, { 
    type: 'SET_GLOBAL_LOG_SCROLL', 
    value: maxScroll, 
    maxScroll 
  });
  assert.strictEqual(atHome.globalLogScroll, 12, 'Home must set scroll to maxScroll');

  // 2c. First Down Arrow after Home must immediately scroll down to 11
  const down1 = dashboardReducer(atHome, { 
    type: 'SCROLL_GLOBAL_LOGS', 
    delta: -1, 
    maxScroll 
  });
  assert.strictEqual(down1.globalLogScroll, 11, 'First Down Arrow after Home must immediately scroll down to 11');
  console.log('✔ Global logs: First Down Arrow after Home immediately scrolls down');
}

// Test 3: ServicesPanel sliding window algorithm verification
{
  const services = Array.from({ length: 10 }, (_, i) => ({
    id: `svc-${i + 1}`,
    name: `service-${i + 1}`,
    status: 'running' as const,
    uptime: '1m',
    uptimeSeconds: 60,
    command: 'npm start',
    port: `:300${i}`,
    pid: `${100 + i}`,
    errors: 0,
    metrics: { cpu: '1%', memory: '50MB', p50: '5ms', p99: '10ms', requests: '10' },
    logs: [],
    errorLogs: []
  }));

  const maxVisibleCards = 4;

  // Function mimicking ServicesPanel sliding window
  const getWindow = (selectedIndex: number) => {
    let startIndex = 0;
    if (services.length > maxVisibleCards) {
      if (selectedIndex >= maxVisibleCards) {
        startIndex = selectedIndex - maxVisibleCards + 1;
      }
      startIndex = Math.max(0, Math.min(services.length - maxVisibleCards, startIndex));
    }
    const visible = services.slice(startIndex, startIndex + maxVisibleCards);
    return { startIndex, visible };
  };

  // At index 0: visible should be 0..3
  const w0 = getWindow(0);
  assert.strictEqual(w0.startIndex, 0);
  assert.strictEqual(w0.visible[0].name, 'service-1');
  assert.strictEqual(w0.visible.length, 4);

  // At index 4 (5th service): window must slide so service-5 is visible
  const w4 = getWindow(4);
  assert.strictEqual(w4.startIndex, 1);
  assert.strictEqual(w4.visible[3].name, 'service-5');
  console.log('✔ Services sliding window: selected index 4 slides window to include service-5');

  // At index 9 (last service): window must slide to end (startIndex 6, items 6..9)
  const w9 = getWindow(9);
  assert.strictEqual(w9.startIndex, 6);
  assert.strictEqual(w9.visible[3].name, 'service-10');
  console.log('✔ Services sliding window: last index 9 slides window to end with service-10 visible');
}

// Test 4: SET_NARROW_TAB synchronizes activePanel
{
  const stateNarrow = dashboardReducer(initialDashboardState, {
    type: 'SET_NARROW_TAB',
    tab: 'detail'
  });
  assert.strictEqual(stateNarrow.narrowTab, 'detail');
  assert.strictEqual(stateNarrow.activePanel, 'serviceLogs');
  console.log('✔ SET_NARROW_TAB correctly synchronizes activePanel to serviceLogs');
}

console.log('\n✅ ALL ARROW KEY SCROLL & RESPONSIVENESS TESTS PASSED PERFECTLY!\n');

