import assert from 'assert';
import { resolveDependencyTiers } from '../src/services/dependencyGraph.js';
import { ServiceConfig } from '../src/types/config.js';

async function runDagDependencyTests() {
  console.log('=== STARTING DAG DEPENDENCY & TOPOLOGICAL RESOLUTION TESTS ===');

  // Test 1: Independent Services (no dependencies) -> All in Tier 0
  console.log('\n[Test 1] Testing independent services...');
  const independentServices: ServiceConfig[] = [
    { name: 'auth', path: '.', command: 'node auth.js' },
    { name: 'user', path: '.', command: 'node user.js' },
    { name: 'payment', path: '.', command: 'node payment.js' }
  ];

  const res1 = resolveDependencyTiers(independentServices);
  assert.strictEqual(res1.hasCycle, false, 'Expected no cycle in independent services');
  assert.strictEqual(res1.tiers.length, 1, 'Expected exactly 1 tier for independent services');
  assert.strictEqual(res1.tiers[0]!.length, 3, 'Expected all 3 services in tier 0');
  console.log('✔ Independent services successfully placed in a single tier (Tier 0)');

  // Test 2: Linear Dependency Chain (A -> B -> C)
  // B depends on A; C depends on B.
  console.log('\n[Test 2] Testing linear dependency chain (A -> B -> C)...');
  const linearServices: ServiceConfig[] = [
    { name: 'db', path: '.', command: 'node db.js' },
    { name: 'backend', path: '.', command: 'node api.js', dependsOn: ['db'] },
    { name: 'frontend', path: '.', command: 'node fe.js', dependsOn: ['backend'] }
  ];

  const res2 = resolveDependencyTiers(linearServices);
  assert.strictEqual(res2.hasCycle, false);
  assert.strictEqual(res2.tiers.length, 3, 'Expected 3 distinct tiers for linear chain');
  assert.deepStrictEqual(res2.tiers[0]!.map(s => s.name), ['db'], 'Tier 0 must be [db]');
  assert.deepStrictEqual(res2.tiers[1]!.map(s => s.name), ['backend'], 'Tier 1 must be [backend]');
  assert.deepStrictEqual(res2.tiers[2]!.map(s => s.name), ['frontend'], 'Tier 2 must be [frontend]');
  console.log('✔ Linear chain correctly resolved: [db] -> [backend] -> [frontend]');

  // Test 3: Diamond Dependencies (A -> [B, C] -> D)
  // B depends on A; C depends on A; D depends on both B and C.
  console.log('\n[Test 3] Testing diamond dependency (A -> [B, C] -> D)...');
  const diamondServices: ServiceConfig[] = [
    { name: 'service-a', path: '.', command: 'node a.js' },
    { name: 'service-b', path: '.', command: 'node b.js', dependsOn: ['service-a'] },
    { name: 'service-c', path: '.', command: 'node c.js', dependsOn: ['service-a'] },
    { name: 'service-d', path: '.', command: 'node d.js', dependsOn: ['service-b', 'service-c'] }
  ];

  const res3 = resolveDependencyTiers(diamondServices);
  assert.strictEqual(res3.hasCycle, false);
  assert.strictEqual(res3.tiers.length, 3, 'Expected 3 tiers for diamond graph');
  assert.deepStrictEqual(res3.tiers[0]!.map(s => s.name), ['service-a']);
  const tier1Names = res3.tiers[1]!.map(s => s.name).sort();
  assert.deepStrictEqual(tier1Names, ['service-b', 'service-c']);
  assert.deepStrictEqual(res3.tiers[2]!.map(s => s.name), ['service-d']);
  console.log('✔ Diamond graph correctly resolved: [service-a] -> [service-b, service-c] -> [service-d]');

  // Test 4: Circular Dependency Detection (A -> B -> A)
  console.log('\n[Test 4] Testing circular dependency detection (A -> B -> A)...');
  const circularServices: ServiceConfig[] = [
    { name: 'service-x', path: '.', command: 'node x.js', dependsOn: ['service-y'] },
    { name: 'service-y', path: '.', command: 'node y.js', dependsOn: ['service-x'] }
  ];

  const res4 = resolveDependencyTiers(circularServices);
  assert.strictEqual(res4.hasCycle, true, 'Expected hasCycle to be true');
  assert.ok(res4.cycleNodes && res4.cycleNodes.length >= 2, 'Expected cycleNodes to be populated');
  console.log('✔ Cycle detected successfully: cycleNodes =', res4.cycleNodes);

  // Test 5: Missing Dependency Reporting
  console.log('\n[Test 5] Testing missing dependency handling...');
  const missingDepServices: ServiceConfig[] = [
    { name: 'worker', path: '.', command: 'node worker.js', dependsOn: ['non-existent-redis'] }
  ];

  const res5 = resolveDependencyTiers(missingDepServices);
  assert.strictEqual(res5.hasCycle, false);
  assert.ok(res5.missingDependencies.has('worker'));
  assert.deepStrictEqual(res5.missingDependencies.get('worker'), ['non-existent-redis']);
  console.log('✔ Missing dependency captured accurately');

  console.log('\n=== ALL DAG DEPENDENCY TESTS PASSED (5/5) ===');
}

runDagDependencyTests().catch(err => {
  console.error('DAG dependency test failed:', err);
  process.exit(1);
});

