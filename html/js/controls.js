import $ from './jquery.module.js';
import UiUtils from './uiutils.js';
import Viewer from './viewer.js';
import Config from './config.js';
import VMath from './math.js';
import Gfx from './gfx.js';
import LabelUtils from './labelUtils.js';

const { math } = window;

const ImageUrls = {
  'banana.png': 'resources/banana.png',
  'orange.png': 'resources/orange.png',
  'pear.png': 'resources/pear.png',
  'tree01.png': 'resources/tree01.png',
  'gray-checkerboard.png': 'resources/gray-checkerboard.png',
  white: 'resources/white.png',
  missing: 'resources/white.png',
};

const MaterialUrls = {};

// initialized on document.ready
let viewer;

function setInfo(text) {
  $('#infoDiv').text(text);
}

function setWarning(text) {
  setInfo(`[WARNING] ${text}`);
}

function setError(e) {
  console.error(e);
  setInfo(`[ERROR] ${e}`);
}

function clearFileBrowser(id) {
  // https://stackoverflow.com/a/832730
  $(`#${id}`).replaceWith($(`#${id}`).val('').clone(true));
}

function dumpObject(obj) {
  const keys = Object.keys(obj);
  const lines = keys.map(k => `${k}: ${obj[k]}`);
  setInfo(lines.join(', '));
}

function matrixToString(m) {
  // we could split it in 4 lines, but let's keep it simple for now
  return m.join(', ');
}

function vectorToString(v) {
  const rounder = a => Math.round(a * 100000) / 100000;
  let p = [];
  if (v.x !== undefined) {
    Object.keys(v).forEach((axis) => {
      p.push(rounder(v[axis]));
    });
  } else {
    p = v.map(rounder);
  }
  return p.join(', ');
}

function removePoseGroup() {
  $('tr[id^=gPose]').remove();
}

function addPoseGroup(skinnedModel) {
  const id = 'gPose';
  const frame = Config.keyframe;
  const { pose } = skinnedModel.getPoseFile(frame);
  const axisToIndex = { x: 0, y: 1, z: 2 };
  function updateJointAngle(joint, v, sub) {
    const key = 'eulerAngles';
    const value = parseFloat(v);
    const index = axisToIndex[sub];
    // eslint-disable-next-line object-curly-newline
    skinnedModel.setAnimValue({ joint, frame, key, value, index });
    skinnedModel.applyPose(frame);
  }
  function angleSlider(s, joint, values) {
    const parentId = `${id}_${joint}`;
    return UiUtils.createAngleSliders(s, parentId, values, updateJointAngle.bind(null, joint));
  }
  function updateJointPos(joint, v, sub) {
    const key = 'position';
    const value = parseFloat(v);
    const index = axisToIndex[sub];
    // eslint-disable-next-line object-curly-newline
    skinnedModel.setAnimValue({ joint, frame, key, value, index });
    skinnedModel.applyPose(frame);
  }
  function translationSlider(s, joint, values) {
    const parentId = `${id}_${joint}`;
    return UiUtils.createTranslationSliders(s, parentId, values, updateJointPos.bind(null, joint));
  }
  function createControls(skeleton, parent) {
    const joints = Object.keys(skeleton);
    let controls = [];
    joints.forEach((joint) => {
      const transform = pose[joint] || [];
      const rx = transform[0] || 0;
      const ry = transform[1] || 0;
      const rz = transform[2] || 0;
      const tx = transform[6] || 0;
      const ty = transform[7] || 0;
      const tz = transform[8] || 0;
      const subId = `${id}_${joint}`;
      let subcontrols = [
        angleSlider(subId, joint, [rx, ry, rz]),
        translationSlider(subId, joint, [tx, ty, tz]),
      ];
      const jointControls = createControls(skeleton[joint], subId);
      subcontrols = subcontrols.concat(jointControls);
      const jointGroup = UiUtils.createSubGroup(subId, joint, subcontrols, parent);
      controls = controls.concat(jointGroup);
    });
    return controls;
  }
  const controls = createControls(skinnedModel.topology);
  UiUtils.addGroup(id, 'Pose Controls', controls, '#controlsRight');
  // hide the sliders by clicking twice to toggle controls
  $('#gPose').click();
  $('#gPose').click();
}

function progressBarUpdate(ratio) {
  const percentage = Math.round(100 * ratio);
  $('#progressBar').css('width', `${percentage}%`);
}

function populateSubmeshList(meshes) {
  const ctrl = $('#submesh');
  ctrl.empty();
  ctrl.append($('<option>').attr('value', 'all').append('all'));
  meshes.forEach((m) => {
    ctrl.append($('<option>').attr('value', m.id).append(m.id));
  });
}

function populateLabelList(labels) {
  const keys = Object.keys(labels || {});
  const names = ['origin'].concat(keys);
  $('#centerModel_select').empty();
  UiUtils.addUrisToDropdownList('centerModel_select', names);
  $('#deleteLabel_select').empty();
  UiUtils.addUrisToDropdownList('deleteLabel_select', keys);
}

function updateLabelList() {
  if (viewer && viewer.scene.models[viewer.selectedModel]) {
    populateLabelList(viewer.scene.models[viewer.selectedModel].labels);
  }
}

function updateRotationLock() {
  viewer.setRotationLock(Config.isLockRotationX, Config.isLockRotationY);
}

