(function(global) {
  "use strict";
  // Singletons, so defined with object literals
  // Ref. http://www.phpied.com/3-ways-to-define-a-javascript-class/

  /**
   * Graphics libs
   * They require jQuery
   * Refs: http://stackoverflow.com/questions/5878703/webgl-is-there-an-alternative-to-embedding-shaders-in-html
   */
  var GFX = {
    shaderCache: {},
    textureCache: {},
    SHADER_TYPE_FRAGMENT: "x-shader/x-fragment",
    SHADER_TYPE_VERTEX: "x-shader/x-vertex",

    /// Eg. GFX.useShader(gl, "shaders/main.vs", "shaders/main.fs", function(shaderProgram) {});
    useShader: function(gl, vsPath, fsPath, callback)
    {
      GFX.loadShader(vsPath, GFX.SHADER_TYPE_VERTEX, function(vd) {
        if (vd) {
          GFX.loadShader(fsPath, GFX.SHADER_TYPE_FRAGMENT, function (fd) {
            if (fd) {
              var vertexShader = GFX.getShader(gl, vsPath);
              var fragmentShader = GFX.getShader(gl, fsPath);
              var prog = gl.createProgram();
              gl.attachShader(prog, vertexShader);
              gl.attachShader(prog, fragmentShader);
              gl.linkProgram(prog);
              if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
                console.error("Could not initialise shaders: "+vsPath+", "+fsPath);
              }
              callback(prog);
            }
          });
        }
      });
    },

    loadShader: function(file, type, callback)
    {
      $.ajax({
        async: true,
        url: file,
        success: function(data) {
          // store in cache
          GFX.shaderCache[file] = {script: data, type: type};
          callback(data);
        },
        error: function(e) {
          console.log("loadShader: " + e);
          callback();
        },
        dataType: 'text'
      });
    },

    getShader: function(gl, id)
    {
      var shaderObj = GFX.shaderCache[id];
      var shaderScript = shaderObj.script;
      var shaderType = shaderObj.type;
      var shader;
      if (shaderType == GFX.SHADER_TYPE_FRAGMENT) {
        shader = gl.createShader(gl.FRAGMENT_SHADER);
      } else if (shaderType == GFX.SHADER_TYPE_VERTEX) {
        shader = gl.createShader(gl.VERTEX_SHADER);
      } else {
        return null;
      }
      gl.shaderSource(shader, shaderScript);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert(gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    }, // getShader

    destroyBuffers: function(gl, modelData)
    {
      if (modelData.meshes) {
        modelData.meshes.forEach(function (m) {
          // remove img reference
          m.albedoMap = null;
          gl.deleteBuffer(m.indexBuffer);
        });
        modelData.meshes = false;
      }
      if (modelData.vertexBuffer) {
        gl.deleteBuffer(modelData.vertexBuffer);
        modelData.vertexBuffer = false;
      }
      // empty texture cache
      var toKeep = [];
      Object.keys(GFX.textureCache).forEach(function (url) {
        var img = GFX.textureCache[url];
        if (img.keepInCache) {
          toKeep.push(url);
        } else {
          if (img.webglTexture) {
            gl.deleteTexture(img.webglTexture);
          }
          GFX.textureCache[url] = null;
        }
      });
      var newCache = {};
      toKeep.forEach(function (url) { newCache[url] = GFX.textureCache[url]; });
      GFX.textureCache = newCache;
    },

    // tries to get the datatype
    loadModel: function(gl, params, modelData, callback)
    {
      var loaders = {
        loadModelJson: function() {
          $.getJSON(params.model.uri, function(model) {
            if (params.isZAxisUp) {
              GFX.flipAxisZ(model);
            }
            GFX.initModelFromJson(gl, modelData, params.imageUris, model);
            callback();
          });
        },
        loadModel: function() {
          GFX.modelFileToJson(params, function(model) {
            if (params.isZAxisUp) {
              GFX.flipAxisZ(model);
            }
            GFX.initModelFromJson(gl, modelData, params.imageUris, model);
            callback();
          });
        }
      };
      var ext = GFX.getModelFileExtension(params.model);
      var fn = loaders["loadModel" + (ext === "Json" ? ext : "")];
      if(ext !== "" && typeof fn === 'function') {
        // free previous resources
        GFX.destroyBuffers(gl, modelData);
        modelData.modelURL = params.model.uri;
        fn();
      } else {
        window.alert("Unsupported format: "+ext);
      }
    },

    flipAxisZ: function(model) {
      var n = model.vertices.length;
      var coordsPerVertex = 8; // position (3), normal (3), uv (2)
      for (var i = 0; i < n; i+=coordsPerVertex) {
        var positionY = model.vertices[i+1];
        var positionZ = model.vertices[i+2];
        var normalY = model.vertices[i+4];
        var normalZ = model.vertices[i+5];
        model.vertices[i+1] = positionZ;
        model.vertices[i+2] = -positionY;
        // it seems that the normals of the models I have don't need flipping...
        //model.vertices[i+4] = normalZ;
        //model.vertices[i+5] = -normalY;
      }
    },

    // format:
    // { name: // model name
    //   materials: {
    //     "name": {
    //       albedoMap: "image.png",
    //     }
    //   },
    //   vertices: // float array in this order: position (3), normal (3), uv (2)
    //         // + weights (4) + joint indices (1 -- 4 bytes) for skinned models
    //   stride: 8 or 13
    //   meshes: // array of submeshes
    //      [ {material: // material reference
    //         indices: // faces of the submesh
    //      }]
    // }
    initModelFromJson: function(gl, modelData, imageUris, model) {
      //vertices
      modelData.vertexBuffer= gl.createBuffer();
      modelData.stride = model.stride;
      console.log("#vertices: " + (model.vertices.length/model.stride));
      if (model.skin) {
        modelData.skinnedModel = new SkinnedModel(model.skin, model.skeleton, model.anims);
      } else {
        modelData.skinnedModel = null;
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, modelData.vertexBuffer);
      // atm, only floats allowed ...
      // but we should be able to mix with other datatypes
      // https://www.html5rocks.com/en/tutorials/webgl/typed_arrays/
      gl.bufferData(gl.ARRAY_BUFFER,
                    new Float32Array(model.vertices),
                    gl.STATIC_DRAW);
      //submeshes
      modelData.meshes=[];
      model.meshes.forEach(function (m){
        var mat = m.material !== undefined ? model.materials[m.material] || {} : {};
        var albedoMapName = mat.albedoMap || "missing";
        // if the .dds texture is missing, try to find equivalent .png
        var albedoMapUri = imageUris[albedoMapName] || imageUris[GFX.getFileNameWithoutExtension(albedoMapName)+".png"];
        var mesh = {
          indexBuffer: gl.createBuffer(),
          numPoints: m.indices.length,
          albedoMap: albedoMapUri !== undefined ? GFX.loadTexture(gl, albedoMapUri) : false
        };
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,
                      new Uint32Array(m.indices), // 32-bit for more than 64K verts
          gl.STATIC_DRAW);
        modelData.meshes.push(mesh);
      });
    },

    modelFileToJson: function(params, callback)
    {
      var ext = GFX.getModelFileExtension(params.model);
      if (ext === "Obj") {
        $.ajax({
          async: true,
          url: params.model.uri,
          success: function(data) {
            var model = window.WavefrontUtils.parseObjWavefront(data);
            model.name = GFX.getFileNameWithoutExtension(params.model.name) + ".json";
            if (model.materialFile !== undefined && params.materialUris[model.materialFile] !== undefined) {
              $.ajax({
                async: true,
                url: params.materialUris[model.materialFile],
                success: function(mtldata) {
                  model.materials = window.WavefrontUtils.parseMaterial(mtldata);
                  callback(model);
                },
                dataType: 'text'
              });
            }
            else {
              callback(model);
            }
          },
          dataType: 'text'
        });
      } else if (ext === "Dae") {
        $.ajax({
          async: true,
          url: params.model.uri,
          success: function(data) {
            var filename = GFX.getFileNameWithoutExtension(params.model.name);
            var model = ColladaUtils.parseCollada(data, filename + ".png");
            model.name = filename + ".json";
            callback(model);
          },
          dataType: 'text'
        });
      } else if (ext === "Json") {
        $.getJSON(params.model.uri, function(model) {
          callback(model);
        });
      }
    },

    loadTexture: function(gl, url, keepInCache, callback) {
      if (GFX.textureCache[url]) {
        if (callback) {
          callback(GFX.textureCache[url]);
        }
        return GFX.textureCache[url];
      }
      var image=new Image();
      image.src=url;
      image.webglTexture=false;
      image.keepInCache = keepInCache;
      image.onload=function(e)
      {
        var texture=gl.createTexture();
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
        if (MATH.isPowerOf2(image.width) && MATH.isPowerOf2(image.height)) {
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST_MIPMAP_LINEAR);
          gl.generateMipmap(gl.TEXTURE_2D);

        } else {
          console.warn("NPOT texture: " + image.width + "x" + image.height);
          // gl.NEAREST is also allowed, instead of gl.LINEAR, as neither mipmap.
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
          // Prevents s-coordinate wrapping (repeating).
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
          // Prevents t-coordinate wrapping (repeating).
          gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        }
        gl.bindTexture(gl.TEXTURE_2D, null);
        image.webglTexture=texture;
        if (callback) {
          callback(image);
        }
      };
      GFX.textureCache[url] = image;
      return image;
    },

    getFileNameWithoutExtension: function(file) {
      var iSlash = file.lastIndexOf('/')+1;
      var iDot = file.lastIndexOf('.');
      return file.substr(iSlash, iDot - iSlash);
    },

    // returns the extension in Camel case. Eg. Json, Obj
    getFileExtension: function(file) {
      var iDot = file.lastIndexOf('.');
      if (iDot < 0) {
        return "";
      }
      var ext = file.substr(iDot+1).toLowerCase();
      return ext.substr(0,1).toUpperCase()+ext.substr(1);
    },

    getModelFileExtension: function(modelFile) {
      var ext = GFX.getFileExtension(modelFile.uri);
      if (ext === "") {
        ext = GFX.getFileExtension(modelFile.name);
      }
      return ext;
    },

    exportModel: function(params, modelType) {
      var ext = GFX.getModelFileExtension(params.model);
      var filename = GFX.getFileNameWithoutExtension(params.model.name);
      var onExportSuccess = function(text) {
        saveAs(
          new Blob([text], {type: "text/plain;charset=" + document.characterSet}),
          filename + modelType
        );
      };
      GFX.modelFileToJson(params, function(model) {
        if (modelType === ".obj") {
          WavefrontUtils.exportObjModel(model, onExportSuccess);
        } else if (modelType === ".json") {
          var out = GFX.modelStringify(model);
          onExportSuccess(out);
        } else {
          console.error("Unsupported model type: "+modelType);
        }
      });
    },

    exportPose: function(pose, filename) {
      var text = JSON.stringify(pose, null, "  ");
      saveAs(
        new Blob([text], {type: "text/plain;charset=" + document.characterSet}),
        filename + ".json"
      );
    },

    // JSON.stringify generates array that are difficult to read...
    modelStringify: function(model) {
      //return JSON.stringify(model, null, "  ");
      var s = "{\n";
      // JSON.stringify everything but "vertices" and "meshes"
      Object.keys(model).forEach(function (k) {
        if (k !== "vertices" && k !== "meshes") {
          s += "\"" + k + "\": " + JSON.stringify(model[k], null, "  ");
          s += ",\n";
        }
      });
      // manually format vertices
      s += "\"vertices\": [\n";
      for (var i = 0; i < model.vertices.length; i+=8) {
        s += "  " + model.vertices[i];
        s += ", " + model.vertices[i+1];
        s += ", " + model.vertices[i+2];
        s += ",    " + model.vertices[i+3];
        s += ", " + model.vertices[i+4];
        s += ", " + model.vertices[i+5];
        s += ",    " + model.vertices[i+6];
        s += ", " + model.vertices[i+7];
        if (i+8 < model.vertices.length) {
          s += ",";
        }
        s += "\n";
      }
      s += "],\n";
      // manually format submeshes (indices)
      s += "\"meshes\": [\n";
      for (i = 0; i < model.meshes.length; i++) {
        var m = model.meshes[i];
        s += "  {\"material\": \"" + m.material + "\",\n";
        s += "  \"indices\": [\n";
        for (var j = 0; j < m.indices.length; j += 3) { // assume triangles
          s += "    " + m.indices[j];
          s += ", " + m.indices[j+1];
          s += ", " + m.indices[j+2];
          if (j + 3 < m.indices.length) {
            s += ",";
          }
          s += "\n";
        }
        s += "  ]}";
        if (i + 1 < model.meshes.length) {
          s += ",";
        }
        s += "\n";
      }
      s += "]\n";
      s +="}";
      return s;
    },

    createQuad: function (gl) {
      var modelData = {
        vertices: false,
        faces: false,
        vertexBuffer: false,
        indexBuffer: false
      };
      modelData.vertices = [ // xyz, uv is computed in the shader from xy
      -1, -1, 0,
      -1,  1, 0,
       1, -1, 0,
       1,  1, 0
      ];
      modelData.faces = [0, 2, 1, 3];
      modelData.vertexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, modelData.vertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(modelData.vertices), gl.STATIC_DRAW);
      modelData.indexBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, modelData.indexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(modelData.faces), gl.STATIC_DRAW);
      return modelData;
    }
  };
  // export
  global.GFX = (global.module || {}).exports = GFX;
})(this);
