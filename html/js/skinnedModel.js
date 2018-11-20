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
    this.keyframeCount = animKeys.length > 0 ? anims[animKeys[0]].keyframes.length : 0;
    this.anims = anims;
    //this.applyPose(0);
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
      if (jointAnim.transform) {
        return jointAnim.transform[keyframe];
      }
      var transform = this.skeleton[name].transform;
      var s = jointAnim.scale ? jointAnim.scale[keyframe] : [1, 1, 1];
      var t = jointAnim.translation ? jointAnim.translation[keyframe] : [transform[3], transform[7], transform[11]];
      var rx = jointAnim["rotateX.ANGLE"] ? MATH.degToRad(jointAnim["rotateX.ANGLE"][keyframe]) : 0;
      var ry = jointAnim["rotateY.ANGLE"] ? MATH.degToRad(jointAnim["rotateY.ANGLE"][keyframe]) : 0;
      var rz = jointAnim["rotateZ.ANGLE"] ? MATH.degToRad(jointAnim["rotateZ.ANGLE"][keyframe]) : 0;
      var ms = MATH.getI4();
      ms[0] = s[0]; ms[5] = s[1]; ms[10] = s[2];
      var mt = MATH.getI4();
      // row-major
      mt[3] = t[0]; mt[7] = t[1]; mt[11] = t[2];
      var mr = {
        x: MATH.rotateX(MATH.getI4(), rx),
        y: MATH.rotateY(MATH.getI4(), ry),
        z: MATH.rotateZ(MATH.getI4(), rz)
      };
      // rotations are column-major! convert to row-major
      mr.x = MATH.transpose(mr.x);
      mr.y = MATH.transpose(mr.y);
      mr.z = MATH.transpose(mr.z);
      var order = this.skeleton[name].rotationOrder;
      var m = MATH.mulMatrix(mr[order[0]], mr[order[1]]);
      m = MATH.mulMatrix(m, mr[order[2]]);
      m = MATH.mulMatrix(m, ms);
      m = MATH.mulMatrix(mt, m);
      return m;
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
