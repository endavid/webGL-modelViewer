import $ from './jquery.module.js';
import UiUtils from './uiutils.js';
import Viewer from './viewer.js';
import Config from './config.js';
import VMath from './math.js';
import Gfx from './gfx.js';

const ImageUrls = {
  'banana.png': 'resources/banana.png',
  'orange.png': 'resources/orange.png',
  'pear.png': 'resources/pear.png',
  white: 'resources/white.png',
  missing: 'resources/UVTextureChecker4096.png',
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
  const p = v.map(a => Math.round(a * 100000) / 100000);
  return p.join(', ');
}

function removePoseGroup() {
  $('tr[id^=gPose]').remove();
}

function addPoseGroup(skinnedModel) {
  const id = 'gPose';
  const frame = Config.keyframe;
  const { pose } = skinnedModel.getPoseFile(frame);
  function updateJointWithValue(joint, value, sub) {
    const key = `rotate${sub}.ANGLE`;
    skinnedModel.setAnimValue(joint, frame, key, parseFloat(value));
    skinnedModel.applyPose(frame);
  }
  function angleSlider(s, joint, values) {
    const slider = UiUtils.createMultiSlider(`${s}_angle`, ['X', 'Y', 'Z'], 'rotation XYZ', values, -180, 180, 0.1, updateJointWithValue.bind(null, joint));
    slider.attr('parent', `${id}_${joint}`);
    return slider;
  }
  function updateJointTrWithValue(joint, value, sub) {
    const indices = { X: 0, Y: 1, Z: 2 };
    skinnedModel.setAnimValue(joint, frame, 'translation', parseFloat(value), indices[sub]);
    skinnedModel.applyPose(frame);
  }
  function translationSlider(s, joint, values) {
    const slider = UiUtils.createMultiSlider(`${s}_translation`, ['X', 'Y', 'Z'], 'translation XYZ', values, -10, 10, 0.1, updateJointTrWithValue.bind(null, joint));
    slider.attr('parent', `${id}_${joint}`);
    return slider;
  }
  function colorPicker(s, joint) {
    const jointIndex = skinnedModel.jointIndices[joint];
    if (jointIndex === undefined) {
      return null;
    }
    const palette = skinnedModel.jointColorPalette;
    const color = palette.slice(4 * jointIndex, 4 * jointIndex + 3);
    const hexColor = VMath.vectorToHexColor(color);
    const picker = UiUtils.createColorPicker(`${s}_color`, 'debug color', hexColor, (e) => {
      const c = VMath.hexColorToNormalizedVector(e.target.value);
      c.forEach((value, i) => {
        palette[4 * jointIndex + i] = value;
      });
    });
    picker.attr('parent', `${id}_${joint}`);
    return picker;
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
      const picker = colorPicker(subId, joint);
      if (picker) {
        subcontrols.push(picker);
      }
      const jointControls = createControls(skeleton[joint], subId);
      subcontrols = subcontrols.concat(jointControls);
      const jointGroup = UiUtils.createSubGroup(subId, joint, subcontrols, parent);
      controls = controls.concat(jointGroup);
    });
    return controls;
  }
  const controls = createControls(skinnedModel.getSkeletonTopology());
  UiUtils.addGroup(id, 'Pose Controls', controls, '#controlsRight');
  // hide the sliders by clicking twice to toggle controls
  $('#gPose').click();
  $('#gPose').click();
}

function progressBarUpdate(ratio) {
  const percentage = Math.round(100 * ratio);
  $('#progressBar').css('width', `${percentage}%`);
}

function updateModelTransform() {
  const phi = Config.modelRotationPhi;
  const theta = Config.modelRotationTheta;
  viewer.setModelRotationAndScale(0, phi, theta, Config.modelScale);
}

function updateModelScale(logValue) {
  Config.modelScale = 10 ** parseFloat(logValue);
  updateModelTransform();
}

function setRotation(phi, theta) {
  const round2 = v => Math.round(v * 100) / 100;
  const phiDeg = round2(phi);
  const thetaDeg = round2(theta);
  $('#modelRotationTheta').val(thetaDeg);
  $('#modelRotationTheta_number').val(thetaDeg);
  $('#modelRotationPhi').val(phiDeg);
  $('#modelRotationPhi_number').val(phiDeg);
  Config.modelRotationPhi = phiDeg;
  Config.modelRotationTheta = thetaDeg;
  updateModelTransform();
}

