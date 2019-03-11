/* eslint-env qunit */
import VMath from '../js/math.js';

QUnit.module('VMath');

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