const Update = {
  cameraLocation: (i) => {
    const idx = i || Config.selectedCamera;
    const camera = viewer.getCamera(idx);
    const cfgCamera = Config.cameras[idx];
    camera.setLocation(
      cfgCamera.offsetX,
      cfgCamera.height,
      cfgCamera.distance,
      cfgCamera.pitch,
      cfgCamera.rotationY,
    );
  },
  cameraFov: (i) => {
    const idx = i || Config.selectedCamera;
    const camera = viewer.getCamera(idx);
    const cfgCamera = Config.cameras[idx];
    camera.setFOV(cfgCamera.fov);
  },
  camera: (i) => {
    Update.cameraLocation(i);
    Update.cameraFov(i);
  },
  cameraPosition: (value, axis) => {
    const camera = viewer.getCamera(Config.selectedCamera);
    const cfgCamera = Config.cameras[Config.selectedCamera];
    cfgCamera.eye.position[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
  },
  cameraTarget: (value, axis) => {
    const camera = viewer.getCamera(Config.selectedCamera);
    const cfgCamera = Config.cameras[Config.selectedCamera];
    cfgCamera.eye.target[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
  },
  cameraUp: (value, axis) => {
    const camera = viewer.getCamera(Config.selectedCamera);
    const cfgCamera = Config.cameras[Config.selectedCamera];
    cfgCamera.eye.up[axis] = parseFloat(value);
    camera.setEye(cfgCamera.eye);
  },
  modelTransform: () => {
    const p = Config.model.position;
    const r = Config.model.rotation;
    const s = Config.model.scale;
    viewer.setModelTransform({
      position: [p.x, p.y, p.z],
      rotation: [r.x, r.y, r.z],
      scale: [s, s, s],
    });
  },
  modelScale: (logValue) => {
    Config.model.scale = 10 ** parseFloat(logValue);
    Update.modelTransform();
  },
  model: () => {
    Update.modelTransform();
  },
  sunAltitude: (h) => {
    viewer.scene.lights[0].setAltitude(h);
  },
  sunEastWest: (ew) => {
    viewer.scene.lights[0].setEastWest(ew);
  },
  sunIntensity: (i) => {
    viewer.scene.lights[0].setIntensity(i);
  },
  sunAlpha: (a) => {
    viewer.scene.lights[0].setAlpha(a);
  },
  sun: () => {
    const sun = viewer.scene.lights[0];
    sun.setAltitude(Config.sun.altitude);
    sun.setEastWest(Config.sun.eastWest);
    sun.setIntensity(Config.sun.intensity);
    sun.setAlpha(Config.sun.alpha);
  },
  jointSelection: (obj) => {
    console.log(obj);
    const model = viewer.getSelectedModel();
    if (model && model.skinnedModel) {
      model.skinnedModel.selectedJoint = obj.value;
      UISetter.anim.updateJointControls();
      UISetter.anim.updateJointColor();
    }
  },
};


const UISetter = {
  global: {
    setSlider: (id, value) => {
      $(`#${id}`).val(value);
      $(`#${id}_number`).val(value);
    },
  },
  camera: {
    distance: (z) => {
      UISetter.global.setSlider('camera_distance', z);
      Config.cameras[Config.selectedCamera].distance = z;
    },
    height: (y) => {
      UISetter.global.setSlider('camera_height', y);
      Config.cameras[Config.selectedCamera].height = y;
    },
    offsetX: (x) => {
      UISetter.global.setSlider('camera_offsetX', x);
      Config.cameras[Config.selectedCamera].offsetX = x;
    },
    pitch: (a) => {
      UISetter.global.setSlider('camera_pitch', a);
      Config.cameras[Config.selectedCamera].pitch = a;
    },
    rotationY: (a) => {
      UISetter.global.setSlider('camera_rotationY', a);
      Config.cameras[Config.selectedCamera].rotationY = a;
    },
    position: (position) => {
      const p = VMath.round(position, 4);
      const cfgCamera = Config.cameras[Config.selectedCamera];
      ['x', 'y', 'z'].forEach((axis, i) => {
        cfgCamera.position[axis] = p[i];
        $(`#camera_position${axis}`).val(p[i]);
        $(`#camera_position${axis}_number`).val(p[i]);
      });
    },
    fov: (a) => {
      UISetter.global.setSlider('camera_fov', a);
      Config.cameras[Config.selectedCamera].fov = a;
    },
    select: (obj) => {
      Config.selectedCamera = obj.value;
      const cfgCamera = Config.cameras[obj.value];
      Object.keys(cfgCamera).forEach((k) => {
        UISetter.global.setSlider(`camera_${k}`, cfgCamera[k]);
      });
    },
  },
  model: {
    rotation: (rotation) => {
      ['x', 'y', 'z'].forEach((axis, i) => {
        const angle = rotation[i] !== undefined
          ? VMath.round(rotation[i], 4) : Config.model.rotation[axis];
        Config.model.rotation[axis] = angle;
        $(`#armature_angle${axis}`).val(angle);
        $(`#armature_angle${axis}_number`).val(angle);
      });
    },
    translation: (translation) => {
      const p = VMath.round(translation, 4);
      ['x', 'y', 'z'].forEach((axis, i) => {
        Config.model.position[axis] = p[i];
        $(`#armature_translation${axis}`).val(p[i]);
        $(`#armature_translation${axis}_number`).val(p[i]);
      });
    },
    meterUnits: (unitMeters) => {
      let logScale = Math.log10(unitMeters);
      logScale = Math.round(1e4 * logScale) * 1e-4;
      $('#modelScaleExp10').val(logScale);
      $('#modelScaleExp10_number').val(logScale);
      Config.model.scale = 10 ** parseFloat(logScale);
    },
  },
  sun: {
    altitude: (h) => {
      $('#SunAltitude').val(h);
      $('#SunAltitude_number').val(h);
      Config.sun.altitude = h;
    },
    eastWest: (ew) => {
      $('#SunEastWest').val(ew);
      $('#SunEastWest_number').val(ew);
      Config.sun.eastWest = ew;
    },
    intensity: (i) => {
      $('#SunIntensity').val(i);
      $('#SunIntensity_number').val(i);
      Config.sun.intensity = i;
    },
    alpha: (a) => {
      $('#SunAlpha').val(a);
      $('#SunAlpha_number').val(a);
      Config.sun.alpha = a;
    },
  },
  anim: {
    keyframe: (k) => {
      Config.keyframe = parseInt(k, 10);
      removePoseGroup();
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        addPoseGroup(model.skinnedModel);
        viewer.setKeyframe(Config.keyframe);
      }
    },
    setOption: (key, value) => {
      Config[key] = value;
      $(`#${key}`).prop('checked', value);
    },
    setJointValue: (id, key, joint, axis, valueStr) => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const value = parseFloat(valueStr);
        $(`#gPose_${joint}_${id}${axis}`).val(value);
        $(`#gPose_${joint}_${id}${axis}_number`).val(value);
        const frame = Config.keyframe;
        const index = { x: 0, y: 1, z: 2 }[axis];
        model.skinnedModel.setAnimValue({
          joint, frame, key, value, index,
        });
        model.skinnedModel.applyPose(frame);
      }
    },
    setJointNames: (names) => {
      $('#selectedJoint').empty();
      UiUtils.addUrisToDropdownList('selectedJoint', names);
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        model.skinnedModel.selectedJoint = $('#selectedJoint').val();
      }
    },
    updateJointColor: () => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        const jointIndex = model.skinnedModel.jointIndices[joint];
        if (jointIndex === undefined) {
          return null;
        }
        const palette = model.skinnedModel.jointColorPalette;
        const color = palette.slice(4 * jointIndex, 4 * jointIndex + 3);
        const hexColor = VMath.vectorToHexColor(color);
        $('#jointColor').val(hexColor);
      }
    },
    updateJointControls: () => {
      let angles = { x: 0, y: 0, z: 0 };
      let localAngles = { x: 0, y: 0, z: 0 };
      let pos = { x: 0, y: 0, z: 0 };
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        angles = {
          x: $(`#gPose_${joint}_anglex`).val(),
          y: $(`#gPose_${joint}_angley`).val(),
          z: $(`#gPose_${joint}_anglez`).val(),
        };
        pos = {
          x: $(`#gPose_${joint}_translationx`).val(),
          y: $(`#gPose_${joint}_translationy`).val(),
          z: $(`#gPose_${joint}_translationz`).val(),
        };
        const frame = Config.keyframe;
        localAngles = model.skinnedModel.getRotationInLocalAxis(joint, frame);
      }
      // copy values from main controller to shortcut for selected joint
      ['x', 'y', 'z'].forEach((axis) => {
        $(`#joint_angle${axis}`).val(angles[axis]);
        $(`#joint_angle${axis}_number`).val(angles[axis]);
        // keep only 4 digits (in degrees)
        const a = VMath.round(localAngles[axis], 4);
        $(`#joint_localAngle${axis}`).val(a);
        $(`#joint_localAngle${axis}_number`).val(a);
        $(`#joint_translation${axis}`).val(pos[axis]);
        $(`#joint_translation${axis}_number`).val(pos[axis]);
      });
    },
    selectJoint: (name) => {
      $('#selectedJoint').val(name);
      UISetter.anim.updateJointControls();
      UISetter.anim.updateJointColor();
    },
  },
};

