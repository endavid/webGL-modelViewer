/* eslint-env qunit */
import VMath from '../js/math.js';

const { math } = window;

QUnit.module('VMath');

function roundedAngles(angleAxis, rotationOrder, conversion) {
  const fn = conversion || VMath.eulerAnglesFromAngleAxis;
  const angles = fn(angleAxis, rotationOrder);
  const eulearAngles = angles.map(VMath.radToDeg);
  const rounded = VMath.round(eulearAngles, 1);
  return rounded;
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
    assert.deepEqual(roundedAngles(angleAxis, ro), [0, -45, 0]);
  });
});

QUnit.test('euler conversion ccwX', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [1, 0, 0] };
  allRotations.forEach((ro) => {
    assert.deepEqual(roundedAngles(angleAxis, ro), [45, 0, 0]);
  });
});

QUnit.test('euler conversion ccwZ', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [0, 0, 1] };
  allRotations.forEach((ro) => {
    assert.deepEqual(roundedAngles(angleAxis, ro), [0, 0, 45]);
  });
});

QUnit.test('euler conversion ccwXY', (assert) => {
  const angleAxis = { angle: 2 * Math.PI / 3, axis: [0.57735, 0.57735, 0.57735] };
  assert.deepEqual(roundedAngles(angleAxis, 'xyz'), [90, 90, 0]);
  assert.deepEqual(roundedAngles(angleAxis, 'xzy'), [90, 90, 0]);
  assert.deepEqual(roundedAngles(angleAxis, 'yxz'), [0, 90, 90]);
  assert.deepEqual(roundedAngles(angleAxis, 'yzx'), [0, 90, 90]);
  assert.deepEqual(roundedAngles(angleAxis, 'zxy'), [90, 0, 90]);
  assert.deepEqual(roundedAngles(angleAxis, 'zyx'), [90, 0, 90]);
});

QUnit.test('euler conversion ccwXZ', (assert) => {
  const angleAxis = { angle: VMath.degToRad(62.8), axis: [0.6785983, -0.2810846, 0.6785983] };
  assert.deepEqual(roundedAngles(angleAxis, 'xyz'), [45, 0, 45]);
  assert.deepEqual(roundedAngles(angleAxis, 'xzy'), [45, 0, 45]);
  assert.deepEqual(roundedAngles(angleAxis, 'yxz'), [45, 0, 45]);
  assert.deepEqual(roundedAngles(angleAxis, 'yzx'), [54.74, -35.26, 30]);
  assert.deepEqual(roundedAngles(angleAxis, 'zxy'), [30, -35.26, 54.74]);
  assert.deepEqual(roundedAngles(angleAxis, 'zyx'), [35.26, -30, 35.26]);
});

QUnit.test('euler to matrix', (assert) => {
  let Rx = VMath.rotationMatrixAroundX(VMath.degToRad(35.26));
  let Ry = VMath.rotationMatrixAroundY(VMath.degToRad(-30));
  let Rz = VMath.rotationMatrixAroundZ(VMath.degToRad(35.26));
  // zyx, x applied first
  let R = math.multiply(Rz, math.multiply(Ry, Rx));
  console.log(VMath.matrixToString(R));
  Rx = VMath.rotationMatrixAroundX(VMath.degToRad(54.74));
  Ry = VMath.rotationMatrixAroundY(VMath.degToRad(-35.26));
  Rz = VMath.rotationMatrixAroundZ(VMath.degToRad(30));
  // zyx, x applied first
  R = math.multiply(Rz, math.multiply(Ry, Rx));
  console.log(VMath.matrixToString(R));
  Rx = VMath.rotationMatrixAroundX(VMath.degToRad(30));
  Ry = VMath.rotationMatrixAroundY(VMath.degToRad(-35.26));
  Rz = VMath.rotationMatrixAroundZ(VMath.degToRad(54));
  // zyx, x applied first
  R = math.multiply(Rz, math.multiply(Ry, Rx));
  console.log(VMath.matrixToString(R));
});

