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
