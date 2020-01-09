// failed to import as a module atm
const { X2JS } = window;

function floatStringToArray(text) {
  return text.split(/[\s,]+/).map(e => parseFloat(e));
}
function intStringToArray(text) {
  return text.split(/[\s,]+/).map(e => parseInt(e, 10));
}
function simplifyName(name) {
  if (!name) {
    return name;
  }
  // Collada files exported from FBX have some ugly _ncl1_1 appended
  // to every joint name
  return name.replace('_ncl1_1', '');
}
// [a b c d e ...] -> [ [a b], [b c], ...]
function toVectorArray(array, stride) {
  const hash = {}; // to avoid duplicated entries
  const out = [];
  let duplicateCount = 0;
  for (let i = 0; i < array.length; i += stride) {
    const v = array.slice(i, i + stride);
    if (hash[v]) {
      duplicateCount += 1;
      hash[v] += 1;
    } else {
      hash[v] = 1;
    }
    out.push(v);
  }
  if (duplicateCount > 0) {
    // not removing them for now...
    console.log(`Counted ${duplicateCount} duplicated entries`);
  }
  return out;
}

function flipAxisForMatrix(m) {
  return [
    m[0], m[2], -m[1], m[3],
    m[8], m[10], -m[9], m[11],
    -m[4], -m[6], m[5], -m[7],
    m[12], m[14], -m[13], m[15],
  ];
}

function getTranslation(m) {
  return [m[3], m[7], m[11]];
}

function isZUp(json) {
  return json.COLLADA.asset.up_axis === 'Z_UP';
}

function getMeterUnits(json) {
  const { unit } = json.COLLADA.asset;
  const meter = parseFloat(unit._meter || '1');
  return meter;
}

function getPolylistsAndTriangleLists(json) {
  const lists = [];
  const { mesh } = json.COLLADA.library_geometries.geometry;
  ['polylist', 'triangles'].forEach((key) => {
    if (mesh[key]) {
      if (Array.isArray(mesh[key])) {
        mesh[key].forEach((p) => { lists.push(p); });
      } else {
        lists.push(mesh[key]);
      }
    }
  });
  return lists;
}

function sourceIdToSemantics(id) {
  const s = id.toLowerCase();
  if (s.indexOf('position') >= 0) {
    return 'positions';
  }
  if (s.indexOf('normal') >= 0) {
    return 'normals';
  }
  if (s.indexOf('map') >= 0 || s.indexOf('uv') >= 0) {
    return 'uvs';
  }
  return null;
}

