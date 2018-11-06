(function() {
  "use strict";

  var WavefrontUtils = {
    parseObjWavefront: function(data) {
      var lines = data.split("\n");
      var positions = [];
      var normals = [];
      var uvs = [];
      var meshes = [];
      var uniqueIndexTriplets = {};
      var model = {
        materials: {},
        vertices: [],
        meshes: []
      };
      var lastGroup = -1;
      lines.forEach(function(s) {
        var m;
        m = /mtllib\s(.*)/.exec(s);
        if (m) {
            model.materialFile = m[1];
        }
        m = /v\s(.+)\s(.+)\s(.+)/.exec(s);
        if (m) {
          m.slice(1, 4).forEach(function(val){
            positions.push(parseFloat(val));
          });
          return;
        }
        m = /vn\s(.+)\s(.+)\s(.+)/.exec(s);
        if (m) {
          m.slice(1, 4).forEach(function(val){
            normals.push(parseFloat(val));
          });
          return;
        }
        m = /vt\s(.+)\s(.+)/.exec(s);
        if (m) {
          uvs.push(parseFloat(m[1]));
          uvs.push(parseFloat(m[2]));
          return;
        }
        m = /g\s(.*)/.exec(s);
        if (m) {
          meshes.push({name: m[1], indices: []});
          lastGroup++;
        }
        m = /usemap\s(.*)/.exec(s);
        if (m) {
          var material = { albedoMap: m[1] };
          model.materials[m[1]] = material;
          if (lastGroup >= 0) {
            meshes[lastGroup].material = m[1];
          } else {
            meshes.push({material: m[1], indices: []});
          }
          return;
        }
        m = /usemtl\s(.*)/.exec(s);
        if (m) {
          if (lastGroup >= 0) {
            meshes[lastGroup].material = m[1];
          } else {
            meshes.push({material: m[1], indices: []});
          }
          return;
        }
        m = /f\s(\d+(?:\/\d+){0,2})\s(\d+(?:\/\d+){0,2})\s(\d+(?:\/\d+){0,2})/.exec(s);
        if (m) {
          m.slice(1, 4).forEach(function(val) {
            if (uniqueIndexTriplets[val] === undefined) {
              uniqueIndexTriplets[val] = 1;
            } else {
              uniqueIndexTriplets[val]++;
            }
            meshes[meshes.length-1].indices.push(val);
            //var triplet = val.split("/").map(function(d) {return parseInt(d)-1});
            //meshes[meshes.length-1].indices.push(triplet);
          });
        }
      });
      var countSharedVertices = 0;
      var uniqueIndexKeys = Object.keys(uniqueIndexTriplets);
      var newVertexIndex = 0;
      uniqueIndexKeys.forEach(function(k) {
        if (uniqueIndexTriplets[k] > 1) {
          countSharedVertices++;
        }
        uniqueIndexTriplets[k] = newVertexIndex++;
        var triplet = k.split("/").map(function(d) {return parseInt(d)-1;});
        model.vertices.push(positions[3*triplet[0]]);
        model.vertices.push(positions[3*triplet[0]+1]);
        model.vertices.push(positions[3*triplet[0]+2]);
        model.vertices.push(triplet[2]===undefined?0:normals[3*triplet[2]]);
        model.vertices.push(triplet[2]===undefined?0:normals[3*triplet[2]+1]);
        model.vertices.push(triplet[2]===undefined?0:normals[3*triplet[2]+2]);
        model.vertices.push(triplet[1]===undefined?0:uvs[2*triplet[1]]);
        model.vertices.push(triplet[1]===undefined?0:uvs[2*triplet[1]+1]);
      });
      console.log("# shared vertices: "+countSharedVertices+"/"+positions.length);
      meshes.forEach(function(m){
        var submesh = { material: m.material, indices: [] };
        // populate with new indices
        m.indices.forEach(function(i) {
          submesh.indices.push(uniqueIndexTriplets[i]);
        });
        model.meshes.push(submesh);
      });
      return model;
    },

    parseMaterial: function(data) {
      var lines = data.split("\n");
      var materials = {};
      var lastMaterial = "";
      function getVector(match) {
        var v = [];
        match.slice(1, 4).forEach(function(val){
          v.push(parseFloat(val));
        });
        return v;
      }
      lines.forEach(function(s) {
        var m;
        m = /newmtl\s(.*)/.exec(s);
        if (m) {
          lastMaterial = m[1];
          materials[lastMaterial] = {};
          return;
        }
        m = /Kd\s(.+)\s(.+)\s(.+)/.exec(s);
        if (m) {
          materials[lastMaterial].diffuseColor = getVector(m);
          return;
        }
        m = /Ka\s(.+)\s(.+)\s(.+)/.exec(s);
        if (m) {
          materials[lastMaterial].ambientColor = getVector(m);
          return;
        }
        m = /Ks\s(.+)\s(.+)\s(.+)/.exec(s);
        if (m) {
          materials[lastMaterial].specularColor = getVector(m);
          return;
        }
        m = /Ns\s(.+)/.exec(s);
        if (m) {
          materials[lastMaterial].specularExponent = parseFloat(m[1]);
          return;
        }
        m = /map_Kd\s(.*)/.exec(s);
        if (m) {
          materials[lastMaterial].albedoMap = m[1];
          return;
        }
        m = /d\s(.+)/.exec(s);
        if (m) {
          materials[lastMaterial].opaqueness = parseFloat(m[1]);
          return;
        }
      });
      return materials;
    },

    exportObjModel: function(model, callback) {
      var out = "# Vertices\n";
      var i;
      for (i = 0; i < model.vertices.length; i+=8 ) {
        out += "v " + model.vertices[i] + " " + model.vertices[i+1] + " " + model.vertices[i+2] + "\n";
      }
      out += "# Normals\n";
      for (i = 0; i < model.vertices.length; i+=8 ) {
        out += "vn " + model.vertices[i+3] + " " + model.vertices[i+4] + " " + model.vertices[i+5] + "\n";
      }
      out += "# Texture coordinates\n";
      for (i = 0; i < model.vertices.length; i+=8 ) {
        out += "vt " + model.vertices[i+6] + " " + model.vertices[i+7] + "\n";
      }
      model.meshes.forEach(function (m) {
        out += "usemap " + m.texture + "\n"; // old Wavefront texture map
        for (var i = 0; i < m.indices.length; i+=3 ) {
          var i1 = m.indices[i] + 1;
          var i2 = m.indices[i+1] + 1;
          var i3 = m.indices[i+2] + 1;
          out += "f " + i1 +"/" + i1 + "/" + i1 + " ";
          out += i2 +"/" + i2 + "/" + i2 + " ";
          out += i3 +"/" + i3 + "/" + i3 + "\n";
        }
      });
      callback(out);
    },
  };

  // export all
  window.WavefrontUtils = WavefrontUtils;

})();