// aliases
UISetter.anim.setJointRotation = UISetter.anim.setJointValue.bind(null, 'angle', 'eulerAngles');
UISetter.anim.setJointTranslation = UISetter.anim.setJointValue.bind(null, 'translation', 'position');


const Actions = {
  labels: {
    setOption: (key, value) => {
      Config[key] = value;
      viewer.scene.labels[key] = value;
      $(`#${key}`).prop('checked', value);
    },
    bake: () => {
      const model = viewer.scene.models[0];
      if (model) {
        progressBarUpdate(0);
        $('#progressBarDiv').show();
        model.bakeLabels(viewer.glState.gl,
          Config.labelScale,
          progressBarUpdate, () => {
            Actions.labels.setOption('showLabels', false);
            $('#progressBarDiv').hide();
          }, setError);
      }
    },
  },
  model: {
    load: (slot, name, url) => {
      const currentSlot = viewer.selectedModel;
      viewer.selectedModel = slot;
      progressBarUpdate(0);
      $('#progressBarDiv').show();
      viewer.loadModel(name, url, Config, ImageUrls, MaterialUrls, progressBarUpdate, (model) => {
        removePoseGroup();
        $('#progressBarDiv').hide();
        if (model.stats) {
          dumpObject(model.stats);
        }
        if (model.skinnedModel) {
          $('#keyframe').attr('max', model.skinnedModel.keyframeCount - 1);
          $('#keyframe_number').val(-1);
          Config.keyframe = -1;
          Actions.anim.setOption('showSkeleton', Config.showSkeleton);
          Actions.anim.setOption('showJointLabels', Config.showJointLabels);
          UISetter.anim.setJointNames(model.skinnedModel.jointNames);
          addPoseGroup(model.skinnedModel);
        }
        UISetter.model.translation(model.transform.position);
        UISetter.model.rotation([0, 0, 0]);
        UISetter.model.meterUnits(model.meterUnits);
        Update.modelTransform();
        populateSubmeshList(model.meshes);
        populateLabelList(model.labels);
        viewer.selectedModel = currentSlot;
      }, setError);
    },
    reload: () => {
      const url = $('#selectedModel').val();
      const name = $('#selectedModel option:selected').text();
      const slot = viewer.selectedModel;
      Actions.model.load(slot, name, url);
    },
    placeOnFloor: () => {
      const model = viewer.getSelectedModel();
      if (model) {
        progressBarUpdate(0);
        $('#progressBarDiv').show();
        model.getBoundingBox((bb) => {
          setInfo(`BoundingBox: {min: [${vectorToString(bb.min)}], max: [${vectorToString(bb.max)}]}`);
          const p = model.transform.position;
          const t = [p[0], -bb.min.y, p[2]];
          UISetter.model.translation(t);
          Update.modelTransform();
          $('#progressBarDiv').hide();
        });
      }
    },
    dumpScaledTranslation: () => {
      const model = viewer.getSelectedModel();
      if (model) {
        const scaled = math.dotDivide(model.transform.position, model.transform.scale);
        const p = math.subtract([0, 0, 0], scaled);
        const str = vectorToString(p);
        setInfo(`Position: ${str}`);
      }
    },
  },
  anim: {
    setPose: (url) => {
      const frame = Config.keyframe;
      const model = viewer.getSelectedModel();
      if (!model || !model.skinnedModel) {
        setWarning('Not a skinned model');
        return;
      }
      $.getJSON(url, (pose) => {
        model.skinnedModel.setPose(pose.pose, frame);
        UISetter.anim.keyframe(frame);
      })
        .fail((e) => {
          console.error(e);
        });
    },
    makeSymmetric: (referenceSide) => {
      const frame = Config.keyframe;
      const model = viewer.getSelectedModel();
      if (!model || !model.skinnedModel) {
        setWarning('Not a skinned model');
        return;
      }
      model.skinnedModel.makeSymmetric(referenceSide, frame);
      UISetter.anim.keyframe(frame);
    },
    zeroTranslations: () => {
      const frame = Config.keyframe;
      const model = viewer.getSelectedModel();
      if (!model || !model.skinnedModel) {
        setWarning('Not a skinned model');
        return;
      }
      model.skinnedModel.zeroTranslations(frame);
      UISetter.anim.keyframe(frame);
    },
    setOption: (key, value) => {
      UISetter.anim.setOption(key, value);
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        model.skinnedModel[key] = value;
      }
    },
    alignBoneWith: (alignment) => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const label = $('#deleteLabel_select').val();
        const joint = model.skinnedModel.selectedJoint;
        const labelPos = model.labels[label];
        let aa;
        if (alignment === 'twist') {
          aa = model.skinnedModel.twistParentToPointBoneToTarget(joint, labelPos, Config.keyframe);
        } else {
          aa = model.skinnedModel.pointBoneToTarget(joint, labelPos, Config.keyframe);
        }
        ['x', 'y', 'z'].forEach((axis, i) => {
          UISetter.anim.setJointRotation(aa.joint, axis, aa.eulerNew[i]);
        });
        UISetter.anim.updateJointControls();
        console.log(aa);
      }
    },
    zeroJoint: () => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        ['x', 'y', 'z'].forEach((axis) => {
          UISetter.anim.setJointRotation(joint, axis, 0);
          UISetter.anim.setJointTranslation(joint, axis, 0);
        });
        UISetter.anim.updateJointControls();
      }
    },
    jointAngle: (value, axis) => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        UISetter.anim.setJointRotation(joint, axis, value);
        UISetter.anim.updateJointControls();
      }
    },
    jointLocalAngle: () => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        const eulerAngles = [
          $('#joint_localAnglex').val(),
          $('#joint_localAngley').val(),
          $('#joint_localAnglez').val(),
        ];
        const angleAxis = model.skinnedModel.convertLocalRotationToGlobalAxis(joint, eulerAngles);
        // keep only 4 digits (in degrees)
        const angles = VMath.round(angleAxis.eulerAngles.map(VMath.radToDeg), 4);
        ['x', 'y', 'z'].forEach((axis, i) => {
          UISetter.anim.setJointRotation(joint, axis, angles[i]);
          $(`#joint_angle${axis}`).val(angles[i]);
          $(`#joint_angle${axis}_number`).val(angles[i]);
          $(`#gPose_${joint}_angle${axis}`).val(angles[i]);
          $(`#gPose_${joint}_angle${axis}_number`).val(angles[i]);
        });
      }
    },
    jointTranslation: (value, axis) => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        UISetter.anim.setJointTranslation(joint, axis, value);
      }
    },
    jointColor: (e) => {
      const model = viewer.getSelectedModel();
      if (model && model.skinnedModel) {
        const joint = model.skinnedModel.selectedJoint;
        const jointIndex = model.skinnedModel.jointIndices[joint];
        if (jointIndex === undefined) {
          return;
        }
        const palette = model.skinnedModel.jointColorPalette;
        const c = VMath.hexColorToNormalizedVector(e.target.value);
        c.forEach((value, i) => {
          palette[4 * jointIndex + i] = value;
        });
      }
    },
  },
  shader: {
    checkAspect: (img) => {
      if (!img) {
        setWarning('Not an image');
        return;
      }
      const aspect = img.height / img.width;
      const sizeinfo = `${img.width}×${img.height}`;
      if (Math.abs(aspect - 1.5) > 0.01) {
        setWarning(`Image aspect should be 2:3 but loaded image is ${sizeinfo}`);
      } else {
        setInfo(`Image size: ${sizeinfo}`);
      }
    },
    background: (values) => {
      values.forEach((v, i) => {
        viewer.setBackgroundImage(i, v.uri, Actions.shader.checkAspect);
      });
    },
    overlay: (values) => {
      values.forEach((v, i) => {
        viewer.setOverlayImage(i, v.uri, Actions.shader.checkAspect);
      });
    },
    overlayAlpha: (alpha) => {
      viewer.views.forEach((v) => {
        v.overlay.alpha = alpha;
      });
    },
    clearBackground: () => {
      for (let i = 0; i < viewer.views.length; i += 1) {
        viewer.setBackgroundImage(i, null);
      }
      clearFileBrowser('backgroundFileBrowser');
    },
    clearOverlay: () => {
      for (let i = 0; i < viewer.views.length; i += 1) {
        viewer.setOverlayImage(i, null);
      }
      clearFileBrowser('overlayFileBrowser');
    },
  },
};

