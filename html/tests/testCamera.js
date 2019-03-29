/* eslint-env qunit */
import Camera from '../js/camera.js';
import VMath from '../js/math.js';

QUnit.module('Camera');

function round(v) {
  return v.map(a => Math.round(a * 1e6) / 1e6);
}

// https://github.com/endavid/VidEngine/blob/master/VidTests/VidTestsTests/VidTestsTests.swift
QUnit.test('projection', (assert) => {
  const camera = new Camera(90, 1, 0.1, 100);
  camera.setPosition(0, 2, 20);
  const worldPoint = [0.6, 1.2, -5, 1];
  const viewPoint = VMath.mulVector(camera.viewMatrix, worldPoint);
  assert.deepEqual(viewPoint, [0.6, -0.8, -25.0, 1]);
  const screenPoint = VMath.mulVector(camera.projectionMatrix, viewPoint);
  assert.deepEqual(round(screenPoint), [0.6, -0.8, 24.84985, 25]);
  let p = screenPoint.map(a => a / screenPoint[3]);
  p = VMath.mulVector(camera.projectionInverse, p);
  p = p.map(a => a / p[3]);
  assert.deepEqual(round(p), viewPoint);
  const wp = VMath.mulVector(camera.transformMatrix, p);
  assert.deepEqual(round(wp), worldPoint);
});

QUnit.test('ray from screen coords', (assert) => {
  const camera = new Camera(90, 1, 0.1, 100);
  camera.setPosition(0, 2, 20);
  const ray = camera.rayFromScreenCoordinates(0.6 / 25, -0.8 / 25);
  const worldPoint = [0.6, 1.2, -5];
  const distance = VMath.distance(worldPoint, camera.getPosition());
  const direction = VMath.normalize(VMath.diff(worldPoint, camera.getPosition()));
  const p = VMath.travelDistance(ray, distance);
  assert.deepEqual(round(p), worldPoint);
  assert.deepEqual(round(ray.direction), round(direction));
});