function readMeshes(json, skin, defaultMaterial) {
  const d = {
    positions: [],
    normals: [],
    uvs: [],
  };
  const vertices = [];
  const meshes = [];
  const ngons = {};
  const invertAxis = isZUp(json);
  let missingNormals = false;
  let missingUVs = false;
  if (Array.isArray(json.COLLADA.library_geometries.geometry)) {
    console.error(json.COLLADA.library_geometries.geometry);
    throw new Error('Collada files with more than 1 geometries are not supported');
  }
  let src = json.COLLADA.library_geometries.geometry.mesh.source;
  if (!Array.isArray(src)) {
    src = [src];
  }
  src.forEach((e) => {
    const key = sourceIdToSemantics(e._id);
    if (key) {
      d[key] = floatStringToArray(e.float_array.__text);
    }
  });
  const polylists = getPolylistsAndTriangleLists(json);
  let j = 0; // face index
  polylists.forEach((polylist) => {
    const numInputs = Array.isArray(polylist.input) ? polylist.input.length : 1;
    let vcount = [];
    if (polylist.vcount) {
      vcount = intStringToArray(polylist.vcount);
    } else {
      // all triangles
      const count = parseInt(polylist._count, 10);
      vcount = Array(...Array(count)).map(() => 3);
    }
    const polygons = toVectorArray(intStringToArray(polylist.p), numInputs);
    const submesh = {
      material: polylist._material || defaultMaterial,
      indices: [],
    };
    // interleave vertex data as
    // position (3), normal (3), UVs (2)
    polygons.forEach((p) => {
      vertices.push(d.positions[3 * p[0]]);
      if (invertAxis) {
        vertices.push(d.positions[3 * p[0] + 2]);
        vertices.push(-d.positions[3 * p[0] + 1]);
      } else {
        vertices.push(d.positions[3 * p[0] + 1]);
        vertices.push(d.positions[3 * p[0] + 2]);
      }
      const noNormals = p[1] === undefined;
      if (noNormals) {
        missingNormals = true;
      }
      vertices.push(noNormals ? 0 : d.normals[3 * p[1]]);
      if (invertAxis) {
        vertices.push(noNormals ? 0 : d.normals[3 * p[1] + 2]);
        vertices.push(noNormals ? 0 : -d.normals[3 * p[1] + 1]);
      } else {
        vertices.push(noNormals ? 0 : d.normals[3 * p[1] + 1]);
        vertices.push(noNormals ? 0 : d.normals[3 * p[1] + 2]);
      }
      const noUVs = p[2] === undefined;
      if (noUVs) {
        missingUVs = true;
      }
      vertices.push(noUVs ? 0 : d.uvs[2 * p[2]] || 0);
      vertices.push(noUVs ? 0 : d.uvs[2 * p[2] + 1] || 0);
      if (skin) {
        const weights = [1.0, 0.0, 0.0, 0.0];
        const indices = [0, 0, 0, 0];
        const list = skin.weights[p[0]];
        for (let k = 0; k < Math.min(list.length, 4); k += 1) {
          /* eslint-disable prefer-destructuring */
          indices[k] = list[k][0];
          weights[k] = list[k][1];
          /* eslint-enable prefer-destructuring */
        }
        weights.forEach((w) => { vertices.push(w); });
        indices.forEach((i) => { vertices.push(i); });
      }
    });
    vcount.forEach((c) => {
      if (c === 3 || c === 4) {
        submesh.indices.push(j);
        submesh.indices.push(j + 1);
        submesh.indices.push(j + 2);
        if (c === 4) {
          submesh.indices.push(j);
          submesh.indices.push(j + 2);
          submesh.indices.push(j + 3);
        }
      } else {
        ngons[`${c}`] = true;
      }
      j += c;
    });
    meshes.push(submesh);
  });
  Object.keys(ngons).forEach((n) => {
    console.warn(`${n}-gons not supported. Only triangles and quads`);
  });
  return {
    meshes,
    stride: skin ? 16 : 8,
    vertices,
    materials: {},
    missingNormals,
    missingUVs,
  };
}

function mapWeightsPerVertex(vcount, jointWeightIndices, weightData) {
  const weights = [];
  const overflowCount = {};
  let iv = 0;
  vcount.forEach((jointsPerVertex) => {
    if (jointsPerVertex > 4) {
      overflowCount[jointsPerVertex] = 1 + (overflowCount[jointsPerVertex] || 0);
    }
    const jointWeightPairs = [];
    for (let j = 0; j < jointsPerVertex; j += 1) {
      const jointIndex = jointWeightIndices[iv][0];
      const weightIndex = jointWeightIndices[iv][1];
      const weight = weightData[weightIndex];
      jointWeightPairs.push([jointIndex, weight]);
      iv += 1;
    }
    // sort them, so big weights come first, so we can slice below
    jointWeightPairs.sort((a, b) => b[1] - a[1]);
    // if there are more joints, ignore the least important ones
    const mostImportant = jointWeightPairs.slice(0, 4);
    weights.push(mostImportant);
  });
  Object.keys(overflowCount).forEach((key) => {
    const count = overflowCount[key];
    console.warn(`There are ${count} vertices with ${key} contributing joints! Only taking the most important 4 and ignoring the rest...`);
  });
  return weights;
}

function skinSourceIdToSemantics(id) {
  const s = id.toLowerCase();
  if (s.indexOf('weights') >= 0) {
    return 'weights';
  }
  if (s.indexOf('bind_poses') >= 0 || s.indexOf('matrices') >= 0) {
    return 'bindPoses';
  }
  if (s.indexOf('joints') >= 0) {
    return 'joints';
  }
  return null;
}

