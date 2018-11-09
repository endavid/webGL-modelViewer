(function(global) {
  "use strict";

  function floatStringToArray(text) {
    return text.split(" ").map(function(e) { return parseFloat(e); });
  }
  function intStringToArray(text) {
    return text.split(" ").map(function(e) { return parseInt(e); });
  }
  // [a b c d e ...] -> [ [a b], [b c], ...]
  function toVectorArray(array, stride) {
    var hash = {}; // to avoid duplicated entries
    var out = [];
    var duplicateCount = 0;
    for (var i=0; i<array.length; i+=stride) {
      var v = array.slice(i, i+stride);
      if (hash[v]) {
        duplicateCount++;
        hash[v]++;
      } else {
        hash[v] = 1;
      }
      out.push(v);
    }
    if (duplicateCount > 0) {
      // not removing them for now...
      console.log("Counted " + duplicateCount + " duplicated entries");
    }
    return out;
  }

  function readMeshes(json, defaultMaterial) {
    var positions = [];
    var normals = [];
    var uvs = [];
    var vertices = [];
    var meshes = [];
    var ngons = {};
    var src = json.COLLADA.library_geometries.geometry.mesh.source;
    var isZUp = (json.COLLADA.asset.up_axis === "Z_UP");
    src.forEach(function (e) {
      if (e._id.indexOf("positions") >= 0) {
        positions = floatStringToArray(e.float_array.__text);
      }
      else if (e._id.indexOf("normals") >= 0) {
        normals = floatStringToArray(e.float_array.__text);
      }
      else if (e._id.indexOf("map") >= 0 || e._id.indexOf("uvs") >= 0) {
        uvs = floatStringToArray(e.float_array.__text);
      }
    });
    var polylists = json.COLLADA.library_geometries.geometry.mesh.polylist;
    if (!Array.isArray(polylists)) {
      polylists = [polylists];
    }
    var j = 0; // face index
    polylists.forEach(function (polylist) {
      var numInputs = polylist.input.length;
      var vcount = intStringToArray(polylist.vcount);
      var polygons = toVectorArray(intStringToArray(polylist.p), numInputs);
      var submesh = { indices: [] };
      if (defaultMaterial) {
        submesh.material = defaultMaterial;
      }
      // interleave vertex data as
      // position (3), normal (3), UVs (2)
      for (var i = 0; i < polygons.length; i++) {
        var p = polygons[i];
        vertices.push(positions[3*p[0]]);
        if (isZUp) {
          vertices.push(positions[3*p[0]+2]);
          vertices.push(-positions[3*p[0]+1]);
        } else {
          vertices.push(positions[3*p[0]+1]);
          vertices.push(positions[3*p[0]+2]);
        }
        var noNormals = p[1] === undefined;
        vertices.push(noNormals ? 0 : normals[3*p[1]]);
        if (isZUp) {
          vertices.push(noNormals ? 0 :normals[3*p[1]+2]);
          vertices.push(noNormals ? 0 :-normals[3*p[1]+1]);
        } else {
          vertices.push(noNormals ? 0 : normals[3*p[1]+1]);
          vertices.push(noNormals ? 0 : normals[3*p[1]+2]);
        }
        var noUVs = p[2] === undefined;
        vertices.push(noUVs ? 0 : uvs[2*p[2]] || 0);
        vertices.push(noUVs ? 0 : uvs[2*p[2]+1] || 0);
      }
      vcount.forEach(function(c) {
        if (c === 3 || c === 4) {
          submesh.indices.push(j);
          submesh.indices.push(j+1);
          submesh.indices.push(j+2);
          if (c === 4) {
            submesh.indices.push(j);
            submesh.indices.push(j+2);
            submesh.indices.push(j+3);
          }
        } else {
          ngons[""+c] = true;
        }
        j += c;
      });
      meshes.push(submesh);
    });
    Object.keys(ngons).forEach(function(n) {
      console.warn(n+"-gons not supported. Only triangles and quads");
    });
    return {
      meshes: meshes,
      vertices: vertices,
      materials: {}
    };
  }

  function readSkin(json) {
    var controller = json.COLLADA.library_controllers.controller;
    var skin = controller ? controller.skin : controller;
    var skinData = {};
    if (!skin) {
      return skinData;
    }
    var isZUp = (json.COLLADA.asset.up_axis === "Z_UP");
    var weightData = [];
    skin.source.forEach(function (e) {
      if (e._id.indexOf("weights") >= 0) {
        weightData = floatStringToArray(e.float_array.__text);
      }
      else if (e._id.indexOf("bind_poses") >= 0) {
        skinData.bindPoses = floatStringToArray(e.float_array.__text);
      }
      else if (e._id.indexOf("joints") >= 0) {
        skinData.joints = e.Name_array.__text.split(" ");
      }
    });
    var v = intStringToArray(skin.vertex_weights.v);
    var jointWeightIndices = toVectorArray(v, 2);
    var vcount = intStringToArray(skin.vertex_weights.vcount);
    skinData.bindShapeMatrix = floatStringToArray(skin.bind_shape_matrix);
    skinData.weights = mapWeightsPerVertex(vcount, jointWeightIndices, weightData);
    return skinData;
  }

  function mapWeightsPerVertex(vcount, jointWeightIndices, weightData) {
    var moreThan4JointsCount = 0;
    var weights = [];
    var iv = 0;
    vcount.forEach(function (jointsPerVertex) {
      if (jointsPerVertex > 4) {
        moreThan4JointsCount++;
      }
      var jointWeightPairs = [];
      for (var j = 0; j < jointsPerVertex; j++) {
        if (j <= 4) { // if there are more joints, ignore
          var jointIndex = jointWeightIndices[iv][0];
          var weightIndex = jointWeightIndices[iv][1];
          var weight = weightData[weightIndex];
          jointWeightPairs.push([jointIndex, weight]);
        }
        iv++;
      }
      weights.push(jointWeightPairs);
    });
    if (moreThan4JointsCount > 0) {
      console.warn("There are " + moreThan4JointsCount + " vertices with more than 4 contributing joints! Ignoring the 5th onwards...");
    }
    return weights;
  }

  function readSkeleton(json) {
    var node = json.COLLADA.library_visual_scenes.visual_scene.node;
    if (!Array.isArray(node)) {
      node = node.node;
    }
    var i = 0;
    var rootJoint;
    while (i < node.length && !rootJoint) {
      if (node[i]._type === "JOINT") {
        rootJoint = node[i];
      }
      i++;
    }
    return extractBoneTree(rootJoint, null);
  }

  function extractBoneTree(joint, parent) {
    if (!joint) {
      return {};
    }
    var skeleton = {};
    var t = extractTransform(joint);
    skeleton[joint._id] = {
      parent: parent,
      transform: t.transform,
      rotationOrder: t.rotationOrder
    };
    var children = Array.isArray(joint.node) ? joint.node : [joint.node];
    children.forEach(function (child) {
      var branch = extractBoneTree(child, joint._id);
      // flatten tree into dictionary
      var jointList = Object.keys(branch);
      jointList.forEach(function (j) {
        skeleton[j] = branch[j];
      });
    });
    return skeleton;
  }

  function extractTransform(joint) {
    var data = {
      transform: [],
      rotationOrder: ""
    };
    if (joint.matrix) {
      data.transform = floatStringToArray(joint.matrix.__text);
    } else {
      var t = floatStringToArray(joint.translate.__text || joint.translate);
      var s = floatStringToArray(joint.scale.__text || joint.scale);
      var rx = [];
      var ry = [];
      var rz = [];
      for (var i = 0; i < 3; i++) {
        var r = joint.rotate[i];
        if (r._sid === "rotateX") {
          data.rotationOrder += "x";
          rx = floatStringToArray(r.__text);
        } else if (r._sid === "rotateY") {
          data.rotationOrder += "y";
          ry = floatStringToArray(r.__text);
        } else if (r._sid === "rotateZ") {
          data.rotationOrder += "z";
          rz = floatStringToArray(r.__text);
        }
      }
      data.transform = [
        rx[0] * s[0], ry[0] * s[1], rz[0] * s[2], t[0],
        rx[1] * s[0], ry[1] * s[1], rz[1] * s[2], t[1],
        rx[2] * s[0], ry[2] * s[1], rz[2] * s[2], t[2],
        rx[3],        ry[3],        rz[3],        1.0
      ];
    }
    return data;
  }

  function readAnimations(json) {
    var anims = json.COLLADA.library_animations;
    if (!anims) {
      return {};
    }
    anims = Array.isArray(anims.animation) ? anims.animation : [anims.animation];
    var animations = {};
    anims.forEach(function (anim) {
      var target = anim.channel._target.split("/");
      var boneId = target[0];
      var targetId = target[1];
      animations[boneId] = {};
      anim.source.forEach(function (src) {
        if (src.float_array) {
          var id = src.float_array._id;
          var floats = floatStringToArray(src.float_array.__text);
          if (id.indexOf("input") >= 0) {
            animations[boneId].keyframes = floats;
          } else if (id.indexOf("output") >= 0) {
            if (targetId.indexOf("translation") >= 0 || targetId.indexOf("scale") >= 0) {
              animations[boneId][targetId] = toVectorArray(floats, 3);
            } else if (targetId.indexOf("matrix") >= 0) {
              animations[boneId][targetId] = toVectorArray(floats, 16);
            } else {
              animations[boneId][targetId] = floats;
            }
          }
        }
      });
    });
    return animations;
  }

  var ColladaUtils = {
    parseCollada: function(xmlText, defaultMaterial) {
      // https://github.com/abdmob/x2js
      var x2js = new X2JS();
      var json = x2js.xml_str2json(xmlText);
      var model = readMeshes(json, defaultMaterial);
      var skin = readSkin(json);
      var skeleton = readSkeleton(json);
      var anims = readAnimations(json);
      if (defaultMaterial) {
        model.materials[defaultMaterial] = {
          albedoMap: defaultMaterial
        };
      }
      return model;
    }
  };
  // export
  global.ColladaUtils = (global.module || {}).exports = ColladaUtils;
})(this);
