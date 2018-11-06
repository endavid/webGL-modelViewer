(function() {
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

  var ColladaUtils = {
    parseCollada: function(xmlText, defaultMaterial) {
      // https://github.com/abdmob/x2js
      var x2js = new X2JS();
      var json = x2js.xml_str2json(xmlText);
      var positions = [];
      var normals = [];
      var uvs = [];
      var meshes = [];
      var model = {
        materials: {},
        vertices: [],
        meshes: []
      };
      if (defaultMaterial) {
        model.materials[defaultMaterial] = {
          albedoMap: defaultMaterial
        };
      }
      var src = json.COLLADA.library_geometries.geometry.mesh.source;
      var isZUp = (json.COLLADA.asset.up_axis === "Z_UP");
      src.forEach(function (e) {
        if (e._id.indexOf("positions") >= 0) {
          positions = floatStringToArray(e.float_array.__text);
        }
        else if (e._id.indexOf("normals") >= 0) {
          normals = floatStringToArray(e.float_array.__text);
        }
        else if (e._id.indexOf("map") >= 0) {
          uvs = floatStringToArray(e.float_array.__text);
        }
      });
      var polylist = json.COLLADA.library_geometries.geometry.mesh.polylist;
      var numInputs = polylist.input.length;
      var vcount = intStringToArray(polylist.vcount);
      var polygons = toVectorArray(intStringToArray(polylist.p), numInputs);
      var submesh = { indices: [] };
      if (defaultMaterial) {
        submesh.material = defaultMaterial;
      }
      for (var i = 0; i < polygons.length; i++) {
        var p = polygons[i];
        model.vertices.push(positions[3*p[0]]);
        if (isZUp) {
          model.vertices.push(positions[3*p[0]+2]);
          model.vertices.push(-positions[3*p[0]+1]);
        } else {
          model.vertices.push(positions[3*p[0]+1]);
          model.vertices.push(positions[3*p[0]+2]);
        }
        model.vertices.push(p[1]===undefined?0:normals[3*p[1]]);
        if (isZUp) {
          model.vertices.push(p[1]===undefined?0:normals[3*p[1]+2]);
          model.vertices.push(p[1]===undefined?0:-normals[3*p[1]+1]);
        } else {
          model.vertices.push(p[1]===undefined?0:normals[3*p[1]+1]);
          model.vertices.push(p[1]===undefined?0:normals[3*p[1]+2]);
        }
        model.vertices.push(p[2]===undefined?0:uvs[2*p[2]]);
        model.vertices.push(p[2]===undefined?0:uvs[2*p[2]+1]);
      }
      var ngons = {};
      var j=0;
      for (i = 0; i < vcount.length; i++) {
        var c = vcount[i];
        if (c === 3 || c === 4) {
          submesh.indices.push(j);
          submesh.indices.push(j+1);
          submesh.indices.push(j+2);
          if (c === 4) {
            submesh.indices.push(j);
            submesh.indices.push(j+1);
            submesh.indices.push(j+3);
          }
        }
        else {
          ngons[""+vcount[i]] = true;
        }
        j += c;
      }
      model.meshes.push(submesh);
      Object.keys(ngons).forEach(function(n) {
        console.log(n+"-gons not supported. Only triangles and quads");
      });
      return model;
    }
  };

  // export
  window.ColladaUtils = ColladaUtils;
})();