function readSkin(json) {
  const { controller } = json.COLLADA.library_controllers;
  const skin = controller ? controller.skin : controller;
  if (!skin) {
    return null;
  }
  const skinData = {};
  const invertAxis = isZUp(json);
  let weightData = [];
  skin.source.forEach((e) => {
    const key = skinSourceIdToSemantics(e._id);
    if (key === 'weights') {
      weightData = floatStringToArray(e.float_array.__text);
    } else if (key === 'bindPoses') {
      let bp = floatStringToArray(e.float_array.__text);
      bp = toVectorArray(bp, 16);
      if (invertAxis) {
        skinData.bindPoses = bp.map(flipAxisForMatrix);
      } else {
        skinData.bindPoses = bp;
      }
    } else if (key === 'joints') {
      const joints = e.Name_array.__text.split(/[\s,]+/);
      skinData.joints = joints.map(simplifyName);
    }
  });
  const v = intStringToArray(skin.vertex_weights.v);
  const jointWeightIndices = toVectorArray(v, 2);
  const vcount = intStringToArray(skin.vertex_weights.vcount);
  const bsm = floatStringToArray(skin.bind_shape_matrix);
  if (invertAxis) {
    skinData.bindShapeMatrix = flipAxisForMatrix(bsm);
  } else {
    skinData.bindShapeMatrix = bsm;
  }
  skinData.weights = mapWeightsPerVertex(vcount, jointWeightIndices, weightData);
  return skinData;
}

function findRootNode(node, parent) {
  const nodes = Array.isArray(node) ? node : [node];
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i]._type === 'JOINT') {
      return { rootJoint: nodes[i], armatureNode: parent };
    }
    if (nodes[i].node) {
      const joint = findRootNode(nodes[i].node, nodes[i]);
      if (joint) {
        return joint;
      }
    }
  }
  return null;
}

function extractTransform(joint, invertAxis) {
  const data = {
    matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    rotationOrder: '',
  };
  if (joint && joint.matrix) {
    data.matrix = floatStringToArray(joint.matrix.__text || joint.matrix);
  } else if (joint && joint.translate) {
    const t = floatStringToArray(joint.translate.__text || joint.translate);
    const s = floatStringToArray(joint.scale.__text || joint.scale);
    let rx = [];
    let ry = [];
    let rz = [];
    for (let i = 0; i < 3; i += 1) {
      const r = joint.rotate[i];
      if (r._sid === 'rotateX' || r._sid === 'rotationX') {
        data.rotationOrder += 'x';
        rx = floatStringToArray(r.__text);
      } else if (r._sid === 'rotateY' || r._sid === 'rotationY') {
        data.rotationOrder += 'y';
        ry = floatStringToArray(r.__text);
      } else if (r._sid === 'rotateZ' || r._sid === 'rotationZ') {
        data.rotationOrder += 'z';
        rz = floatStringToArray(r.__text);
      }
    }
    data.matrix = [
      rx[0] * s[0], ry[0] * s[1], rz[0] * s[2], t[0],
      rx[1] * s[0], ry[1] * s[1], rz[1] * s[2], t[1],
      rx[2] * s[0], ry[2] * s[1], rz[2] * s[2], t[2],
      // eslint-disable-next-line no-multi-spaces
      rx[3],        ry[3],        rz[3],        1.0,
    ];
  }
  if (invertAxis) {
    data.matrix = flipAxisForMatrix(data.matrix);
  }
  return data;
}

function extractBoneTree(joint, parent, invertAxis) {
  if (!joint) {
    return {};
  }
  const skeleton = {};
  const t = extractTransform(joint, invertAxis);
  const jointId = simplifyName(joint._id);
  skeleton[jointId] = {
    parent: simplifyName(parent),
    matrix: t.matrix,
    rotationOrder: t.rotationOrder,
  };
  const children = Array.isArray(joint.node) ? joint.node : [joint.node];
  children.forEach((child) => {
    const branch = extractBoneTree(child, joint._id, invertAxis);
    // flatten tree into dictionary
    const jointList = Object.keys(branch);
    jointList.forEach((j) => {
      skeleton[j] = branch[j];
    });
  });
  return skeleton;
}

function readSkeleton(json) {
  const { node } = json.COLLADA.library_visual_scenes.visual_scene;
  const root = findRootNode(node, null);
  if (!root) {
    return null;
  }
  const { rootJoint, armatureNode } = root;
  const invertAxis = isZUp(json);
  const skeleton = extractBoneTree(rootJoint, null, invertAxis);
  const armature = extractTransform(armatureNode, invertAxis);
  if (armatureNode && armatureNode._id) {
    armature.name = armatureNode._id;
  }
  return { skeleton, armature };
}

