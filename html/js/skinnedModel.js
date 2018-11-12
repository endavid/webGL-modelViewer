(function(global) {
  "use strict";

  var MAX_JOINTS = 100;

  function SkinnedModel(skin, skeleton, anims) {
    this.joints = new Array(MAX_JOINTS * 16);
    for (var offset = 0; offset < 16 * MAX_JOINTS; offset+=16) {
      MATH.setI4(this.joints, offset);
    }
    this.jointNames = skin.joints;
    this.jointIndices = {};
    for (var i = 0; i < skin.joints.length; i++) {
      this.jointIndices[skin.joints[i]] = i;
    }
    this.inverseBindMatrices = skin.bindPoses;
    this.skeleton = skeleton;
    this.applyDefaultPose();
  }

  /// JointMatrix * InvBindMatrix
  SkinnedModel.prototype.applyDefaultPose = function() {
    for (var i = 0; i < this.jointNames.length; i++) {
      var m = MATH.mulMatrix(
        this.getDefaultPoseMatrix(i),
        this.inverseBindMatrices[i]);
      // convert row-major to column-major, GL-ready
      MATH.transpose(m, this.joints, i * 16);
    }
  };

  SkinnedModel.prototype.getDefaultPoseMatrix = function(i) {
    var name = this.jointNames[i];
    var node = this.skeleton[name];
    var m = node.transform;
    var parent = node.parent;
    while (parent) {
      node = this.skeleton[parent];
      m = MATH.mulMatrix(node.transform, m);
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  };

  // export
  global.SkinnedModel = (global.module || {}).exports = SkinnedModel;
})(this);
