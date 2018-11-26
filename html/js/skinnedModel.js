(function(global) {
  "use strict";

  var MAX_JOINTS = 100;

  function arrayValueOrDefault(array, index, def) {
    if (array && array[index]) {
      return array[index];
    }
    return def;
  }

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
    var jointAnim = this.anims[name] || {};
    if (jointAnim.transform && jointAnim.transform[keyframe]) {
      return jointAnim.transform[keyframe];
    }
    var transform = this.skeleton[name].transform;
    var s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
    var t = arrayValueOrDefault(jointAnim.translation, keyframe,  [transform[3], transform[7], transform[11]]);
    var rx = MATH.degToRad(arrayValueOrDefault(jointAnim["rotateX.ANGLE"], keyframe, 0));
    var ry = MATH.degToRad(arrayValueOrDefault(jointAnim["rotateY.ANGLE"], keyframe, 0));
    var rz = MATH.degToRad(arrayValueOrDefault(jointAnim["rotateZ.ANGLE"], keyframe, 0));
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
    var order = this.skeleton[name].rotationOrder || "xyz";
    var m = MATH.mulMatrix(mr[order[0]], mr[order[1]]);
    m = MATH.mulMatrix(m, mr[order[2]]);
    m = MATH.mulMatrix(m, ms);
    m = MATH.mulMatrix(mt, m);
    return m;
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

  SkinnedModel.prototype.addPose = function(pose) {
    var anims = this.anims;
    var keys = Object.keys(pose);
    var frame = this.keyframeCount;
    keys.forEach(function (joint) {
      if (!anims[joint]) {
        anims[joint] = {};
      }
      ["X", "Y", "Z"].forEach(function (axis, i){
        var k = "rotate"+axis+".ANGLE";
        if (!anims[joint][k]) {
          anims[joint][k] = [];
        }
        anims[joint][k][frame] = pose[joint][i];
      });
      if (pose[joint][5] !== undefined) {
        if (!anims[joint].scale) {
          anims[joint].scale = [];
        }
        anims[joint].scale[frame] = pose[joint].slice(3, 6);
      }
      if (pose[joint][8] !== undefined) {
        if (!anims[joint].translation) {
          anims[joint].translation = [];
        }
        anims[joint].translation[frame] = pose[joint].slice(6, 9);
      }
    });
    this.keyframeCount += 1;
  };

  SkinnedModel.prototype.updateJointRotationOrder = function(jro) {
    var skeleton = this.skeleton;
    var keys = Object.keys(jro);
    keys.forEach(function(joint) {
      if (skeleton[joint]) {
        skeleton[joint].rotationOrder = jro[joint];
      }
    });
  };

  SkinnedModel.prototype.getPoseFile = function(keyframe) {
    var joints = Object.keys(this.anims);
    var anims = this.anims;
    var pose = {};
    joints.forEach(function (joint) {
      var jointAnim = anims[joint];
      var hasRotation = false;
      ["X", "Y", "Z"].forEach(function (axis) {
        var k = "rotate"+axis+".ANGLE";
        hasRotation |= jointAnim[k] && jointAnim[k][keyframe];
      });
      var hasScale = jointAnim.scale && jointAnim.scale[keyframe];
      var hasTranslation = jointAnim.translation && jointAnim.translation[keyframe];
      if (hasRotation || hasScale || hasTranslation) {
        var t = [];
        ["X", "Y", "Z"].forEach(function (axis) {
          var k = "rotate"+axis+".ANGLE";
          var r = arrayValueOrDefault(jointAnim[k], keyframe, 0);
          t.push(r);
        });
        if (hasScale || hasTranslation) {
          var s = arrayValueOrDefault(jointAnim.scale, keyframe, [1, 1, 1]);
          s.forEach(function(v) {t.push(v);});
          if (hasTranslation) {
            var x = arrayValueOrDefault(jointAnim.translation, keyframe, [0, 0, 0]);
            x.forEach(function(v) {t.push(v);});
          }
        }
        pose[joint] = t;
      }
    });
    return { pose: pose };
  };

  SkinnedModel.prototype.setAnimValue = function(joint, frame, key, value, index) {
    var jointAnim = this.anims[joint];
    if (!jointAnim[key]) {
      jointAnim[key] = [];
    }
    if (index) {
      jointAnim[key][frame][index] = value;
    } else {
      jointAnim[key][frame] = value;
    }
  };

  SkinnedModel.prototype.getSkeletonTopology = function(parentJoint) {
    var self = this;
    var joints = Object.keys(this.anims);
    var parent = parentJoint || null;
    var topo = {};
    joints.forEach(function (joint) {
      var j = self.skeleton[joint];
      if (j && j.parent === parent) {
        topo[joint] = self.getSkeletonTopology(joint);
      }
    });
    return topo;
  };

  // export
  global.SkinnedModel = (global.module || {}).exports = SkinnedModel;
})(this);
