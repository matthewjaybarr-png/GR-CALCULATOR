const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/core.js');

const closeTo = (actual, expected, tolerance = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} was not within ${tolerance} of ${expected}`);
};

test('surface-speed calculation uses one explicit basis', () => {
  const fromSfm = calc.resolveSurfaceSpeed({ basis: 'sfm', sfm: 350, rpm: 999, diameterInches: 0.5 });
  closeTo(fromSfm.rpm, 350 * (12 / Math.PI) / 0.5);
  assert.equal(fromSfm.sfm, 350);

  const fromRpm = calc.resolveSurfaceSpeed({ basis: 'rpm', sfm: 999, rpm: 2500, diameterInches: 0.5 });
  closeTo(fromRpm.sfm, 2500 * 0.5 / (12 / Math.PI));
  assert.equal(fromRpm.rpm, 2500);
});

test('thread-mill feed includes cutting-edge count', () => {
  const result = calc.threadMill({
    threadMajorInches: 0.5,
    toolDiameterInches: 0.375,
    rpm: 1800,
    cuttingEdges: 3,
    chipLoad: 0.0015,
    pitchInches: 1 / 13,
  });
  closeTo(result.feedIpm, 8.1);
  closeTo(result.centerlineDiameter, 0.125);
});

test('thread-mill centerline supports internal and external threads', () => {
  closeTo(calc.threadMill({
    threadMajorInches: 1,
    toolDiameterInches: 0.25,
    rpm: 1000,
    cuttingEdges: 4,
    chipLoad: 0.001,
    pitchInches: 0.05,
    threadLocation: 'internal',
  }).centerlineDiameter, 0.75);

  closeTo(calc.threadMill({
    threadMajorInches: 1,
    toolDiameterInches: 0.25,
    rpm: 1000,
    cuttingEdges: 4,
    chipLoad: 0.001,
    pitchInches: 0.05,
    threadLocation: 'external',
  }).centerlineDiameter, 1.25);
});

test('circle calculation obeys the selected source field', () => {
  closeTo(calc.circleFrom('radius', 2).diameter, 4);
  closeTo(calc.circleFrom('circumference', Math.PI * 3).diameter, 3);
});

test('right-triangle calculation obeys the selected input pair', () => {
  const sides = calc.rightTriangle({ solveFrom: 'a_b', sideA: 3, sideB: 4 });
  closeTo(sides.hypotenuse, 5);

  const angleAndHypotenuse = calc.rightTriangle({
    solveFrom: 'angle_h',
    sideA: 999,
    sideB: 999,
    hypotenuse: 10,
    angleA: 30,
  });
  closeTo(angleAndHypotenuse.sideA, 5);
  closeTo(angleAndHypotenuse.sideB, 5 * Math.sqrt(3));
});

test('invalid machining geometry throws instead of returning a plausible zero', () => {
  assert.throws(() => calc.countersinkDepth(0.5, 0.25, 82), /must exceed/);
  assert.throws(() => calc.helixPitch(0.5, 0.75, 3), /smaller than bore/);
  assert.throws(() => calc.rpmFromSfm(350, 0), /greater than zero/);
});

test('known drill-point-independent geometry calculations remain precise', () => {
  closeTo(calc.countersinkDepth(0.25, 0.5, 90), 0.125);
  const helix = calc.helixPitch(1.5675, 0.75, 3);
  closeTo(helix.radius, 0.40875);
  closeTo(helix.pitch, 2 * Math.PI * 0.40875 * Math.tan(3 * Math.PI / 180));
});

test('NPT drill handling never invents a form-tap recommendation', () => {
  const thread = { major: 1.315, pitch: 11.5, tapDec: 1.15625, tapConfidence: 'published' };
  const cutting = calc.tapDrillRange('NPT', thread, 'cut');
  assert.equal(cutting.exact, true);
  assert.equal(cutting.typicalDec, 1.15625);

  const forming = calc.tapDrillRange('NPT', thread, 'form');
  assert.equal(forming.unsupported, true);
  assert.match(forming.note, /manufacturer/i);
});

test('straight-thread tap drill ranges preserve low-to-high drill order', () => {
  const thread = { major: 0.5, pitch: 13 };
  const range = calc.tapDrillRange('UNC', thread, 'cut');
  assert.ok(range.minDec < range.typicalDec);
  assert.ok(range.typicalDec < range.maxDec);
});

test('circular interpolation compensates feed at the cutter centerline', () => {
  const bore = calc.circularInterpolationFeed({
    featureDiameter: 2,
    toolDiameter: 0.5,
    surfaceFeedIpm: 20,
    location: 'internal',
  });
  closeTo(bore.centerlineDiameter, 1.5);
  closeTo(bore.centerlineFeedIpm, 15);

  const boss = calc.circularInterpolationFeed({
    featureDiameter: 2,
    toolDiameter: 0.5,
    surfaceFeedIpm: 20,
    location: 'external',
  });
  closeTo(boss.centerlineDiameter, 2.5);
  closeTo(boss.centerlineFeedIpm, 25);
});

test('effective cutting diameter supports ball-nose and tapered tools', () => {
  closeTo(calc.effectiveCuttingDiameter({
    toolType: 'ball', toolDiameter: 1, axialDepth: 0.125,
  }).effectiveDiameter, 2 * Math.sqrt(0.125 * 0.875));
  closeTo(calc.effectiveCuttingDiameter({
    toolType: 'taper', toolDiameter: 1, tipDiameter: 0.25, axialDepth: 0.25, includedAngleDegrees: 60,
  }).effectiveDiameter, 0.25 + 0.5 * Math.tan(Math.PI / 6));
});

test('scallop geometry solves in either direction', () => {
  const fromStepover = calc.scallopGeometry({solveFrom:'stepover', ballDiameter:1, stepover:0.1});
  const fromHeight = calc.scallopGeometry({solveFrom:'height', ballDiameter:1, scallopHeight:fromStepover.scallopHeight});
  closeTo(fromHeight.stepover, 0.1);
});

test('true position reports diametrical position from axis deviations', () => {
  const position = calc.truePosition(0.003, 0.004);
  closeTo(position.radialError, 0.005);
  closeTo(position.diametricalTruePosition, 0.01);
});

test('bore stock planning preserves finish allowance and pass limits', () => {
  const plan = calc.boreStockPlan({
    currentDiameter: 1,
    finishDiameter: 1.5,
    maxRadialDepth: 0.1,
    finishAllowanceDiameter: 0.02,
  });
  assert.equal(plan.roughPasses, 3);
  assert.ok(plan.radialDepthPerRoughPass <= 0.1);
  closeTo(plan.prefinishDiameter, 1.48);
  closeTo(plan.finishRadialStock, 0.01);
});

test('advanced geometry rejects impossible domains', () => {
  assert.throws(() => calc.circularInterpolationFeed({featureDiameter:1, toolDiameter:1, surfaceFeedIpm:10}), /smaller/);
  assert.throws(() => calc.scallopGeometry({solveFrom:'height', ballDiameter:1, scallopHeight:0.6}), /ball radius/);
  assert.throws(() => calc.boreStockPlan({currentDiameter:2, finishDiameter:1, maxRadialDepth:0.1}), /must exceed/);
});