function setCameraHeight(y) {
  $('#cameraHeight').val(y);
  $('#cameraHeight_number').val(y);
  Config.cameraHeight = y;
}

function setCameraDistance(z) {
  $('#cameraDistance').val(z);
  $('#cameraDistance_number').val(z);
  Config.cameraDistance = z;
}

function setMeterUnits(unitMeters) {
  let logScale = Math.log10(unitMeters);
  logScale = Math.round(1e4 * logScale) * 1e-4;
  $('#modelScaleExp10').val(logScale);
  $('#modelScaleExp10_number').val(logScale);
  updateModelScale(logScale);
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
  const select = $('#centerModel_select');
  const names = ['origin'].concat(Object.keys(labels || {}));
  select.empty();
  UiUtils.addUrisToDropdownList('centerModel_select', names);
}

function reloadModel() {
  const url = $('#Presets').val();
  const name = $('#Presets option:selected').text();
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
      addPoseGroup(model.skinnedModel);
    }
    setRotation(0, 0);
    setMeterUnits(model.meterUnits);
    populateSubmeshList(model.meshes);
    populateLabelList(model.labels);
  }, setError);
}

function updateRotationLock() {
  viewer.setRotationLock(Config.isLockRotationX, Config.isLockRotationY);
}

function updateCamera() {
  const { camera } = viewer.scene;
  camera.setLocation(
    Config.cameraHeight,
    Config.cameraDistance,
    Config.cameraPitch,
    Config.cameraRotationY,
  );
}

function updateCameraFOV() {
  const { camera } = viewer.scene;
  camera.setFOV(Config.cameraFOV);
}

function onAddOverlay(values) {
  const f = values[0];
  viewer.setOverlayImage(f.uri, (img) => {
    const aspect = img.height / img.width;
    const sizeinfo = `${img.width}×${img.height}`;
    if (Math.abs(aspect - 1.5) > 0.01) {
      setWarning(`Overlay aspect should be 2:3 but loaded image is ${sizeinfo}`);
    } else {
      setInfo(`Overlay size: ${sizeinfo}`);
    }
  });
}

function saveCurrentPose() {
  const model = viewer.scene.models[0];
  if (model && model.skinnedModel) {
    const frame = Config.keyframe;
    const pose = model.skinnedModel.getPoseFile(frame);
    const fn = Gfx.getFileNameWithoutExtension(model.name);
    Gfx.exportPose(pose, `${fn}_${frame}`);
  } else {
    setWarning('No skinned model');
  }
}

function onChangeKeyframe() {
  removePoseGroup();
  const model = viewer.scene.models[0];
  if (model && model.skinnedModel) {
    addPoseGroup(model.skinnedModel);
    viewer.setKeyframe(0, Config.keyframe);
  }
}

