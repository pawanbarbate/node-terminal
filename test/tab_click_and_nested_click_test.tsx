import React from 'react';
import assert from 'node:assert';
import { render } from 'ink';
import { PassThrough } from 'stream';
import { ClickProvider, Clickable, ClickManagerContextValue } from '../src/components/common/ClickManager.js';
import { dashboardReducer, initialDashboardState } from '../src/state/dashboardReducer.js';

console.log('--- STARTING TAB CLICK & NESTED CLICK HIERARCHY TESTS ---');

// TEST 1: Unit verification of ClickManager innermost child precedence
async function testNestedClickablePrecedence() {
  const clickManagerRef = { current: null as ClickManagerContextValue | null };
  let parentClickCount = 0;
  let clickedTab = '';

  const stdin = new PassThrough() as any;
  stdin.setRawMode = () => {};
  stdin.ref = () => {};
  stdin.unref = () => {};
  stdin.isTTY = true;

  const stdout = new PassThrough() as any;
  stdout.isTTY = true;
  stdout.columns = 100;
  stdout.rows = 30;

  // Render a parent panel (large area) containing 4 tabs (small area)
  const { unmount } = render(
    <ClickProvider clickManagerRef={clickManagerRef}>
      <Clickable 
        onClick={() => { parentClickCount++; }} 
        width={60} 
        height={15}
      >
        <Clickable onClick={() => { clickedTab = 'logs'; }} width={6} height={2}>
          {/* Logs Tab */}
        </Clickable>
        <Clickable onClick={() => { clickedTab = 'errors'; }} width={10} height={2}>
          {/* Errors Tab */}
        </Clickable>
        <Clickable onClick={() => { clickedTab = 'metrics'; }} width={9} height={2}>
          {/* Metrics Tab */}
        </Clickable>
        <Clickable onClick={() => { clickedTab = 'env'; }} width={5} height={2}>
          {/* Env Tab */}
        </Clickable>
      </Clickable>
    </ClickProvider>,
    { stdin, stdout }
  );

  // Allow layout and bounds registration
  await new Promise(r => setTimeout(r, 100));

  assert(clickManagerRef.current !== null, 'ClickManager must be registered');

  // Find registered bounds
  // Test click on Tab 1 (Logs)
  clickedTab = '';
  parentClickCount = 0;
  const hitLogs = clickManagerRef.current.dispatchClick(2, 1);
  assert.strictEqual(hitLogs, true, 'Click on Logs tab must be dispatched');
  assert.strictEqual(clickedTab, 'logs', 'Logs tab onClick must be invoked');
  assert.strictEqual(parentClickCount, 0, 'Parent panel must NOT swallow the child tab click');

  // Test click on Tab 2 (Errors)
  clickedTab = '';
  const hitErrors = clickManagerRef.current.dispatchClick(8, 1);
  assert.strictEqual(hitErrors, true, 'Click on Errors tab must be dispatched');
  assert.strictEqual(clickedTab, 'errors', 'Errors tab onClick must be invoked');

  // Test click on Tab 3 (Metrics)
  clickedTab = '';
  const hitMetrics = clickManagerRef.current.dispatchClick(18, 1);
  assert.strictEqual(hitMetrics, true, 'Click on Metrics tab must be dispatched');
  assert.strictEqual(clickedTab, 'metrics', 'Metrics tab onClick must be invoked');

  // Test click on Tab 4 (Env)
  clickedTab = '';
  const hitEnv = clickManagerRef.current.dispatchClick(28, 1);
  assert.strictEqual(hitEnv, true, 'Click on Env tab must be dispatched');
  assert.strictEqual(clickedTab, 'env', 'Env tab onClick must be invoked');

  // Test click on parent blank space (col 50, row 10 - inside parent, outside all tabs)
  clickedTab = '';
  parentClickCount = 0;
  const hitParent = clickManagerRef.current.dispatchClick(50, 10);
  assert.strictEqual(hitParent, true, 'Click on parent blank area must be dispatched');
  assert.strictEqual(parentClickCount, 1, 'Parent onClick must be invoked');
  assert.strictEqual(clickedTab, '', 'No tab should be clicked');

  unmount();

  console.log('✔ Tab 1 (Logs) received click over parent panel');
  console.log('✔ Tab 2 (Errors) received click over parent panel');
  console.log('✔ Tab 3 (Metrics) received click over parent panel');
  console.log('✔ Tab 4 (Env) received click over parent panel');
  console.log('✔ Parent panel receives click when clicking blank space');
}

// TEST 2: Reducer tab state transition
function testReducerTabTransitions() {
  const tabs = ['logs', 'errors', 'metrics', 'env'] as const;

  for (const tab of tabs) {
    const nextState = dashboardReducer(initialDashboardState, {
      type: 'SET_ACTIVE_TAB',
      tab
    });
    assert.strictEqual(nextState.activeTab, tab, `activeTab must be set to ${tab}`);
    assert.strictEqual(nextState.activePanel, 'serviceLogs', 'activePanel must be focused to serviceLogs');
    assert.strictEqual(nextState.serviceLogScroll, 0, 'serviceLogScroll must be reset to 0');
  }
  console.log('✔ Reducer SET_ACTIVE_TAB correctly updates activeTab, activePanel, and resets scroll');
}

async function run() {
  await testNestedClickablePrecedence();
  testReducerTabTransitions();
  console.log('\n✅ ALL TAB CLICK & NESTED CLICK HIERARCHY TESTS PASSED PERFECTLY!\n');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
