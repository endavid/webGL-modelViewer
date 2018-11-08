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

  var ColladaUtils = {
    parseCollada: function(xmlText, defaultMaterial) {
      // https://github.com/abdmob/x2js
      var x2js = new X2JS();
      var json = x2js.xml_str2json(xmlText);
      var model = readMeshes(json, defaultMaterial);
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
