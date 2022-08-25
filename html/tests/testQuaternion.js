/* eslint-env qunit */
import VMath from '../js/math.js';
import AngleAxis from '../js/angleAxis.js';
import Quaternion from '../js/quaternion.js'

QUnit.module('Quaternion');

const rotationOrders = ['xyz', 'xzy', 'yxz', 'yzx', 'zxy', 'zyx'];

function almostEqual(assert, v0, v1, digits) {
  // 6 digits precision by default
  assert.deepEqual(VMath.round(v0, digits), VMath.round(v1, digits));
}

function testAA2Quaternion(assert, degree, axis, expectedW, expectedV) {
  rotationOrders.forEach((ro) => {
    const aa = new AngleAxis(VMath.degToRad(degree), axis, ro);
    const q = Quaternion.fromAngleAxis(aa);
    almostEqual(assert, [expectedW], [q.w]);
    almostEqual(assert, expectedV, q.v);  
  });
}

function testQuaternion2AA(assert, w, v, order, expectedAngle, expectedAxis) {
  const q = new Quaternion(w, v);
  const aa = q.toAngleAxis(order);
  almostEqual(assert, [expectedAngle], [VMath.radToDeg(aa.angle)], 3);
  almostEqual(assert, expectedAxis, aa.axis);  
}

QUnit.test('from AngleAxis', (assert) => {
  testAA2Quaternion(assert, 45, [0, 0, 1], 0.9238795, [0, 0, 0.3826834]);
});

QUnit.test('to AngleAxis', (assert) => {
  const ro = 'xzy';
  testQuaternion2AA(assert, 0.9238795, [0, 0, 0.3826834], ro, 45, [0, 0, 1]);
  // ~0 rotation
  testQuaternion2AA(assert, 0.999999463558197,
    [-0.001048458507284522, 1.5624989373463904e-06, -1.6382161183159383e-09],
    ro, 0.120144648768,
    [-0.99999888953, 0.00149028043683, -1.56249797941e-06]);
  // :45.1 rotation along Y axis
  testQuaternion2AA(assert, 0.9235941171646118,
    [0.007665018085390329, 0.3832819163799286, 0.003180902451276779],
    ro, 45.0853873972,
    [0.0199936956801, 0.999765677057, 0.00829717489124]);
});