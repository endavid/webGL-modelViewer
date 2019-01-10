// failed to import as a module atm
const { X2JS } = window;

function floatStringToArray(text) {
  return text.split(/[\s,]+/).map(e => parseFloat(e));
}
function intStringToArray(text) {
  return text.split(/[\s,]+/).map(e => parseInt(e, 10));
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

function isZUp(json) {
  return json.COLLADA.asset.up_axis === 'Z_UP';
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

function readMeshes(json, defaultMaterial, skin) {
  let positions = [];
  let normals = [];
  let uvs = [];
  const vertices = [];
  const meshes = [];
  const ngons = {};
  const invertAxis = isZUp(json);
  let src = json.COLLADA.library_geometries.geometry.mesh.source;
  if (!Array.isArray(src)) {
    src = [src];
  }
  src.forEach((e) => {
    if (e._id.indexOf('positions') >= 0) {
      positions = floatStringToArray(e.float_array.__text);
    } else if (e._id.indexOf('normals') >= 0) {
      normals = floatStringToArray(e.float_array.__text);
    } else if (e._id.indexOf('map') >= 0 || e._id.indexOf('uvs') >= 0) {
      uvs = floatStringToArray(e.float_array.__text);
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
    const submesh = { indices: [] };
    if (defaultMaterial) {
      submesh.material = defaultMaterial;
    }
    // interleave vertex data as
    // position (3), normal (3), UVs (2)
    polygons.forEach((p) => {
      vertices.push(positions[3 * p[0]]);
      if (invertAxis) {
        vertices.push(positions[3 * p[0] + 2]);
        vertices.push(-positions[3 * p[0] + 1]);
      } else {
        vertices.push(positions[3 * p[0] + 1]);
        vertices.push(positions[3 * p[0] + 2]);
      }
      const noNormals = p[1] === undefined;
      vertices.push(noNormals ? 0 : normals[3 * p[1]]);
      if (invertAxis) {
        vertices.push(noNormals ? 0 : normals[3 * p[1] + 2]);
        vertices.push(noNormals ? 0 : -normals[3 * p[1] + 1]);
      } else {
        vertices.push(noNormals ? 0 : normals[3 * p[1] + 1]);
        vertices.push(noNormals ? 0 : normals[3 * p[1] + 2]);
      }
      const noUVs = p[2] === undefined;
      vertices.push(noUVs ? 0 : uvs[2 * p[2]] || 0);
      vertices.push(noUVs ? 0 : uvs[2 * p[2] + 1] || 0);
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
  };
}

function mapWeightsPerVertex(vcount, jointWeightIndices, weightData) {
  let moreThan4JointsCount = 0;
  const weights = [];
  let iv = 0;
  vcount.forEach((jointsPerVertex) => {
    if (jointsPerVertex > 4) {
      moreThan4JointsCount += 1;
    }
    const jointWeightPairs = [];
    for (let j = 0; j < jointsPerVertex; j += 1) {
      if (j <= 4) { // if there are more joints, ignore
        const jointIndex = jointWeightIndices[iv][0];
        const weightIndex = jointWeightIndices[iv][1];
        const weight = weightData[weightIndex];
        jointWeightPairs.push([jointIndex, weight]);
      }
      iv += 1;
    }
    weights.push(jointWeightPairs);
  });
  if (moreThan4JointsCount > 0) {
    console.warn(`There are ${moreThan4JointsCount} vertices with more than 4 contributing joints! Ignoring the 5th onwards...`);
  }
  return weights;
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
    if (e._id.indexOf('weights') >= 0) {
      weightData = floatStringToArray(e.float_array.__text);
    } else if (e._id.indexOf('bind_poses') >= 0 || e._id.indexOf('Matrices') >= 0) {
      let bp = floatStringToArray(e.float_array.__text);
      bp = toVectorArray(bp, 16);
      if (invertAxis) {
        skinData.bindPoses = bp.map(flipAxisForMatrix);
      } else {
        skinData.bindPoses = bp;
      }
    } else if (e._id.indexOf('joints') >= 0 || e._id.indexOf('Joints') >= 0) {
      skinData.joints = e.Name_array.__text.split(/[\s,]+/);
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

function findRootNode(node) {
  const nodes = Array.isArray(node) ? node : [node];
  for (let i = 0; i < nodes.length; i += 1) {
    if (nodes[i]._type === 'JOINT') {
      return nodes[i];
    }
    if (nodes[i].node) {
      const joint = findRootNode(nodes[i].node);
      if (joint) {
        return joint;
      }
    }
  }
  return null;
}

function extractTransform(joint, invertAxis) {
  const data = {
    transform: [],
    rotationOrder: '',
  };
  if (joint.matrix) {
    data.transform = floatStringToArray(joint.matrix.__text || joint.matrix);
  } else {
    const t = floatStringToArray(joint.translate.__text || joint.translate);
    const s = floatStringToArray(joint.scale.__text || joint.scale);
    let rx = [];
    let ry = [];
    let rz = [];
    for (let i = 0; i < 3; i += 1) {
      const r = joint.rotate[i];
      if (r._sid === 'rotateX') {
        data.rotationOrder += 'x';
        rx = floatStringToArray(r.__text);
      } else if (r._sid === 'rotateY') {
        data.rotationOrder += 'y';
        ry = floatStringToArray(r.__text);
      } else if (r._sid === 'rotateZ') {
        data.rotationOrder += 'z';
        rz = floatStringToArray(r.__text);
      }
    }
    data.transform = [
      rx[0] * s[0], ry[0] * s[1], rz[0] * s[2], t[0],
      rx[1] * s[0], ry[1] * s[1], rz[1] * s[2], t[1],
      rx[2] * s[0], ry[2] * s[1], rz[2] * s[2], t[2],
      // eslint-disable-next-line no-multi-spaces
      rx[3],        ry[3],        rz[3],        1.0,
    ];
  }
  if (invertAxis) {
    data.transform = flipAxisForMatrix(data.transform);
  }
  return data;
}

function extractBoneTree(joint, parent, invertAxis) {
  if (!joint) {
    return {};
  }
  const skeleton = {};
  const t = extractTransform(joint, invertAxis);
  skeleton[joint._id] = {
    parent,
    transform: t.transform,
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
  const rootJoint = findRootNode(node);
  const invertAxis = isZUp(json);
  return extractBoneTree(rootJoint, null, invertAxis);
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
    const target = anim.channel._target.split('/');
    const boneId = target[0];
    const targetId = target[1];
    if (animations[boneId] === undefined) {
      animations[boneId] = {};
    }
    anim.source.forEach((src) => {
      if (src.float_array) {
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
              animations[boneId][targetId] = matrices.map(flipAxisForMatrix);
            } else {
              animations[boneId][targetId] = matrices;
            }
          } else {
            animations[boneId][targetId] = floats;
          }
        }
      }
    });
  });
  return animations;
}

class Collada {
  static parse(xmlText, defaultMaterial) {
    // https://github.com/abdmob/x2js
    const x2js = new X2JS();
    const json = x2js.xml_str2json(xmlText);
    const skin = readSkin(json);
    const model = readMeshes(json, defaultMaterial, skin);
    const skeleton = readSkeleton(json);
    const anims = readAnimations(json);
    if (defaultMaterial) {
      model.materials[defaultMaterial] = {
        albedoMap: defaultMaterial,
      };
    }
    model.skin = skin;
    model.skeleton = skeleton;
    model.anims = anims;
    return model;
  }
}

export { Collada as default };