// aliases
Actions.anim.alignBone = Actions.anim.alignBoneWith.bind(null, 'cross');
Actions.anim.twistAlign = Actions.anim.alignBoneWith.bind(null, 'twist');


function saveCurrentPose() {
  const model = viewer.getSelectedModel();
  if (model && model.skinnedModel) {
    const frame = Config.keyframe;
    const pose = model.skinnedModel.getPoseFile(frame);
    const fn = Gfx.getFileNameWithoutExtension(model.name);
    Gfx.saveJson(pose, `${fn}_${frame}`);
  } else {
    setWarning('No skinned model');
  }
}

function addImageToBasket(image) {
  const thumbnailHeight = 68;
  const img = image;
  img.width = thumbnailHeight * img.width / img.height;
  img.height = thumbnailHeight;
  img.className = 'snapshot';
  $('#imageBasket').append(img);
}

function snapshot(imgData) {
  return new Promise((resolve, reject) => {
    Gfx.createImageFromImageData(imgData, (image) => {
      if (image.width === 0) {
        reject(new Error('Failed to capture'));
      } else {
        resolve(image);
      }
    });
  });
}

function captureColor() {
  Viewer.readImageData()
    .then(snapshot)
    .then(addImageToBasket)
    .catch(setError);
}

function captureDepth() {
  viewer.replaceLitShader('shaders/outDepth.fs')
    .then(() => {
      viewer.setBackgroundColor(0xffffffff);
      viewer.setOutputSurface('float');
    })
    .then(Viewer.readImageData)
    .then((imgData) => {
      Gfx.savePamFile(imgData, 'depth.pam');
      return snapshot(imgData);
    })
    .then((img) => {
      addImageToBasket(img);
      viewer.setOutputSurface('default');
      viewer.setBackgroundColor(Config.backgroundColor);
      viewer.replaceLitShader('shaders/lighting.fs');
    })
    .catch(setError);
}

