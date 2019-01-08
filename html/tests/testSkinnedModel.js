import Collada from '/js/collada.js';
import SkinnedModel from '/js/skinnedModel.js';

QUnit.module("SkinnedModel");

QUnit.test("add pose keyframe", assert => {
  var done = assert.async();
  $.ajax({
    async: true,
    url: "resources/monigote.dae",
    dataType: 'text',
    success: function(data) {
      var model = Collada.parse(data);
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
