/* eslint-env qunit */
import VMath from '../js/math.js';

QUnit.module('VMath');

function roundAngles(rads, digits) {
  const degrees = rads.map(VMath.radToDeg);
  return VMath.round(degrees, digits || 2);
}

function roundAnglesFromAngleAxis(angleAxis, rotationOrder, digits) {
  const R = VMath.rotationMatrixFromAngleAxis(angleAxis);
  const angles = VMath.eulerAnglesFromRotationMatrix(R, rotationOrder);
  return roundAngles(angles, digits);
}

const allRotations = ['xyz', 'xzy', 'yxz', 'yzx', 'zxy', 'zyx'];

QUnit.test('matrix × vector', (assert) => {
  // row-major
  const m = [
    1, 0, 0, -1,
    1, 0, 0, 1,
    1, 1, 1, 2,
    0, 0, 0, 3,
  ];
  const v = [1, 2, 3, 4];
  const mv = VMath.mulVector(m, v);
  // https://api.qunitjs.com/assert/deepEqual
  assert.deepEqual(mv, [6, 3, 3, 19]);
  const mvt = VMath.mulVector(VMath.transpose(m), v);
  assert.deepEqual(mvt, [-3, 5, 14, 12]);
});

QUnit.test('matrix × matrix', (assert) => {
  // row-major
  const m = [
    1, 0, 0, -1,
    1, 0, 0, 1,
    1, 1, 1, 2,
    0, 0, 0, 3,
  ];
  const mm = VMath.mulMatrix(m, m);
  let expected = [1, 0, 0, -4, 1, 0, 0, 2, 3, 1, 1, 8, 0, 0, 0, 9];
  assert.deepEqual(mm, expected);
  const mt = VMath.transpose(m);
  const mmt = VMath.mulMatrix(mt, mt);
  expected = VMath.transpose(expected);
  assert.deepEqual(mmt, expected);
  const m2 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  VMath.mulMatrix(mt, m2, mm);
  expected = [3, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0];
  assert.deepEqual(mm, expected);
});

QUnit.test('projection matrix', (assert) => {
  const m = VMath.getProjection(90, 3 / 4, 1, 50);
  // column-major
  const expected = [
    1.0000000000000002, 0, 0, 0,
    0, 0.7500000000000001, 0, 0,
    0, 0, -1.0408163265306123, -1,
    0, 0, -2.0408163265306123, 0];
  assert.deepEqual(m, expected);
});

// https://github.com/endavid/VidEngine/blob/master/VidTests/VidTestsTests/VidTestsTests.swift
QUnit.test('projection square aspect', (assert) => {
  const m = VMath.getProjection(90, 1, 0.1, 100);
  // column-major
  const expected = [
    1.0000000000000002, 0, 0, 0,
    0, 1.0000000000000002, 0, 0,
    0, 0, -1.002002002002002, -1,
    0, 0, -0.20020020020020018, 0];
  assert.deepEqual(m, expected);
});

QUnit.test('projection inverse', (assert) => {
  const m = VMath.getProjectionInverse(90, 1, 0.1, 100);
  // column-major
  const expected = [
    0.9999999999999999, 0, 0, 0,
    0, 0.9999999999999999, 0, 0,
    0, 0, 0, -4.995,
    0, 0, -1, 5.005];
  assert.deepEqual(m, expected);
});

// To generate AngleAxis / Euler references:
// https://www.andre-gaschler.com/rotationconverter/

QUnit.test('euler conversion cwY', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [0, -1, 0] };
  allRotations.forEach((ro) => {
    assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, ro), [0, -45, 0]);
  });
});

QUnit.test('euler conversion ccwX', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [1, 0, 0] };
  allRotations.forEach((ro) => {
    assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, ro), [45, 0, 0]);
  });
});

QUnit.test('euler conversion ccwZ', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [0, 0, 1] };
  allRotations.forEach((ro) => {
    assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, ro), [0, 0, 45]);
  });
});

QUnit.test('euler conversion ccwXY', (assert) => {
  const angleAxis = { angle: 2 * Math.PI / 3, axis: [0.57735, 0.57735, 0.57735] };
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xyz'), [90, 89.93, 0]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xzy'), [90, 90, 0]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yxz'), [0, 90, 90]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yzx'), [0, 90, 89.93]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zxy'), [89.93, 0, 90]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zyx'), [90, 0, 90]);
});

QUnit.test('euler conversion ccwXZ', (assert) => {
  const angleAxis = { angle: VMath.degToRad(62.8), axis: [0.6785983, -0.2810846, 0.6785983] };
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xyz'), [45, 0, 45]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xzy'), [45, 0, 45]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yxz'), [45, 0, 45]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yzx'), [54.74, -35.26, 30]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zxy'), [30, -35.26, 54.74]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zyx'), [35.26, -30, 35.26]);
});

QUnit.test('euler to matrix', (assert) => {
  const expected = [
    { order: 'xyz', angles: [45, 0, 45] },
    { order: 'xzy', angles: [45, 0, 45] },
    { order: 'yxz', angles: [45, 0, 45] },
    { order: 'yzx', angles: [54.74, -35.26, 30] },
    { order: 'zxy', angles: [30, -35.26, 54.74] },
    { order: 'zyx', angles: [35.26, -30, 35.26] },
  ];
  expected.forEach((v) => {
    const a = v.angles.map(VMath.degToRad);
    const R = VMath.rotationMatrixFromEuler(a, v.order);
    // can we convert back?
    const ea = roundAngles(VMath.eulerAnglesFromRotationMatrix(R, v.order));
    assert.deepEqual(ea, v.angles);
  });
});

QUnit.test('euler arbitrary', (assert) => {
  const angleAxis = { angle: VMath.degToRad(129), axis: [0.6215149, 0.4769051, 0.6215149] };
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xyz'), [105, 90, 0]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xzy'), [105, 90, 0]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yxz'), [0, 90, 105]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yzx'), [179.98, -89.99, 75]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zxy'), [75, -89.99, 179.98]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zyx'), [90, -15, 90]);
});

QUnit.test('euler conversion collar', (assert) => {
  const angleAxis = {
    angle: VMath.degToRad(18.4609678396),
    axis: [0.375040562039, -0.926971164802, -0.0083088177441],
  };
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xyz'), [7.11, -17.08, 0.91]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'xzy'), [6.84, -17.08, 0.87]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yxz'), [6.80, -17.20, -1.18]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'yzx'), [6.80, -17.06, -1.18]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zxy'), [6.84, -17.19, 0.88]);
  assert.deepEqual(roundAnglesFromAngleAxis(angleAxis, 'zyx'), [7.16, -17.06, -1.23]);
});
