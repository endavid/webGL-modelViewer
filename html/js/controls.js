import $ from './jquery.module.js';
import UiUtils from './uiutils.js';
import Viewer from './viewer.js';
import Config from './config.js';
import VMath from './math.js';
import Gfx from './gfx.js';
import LabelUtils from './labelUtils.js';

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
  cameraLocation: () => {
    const { camera } = viewer.scene;
    camera.setLocation(
      Config.camera.height,
      Config.camera.distance,
      Config.camera.pitch,
      Config.camera.rotationY,
    );
  },
  cameraFov: () => {
    const { camera } = viewer.scene;
    camera.setFOV(Config.camera.fov);  
  },
  camera: () => {
    Update.cameraLocation();
    Update.cameraFov();
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
  sun: () => {}
}

const UISetter = {
  camera: {
    distance: (z) => {
      $('#cameraDistance').val(z);
      $('#cameraDistance_number').val(z);
      Config.camera.distance = z;
    },
    height: (y) => {
      $('#cameraHeight').val(y);
      $('#cameraHeight_number').val(y);
      Config.camera.height = y;
    },
    pitch: (a) => {
      $('#cameraPitch').val(a);
      $('#cameraPitch_number').val(a);
      Config.camera.pitch = a;
    },
    rotationY: (a) => {
      $('#cameraRotationY').val(a);
      $('#cameraRotationY_number').val(a);
      Config.camera.rotationY = a;
    },
    fov: (a) => {
      $('#cameraFOV').val(a);
      $('#cameraFOV_number').val(a);
      Config.camera.fov = a;
    }
  },
  model: {
    rotation: (rotation) => {
      ['x', 'y', 'z'].forEach((axis, i) => {
        const angle = rotation[i] !== undefined
          ? VMath.round(rotation[i], 2) : Config.model.rotation[axis];
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
    }
  },
  sun: {
    altitude: (h) => {
      const sun = viewer.scene.lights[0];
      sun.setAltitude(h);
    },
    eastWest: (ew) => {
      const sun = viewer.scene.lights[0];
      sun.setEastWest(ew);
    },
    intensity: (i) => {
      const sun = viewer.scene.lights[0];
      sun.setIntensity(i);
    }
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
    }
  }
}

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
      const url = $('#Presets').val();
      const name = $('#Presets option:selected').text();
      const slot = viewer.selectedModel;
      Actions.model.load(slot, name, url);
    }
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
    }
  },
  shader: {
    checkAspect: (img) => {
      const aspect = img.height / img.width;
      const sizeinfo = `${img.width}×${img.height}`;
      if (Math.abs(aspect - 1.5) > 0.01) {
        setWarning(`Image aspect should be 2:3 but loaded image is ${sizeinfo}`);
      } else {
        setInfo(`Image size: ${sizeinfo}`);
      }
    },
    background: (url) => {
      viewer.setBackgroundImage(url, Actions.shader.checkAspect);
    },
    overlay: (url) => {
      viewer.setOverlayImage(url, Actions.shader.checkAspect);
    },
    clearBackground: () => {
      viewer.setBackgroundImage(null);
      // https://stackoverflow.com/a/832730
      $("#backgroundFileBrowser").replaceWith($("#backgroundFileBrowser").val('').clone(true));
    }
  }
}

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
      UiUtils.addUrisToDropdownList('Presets', models);
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
      }
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
        success: importLabels(LabelUtils.importLabelsTxt)
      });
    } else if (ext === 'Lnd') {
      $.ajax({
        async: true,
        url: f.uri,
        datatype: 'text',
        success: importLabels(LabelUtils.importLabelsLnd)
      });
    } else if (ext === 'Pp') {
      $.ajax({
        async: true,
        url: f.uri,
        datatype: 'xml',
        success: importLabels(LabelUtils.importLabelsXml)
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
    const KV = viewer.scene.camera.getIntrinsicViewMatrix(w, h);
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
    { name: 'depth', value: 'shaders/debugDepth.fs' },
    { name: 'skin weights', value: 'shaders/debugSkinWeights.fs' },
    { name: 'world normal', value: 'shaders/debugWorldNormal.fs' },
    { name: 'intersect', value: 'intersect' },
    { name: 'intersect lit', value: 'intersect-lit' }
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
    { name: 'enabled && back && left', value: 'enabledBackLeft' }
  ];

  const labelFilters = {
    all: () => { return true; },
    enabled: (_, label) => { return !label.disabled; },
    disabled: (_, label) => { return label.disabled; },
    enabledFront: (name, label) => { return !label.disabled && name.indexOf('Back') < 0; },
    enabledBack: (name, label) => { return !label.disabled && name.indexOf('Front') < 0 && name.indexOf('Bust') < 0; },
    enabledFrontRight: (name, label) => { return labelFilters.enabledFront(name, label) && name.endsWith('Right'); },
    enabledFrontLeft: (name, label) => { return labelFilters.enabledFront(name, label) && name.endsWith('Left'); },
    enabledBackRight: (name, label) => { return !label.disabled && name.indexOf('Back') >= 0 && name.indexOf('Right') >= 0; },
    enabledBackLeft: (name, label) => { return !label.disabled && name.indexOf('Back') >= 0 && name.indexOf('Left') >= 0; }
  };

  const modelSlots = [
    { name: 'slot 0', value: 0 },
    { name: 'slot 1', value: 1 },
    { name: 'slot 2', value: 2 },
    { name: 'slot 3', value: 3 }
  ]

  // Create the UI controls
  // * Toolbar (it won't execute if toolbar.json doesn't exist)
  $.getJSON('/toolbar.json', (cfg) => {
    let elements = [];
    Object.keys(cfg).forEach((g) => {
      let row = [];
      cfg[g].forEach((b) => {
        let fn = () => {
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
                const cmd = action.cmd;
                Actions[key][cmd].apply(null, action.args);
              });
            });
          }
          if (!b.actions && !b.preset) {
            console.log(b);
          }
        };
        let btn = {
          id: b.id,
          text: b.text,
          icon: b.icon,
          iconType: b.iconType || '',
          callback: fn
        };
        row.push(btn);
      });
      elements.push(UiUtils.createButtons(`toolbar_${g}`, row));
    });
    UiUtils.addGroup('gToolbar', 'Toolbar', elements, '#controls', true);
  });
  // * File
  UiUtils.addGroup('gFile', 'File', [
    UiUtils.createDropdownList('ModelSlot', modelSlots, (e) => {
      viewer.selectedModel = parseInt(e.value);
    }),
    UiUtils.createFileBrowser('fileBrowser', 'load models & textures', true, onChangeFileBrowser),
    UiUtils.createDropdownList('Presets', modelPresets, Actions.model.reload),
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
    }
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
      }
    ),
    UiUtils.createSlider('pointSize', 'Point size', Config.pointSize, 0, 16, 1, (value) => {
      viewer.setPointSize(value);
    }),
    UiUtils.createColorPicker('pointColor', 'Point color', '#ffffff', (e) => {
      const c = VMath.hexColorToNormalizedVector(e.target.value);
      viewer.setPointColor(c[0], c[1], c[2], 1);
    }),
    UiUtils.createDropdownList('labelFilter', labelFilterPresets, (obj) => {
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
      isZAxisUp: { text: 'Z is up', default: Config.isZAxisUp },
      recomputeNormals: { text: 'recompute normals', default: Config.recomputeNormals },
    }, (key, value) => {
      Config[key] = value;
      Actions.model.reload();
    }),
    UiUtils.createSlider('modelScaleExp10', 'scale (log10)', 0, -3, 3, 0.2, Update.model.modelScale),
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
        Update.model.modelTransform();
      }),
    UiUtils.createDropdownList('submesh', [], (obj) => {
      viewer.selectSubmesh(obj.value);
    }),
  ]);
  // * Camera Settings
  UiUtils.addGroup('gCamera', 'Camera Settings', [
    UiUtils.createSlider('cameraDistance', 'distance',
      Config.camera.distance, 0.2, 10, 0.01, (value) => {
        Config.camera.distance = parseFloat(value);
        Update.cameraLocation();
      }),
    UiUtils.createSlider('cameraHeight', 'height',
      Config.camera.height, -2, 2, 0.01, (value) => {
        Config.camera.height = parseFloat(value);
        Update.cameraLocation();
      }),
    UiUtils.createSlider('cameraPitch', 'pitch',
      Config.camera.pitch, -90, 90, 1, (value) => {
        Config.camera.pitch = parseFloat(value);
        Update.cameraLocation();
      }),
    UiUtils.createSlider('cameraRotationY', 'rotation Y',
      Config.camera.rotationY, -180, 180, 1, (value) => {
        Config.camera.rotationY = parseFloat(value);
        Update.cameraLocation();
      }),
    UiUtils.createSlider('cameraFOV', 'Field of View',
      Config.camera.fov, 1, 90, 1, (value) => {
        Config.camera.fov = parseFloat(value);
        Update.cameraFov()
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
      {
        id: 'saveIntrinsicView',
        text: 'Save K*V',
        callback: saveIntrinsicViewMatrix,
      },
    ]),
  ]);
  // * Light Settings
  const sun = viewer.scene.lights[0];
  UiUtils.addGroup('gLight', 'Light Settings', [
    UiUtils.createSlider('SunAltitude', 'sun altitude', sun.altitude, -1, 1, 0.05, UISetter.sun.altitude),
    UiUtils.createSlider('SunEastWest', 'sun east-west', sun.eastWest, -1, 1, 0.05, UISetter.sun.eastWest),
    UiUtils.createSlider('SunIntensity', 'sun intensity', sun.intensity, 0.1, 2, 0.1, UISetter.sun.intensity),
  ]);
  // * Shader Settings
  const { overlay } = viewer.scene;
  UiUtils.addGroup('gShader', 'Shader Settings', [
    UiUtils.createDropdownList('missingTexture', missingTexturePresets, (obj) => {
      ImageUrls.missing = obj.value;
      Actions.model.reload();
    }),
    UiUtils.createDropdownList('shader', shaderPresets, (obj) => {
      viewer.replaceLitShader(obj.value);
    }),
    UiUtils.createFileBrowser('backgroundFileBrowser', 'load background', false, (values) => { Actions.shader.background(values[0].uri); }),
    UiUtils.createButtons('shaderButtons', [{
      id: 'removeBackground',
      text: 'Clear Bg',
      callback: Actions.shader.clearBackground,
    }]),
    UiUtils.createFileBrowser('overlayFileBrowser', 'load overlay', false, (values) => { Actions.shader.overlay(values[0].uri); }),
    UiUtils.createSlider('overlayAlpha', 'overlay opacity', overlay.alpha, 0, 1, 1 / 255, (value) => {
      overlay.alpha = parseFloat(value);
    }),
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
  viewer.setBackgroundColor(Config.backgroundColor);
  Update.camera();
  populateControls();
  toggleUninterestingGroups();
  Actions.model.reload();
  makeCanvasFollowScroll();
});
