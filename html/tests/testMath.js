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

QUnit.test('euler conversion cwY', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [0, -1, 0] };
  const angles = VMath.eulerAnglesFromAngleAxis(angleAxis, 'zyx');
  const eulearAngles = angles.map(VMath.radToDeg);
  assert.deepEqual(VMath.round(eulearAngles), [0, -45, 0]);
});

QUnit.test('euler conversion ccwX', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [1, 0, 0] };
  const angles = VMath.eulerAnglesFromAngleAxis(angleAxis, 'xyz');
  const eulearAngles = angles.map(VMath.radToDeg);
  assert.deepEqual(VMath.round(eulearAngles), [45, 0, 0]);
});

QUnit.test('euler conversion ccwZ', (assert) => {
  const angleAxis = { angle: VMath.degToRad(45), axis: [0, 0, 1] };
  const angles = VMath.eulerAnglesFromAngleAxis(angleAxis, 'xyz');
  const eulearAngles = angles.map(VMath.radToDeg);
  assert.deepEqual(VMath.round(eulearAngles), [0, 0, 45]);
});

QUnit.test('euler conversion ccwXY', (assert) => {
  const angleAxis = { angle: 2 * Math.PI / 3, axis: [0.57735, 0.57735, 0.57735] };
  const angles = VMath.eulerAnglesFromAngleAxis(angleAxis, 'xyz');
  const eulearAngles = angles.map(VMath.radToDeg);
  assert.deepEqual(VMath.round(eulearAngles), [90, 90, 0]);
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
