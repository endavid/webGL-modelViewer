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
    0.5000000000000001, 0, 0, 0,
    0, 0.37500000000000006, 0, 0,
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