function populateControls() {
  function onChangeFileBrowser(values) {
    const models = [];
    for (let i = 0; i < values.length; i += 1) {
      const ext = Gfx.getFileExtension(values[i].name);
      if (ext === 'Json' || ext === 'Obj' || ext === 'Dae') {
        models.push(values[i]);
      } else if (ext === 'Mtl') {
        MaterialUrls[values[i].name] = values[i].uri;
      } else { // the rest should be images!
        ImageUrls[values[i].name] = values[i].uri;
      }
    }
    // add models to preset list
    if (models.length > 0) {
      UiUtils.addUrisToDropdownList('selectedModel', models);
      Actions.model.reload();
    }
  }

  function onLoadLabels(values) {
    const f = values[0];
    if (!f) {
      return;
    }
    function importLabels(fn) {
      const importer = (data) => {
        const model = viewer.getSelectedModel();
        if (model) {
          const labels = fn(data);
          model.labels = labels;
          populateLabelList(labels);
        }
      };
      return importer;
    }
    const ext = Gfx.getFileExtension(f.name);
    if (ext === 'Json') {
      $.getJSON(f.uri, importLabels(LabelUtils.importLabels));
    } else if (ext === 'Txt') {
      $.ajax({
        async: true,
        url: f.uri,
        datatype: 'text',
        success: importLabels(LabelUtils.importLabelsTxt),
      });
    } else if (ext === 'Lnd') {
      $.ajax({
        async: true,
        url: f.uri,
        datatype: 'text',
        success: importLabels(LabelUtils.importLabelsLnd),
      });
    } else if (ext === 'Pp') {
      $.ajax({
        async: true,
        url: f.uri,
        datatype: 'xml',
        success: importLabels(LabelUtils.importLabelsXml),
      });
    } else {
      setError('Supported label formats: Json, Txt, Lnd, Pp');
    }
  }

  function updateLabelScale(logValue) {
    Config.labelScale = 10 ** parseFloat(logValue);
    viewer.setLabelScale(Config.labelScale);
  }

  function onAddPoseFiles(values) {
    const model = viewer.getSelectedModel();
    if (!model || !model.skinnedModel) {
      setWarning('Not a skinned model');
      return;
    }
    const { skinnedModel } = model;
    function readPoseFile(i) {
      if (i >= values.length) {
        $('#keyframe').attr('max', skinnedModel.keyframeCount - 1);
        return;
      }
      const ext = Gfx.getFileExtension(values[i].name);
      if (ext === 'Json') {
        $.getJSON(values[i].uri, (pose) => {
          skinnedModel.addPose(pose.pose);
          readPoseFile(i + 1);
        });
      } else {
        console.warn(`Unknown extension: ${values[i].name}`);
        readPoseFile(i + 1);
      }
    }
    readPoseFile(0);
  }

  function onAddJroFile(values) {
    const model = viewer.getSelectedModel();
    if (!model || !model.skinnedModel) {
      setWarning('Not a skinned model');
      return;
    }
    const { skinnedModel } = model;
    const f = values[0];
    const ext = Gfx.getFileExtension(f.name);
    if (ext === 'Json') {
      $.getJSON(f.uri, (jro) => {
        skinnedModel.updateJointRotationOrder(jro.jointRotationOrder);
      });
    } else {
      setWarning(`Unknown extension: ${f.name}`);
    }
  }

  function saveIntrinsicViewMatrix() {
    const w = viewer.canvas.width;
    const h = viewer.canvas.height;
    const KV = viewer.getCamera(0).getIntrinsicViewMatrix(w, h);
    const obj = {
      image_width: w,
      image_height: h,
      projection_matrix: KV,
    };
    Gfx.saveJson(obj, 'camera');
  }

  const modelPresets = [
    'pear.json',
    'banana.json',
    'cubes.obj',
    'orange.json',
    'banana.obj',
    'tree01.dae',
    'plane.obj',
    'monigote.dae'].map(e => ({ name: e, value: `resources/${e}` }));

  const missingTexturePresets = [
    { name: 'white', value: 'resources/white.png' },
    { name: 'uvChecker', value: 'resources/UVTextureChecker4096.png' },
  ];

  const shaderPresets = [
    { name: 'default shading', value: 'shaders/lighting.fs' },
    { name: 'albedo', value: 'shaders/debugAlbedo.fs' },
    { name: 'depth', value: 'shaders/debugDepth.fs' },
    { name: 'UVs', value: 'shaders/debugUVs.fs' },
    { name: 'solid wire', value: 'shaders/debugSolidWire.fs' },
    { name: 'skin weights', value: 'shaders/debugSkinWeights.fs' },
    { name: 'joint count', value: 'shaders/debugJointCount.fs' },
    { name: 'world normal', value: 'shaders/debugWorldNormal.fs' },
    { name: 'intersect', value: 'intersect' },
    { name: 'intersect lit', value: 'intersect-lit' },
  ];

  const labelFilterPresets = [
    { name: 'all', value: 'all' },
    { name: 'enabled', value: 'enabled' },
    { name: 'disabled', value: 'disabled' },
    { name: 'enabled && front', value: 'enabledFront' },
    { name: 'enabled && back', value: 'enabledBack' },
    { name: 'enabled && front && right', value: 'enabledFrontRight' },
    { name: 'enabled && front && left', value: 'enabledFrontLeft' },
    { name: 'enabled && back && right', value: 'enabledBackRight' },
    { name: 'enabled && back && left', value: 'enabledBackLeft' },
  ];

  const labelFilters = {
    all: () => true,
    enabled: (_, label) => !label.disabled,
    disabled: (_, label) => label.disabled,
    enabledFront: (name, label) => !label.disabled && name.indexOf('Back') < 0,
    enabledBack: (name, label) => !label.disabled && name.indexOf('Front') < 0 && name.indexOf('Bust') < 0,
    enabledFrontRight: (name, label) => labelFilters.enabledFront(name, label) && name.endsWith('Right'),
    enabledFrontLeft: (name, label) => labelFilters.enabledFront(name, label) && name.endsWith('Left'),
    enabledBackRight: (name, label) => !label.disabled && name.indexOf('Back') >= 0 && name.indexOf('Right') >= 0,
    enabledBackLeft: (name, label) => !label.disabled && name.indexOf('Back') >= 0 && name.indexOf('Left') >= 0,
  };

  const modelSlots = [
    { name: 'slot 0', value: 0 },
    { name: 'slot 1', value: 1 },
    { name: 'slot 2', value: 2 },
    { name: 'slot 3', value: 3 },
  ];

  // Create the UI controls
  // * Toolbar (it won't execute if toolbar.json doesn't exist)
  $.getJSON('toolbar.json', (cfg) => {
    const elements = [];
    Object.keys(cfg).forEach((g) => {
      const row = [];
      cfg[g].forEach((b) => {
        const fn = () => {
          if (b.preset) {
            Object.keys(b.preset).forEach((key) => {
              Object.keys(b.preset[key]).forEach((field) => {
                UISetter[key][field](b.preset[key][field]);
              });
              Update[key]();
            });
          }
          if (b.actions) {
            Object.keys(b.actions).forEach((key) => {
              b.actions[key].forEach((action) => {
                const { cmd } = action;
                Actions[key][cmd].apply(null, action.args);
              });
            });
          }
          if (!b.actions && !b.preset) {
            console.log(b);
          }
        };
        const btn = {
          id: b.id,
          text: b.text,
          icon: b.icon,
          iconType: b.iconType || '',
          callback: fn,
        };
        row.push(btn);
      });
      elements.push(UiUtils.createButtons(`toolbar_${g}`, row));
    });
    UiUtils.addGroup('gToolbar', 'Toolbar', elements, '#controls', true);
  });
  // * File
  UiUtils.addGroup('gFile', 'File', [
    UiUtils.createDropdownList('modelSlot', 'Slot', modelSlots, (e) => {
      viewer.selectedModel = parseInt(e.value, 10);
    }),
    UiUtils.createFileBrowser('fileBrowser', 'load models & textures', true, onChangeFileBrowser),
    UiUtils.createDropdownList('selectedModel', 'Presets', modelPresets, Actions.model.reload),
    UiUtils.createButtonWithOptions('saveFile', 'Save', ' as ',
      [{ name: 'OBJ Wavefront', value: '.obj' }, { name: 'Json', value: '.json' }],
      (e) => {
        const modelType = $(`#${e.target.id}_select`).val();
        const url = $('#selectedModel').val();
        const name = $('#selectedModel option:selected').text();
        const submeshes = viewer.scene.selectedMesh ? [viewer.scene.selectedMesh] : false;
        Gfx.exportModel(name, url, modelType, MaterialUrls, submeshes)
          .catch((ee) => {
            setError(ee);
          });
      }),
    UiUtils.createButtons('snapshotControls', [{
      id: 'snapshot',
      text: 'Snapshot',
      callback: captureColor,
    },
    {
      id: 'snapDepth',
      text: 'Depth',
      callback: captureDepth,
    },
    {
      id: 'clearSnapshots',
      text: 'Clear',
      callback: () => {
        $('#imageBasket').empty();
      },
    }]),
    UiUtils.createEmptyRow('imageBasket'),
  ]);
  // * Labels
  UiUtils.addGroup('gLabels', 'Labels', [
    UiUtils.createFileBrowser('labelBrowser', 'load model labels', false, onLoadLabels),
    UiUtils.createSlider('labelScaleExp10', 'scale (log10)', 0, -3, 3, 0.2, updateLabelScale),
    UiUtils.createButtons('labelButtons', [{
      id: 'bakeLabels',
      text: 'Bake',
      callback: Actions.labels.bake,
    },
    {
      id: 'clearLabels',
      text: 'Clear',
      callback: () => {
        const model = viewer.getSelectedModel();
        if (model) {
          model.labels = {};
          updateLabelList();
        }
      },
    },
    {
      id: 'averageLabels',
      text: 'Average',
      callback: () => {
        const model = viewer.getSelectedModel();
        if (model) {
          model.labels = LabelUtils.averageSimilarLabels(model.labels);
        }
      },
    },
    {
      id: 'saveLabels',
      text: 'Save',
      callback: () => {
        const labels = viewer.getModelLabels();
        if (labels) {
          Gfx.saveJson(labels, 'labels');
        }
      },
    },
    {
      id: 'saveLabelsFiltered',
      text: 'Save Filtered',
      callback: () => {
        const labels = viewer.getModelLabels();
        if (labels) {
          const filterId = $('#labelFilter').val();
          const filterFn = labelFilters[filterId];
          const labelsFiltered = {};
          Object.keys(labels).forEach((k) => {
            if (filterFn(k, labels[k])) {
              labelsFiltered[k] = labels[k];
            }
          });
          Gfx.saveJson(labelsFiltered, 'labels');
        }
      },
    },
    ]),
    UiUtils.createTextInput('pickLabel', 'Label name', 'new', (e) => {
      viewer.scene.labels.selected = e.target.value;
    }),
    UiUtils.createButtonWithOptions('deleteLabel', 'Delete', ' selected label: ',
      [],
      (e) => {
        const label = $(`#${e.target.id}_select`).val();
        viewer.deleteLabel(label);
        updateLabelList();
      },
      (e) => {
        const label = $(`#${e.target.id}`).val();
        $('#pickLabel').val(label);
        viewer.scene.labels.selected = label;
      }),
    UiUtils.createSlider('pointSize', 'Point size', Config.pointSize, 0, 16, 1, (value) => {
      viewer.setPointSize(value);
    }),
    UiUtils.createColorPicker('pointColor', 'Point color', '#ffffff', (e) => {
      const c = VMath.hexColorToNormalizedVector(e.target.value);
      viewer.setPointColor(c[0], c[1], c[2], 1);
    }),
    UiUtils.createDropdownList('labelFilter', 'Filter', labelFilterPresets, (obj) => {
      viewer.setLabelFilter(labelFilters[obj.value]);
    }),
    UiUtils.createCheckboxes('labelOptions', {
      showLabels: { text: 'show labels', default: Config.showLabels },
      showPoints: { text: 'show points', default: Config.showPoints },
    }, Actions.labels.setOption),
  ]);
  // * Model Settings
  UiUtils.addGroup('gModel', 'Model Settings', [
    UiUtils.createCheckboxes('onLoadOptions', {
      recomputeNormals: { text: 'recompute normals', default: Config.recomputeNormals },
      reRig: { text: 're-rig', default: Config.reRig },
    }, (key, value) => {
      Config[key] = value;
      Actions.model.reload();
    }),
    UiUtils.createSlider('modelScaleExp10', 'scale (log10)', 0, -3, 3, 0.2, Update.modelScale),
    UiUtils.createCheckboxes('axisLock', {
      isLockRotationX: { text: 'lock X', default: Config.isLockRotationX },
      isLockRotationY: { text: 'lock Y', default: Config.isLockRotationY },
    }, (key, value) => {
      Config[key] = value;
      updateRotationLock();
    }),
    UiUtils.createAngleSliders('armature', null, [0, 0, 0], (value, axis) => {
      Config.model.rotation[axis] = parseFloat(value);
      Update.modelTransform();
    }),
    UiUtils.createTranslationSliders('armature', null, [0, 0, 0], (value, axis) => {
      Config.model.position[axis] = parseFloat(value);
      Update.modelTransform();
    }),
    UiUtils.createButtonWithOptions('centerModel', 'Center', ' around ',
      [{ name: 'origin', value: 'origin' }],
      (e) => {
        const label = $(`#${e.target.id}_select`).val();
        const { position, scaled } = viewer.getPositionForLabel(0, label);
        // do not translate vertically
        scaled[1] = 0;
        const str = vectorToString(position);
        setInfo(`${label} at: [${str}]`);
        UISetter.model.rotation([0, 0, 0]);
        UISetter.model.translation(scaled);
        Update.modelTransform();
      }),
    UiUtils.createButtons('modelButtons', [{
      id: 'placeOnFloor',
      text: 'Place on floor',
      callback: Actions.model.placeOnFloor,
    },
    {
      id: 'dumpScaledTranslation',
      text: 'Dump scaled translation',
      callback: Actions.model.dumpScaledTranslation,
    },
    ]),
    UiUtils.createDropdownList('submesh', 'Submesh', [], (obj) => {
      viewer.selectSubmesh(obj.value);
    }),
  ]);
  // * Camera Settings
  UiUtils.addGroup('gCamera', 'Camera Settings', [
    UiUtils.createSlider('camera_distance', 'distance',
      Config.cameras[0].distance, 0.2, 10, 0.01, (value) => {
        Config.cameras[Config.selectedCamera].distance = parseFloat(value);
        Update.cameraLocation(Config.selectedCamera);
      }),
    UiUtils.createSlider('camera_height', 'height',
      Config.cameras[0].height, -2, 2, 0.01, (value) => {
        Config.cameras[Config.selectedCamera].height = parseFloat(value);
        Update.cameraLocation(Config.selectedCamera);
      }),
    UiUtils.createSlider('camera_offsetX', 'offset X',
      Config.cameras[0].offsetX, -2, 2, 0.01, (value) => {
        Config.cameras[Config.selectedCamera].offsetX = parseFloat(value);
        Update.cameraLocation(Config.selectedCamera);
      }),
    UiUtils.createSlider('camera_pitch', 'pitch',
      Config.cameras[0].pitch, -90, 90, 1, (value) => {
        Config.cameras[Config.selectedCamera].pitch = parseFloat(value);
        Update.cameraLocation(Config.selectedCamera);
      }),
    UiUtils.createSlider('camera_rotationY', 'rotation Y',
      Config.cameras[0].rotationY, -180, 180, 1, (value) => {
        Config.cameras[Config.selectedCamera].rotationY = parseFloat(value);
        Update.cameraLocation(Config.selectedCamera);
      }),
    UiUtils.createMultiSlider(
      'camera_position',
      ['x', 'y', 'z'],
      'position XYZ',
      [0, 0.95, 3.01], -10, 10, 0.01,
      Update.cameraPosition,
    ),
    UiUtils.createMultiSlider(
      'camera_target',
      ['x', 'y', 'z'],
      'target XYZ',
      [0, 0.95, 0], -10, 10, 0.01,
      Update.cameraTarget,
    ),
    UiUtils.createMultiSlider(
      'camera_up',
      ['x', 'y', 'z'],
      'up XYZ',
      [0, 1, 0], -1, 1, 0.01,
      Update.cameraUp,
    ),
    UiUtils.createSlider('camera_fov', 'Field of View',
      Config.cameras[0].fov, 1, 90, 1, (value) => {
        Config.cameras[Config.selectedCamera].fov = parseFloat(value);
        Update.cameraFov(Config.selectedCamera);
      }),
    UiUtils.createDropdownList('selectCamera', 'Select camera',
      [{ name: 0, value: 0 }, { name: 1, value: 1 }, { name: 2, value: 2 }, { name: 3, value: 3 }],
      UISetter.camera.select),
    UiUtils.createButtons('cameraDumps', [
      {
        id: 'dumpProjection',
        text: 'Dump Proj',
        callback: () => setInfo(matrixToString(viewer.getCamera(0).projectionMatrix)),
      },
      {
        id: 'dumpView',
        text: 'Dump View',
        callback: () => setInfo(matrixToString(viewer.getCamera(0).viewMatrix)),
      },
      {
        id: 'dumpRotation',
        text: 'Dump R',
        callback: () => setInfo(matrixToString(viewer.getCamera(0).getFlippedRotation())),
      },
      {
        id: 'saveIntrinsicView',
        text: 'Save K*V',
        callback: saveIntrinsicViewMatrix,
      },
    ]),
  ]);
  // * Light Settings
  UiUtils.addGroup('gLight', 'Light Settings', [
    UiUtils.createSlider('SunAltitude', 'sun altitude', Config.sun.altitude, -1, 1, 0.05, Update.sunAltitude),
    UiUtils.createSlider('SunEastWest', 'sun east-west', Config.sun.eastWest, -1, 1, 0.05, Update.sunEastWest),
    UiUtils.createSlider('SunIntensity', 'sun intensity', Config.sun.intensity, 0.1, 2, 0.1, Update.sunIntensity),
  ]);
  // * Shader Settings
  UiUtils.addGroup('gShader', 'Shader Settings', [
    UiUtils.createDropdownList('missingTexture', 'If missing texture', missingTexturePresets, (obj) => {
      ImageUrls.missing = obj.value;
      Actions.model.reload();
    }),
    UiUtils.createDropdownList('shader', 'Shader', shaderPresets, (obj) => {
      viewer.replaceLitShader(obj.value);
    }),
    UiUtils.createFileBrowser('backgroundFileBrowser', 'load background', true, (values) => { Actions.shader.background(values); }),
    UiUtils.createFileBrowser('overlayFileBrowser', 'load overlay', true, (values) => { Actions.shader.overlay(values); }),
    UiUtils.createButtons('shaderButtons', [{
      id: 'removeBackground',
      text: 'Clear Bg',
      callback: Actions.shader.clearBackground,
    },
    {
      id: 'removeOverlay',
      text: 'Clear Overlay',
      callback: Actions.shader.clearOverlay,
    },
    ]),
    UiUtils.createSlider('overlayAlpha', 'overlay opacity', 0.5, 0, 1, 1 / 255, Actions.shader.overlayAlpha),
    UiUtils.createSlider('SunAlpha', 'model alpha', Config.sun.alpha, 0, 1, 1 / 255, Update.sunAlpha),
  ]);
  // * Animation Controls
  UiUtils.addGroup('gAnim', 'Animation Controls', [
    UiUtils.createSlider('keyframe', 'keyframe',
      Config.keyframe, -1, -1, 0, UISetter.anim.keyframe),
    UiUtils.createFileBrowser('posesfileBrowser', 'load poses', true, onAddPoseFiles),
    UiUtils.createFileBrowser('posefileBrowser', 'set pose', false, (values) => {
      Actions.anim.setPose(values[0].uri);
    }),
    UiUtils.createFileBrowser('jrofileBrowser', 'load joint rotation order', false, onAddJroFile),
    UiUtils.createCheckboxes('animOptions', {
      showSkeleton: { text: 'showSkeleton', default: Config.showSkeleton },
      showJointLabels: { text: 'showJointLabels', default: Config.showJointLabels },
    }, Actions.anim.setOption),
    UiUtils.createDropdownList('selectedJoint', 'Joint', [], Update.jointSelection),
    UiUtils.createAngleSliders('joint', null, [0, 0, 0], Actions.anim.jointAngle),
    UiUtils.createLocalAngleSliders('joint', null, [0, 0, 0], Actions.anim.jointLocalAngle),
    UiUtils.createTranslationSliders('joint', null, [0, 0, 0], Actions.anim.jointTranslation),
    UiUtils.createColorPicker('jointColor', 'Skin weight', '#000000', Actions.anim.jointColor),
    UiUtils.createButtons('jointButtons', [
      {
        id: 'alignBone',
        text: 'Align Bone',
        callback: Actions.anim.alignBone,
      },
      {
        id: 'twistAlign',
        text: 'Twist Align',
        callback: Actions.anim.twistAlign,
      },
      {
        id: 'zeroJoint',
        text: 'Zero',
        callback: Actions.anim.zeroJoint,
      },
    ]),
    UiUtils.createButtons('poseAlgoButtons', [
      {
        id: 'poseZeroTranslations',
        text: 'Zero Tx',
        callback: Actions.anim.zeroTranslations,
      },
      {
        id: 'poseMirrorLeft',
        text: 'Mirror L',
        callback: Actions.anim.makeSymmetric.bind(null, 'l'),
      },
      {
        id: 'poseMirrorRight',
        text: 'Mirror R',
        callback: Actions.anim.makeSymmetric.bind(null, 'r'),
      },
    ]),
    UiUtils.createButtonWithOptions('savePose', 'Save Pose', ' as ', 'Json', saveCurrentPose),
  ], '#controlsRight');
}

