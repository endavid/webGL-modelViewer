import VMath from "./math.js";
import { WavefrontUtils } from "./parserWavefront.js";
import parseCollada from "./parserCollada.js";

const ShaderType = {
  fragment: "x-shader/x-fragment",
  vertex: "x-shader/x-vertex"
};

function createAndCompileShader(gl, shaderCode, shaderType) {  
  var shader;
  if (shaderType == ShaderType.fragment) {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderType == ShaderType.vertex) {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    throw new Error("Unknown shader type: " + shaderType);
  }
  gl.shaderSource(shader, shaderCode);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

/**
 * Graphics lib singleton
 *  They require jQuery
 *  Refs: http://stackoverflow.com/questions/5878703/webgl-is-there-an-alternative-to-embedding-shaders-in-html
 *  About Singletons: https://stackoverflow.com/a/6733919
 */
class Gfx {
  constructor() {
    const instance = this.constructor.instance;
    if (instance) {
      return instance;
    }
    this.constructor.instance = this;
    this.textureCache = {};
  }

  /// Eg. Gfx.useShader(gl, "shaders/main.vs", "shaders/main.fs");
  /// Returns a promise
  static async useShader(gl, vsPath, fsPath) {
    const [vd, fd] = await Promise.all([
      $.get(vsPath), $.get(fsPath)
    ])
    const vertexShader = createAndCompileShader(gl, vd, ShaderType.vertex);
    const fragmentShader = createAndCompileShader(gl, fd, ShaderType.fragment);
    const prog = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(
        "Could not initialise shaders: " + vsPath + ", " + fsPath
      );
    }
    return prog;
  }

  static destroyBuffers(gl, modelData) {
    var gfx = new Gfx(); // singleton
    if (modelData.meshes) {
      modelData.meshes.forEach(function(m) {
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
    Object.keys(gfx.textureCache).forEach(url => {
      var img = gfx.textureCache[url];
      if (img.keepInCache) {
        toKeep.push(url);
      } else {
        if (img.webglTexture) {
          gl.deleteTexture(img.webglTexture);
        }
        gfx.textureCache[url] = null;
      }
    });
    var newCache = {};
    toKeep.forEach(url => {
      newCache[url] = gfx.textureCache[url];
    });
    gfx.textureCache = newCache;
  }

  static flipAxisZ(model) {
    var n = model.vertices.length;
    var coordsPerVertex = 8; // position (3), normal (3), uv (2)
    for (var i = 0; i < n; i += coordsPerVertex) {
      var positionY = model.vertices[i + 1];
      var positionZ = model.vertices[i + 2];
      model.vertices[i + 1] = positionZ;
      model.vertices[i + 2] = -positionY;
      // it seems that the normals of the models I've tested don't need flipping...
    }
  }

  static modelFileToJson(name, url, materialUrls) {
    var ext = Gfx.getModelFileExtension(name, url);
    if (ext === "Obj") {
      return $.get(url).then(data => {
        let json = WavefrontUtils.parseObjWavefront(data);
        json.name = Gfx.getFileNameWithoutExtension(name) + ".json";
        if (
          json.materialFile !== undefined &&
          materialUrls[json.materialFile] !== undefined
        ) {
          return $.get(materialUrls[json.materialFile]).then(mtldata => {
            json.materials = WavefrontUtils.parseMaterial(mtldata);
            return json;
          });
        } else {
          return json;
        }
      });
    } else if (ext === "Dae") {
      return $.get(url, null, null, "text").then(data => {
        const filename = Gfx.getFileNameWithoutExtension(name);
        let json = parseCollada(data, filename + ".png");
        json.name = filename + ".json";
        return json;
      });
    } else if (ext === "Json") {
      return $.getJSON(url);
    }
    return new Promise(() => {
      throw new Error("Unsupported format: " + ext);
    });
  }

  static loadTexture(gl, url, keepInCache, callback) {
    var gfx = new Gfx(); // singleton
    if (gfx.textureCache[url]) {
      if (callback) {
        callback(gfx.textureCache[url]);
      }
      return gfx.textureCache[url];
    }
    var image = new Image();
    image.src = url;
    image.webglTexture = false;
    image.keepInCache = keepInCache;
    image.onload = function(e) {
      var texture = gl.createTexture();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image
      );
      if (VMath.isPowerOf2(image.width) && VMath.isPowerOf2(image.height)) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.NEAREST_MIPMAP_LINEAR
        );
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
      image.webglTexture = texture;
      if (callback) {
        callback(image);
      }
    };
    gfx.textureCache[url] = image;
    return image;
  }

  static getFileNameWithoutExtension(file) {
    const iSlash = file.lastIndexOf("/") + 1;
    const iDot = file.lastIndexOf(".");
    return file.substr(iSlash, iDot - iSlash);
  }

  // returns the extension in Camel case. Eg. Json, Obj
  static getFileExtension(file) {
    const iDot = file.lastIndexOf(".");
    if (iDot < 0) {
      return "";
    }
    const ext = file.substr(iDot + 1).toLowerCase();
    return ext.substr(0, 1).toUpperCase() + ext.substr(1);
  }

  static getModelFileExtension(name, url) {
    var ext = Gfx.getFileExtension(url);
    if (ext === "") {
      ext = Gfx.getFileExtension(name);
    }
    return ext;
  }

  static exportModel(name, url, modelType, materialUrls) {
    const filename = Gfx.getFileNameWithoutExtension(name);
    var onExportSuccess = text => {
      saveAs(
        new Blob([text], {
          type: "text/plain;charset=" + document.characterSet
        }),
        filename + modelType
      );
    };
    return Gfx.modelFileToJson(name, url, materialUrls).then(json => {
      if (modelType === ".obj") {
        WavefrontUtils.exportObjModel(json, onExportSuccess);
      } else if (modelType === ".json") {
        const out = Gfx.modelStringify(json);
        onExportSuccess(out);
      } else {
        throw new Error("Unsupported model type: " + modelType);
      }
    });
  }

  static exportPose(pose, filename) {
    const text = JSON.stringify(pose, null, "  ");
    saveAs(
      new Blob([text], { type: "text/plain;charset=" + document.characterSet }),
      filename + ".json"
    );
  }

  // JSON.stringify generates array that are difficult to read...
  static modelStringify(model) {
    var s = "{\n";
    // JSON.stringify everything but "vertices" and "meshes"
    Object.keys(model).forEach(function(k) {
      if (k !== "vertices" && k !== "meshes") {
        s += '"' + k + '": ' + JSON.stringify(model[k], null, "  ");
        s += ",\n";
      }
    });
    // manually format vertices
    s += '"vertices": [\n';
    for (var i = 0; i < model.vertices.length; i += 8) {
      s += "  " + model.vertices[i];
      s += ", " + model.vertices[i + 1];
      s += ", " + model.vertices[i + 2];
      s += ",    " + model.vertices[i + 3];
      s += ", " + model.vertices[i + 4];
      s += ", " + model.vertices[i + 5];
      s += ",    " + model.vertices[i + 6];
      s += ", " + model.vertices[i + 7];
      if (i + 8 < model.vertices.length) {
        s += ",";
      }
      s += "\n";
    }
    s += "],\n";
    // manually format submeshes (indices)
    s += '"meshes": [\n';
    for (i = 0; i < model.meshes.length; i++) {
      var m = model.meshes[i];
      s += '  {"material": "' + m.material + '",\n';
      s += '  "indices": [\n';
      for (var j = 0; j < m.indices.length; j += 3) {
        // assume triangles
        s += "    " + m.indices[j];
        s += ", " + m.indices[j + 1];
        s += ", " + m.indices[j + 2];
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
    s += "}";
    return s;
  }

  static createQuad(gl) {
    var modelData = {
      vertices: false,
      faces: false,
      vertexBuffer: false,
      indexBuffer: false
    };
    modelData.vertices = [
      // xyz, uv is computed in the shader from xy
      -1, -1, 0,
      -1,  1, 0,
       1, -1, 0,
       1,  1, 0
    ];
    modelData.faces = [0, 2, 1, 3];
    modelData.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, modelData.vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(modelData.vertices),
      gl.STATIC_DRAW
    );
    modelData.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, modelData.indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(modelData.faces),
      gl.STATIC_DRAW
    );
    return modelData;
  }
}
export { Gfx as default };
