/* eslint-env qunit */
import VMath from '../js/math.js';
import Transform from '../js/transform.js';

const { math } = window;

QUnit.module('Transform');

QUnit.test('from identity matrix', (assert) => {
  const M = math.diag([1, 1, 1, 1]);
  const t = Transform.fromMatrix(M, 'xyz');
  assert.deepEqual(t.position, [0, 0, 0]);
  assert.deepEqual(t.scale, [1, 1, 1]);
  assert.deepEqual(t.eulerAngles, [0, 0, 0]);
  assert.equal(t.rotationOrder, 'xyz');
});

QUnit.test('from translation matrix', (assert) => {
  const M = math.diag([1, 1, 1, 1]);
  M[0][3] = 4;
  M[1][3] = -7;
  M[2][3] = 6;
  const t = Transform.fromMatrix(M, 'xyz');
  assert.deepEqual(t.position, [4, -7, 6]);
  assert.deepEqual(t.scale, [1, 1, 1]);
  assert.deepEqual(t.eulerAngles, [0, 0, 0]);
  assert.equal(t.rotationOrder, 'xyz');
});

QUnit.test('from scaling matrix', (assert) => {
  const M = math.diag([4, 3, 8, 1]);
  const t = Transform.fromMatrix(M, 'xyz');
  assert.deepEqual(t.position, [0, 0, 0]);
  assert.deepEqual(t.scale, [4, 3, 8]);
  assert.deepEqual(t.eulerAngles, [0, 0, 0]);
  assert.equal(t.rotationOrder, 'xyz');
});

QUnit.test('from translation & scaling matrix', (assert) => {
  const M = math.diag([4, 3, 8, 1]);
  M[0][3] = 4;
  M[1][3] = -7;
  M[2][3] = 6;
  const t = Transform.fromMatrix(M, 'xyz');
  assert.deepEqual(t.position, [4, -7, 6]);
  assert.deepEqual(t.scale, [4, 3, 8]);
  assert.deepEqual(t.eulerAngles, [0, 0, 0]);
  assert.equal(t.rotationOrder, 'xyz');
});

QUnit.test('from 30deg rotation matrix', (assert) => {
  const M = [
    [0.8755950178005940, -0.381752634836825, 0.29597008395768600, 0],
    [0.4200310908981810, 0.9043038598466110, -0.0762129368638007, 0],
    [-0.238552399865652, 0.1910483050478680, 0.95215192992330500, 0],
    [0, 0, 0, 1],
  ];
  const ro = 'xyz';
  const t = Transform.fromMatrix(M, ro);
  const angleAxis = { angle: Math.PI / 6, axis: VMath.normalize([1, 2, 3]) };
  const angles = VMath.eulerAnglesFromAngleAxis(angleAxis, ro);
  const eulerAngles = angles.map(VMath.radToDeg);
  assert.deepEqual(t.position, [0, 0, 0]);
  assert.deepEqual(VMath.round(t.scale), [1, 1, 1]);
  assert.deepEqual(t.eulerAngles, eulerAngles);
  assert.equal(t.rotationOrder, ro);
});
