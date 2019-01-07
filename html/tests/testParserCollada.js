import parseCollada from '/js/parserCollada.js';
import SkinnedModel from '/js/skinnedModel.js';

QUnit.module("parseCollada");

QUnit.test("read Collada anim", assert => {
  var done = assert.async();
  $.ajax({
    async: true,
    url: "resources/monigote.dae",
    dataType: 'text',
    success: function(data) {
      var model = parseCollada(data);
      var expectedVertexCount = 5016;
      assert.equal(model.meshes[0].indices.length, expectedVertexCount);
      assert.equal(model.stride, 16);
      assert.equal(model.vertices.length, expectedVertexCount * 16);
      assert.deepEqual(model.skin.joints, ["Stomach", "Chest", "Head", "Upper_Arm_L", "Lower_Arm_L", "Upper_Leg_L", "Lower_Leg_L", "Foot_L", "Upper_Arm_R", "Lower_Arm_R", "Upper_Leg_R", "Lower_Leg_R", "Foot_R"]);
      assert.deepEqual(Object.keys(model.skeleton), ["Control", "Stomach", "Chest", "Head", "Upper_Arm_L", "Lower_Arm_L", "Upper_Arm_R", "Lower_Arm_R", "Upper_Leg_L", "Lower_Leg_L", "Upper_Leg_R", "Lower_Leg_R", "Arm_IK_L", "Elbow_L", "Arm_IK_R", "Elbow_R", "Leg_IK_L", "Foot_L", "Knee_L", "Leg_IK_R", "Foot_R", "Knee_R"]);
      var skinnedModel = new SkinnedModel(model.skin, model.skeleton, model.anims);
      assert.deepEqual(skinnedModel.inverseBindMatrices[5], [-0.9998402, -0.01788914, 0.0000736057, 0.6960736, 0.000233688, -0.008941292, 0.9999601, 0.2452744, -0.01788777, 0.9997997, 0.008944034, -4.343381, 0, 0, -0, 1]);
      var expectedChestBM = [1, 8.61691e-8, 4.44089e-16, 0, -8.49334e-8, 0.9856594, 0.1687469, 0, 1.45408e-8, -0.1687469, 0.9856594, -1.73887, 0, 0, -0, 1];
      assert.deepEqual(skinnedModel.skeleton.Chest.transform, expectedChestBM);
      var expectedChestAnim0 = [1, 8.14801e-8, 4.32017e-10, -1.2512e-9, -8.11541e-8, 0.9856593, 0.1687469, 0, 1.4442e-8, -0.1687469, 0.9856594, -1.73887, 0, 0, -0, 1];
      assert.deepEqual(skinnedModel.anims.Chest.transform[0], expectedChestAnim0);
      // this is after applying the pose
      var expectedStomachJM = [ // column-major
        0.9999999, -4.84881e-9, 8.72882e-8, 0,
        4.848812833164099e-9, 1.0000000275136807, 4.438203998757828e-9, 0,
        -8.728823047805572e-8, -4.438204991019656e-9, 1.0000000275136904, 0,
        -4.096545206483902e-8, -4.416750146131311, -2.07437700072699e-8, 1];
      assert.deepEqual(skinnedModel.joints.splice(0, 16), expectedStomachJM);
      done();
    }
  });
});
