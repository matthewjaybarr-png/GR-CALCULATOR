const test = require('node:test');
const assert = require('node:assert/strict');
const workflow = require('../js/workflow.js');

test('machine profiles require a name and at least one usable limit', () => {
  assert.throws(() => workflow.normalizeMachineProfile({name:'', maxRpm:10000}), /profile name/);
  assert.throws(() => workflow.normalizeMachineProfile({name:'Mill', maxRpm:0, maxFeedIpm:0}), /at least one/);
  assert.throws(() => workflow.normalizeMachineProfile({name:'Mill', maxRpm:-1}), /positive number/);
});

test('machine profiles normalize persisted numeric values', () => {
  assert.deepEqual(
    workflow.normalizeMachineProfile({id:'m1', name:'  Mill  ', maxRpm:'12000', maxFeedIpm:'400'}),
    {id:'m1', name:'Mill', maxRpm:12000, maxFeedIpm:400}
  );
});

test('machine limit checks report RPM and feed independently', () => {
  const profile = {id:'m1', name:'Mill', maxRpm:12000, maxFeedIpm:400};
  const result = workflow.evaluateMachineLimits(profile, {rpm:12500, feedIpm:450});
  assert.equal(result.withinLimits, false);
  assert.deepEqual(result.warnings.map(warning => warning.type), ['rpm', 'feed']);
});

test('zero means a machine limit is intentionally not configured', () => {
  const result = workflow.evaluateMachineLimits(
    {id:'m1', name:'Lathe', maxRpm:0, maxFeedIpm:200},
    {rpm:50000, feedIpm:150}
  );
  assert.equal(result.withinLimits, true);
  assert.deepEqual(result.warnings, []);
});

function fakeStorage(initial) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    dump: () => Object.fromEntries(map),
  };
}

test('legacy saved settings are copied to the new keys once', () => {
  const storage = fakeStorage({ oldProfiles: '[{"id":"m1"}]', oldActive: 'm1' });
  const copied = workflow.migrateLegacyKeys(storage, { oldProfiles: 'newProfiles', oldActive: 'newActive' });
  assert.equal(copied, 2);
  assert.equal(storage.getItem('newProfiles'), '[{"id":"m1"}]');
  assert.equal(storage.getItem('newActive'), 'm1');
  assert.equal(storage.getItem('oldProfiles'), '[{"id":"m1"}]', 'old keys are left in place');
  assert.equal(workflow.migrateLegacyKeys(storage, { oldProfiles: 'newProfiles' }), 0, 'second run copies nothing');
});

test('migration never overwrites settings already saved under the new key', () => {
  const storage = fakeStorage({ oldProfiles: 'old', newProfiles: 'current' });
  assert.equal(workflow.migrateLegacyKeys(storage, { oldProfiles: 'newProfiles' }), 0);
  assert.equal(storage.getItem('newProfiles'), 'current');
});

test('migration tolerates missing or blocked storage', () => {
  assert.equal(workflow.migrateLegacyKeys(null, { a: 'b' }), 0);
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(workflow.migrateLegacyKeys(blocked, { a: 'b' }), 0);
  assert.equal(workflow.migrateLegacyKeys(fakeStorage({}), { missing: 'b' }), 0);
});
