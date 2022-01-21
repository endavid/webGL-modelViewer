/* eslint-env qunit */
import Collada from '../js/collada.js';
import SkinnedModel from '../js/skinnedModel.js';
import Transform from '../js/transform.js';
import $ from '../js/jquery.module.js';

QUnit.module('Collada');

QUnit.test('read Collada anim', (assert) => {
  const done = assert.async();
  $.ajax({
    async: true,
    url: 'resources/monigote.dae',
    dataType: 'text',
    success(data) {
      const model = Collada.parse(data);
      const expectedVertexCount = 5016;
      assert.equal(model.meshes[0].indices.length, expectedVertexCount);
      assert.equal(model.dataArrays.position.length, expectedVertexCount * 3);
      assert.deepEqual(model.skin.joints, ['Stomach', 'Chest', 'Head', 'Upper_Arm_L', 'Lower_Arm_L', 'Upper_Leg_L', 'Lower_Leg_L', 'Foot_L', 'Upper_Arm_R', 'Lower_Arm_R', 'Upper_Leg_R', 'Lower_Leg_R', 'Foot_R']);
      assert.deepEqual(Object.keys(model.skeleton), ['Control', 'Stomach', 'Chest', 'Head', 'Upper_Arm_L', 'Lower_Arm_L', 'Upper_Arm_R', 'Lower_Arm_R', 'Upper_Leg_L', 'Lower_Leg_L', 'Upper_Leg_R', 'Lower_Leg_R', 'Arm_IK_L', 'Elbow_L', 'Arm_IK_R', 'Elbow_R', 'Leg_IK_L', 'Foot_L', 'Knee_L', 'Leg_IK_R', 'Foot_R', 'Knee_R']);
      const skinnedModel = new SkinnedModel(model.skin, model.skeleton, model.anims, new Transform({}));
      assert.deepEqual(skinnedModel.inverseBindMatrices[5],
        [-0.9998402, -0.01788914, 0.0000736057, 0.6960736,
          0.000233688, -0.008941292, 0.9999601, 0.2452744,
          -0.01788777, 0.9997997, 0.008944034, -4.343381,
          0, 0, -0, 1]);
      const expectedChestBM = [
        1, 8.61691e-8, 4.44089e-16, 0,
        -8.49334e-8, 0.9856594, 0.1687469, 0,
        1.45408e-8, -0.1687469, 0.9856594, -1.73887,
        0, 0, -0, 1];
      assert.deepEqual(skinnedModel.skeleton.Chest.matrix, expectedChestBM);
      const expectedChestTransform = {
        rotationOrder: 'xzy',
        eulerAngles: [-9.714970289473104, 2.4752751160729792e-8, -0.000004668466376658244],
        position: [-1.2512e-9, 0, 0],
        scale: [1.0000000000000033, 0.9999998859680468, 0.9999999845339849],
      };
      const t = skinnedModel.anims.Chest.transforms[0];
      assert.deepEqual(t.rotationOrder, expectedChestTransform.rotationOrder);
      assert.deepEqual(t.eulerAngles, expectedChestTransform.eulerAngles);
      assert.deepEqual(t.position, expectedChestTransform.position);
      assert.deepEqual(t.scale, expectedChestTransform.scale);
      // this is after applying the pose
      const expectedStomachJM = [ // column-major
        0.9999999, -4.84881e-9, 8.72882e-8, 0,
        4.848812833164099e-9, 1.0000000275136807, 4.438203998757828e-9, 0,
        -8.728823047805572e-8, -4.438204991019656e-9, 1.0000000275136904, 0,
        -4.096545206483902e-8, -4.416750146131311, -2.07437700072699e-8, 1];
      assert.deepEqual(skinnedModel.joints.splice(0, 16), expectedStomachJM);
      done();
    },
  });
});
