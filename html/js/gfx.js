import $ from './jquery.module.js';
import VMath from './math.js';
import WavefrontObj from './wavefrontObj.js';
import Collada from './collada.js';
import PamEncoder from './pamencoder.js';
import MemoryLayout from './memoryLayout.js';

// Unfortunately, I wasn't able to import saveAs as a module
const { saveAs } = window;

const ShaderType = {
  fragment: 'x-shader/x-fragment',
  vertex: 'x-shader/x-vertex',
};

function createAndCompileShader(gl, shaderCode, shaderType) {
  let shader;
  if (shaderType === ShaderType.fragment) {
    shader = gl.createShader(gl.FRAGMENT_SHADER);
  } else if (shaderType === ShaderType.vertex) {
    shader = gl.createShader(gl.VERTEX_SHADER);
  } else {
    throw new Error(`Unknown shader type: ${shaderType}`);
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
    const { instance } = this.constructor;
    if (instance) {
      return instance;
    }
    this.constructor.instance = this;
    this.textureCache = {};
  }

  // Eg. Gfx.useShader(gl, 'shaders/main.vs', 'shaders/main.fs');
  // Returns a promise
  static async useShader(gl, vsPath, fsPath, vsConstants) {
    // eslint-disable-next-line prefer-const
    let [vd, fd] = await Promise.all([
      $.get(vsPath), $.get(fsPath),
    ]);
    if (vsConstants) {
      let vertexConstants = '';
      Object.keys(vsConstants).forEach((k) => {
        vertexConstants += `${k} = ${vsConstants[k]};\n`;
      });
      vd = vertexConstants + vd;
    }
    const vertexShader = createAndCompileShader(gl, vd, ShaderType.vertex);
    const fragmentShader = createAndCompileShader(gl, fd, ShaderType.fragment);
    const prog = gl.createProgram();
    gl.attachShader(prog, vertexShader);
    gl.attachShader(prog, fragmentShader);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(`Could not init shaders: ${vsPath}, ${fsPath}`);
    }
    return prog;
  }

  static destroyBuffers(gl, modelData) {
    const gfx = new Gfx(); // singleton
    const modelRef = modelData;
    const images = [];
    if (modelData.meshes) {
      modelData.meshes.forEach((m) => {
        const mesh = m;
        // remove img reference
        mesh.albedoMap = null;
        gl.deleteBuffer(m.indexBuffer);
        images.push(m.albedoUrl);
      });
      modelRef.meshes = false;
    }
    if (modelData.vertexBuffer) {
      gl.deleteBuffer(modelData.vertexBuffer);
      modelRef.vertexBuffer = false;
    }
    if (modelData.dotBuffer) {
      gl.deleteBuffer(modelData.dotBuffer);
      modelRef.dotBuffer = false;
    }
    // empty texture cache
    images.forEach((img) => {
      const cacheRef = gfx.textureCache[img];
      if (cacheRef && !cacheRef.keepInCache) {
        if (cacheRef.webglTexture) {
          gl.deleteTexture(cacheRef.webglTexture);
        }
        gfx.textureCache[img] = null;
      }
    });
  }

  static modelFileToJson(name, url, materialUrls) {
    const ext = Gfx.getModelFileExtension(name, url);
    if (ext === 'Obj') {
      return $.get(url).then((data) => {
        const json = WavefrontObj.parse(data);
        json.name = `${Gfx.getFileNameWithoutExtension(name)}.json`;
        if (
          json.materialFile !== undefined
          && materialUrls[json.materialFile] !== undefined
        ) {
          return $.get(materialUrls[json.materialFile]).then((mtldata) => {
            json.materials = WavefrontObj.parseMaterial(mtldata);
            return json;
          });
        }
        return json;
      });
    }
    if (ext === 'Dae') {
      return $.get(url, null, null, 'text').then((data) => {
        const filename = Gfx.getFileNameWithoutExtension(name);
        const json = Collada.parse(data, `${filename}.png`);
        json.name = `${filename}.json`;
        return json;
      });
    }
    if (ext === 'Json') {
      return $.getJSON(url);
    }
    return new Promise(() => {
      throw new Error(`Unsupported format: ${ext}`);
    });
  }

  static loadTexture(gl, url, keepInCache, callback) {
    const gfx = new Gfx(); // singleton
    if (gfx.textureCache[url]) {
      if (callback) {
        callback(gfx.textureCache[url]);
      }
      return gfx.textureCache[url];
    }
    const image = new Image();
    image.src = url;
    image.webglTexture = false;
    image.keepInCache = keepInCache;
    image.onload = () => {
      const texture = gl.createTexture();
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        image,
      );
      if (VMath.isPowerOf2(image.width) && VMath.isPowerOf2(image.height)) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.NEAREST_MIPMAP_LINEAR,
        );
        gl.generateMipmap(gl.TEXTURE_2D);
      } else {
        console.warn(`NPOT texture: ${image.width}x${image.height}`);
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
    const iSlash = file.lastIndexOf('/') + 1;
    const iDot = file.lastIndexOf('.');
    return file.substr(iSlash, iDot - iSlash);
  }

  // returns the extension in Camel case. Eg. Json, Obj
  static getFileExtension(file) {
    const iSlash = file.lastIndexOf('/') + 1;
    const filename = file.substr(iSlash);
    const iDot = filename.lastIndexOf('.');
    if (iDot < 0) {
      return '';
    }
    const ext = filename.substr(iDot + 1).toLowerCase();
    return ext.substr(0, 1).toUpperCase() + ext.substr(1);
  }

  static getModelFileExtension(name, url) {
    let ext = Gfx.getFileExtension(url);
    if (ext === '') {
      ext = Gfx.getFileExtension(name);
    }
    return ext;
  }

  static exportModel(name, url, modelType, materialUrls, submeshes = []) {
    const filename = Gfx.getFileNameWithoutExtension(name);
    const onExportSuccess = (text) => {
      const t = `text/plain;charset=${document.characterSet}`;
      saveAs(
        new Blob([text], { type: t }),
        filename + modelType,
      );
    };
    return Gfx.modelFileToJson(name, url, materialUrls).then((json) => {
      if (modelType === '.obj') {
        WavefrontObj.export(json, submeshes, onExportSuccess);
      } else if (modelType === '.json') {
        const out = Gfx.modelStringify(json);
        onExportSuccess(out);
      } else {
        throw new Error(`Unsupported model type: ${modelType}`);
      }
    });
  }

  static saveJson(object, filename) {
    const text = JSON.stringify(object, null, '  ');
    const t = `text/plain;charset=${document.characterSet}`;
    saveAs(
      new Blob([text], { type: t }),
      `${filename}.json`,
    );
  }

  static formatArray(array, prefix, columns) {
    let out = '';
    for (let i = 0; i < array.length; i += columns) {
      let s = `${prefix}${array[i]}`;
      for (let j = 1; j < columns; j += 1) {
        s += `, ${array[i + j]}`;
      }
      if (i + columns < array.length) {
        s += ',';
      }
      out += `${s}\n`;
    }
    return out;
  }

  // JSON.stringify generates array that are difficult to read...
  static modelStringify(model) {
    let s = '{\n';
    // JSON.stringify everything but "dataArrays" and "meshes"
    Object.keys(model).forEach((k) => {
      if (k !== 'dataArrays' && k !== 'meshes') {
        const json = JSON.stringify(model[k], null, '  ');
        s += `"${k}": ${json}`;
        s += ',\n';
      }
    });
    // manually format dataArrays
    const layout = MemoryLayout.skinnedVertexLayout();
    s += '"dataArrays": {\n';
    const strArrays = Object.keys(model.dataArrays).map((attribute) => {
      let str = `  "${attribute}": [\n`;
      str += Gfx.formatArray(model.dataArrays[attribute], '    ', layout.counts[attribute]);
      str += '  ]';
      return str;
    });
    s += strArrays.join(',\n');
    s += '\n},\n';
    // manually format submeshes (indices)
    s += '"meshes": [\n';
    for (let i = 0; i < model.meshes.length; i += 1) {
      const m = model.meshes[i];
      s += `  {"material": "${m.material}",\n`;
      s += '  "indices": [\n';
      // assume triangles
      s += Gfx.formatArray(m.indices, '    ', 3);
      s += '  ]}';
      if (i + 1 < model.meshes.length) {
        s += ',';
      }
      s += '\n';
    }
    s += ']\n';
    s += '}';
    return s;
  }

  static createQuad(gl) {
    const modelData = {
      vertices: false,
      faces: false,
      vertexBuffer: false,
      indexBuffer: false,
    };
    modelData.vertices = [
      // xyz, uv is computed in the shader from xy
      -1, -1, 0,
      -1, +1, 0,
      +1, -1, 0,
      +1, +1, 0,
    ];
    modelData.faces = [0, 2, 1, 3];
    modelData.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, modelData.vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(modelData.vertices),
      gl.STATIC_DRAW,
    );
    modelData.indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, modelData.indexBuffer);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(modelData.faces),
      gl.STATIC_DRAW,
    );
    return modelData;
  }

  static createImageFromImageData(imageData, callback) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    ctx.putImageData(imageData, 0, 0);
    // https://stackoverflow.com/a/41970080
    // because we may have transparency
    ctx.globalCompositeOperation = 'copy';
    ctx.scale(1, -1); // Y flip
    ctx.translate(0, -imageData.height); // so we can draw at 0,0
    ctx.drawImage(canvas, 0, 0);
    const image = new Image();
    image.onload = () => { callback(image); };
    image.src = canvas.toDataURL();
  }

  static decodeR32FPng(png) {
    const numPixels = png.width * png.height;
    const outArray = [];
    const buf = new ArrayBuffer(4);
    const view = new DataView(buf);
    for (let i = 0; i < numPixels; i += 1) {
      const r = png.pixels[4 * i];
      const g = png.pixels[4 * i + 1];
      const b = png.pixels[4 * i + 2];
      const a = png.pixels[4 * i + 3];
      view.setUint8(0, a);
      view.setUint8(1, r);
      view.setUint8(2, g);
      view.setUint8(3, b);
      outArray.push(view.getFloat32(0));
    }
    return outArray;
  }

  // Use ImageMagick to convert the PAM file to a RGBA PNG file,
  // > convert depth.pam png32:depth3.png
  static savePamFile(imgData, filename) {
    const opt = { flipY: true, shiftAlpha: true };
    const pam = new PamEncoder(imgData.data, imgData.width, imgData.height, opt);
    const bytes = new Uint8Array(pam.rawBuffer);
    saveAs(
      new Blob([bytes], { type: 'octet.stream' }),
      filename,
    );
  }

  // https://bocoup.com/blog/counting-uniforms-in-webgl
  // To check the capabilities of your browser: https://webglreport.com/
  // Windows FireFox seems to be using ANGLE D3D11, so it lets you use
  // more uniforms than Windows Chrome. No limits on macOS.
  // Also https://stackoverflow.com/a/51628844
  static getProgramInfo(gl, program) {
    const result = {
      attributes: [],
      uniforms: [],
      attributeCount: 0,
      uniformCount: 0,
    };
    const activeUniforms = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    const activeAttributes = gl.getProgramParameter(program, gl.ACTIVE_ATTRIBUTES);

    // Taken from the WebGl spec:
    // http://www.khronos.org/registry/webgl/specs/latest/1.0/#5.14
    const enums = {
      0x8B50: 'FLOAT_VEC2',
      0x8B51: 'FLOAT_VEC3',
      0x8B52: 'FLOAT_VEC4',
      0x8B53: 'INT_VEC2',
      0x8B54: 'INT_VEC3',
      0x8B55: 'INT_VEC4',
      0x8B56: 'BOOL',
      0x8B57: 'BOOL_VEC2',
      0x8B58: 'BOOL_VEC3',
      0x8B59: 'BOOL_VEC4',
      0x8B5A: 'FLOAT_MAT2',
      0x8B5B: 'FLOAT_MAT3',
      0x8B5C: 'FLOAT_MAT4',
      0x8B5E: 'SAMPLER_2D',
      0x8B60: 'SAMPLER_CUBE',
      0x1400: 'BYTE',
      0x1401: 'UNSIGNED_BYTE',
      0x1402: 'SHORT',
      0x1403: 'UNSIGNED_SHORT',
      0x1404: 'INT',
      0x1405: 'UNSIGNED_INT',
      0x1406: 'FLOAT',
    };

    // Loop through active uniforms
    for (let i = 0; i < activeUniforms; i += 1) {
      const uniform = gl.getActiveUniform(program, i);
      result.uniforms.push({
        name: uniform.name,
        size: uniform.size,
        type: enums[uniform.type],
      });
      result.uniformCount += uniform.size;
    }

    // Loop through active attributes
    for (let i = 0; i < activeAttributes; i += 1) {
      const attribute = gl.getActiveAttrib(program, i);
      result.attributes.push({
        name: attribute.name,
        size: attribute.size,
        type: enums[attribute.type],
      });
      result.attributeCount += attribute.size;
    }

    return result;
  }
}
export { Gfx as default };
