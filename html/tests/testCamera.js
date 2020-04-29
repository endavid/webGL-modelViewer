/* eslint-env qunit */
import Camera from '../js/camera.js';
import VMath from '../js/math.js';
// Unfortunately, I wasn't able to import math.js as a module
const { math } = window;

QUnit.module('Camera');

// https://github.com/endavid/VidEngine/blob/master/VidTests/VidTestsTests/VidTestsTests.swift
QUnit.test('projection', (assert) => {
  const camera = new Camera(90, 1, 0.1, 100);
  camera.setLocation(0, 2, 20);
  const worldPoint = [0.6, 1.2, -5, 1];
  const viewPoint = VMath.mulVector(camera.viewMatrix, worldPoint);
  assert.deepEqual(viewPoint, [0.6, -0.8, -25.0, 1]);
  const screenPoint = VMath.mulVector(camera.projectionMatrix, viewPoint);
  assert.deepEqual(VMath.round(screenPoint), [0.6, -0.8, 24.84985, 25]);
  let p = screenPoint.map(a => a / screenPoint[3]);
  p = VMath.mulVector(camera.projectionInverse, p);
  p = p.map(a => a / p[3]);
  assert.deepEqual(VMath.round(p), viewPoint);
  const wp = math.multiply(camera.transform.toMatrix(), p);
  assert.deepEqual(VMath.round(wp), worldPoint);
});

QUnit.test('ray from screen coords', (assert) => {
  const camera = new Camera(90, 1, 0.1, 100);
  camera.setLocation(0, 2, 20);
  const ray = camera.rayFromScreenCoordinates(0.6 / 25, -0.8 / 25);
  const worldPoint = [0.6, 1.2, -5];
  const distance = VMath.distance(worldPoint, camera.getPosition());
  const direction = VMath.normalize(VMath.diff(worldPoint, camera.getPosition()));
  const p = VMath.travelDistance(ray, distance);
  assert.deepEqual(VMath.round(p), worldPoint);
  assert.deepEqual(VMath.round(ray.direction), VMath.round(direction));
});
