/* eslint-env qunit */
import VMath from '../js/math.js';
import AngleAxis from '../js/angleAxis.js';

QUnit.module('AngleAxis');

const rotationOrders = ['xyz', 'xzy', 'yxz', 'yzx', 'zxy', 'zyx'];

function almostEqual(assert, v0, v1, digits) {
  // 6 digits precision by default
  assert.deepEqual(VMath.round(v0, digits), VMath.round(v1, digits));
}

function testEulerDegree(assert, angle, axis, ro, expected) {
  const aa = new AngleAxis(angle, axis, ro);
  const rads = expected.map(VMath.degToRad);
  // ~1-degree error :/
  almostEqual(assert, aa.eulerAngles, rads, 2);
}

QUnit.test('to matrix', (assert) => {
  const axis = VMath.normalize([1, 2, 3]);
  const aa = new AngleAxis(Math.PI / 4, axis, 'xyz');
  assert.deepEqual(aa.rotationMatrix, [
    0.7280277253875085, -0.525104821111919, 0.4407273056121099,
    0.6087885979157627, 0.7907905579903911, -0.06345657129884827,
    -0.3152016404063445, 0.3145079017103789, 0.8953952789951956
  ]);
});

QUnit.test('euler CwY', (assert) => {
  const angle = VMath.degToRad(45);
  rotationOrders.forEach(ro => {
    const aa = new AngleAxis(angle, [0, -1, 0], ro);
    almostEqual(assert, aa.eulerAngles, [0, -angle, 0]);
  });
});

QUnit.test('euler CcwX', (assert) => {
  const angle = VMath.degToRad(45);
  rotationOrders.forEach(ro => {
    const aa = new AngleAxis(angle, [1, 0, 0], ro);
    almostEqual(assert, aa.eulerAngles, [angle, 0, 0]);
  });
});

QUnit.test('euler CcwZ', (assert) => {
  const angle = VMath.degToRad(45);
  rotationOrders.forEach(ro => {
    const aa = new AngleAxis(angle, [0, 0, 1], ro);
    almostEqual(assert, aa.eulerAngles, [0, 0, angle]);
  });
});

QUnit.test('euler CcwXY', (assert) => {
  const angle = VMath.degToRad(120);
  const axis = [0.57735, 0.57735, 0.57735];
  testEulerDegree(assert, angle, axis, 'xyz', [90, 90, 0]);
  testEulerDegree(assert, angle, axis, 'xzy', [90, 90, 0]);
  testEulerDegree(assert, angle, axis, 'yxz', [0, 90, 90]);
  testEulerDegree(assert, angle, axis, 'yzx', [0, 90, 90]);
  testEulerDegree(assert, angle, axis, 'zxy', [90, 0, 90]);
  testEulerDegree(assert, angle, axis, 'zyx', [90, 0, 90]);
});

QUnit.test('euler CcwXZ', (assert) => {
  const angle = VMath.degToRad(62.8);
  const axis = [0.6785983, -0.2810846, 0.6785983];
  testEulerDegree(assert, angle, axis, 'xyz', [45, 0, 45]);
  testEulerDegree(assert, angle, axis, 'xzy', [45, 0, 45]);
  testEulerDegree(assert, angle, axis, 'yxz', [45, 0, 45]);
  testEulerDegree(assert, angle, axis, 'yzx', [54.74, -35.26, 30]);
  testEulerDegree(assert, angle, axis, 'zxy', [30, -35.26, 54.74]);
  testEulerDegree(assert, angle, axis, 'zyx', [35.26, -30, 35.26]);
});

QUnit.test('euler collar', (assert) => {
  const angle = VMath.degToRad(18.4609678396);
  const axis = [0.375040562039, -0.926971164802, -0.0083088177441];
  testEulerDegree(assert, angle, axis, 'zyx', [7.16, -17.06, -1.23]);
});

QUnit.test('from matrix', (assert) => {
  const aa = AngleAxis.fromMatrix([
    [0.7280277253875085, -0.525104821111919, 0.4407273056121099],
    [0.6087885979157627, 0.7907905579903911, -0.06345657129884827],
    [-0.3152016404063445, 0.3145079017103789, 0.8953952789951956]
  ], 'xyz');
  almostEqual(assert, [aa.angle], [Math.PI / 4]);
  assert.deepEqual(aa.axis, VMath.normalize([1, 2, 3]));
});