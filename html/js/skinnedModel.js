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
    var animKeys = Object.keys(anims);
    this.keyframeCount = anims[animKeys[0]].keyframes.length;
    this.anims = anims;
    //this.applyPose(1);
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

  SkinnedModel.prototype.applyPose = function(keyframe) {
    for (var i = 0; i < this.jointNames.length; i++) {
      var m = MATH.mulMatrix(
        this.getAnimMatrix(i, keyframe),
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

  SkinnedModel.prototype.getJointMatrix = function(name, keyframe) {
    var jointAnim = this.anims[name];
    if (jointAnim) {
      return jointAnim.transform[keyframe];
    }
    return MATH.getI4();
  };

  SkinnedModel.prototype.getAnimMatrix = function(i, keyframe) {
    var name = this.jointNames[i];
    var node = this.skeleton[name];
    var m = this.getJointMatrix(name, keyframe);
    var parent = node.parent;
    while (parent) {
      node = this.skeleton[parent];
      var pm = this.getJointMatrix(parent, keyframe);
      m = MATH.mulMatrix(pm, m);
      parent = node.parent;
    }
    // m = armatureTransform * m;
    return m;
  };

  // export
  global.SkinnedModel = (global.module || {}).exports = SkinnedModel;
})(this);
