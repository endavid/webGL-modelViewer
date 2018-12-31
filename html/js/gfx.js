import MATH from './math.js';
import {WavefrontUtils} from './parserWavefront.js';
import {ColladaUtils} from './parserCollada.js';

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

  /// Eg. GFX.useShader(gl, "shaders/main.vs", "shaders/main.fs");
  /// Returns a promise
  useShader: function(gl, vsPath, fsPath)
  {
    return Promise.all([
      GFX.loadShader(vsPath, GFX.SHADER_TYPE_VERTEX),
      GFX.loadShader(fsPath, GFX.SHADER_TYPE_FRAGMENT)
    ]).then(([vd, fd]) => {
      var vertexShader = GFX.getShader(gl, vsPath);
      var fragmentShader = GFX.getShader(gl, fsPath);
      var prog = gl.createProgram();
      gl.attachShader(prog, vertexShader);
      gl.attachShader(prog, fragmentShader);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
        throw new Error("Could not initialise shaders: "+vsPath+", "+fsPath);
      }
      return prog;
    });
  },

  loadShader: function(file, type)
  {
    return $.get(file).then(data => {
      // store in cache
      GFX.shaderCache[file] = {script: data, type: type};
      return data;
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
      throw new Error(gl.getShaderInfoLog(shader));
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

  modelFileToJson: function(name, url, materialUrls)
  {
    var ext = GFX.getModelFileExtension(name, url);
    if (ext === "Obj") {
      return $.get(url).then(data => {
        let json = WavefrontUtils.parseObjWavefront(data);
        json.name = GFX.getFileNameWithoutExtension(name) + ".json";
        if (json.materialFile !== undefined && materialUrls[json.materialFile] !== undefined) {
          return $.get(materialUrls[json.materialFile]).then(mtldata => {
              json.materials = WavefrontUtils.parseMaterial(mtldata);
              return json;
          });
        }
        else {
          return json;
        }
      });
    } else if (ext === "Dae") {
      return $.get(url, null, null, 'text').then(data => {
        const filename = GFX.getFileNameWithoutExtension(name);
        let json = ColladaUtils.parseCollada(data, filename + ".png");
        json.name = filename + ".json";
        return json;
      });
    } else if (ext === "Json") {
      return $.getJSON(url);
    }
    return new Promise(() => {
      throw new Error("Unsupported format: "+ext);
    });
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

  getModelFileExtension: function(name, url) {
    var ext = GFX.getFileExtension(url);
    if (ext === "") {
      ext = GFX.getFileExtension(name);
    }
    return ext;
  },

  exportModel: (name, url, modelType, materialUrls) => {
    const filename = GFX.getFileNameWithoutExtension(name);
    var onExportSuccess = text => {
      saveAs(
        new Blob([text], {type: "text/plain;charset=" + document.characterSet}),
        filename + modelType
      );
    };
    return GFX.modelFileToJson(name, url, materialUrls).then(json => {
      if (modelType === ".obj") {
        WavefrontUtils.exportObjModel(json, onExportSuccess);
      } else if (modelType === ".json") {
        const out = GFX.modelStringify(json);
        onExportSuccess(out);
      } else {
        throw new Error("Unsupported model type: "+modelType);
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
export {GFX as default};