QUnit.test('euler arbitrary', (assert) => {
  const angleAxis = { angle: VMath.degToRad(129), axis: [0.6215149, 0.4769051, 0.6215149] };
  assert.deepEqual(roundedAngles(angleAxis, 'xyz'), [105, 90, 0]);
  assert.deepEqual(roundedAngles(angleAxis, 'xzy'), [105, 90, 0]);
  assert.deepEqual(roundedAngles(angleAxis, 'yxz'), [0, 90, 105]);
  assert.deepEqual(roundedAngles(angleAxis, 'yzx'), [180, -90, 75]);
  assert.deepEqual(roundedAngles(angleAxis, 'zxy'), [75, -90, 180]);
  assert.deepEqual(roundedAngles(angleAxis, 'zyx'), [180, -90, 75]);
});

QUnit.test('euler conversion collar', (assert) => {
  const angleAxis = {
    angle: VMath.degToRad(18.4609678396),
    axis: [0.375040562039, -0.926971164802, -0.0083088177441],
  };
  const angles = VMath.eulerAnglesFromAngleAxis(angleAxis, 'zyx');
  const eulearAngles = angles.map(VMath.radToDeg);
  assert.deepEqual(VMath.round(eulearAngles), [7.16, -17.06, -1.23]);
});

QUnit.test('dummy brute force', () => {
  function testFn(aaList, expectations, ro, eulerize) {
    for (let i = 0; i < aaList.length; i += 1) {
      const euler = roundedAngles(aaList[i], ro, eulerize);
      if (!VMath.isCloseVector(euler, expectations[i])) {
        return false;
      }
    }
    return true;
  }
  // verified with https://www.andre-gaschler.com/rotationconverter/
  const angleAxes = [
    { angle: VMath.degToRad(45), axis: [0, -1, 0] },
    { angle: VMath.degToRad(45), axis: [1, 0, 0] },
    { angle: VMath.degToRad(45), axis: [0, 0, 1] },
    { angle: 2 * Math.PI / 3, axis: [0.57735, 0.57735, 0.57735] },
    { angle: VMath.degToRad(129), axis: [0.6215149, 0.4769051, 0.6215149] },
    { angle: VMath.degToRad(62.8), axis: [0.6785983, -0.2810846, 0.6785983] },
  ];
  VMath.bruteForceEulerizeOrderCheck(testFn.bind(
    null,
    angleAxes,
    [[0, -45, 0], [45, 0, 0], [0, 0, 45], [90, 90, 0], [105, 90, 0], [45, 0, 45]],
    'xyz',
  ));
  VMath.bruteForceEulerizeOrderCheck(testFn.bind(
    null,
    angleAxes,
    [[0, -45, 0], [45, 0, 0], [0, 0, 45], [90, 90, 0], [105, 90, 0], [45, 0, 45]],
    'xzy',
  ));
  VMath.bruteForceEulerizeOrderCheck(testFn.bind(
    null,
    angleAxes,
    [[0, -45, 0], [45, 0, 0], [0, 0, 45], [0, 90, 90], [0, 90, 105], [45, 0, 45]],
    'yxz',
  ));
  VMath.bruteForceEulerizeOrderCheck(testFn.bind(
    null,
    angleAxes,
    [[0, -45, 0], [45, 0, 0], [0, 0, 45], [0, 90, 90], [180, -90, 75], [54.74, -35.26, 30]],
    'yzx',
  ));
  VMath.bruteForceEulerizeOrderCheck(testFn.bind(
    null,
    angleAxes,
    [[0, -45, 0], [45, 0, 0], [0, 0, 45], [90, 0, 90], [75, -90, 180], [30, -35.26, 54.74]],
    'zxy',
  ));
  // For [0.6215149, 0.4769051, 0.6215149], 129deg -> [90, -15, 90]
  // but that's = same axis, 231deg -> [180, -90, 75], or [75, -90, 180]
  VMath.bruteForceEulerizeOrderCheck(testFn.bind(
    null,
    angleAxes,
    [[0, -45, 0], [45, 0, 0], [0, 0, 45], [90, 0, 90], [180, -90, 75], [35.26, -30, 35.26]],
    'zyx',
  ));
});