function toggleUninterestingGroups() {
  $('#gLabels').click();
  $('#gModel').click();
  $('#gCamera').click();
  $('#gLight').click();
}

function makeCanvasFollowScroll() {
  // https://stackoverflow.com/a/14194805
  const el = $('.container');
  const originalelpos = el.offset().top; // take it where it originally is on the page
  // run on scroll
  $(window).scroll(() => {
    const el0 = $('.container'); // important! (local)
    const windowpos = $(window).scrollTop();
    const finaldestination = windowpos + originalelpos;
    el0.stop().animate({ top: finaldestination }, 100);
  });
}

$(document).ready(() => {
  viewer = new Viewer('glCanvas', 'canvas2D', ImageUrls.white);
  viewer.setRotationCallback((r) => {
    UISetter.model.rotation(r);
    Update.modelTransform();
  });
  viewer.setCameraHeightCallback(UISetter.camera.height);
  viewer.setCameraDistanceCallback(UISetter.camera.distance);
  viewer.setJointSelectionCallback(UISetter.anim.selectJoint);
  viewer.setBackgroundColor(Config.backgroundColor);
  for (let i = 0; i < viewer.views.length; i += 1) {
    Update.camera(i);
  }
  populateControls();
  toggleUninterestingGroups();
  Actions.model.reload();
  makeCanvasFollowScroll();
});
