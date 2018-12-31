import SkinnedModel from './js/skinnedModel.js';
import MATH from './js/math.js';
import {ColladaUtils} from './js/parserCollada.js';
import ModelData from './js/modelData.js';

QUnit.test( "matrix × vector", function( assert ) {
  // row-major
  var m = [
    1, 0, 0, -1,
    1, 0, 0, 1,
    1, 1, 1, 2,
    0, 0, 0, 3
  ];
  var v = [1, 2, 3, 4];
  var mv = MATH.mulVector(m, v);
  // https://api.qunitjs.com/assert/deepEqual
  assert.deepEqual(mv, [6, 3, 3, 19]);
  var mvt = MATH.mulVector(MATH.transpose(m), v);
  assert.deepEqual(mvt, [-3, 5, 14, 12]);
});

QUnit.test( "matrix × matrix", function( assert ) {
  // row-major
  var m = [
    1, 0, 0, -1,
    1, 0, 0, 1,
    1, 1, 1, 2,
    0, 0, 0, 3
  ];
  var mm = MATH.mulMatrix(m, m);
  var expected = [1, 0, 0, -4, 1, 0, 0, 2, 3, 1, 1, 8, 0, 0, 0, 9];
  assert.deepEqual(mm, expected);
  var mt = MATH.transpose(m);
  var mmt = MATH.mulMatrix(mt, mt);
  expected = MATH.transpose(expected);
  assert.deepEqual(mmt, expected);
  var m2 = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];
  MATH.mulMatrix(mt, m2, mm);
  expected = [3, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0];
  assert.deepEqual(mm, expected);
});

QUnit.test("projection matrix", function(assert) {
  var m = MATH.getProjection(90, 3/4, 1, 50);
  // column-major
  var expected = [
    1.0000000000000002, 0, 0, 0,
    0, 0.7500000000000001, 0, 0,
    0, 0, -1.0408163265306123, -1,
    0, 0, -2.0408163265306123, 0];
  assert.deepEqual(m, expected);
});

QUnit.test("read Collada anim", function(assert) {
  var done = assert.async();
  $.ajax({
    async: true,
    url: "resources/monigote.dae",
    dataType: 'text',
    success: function(data) {
      var model = ColladaUtils.parseCollada(data);
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

QUnit.test("add pose keyframe", function(assert) {
  var done = assert.async();
  $.ajax({
    async: true,
    url: "resources/monigote.dae",
    dataType: 'text',
    success: function(data) {
      var model = ColladaUtils.parseCollada(data);
      var skinnedModel = new SkinnedModel(model.skin, model.skeleton, model.anims);
      assert.equal(skinnedModel.keyframeCount, 5);
      var posefile = {
        pose: {
          Chest: [0, -0.03, -12.15],
          Knee_L: [-13.5, -12.28, -1.45 ],
          Head: [0, 2, 10, 1, 1, 1, 0, -0.2, 0]
        }
      };
      skinnedModel.addPose(posefile.pose);
      assert.equal(skinnedModel.keyframeCount, 6);
      var jro = {
        Chest: "zxy"
      };
      skinnedModel.updateJointRotationOrder(jro);
      skinnedModel.applyPose(5);
      var expectedJM = [
        1, 0, 0, 0,
        0, -0.05546402, -0.9984606, 0,
        0, 0.9984607, -0.05546402, 0,
        0, 0.6807694000000009, 4.822213, 1
      ];
      assert.deepEqual(skinnedModel.joints.splice(0, 16), expectedJM);
      var outputPose = skinnedModel.getPoseFile(5);
      assert.deepEqual(outputPose, posefile);
      done();
    }
  });
});

QUnit.test("Model Data", assert => {
  const json = {
    name: "tiny test",
    materials: {},
    vertices: [
      1, 0, 0, 1, 0, 0, 0, 0,
      0, 1, 0, 0, 1, 0, 0, 0,
      0, 0, 1, 0, 0, 1, 0, 0,
      -1, 0, 0, -1, 0, 0, 0, 0,      
      0, -1, 0, 0, -1, 0, 0, 0,
      0, 0, -1, 0, 0, -1, 0, 0,
    ],
    stride: 8,
    meshes: [{
      indices: [
        0, 1, 2,
        0, 1, 3,
        1, 2, 3,
        1, 2, 4,
        3, 4, 5,
        2, 4, 5
      ]
    }]
  };
  const modelData = new ModelData(json);
  assert.deepEqual(modelData.getNormal(2), [0, 0, 1]);
  modelData.recomputeNormals();
  assert.deepEqual(modelData.getNormal(2), [0, 0, 1]);
});