function addImageToBasket(image) {
  const thumbnailHeight = 68;
  const img = image;
  img.width = thumbnailHeight * img.width / img.height;
  img.height = thumbnailHeight;
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
      UiUtils.addUrisToDropdownList('Presets', models);
      reloadModel();
    }
  }

  function onLoadLabels(values) {
    const f = values[0];
    if (!f) {
      return;
    }
    const ext = Gfx.getFileExtension(f.name);
    if (ext !== 'Json') {
      setError('Labels must be in Json format');
      return;
    }
    $.getJSON(f.uri, (labels) => {
      const model = viewer.scene.models[0];
      if (model) {
        model.labels = labels;
        populateLabelList(labels);
      }
    });
  }

  function updateLabelScale(logValue) {
    Config.labelScale = 10 ** parseFloat(logValue);
    viewer.setLabelScale(Config.labelScale);
  }

  function setLabelOptions(key, value) {
    Config[key] = value;
    viewer.scene.labels[key] = value;
    $(`#${key}`).prop('checked', value);
  }

  function onBakeModelLabels() {
    const model = viewer.scene.models[0];
    if (model) {
      progressBarUpdate(0);
      $('#progressBarDiv').show();
      model.bakeLabels(viewer.glState.gl,
        Config.labelScale,
        progressBarUpdate, () => {
          setLabelOptions('showLabels', false);
          $('#progressBarDiv').hide();
        }, setError);
    }
  }

  function onAddPoseFiles(values) {
    const model = viewer.scene.models[0];
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
    const model = viewer.scene.models[0];
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

  const modelPresets = [
    'pear.json',
    'banana.json',
    'orange.json',
    'banana.obj',
    'tree01.dae',
    'monigote.dae'].map(e => ({ name: e, value: `resources/${e}` }));

  const missingTexturePresets = [
    { name: 'uvChecker', value: 'resources/UVTextureChecker4096.png' },
    { name: 'white', value: 'resources/white.png' }];

  const shaderPresets = [
    { name: 'default shading', value: 'shaders/lighting.fs' },
    { name: 'depth', value: 'shaders/debugDepth.fs' },
    { name: 'skin weights', value: 'shaders/debugSkinWeights.fs' },
    { name: 'world normal', value: 'shaders/debugWorldNormal.fs' },
  ];

  // Create the UI controls
  UiUtils.addGroup('gFile', 'File', [
    UiUtils.createFileBrowser('fileBrowser', 'load models & textures', true, onChangeFileBrowser),
    UiUtils.createDropdownList('Presets', modelPresets, reloadModel),
    UiUtils.createButtonWithOptions('saveFile', 'Save', ' as ',
      [{ name: 'OBJ Wavefront', value: '.obj' }, { name: 'Json', value: '.json' }],
      (e) => {
        const modelType = $(`#${e.target.id}_select`).val();
        const url = $('#Presets').val();
        const name = $('#Presets option:selected').text();
        Gfx.exportModel(name, url, modelType, MaterialUrls)
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
  UiUtils.addGroup('gLabels', 'Labels', [
    UiUtils.createFileBrowser('labelBrowser', 'load model labels', false, onLoadLabels),
    UiUtils.createSlider('labelScaleExp10', 'scale (log10)', 0, -3, 3, 0.2, updateLabelScale),
    UiUtils.createButton('bakeLabels', 'Bake model labels', onBakeModelLabels),
    UiUtils.createSlider('pointSize', 'Point size', Config.pointSize, 0, 16, 1, (value) => {
      viewer.setPointSize(value);
    }),
    UiUtils.createCheckboxes('labelOptions', {
      showLabels: { text: 'show labels', default: Config.showLabels },
      showPoints: { text: 'show points', default: Config.showPoints },
    }, setLabelOptions),
  ]);
  UiUtils.addGroup('gModel', 'Model Settings', [
    UiUtils.createCheckboxes('onLoadOptions', {
      isZAxisUp: { text: 'Z is up', default: Config.isZAxisUp },
      recomputeNormals: { text: 'recompute normals', default: Config.recomputeNormals },
    }, (key, value) => {
      Config[key] = value;
      reloadModel();
    }),
    UiUtils.createSlider('modelScaleExp10', 'scale (log10)', 0, -3, 3, 0.2, updateModelScale),
    UiUtils.createCheckboxes('axisLock', {
      isLockRotationX: { text: 'lock X', default: Config.isLockRotationX },
      isLockRotationY: { text: 'lock Y', default: Config.isLockRotationY },
    }, (key, value) => {
      Config[key] = value;
      updateRotationLock();
    }),
    UiUtils.createSlider('modelRotationTheta', 'rotation Y axis',
      Config.modelRotationTheta, -180, 180, 0.1, (value) => {
        Config.modelRotationTheta = parseFloat(value);
        updateModelTransform();
      }),
    UiUtils.createSlider('modelRotationPhi', 'rotation X axis',
      Config.modelRotationPhi, -90, 90, 0.1, (value) => {
        Config.modelRotationPhi = parseFloat(value);
        updateModelTransform();
      }),
    UiUtils.createButtonWithOptions('centerModel', 'Center', ' around ',
      [{ name: 'origin', value: 'origin' }],
      (e) => {
        const label = $(`#${e.target.id}_select`).val();
        const pos = viewer.centerModelAround(0, label);
        const str = vectorToString(pos);
        setInfo(`${label} at: [${str}]`);
        setRotation(0, 0);
      }),
    UiUtils.createDropdownList('submesh', [], (obj) => {
      viewer.selectSubmesh(obj.value);
    }),
  ]);
  UiUtils.addGroup('gCamera', 'Camera Settings', [
    UiUtils.createSlider('cameraDistance', 'distance',
      Config.cameraDistance, 0.2, 10, 0.01, (value) => {
        Config.cameraDistance = parseFloat(value);
        updateCamera();
      }),
    UiUtils.createSlider('cameraHeight', 'height',
      Config.cameraHeight, -2, 2, 0.01, (value) => {
        Config.cameraHeight = parseFloat(value);
        updateCamera();
      }),
    UiUtils.createSlider('cameraPitch', 'pitch',
      Config.cameraPitch, -90, 90, 1, (value) => {
        Config.cameraPitch = parseFloat(value);
        updateCamera();
      }),
    UiUtils.createSlider('cameraRotationY', 'rotation Y',
      Config.cameraRotationY, -180, 180, 1, (value) => {
        Config.cameraRotationY = parseFloat(value);
        updateCamera();
      }),
    UiUtils.createSlider('cameraFOV', 'Field of View',
      Config.cameraFOV, 1, 90, 1, (value) => {
        Config.cameraFOV = parseFloat(value);
        updateCameraFOV();
      }),
    UiUtils.createButtons('cameraDumps', [
      {
        id: 'dumpProjection',
        text: 'Dump Projection M',
        callback: () => setInfo(matrixToString(viewer.scene.camera.projectionMatrix)),
      },
      {
        id: 'dumpView',
        text: 'Dump View M',
        callback: () => setInfo(matrixToString(viewer.scene.camera.viewMatrix)),
      },
    ]),
  ]);
  const sun = viewer.scene.lights[0];
  UiUtils.addGroup('gLight', 'Light Settings', [
    UiUtils.createSlider('SunAltitude', 'sun altitude', sun.altitude, -1, 1, 0.05, (value) => {
      sun.setAltitude(value);
    }),
    UiUtils.createSlider('SunEastWest', 'sun east-west', sun.eastWest, -1, 1, 0.05, (value) => {
      sun.setEastWest(value);
    }),
  ]);
  const { overlay } = viewer.scene;
  UiUtils.addGroup('gShader', 'Shader Settings', [
    UiUtils.createDropdownList('missingTexture', missingTexturePresets, (obj) => {
      ImageUrls.missing = obj.value;
      reloadModel();
    }),
    UiUtils.createDropdownList('shader', shaderPresets, (obj) => {
      viewer.replaceLitShader(obj.value);
    }),
    UiUtils.createFileBrowser('overlayFileBrowser', 'load overlay', false, onAddOverlay),
    UiUtils.createSlider('overlayAlpha', 'overlay opacity', overlay.alpha, 0, 1, 1 / 255, (value) => {
      overlay.alpha = parseFloat(value);
    }),
  ]);
  UiUtils.addGroup('gAnim', 'Animation Controls', [
    UiUtils.createSlider('keyframe', 'keyframe',
      Config.keyframe, -1, -1, 0, (value) => {
        Config.keyframe = parseInt(value, 10);
        onChangeKeyframe();
      }),
    UiUtils.createFileBrowser('posefileBrowser', 'load keyframe/pose', true, onAddPoseFiles),
    UiUtils.createFileBrowser('jrofileBrowser', 'load joint rotation order', false, onAddJroFile),
    UiUtils.createButtonWithOptions('savePose', 'Save Pose', ' as ', 'Json', saveCurrentPose),
  ], '#controlsRight');
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
  viewer.setRotationCallback(setRotation);
  viewer.setCameraHeightCallback(setCameraHeight);
  viewer.setCameraDistanceCallback(setCameraDistance);
  viewer.setBackgroundColor(Config.backgroundColor);
  updateCamera();
  updateCameraFOV();
  populateControls();
  reloadModel();
  makeCanvasFollowScroll();
});