function readLabels(json) {
  const labels = {};
  const { node } = json.COLLADA.library_visual_scenes.visual_scene;
  if (!Array.isArray(node)) {
    return labels;
  }
  node.forEach((n) => {
    if (!n.node && n.matrix) {
      const labelId = simplifyName(n._id);
      const matrix = floatStringToArray(n.matrix.__text || n.matrix);
      labels[labelId] = getTranslation(matrix);
    }
  });
  return labels;
}

function readAnimations(json) {
  let anims = json.COLLADA.library_animations;
  if (!anims) {
    return {};
  }
  anims = Array.isArray(anims.animation) ? anims.animation : [anims.animation];
  const invertAxis = isZUp(json);
  const animations = {};
  anims.forEach((a) => {
    let anim = a;
    if (anim.animation) {
      anim = anim.animation;
    }
    if (!anim.channel) {
      // empty animation
      return;
    }
    const target = anim.channel._target.split('/');
    const boneId = simplifyName(target[0]);
    const targetId = target[1];
    if (animations[boneId] === undefined) {
      animations[boneId] = {};
    }
    anim.source.forEach((src) => {
      if (!src.float_array) {
        return;
      }
      const floatCount = parseInt(src.float_array._count || '0', 10);
      if (floatCount <= 0) {
        return;
      }
      const id = src.float_array._id;
      const floats = floatStringToArray(src.float_array.__text);
      if (id.indexOf('input') >= 0) {
        animations[boneId].keyframes = floats;
      } else if (id.indexOf('output') >= 0) {
        if (targetId.indexOf('translation') >= 0 || targetId.indexOf('scale') >= 0) {
          animations[boneId][targetId] = toVectorArray(floats, 3);
        } else if (targetId.indexOf('transform') >= 0 || targetId.indexOf('matrix') >= 0) {
          const matrices = toVectorArray(floats, 16);
          if (invertAxis) {
            animations[boneId].matrix = matrices.map(flipAxisForMatrix);
          } else {
            animations[boneId].matrix = matrices;
          }
        } else {
          animations[boneId][targetId] = floats;
        }
      }
    });
  });
  return animations;
}

function urlToName(url) {
  if (url[0] === '#') {
    // local reference
    return url.substring(1);
  }
  const pathSep = url.lastIndexOf('/');
  return url.substring(pathSep + 1);
}

function readMaterials(json, defaultTexture) {
  // default
  const mat = {};
  mat[defaultTexture] = {
    albedoMap: defaultTexture
  };
  const effects = {};
  let fxArray = (json.COLLADA.library_effects || {}).effect;
  if (fxArray) {
    if (!Array.isArray(fxArray)) {
      fxArray = [fxArray];
    }
    fxArray.forEach((fx) => {
      const id = fx._id;
      const param = fx.profile_COMMON.newparam;
      if (param) {
        fx.profile_COMMON.newparam.forEach((p) => {
          if (p.surface) {
            effects[id] = p.surface.init_from;
          }
        });
      }
    });
  }
  const images = {};
  let imageArray = (json.COLLADA.library_images || {}).image;
  if (imageArray) {
    if (!Array.isArray(imageArray)) {
      imageArray = [imageArray];
    }
    imageArray.forEach((img) => {
      const id = img._id;
      images[id] = urlToName(img.init_from);
    });
  }
  let materials = (json.COLLADA.library_materials || {}).material;
  if (materials) {
    if (!Array.isArray(materials)) {
      materials = [materials];
    }
    materials.forEach((m) => {
      const id = m._id;
      const fxId = urlToName(m.instance_effect._url);
      const fx = effects[fxId] || '';
      const img = images[fx] || defaultTexture;
      mat[id] = {
        albedoMap: img,
      };
    });
  }
  return mat;
}


class Collada {
  static parse(xmlText, defaultTexture) {
    // https://github.com/abdmob/x2js
    const x2js = new X2JS();
    const json = x2js.xml_str2json(xmlText);
    if (!json) {
      throw new Error("Unable to parse XML file")
    }
    const skin = readSkin(json);
    const model = readMeshes(json, skin, defaultTexture);
    model.skin = skin;
    const sk = readSkeleton(json);
    if (sk) {
      const { skeleton, armature } = sk;
      model.skeleton = skeleton;
      model.armature = armature;
    }
    model.anims = readAnimations(json);
    model.materials = readMaterials(json, defaultTexture);
    model.meterUnits = getMeterUnits(json);
    model.labels = readLabels(json);
    return model;
  }
}

export { Collada as default };
