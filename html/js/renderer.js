import GlState from './glState.js';
import Gfx from './gfx.js';
import VMath from './math.js';
import PluginLitModel from './pluginLitModel.js';
import PluginDots from './pluginDots.js';
import PluginOverlay from './pluginOverlay.js';
import PluginLabels from './pluginLabels.js';
import { SunLight } from './lights.js';
import Camera from './camera.js';

// private things
let captureNextFrameCallback = null;

function readPixelsAsImageData(gl, surface) {
  const isFloat = surface === 'float';
  const w = gl.drawingBufferWidth;
  const h = gl.drawingBufferHeight;
  let pixels;
  if (isFloat) {
    pixels = new Float32Array(w * h * 4);
  } else {
    pixels = new Uint8Array(w * h * 4);
  }
  const type = isFloat ? gl.FLOAT : gl.UNSIGNED_BYTE;
  gl.readPixels(0, 0, w, h, gl.RGBA, type, pixels);
  let clampedArray;
  if (isFloat) {
    const view = new DataView(new ArrayBuffer(4));
    clampedArray = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < w * h; i += 1) {
      view.setFloat32(0, pixels[4 * i]);
      clampedArray[4 * i] = view.getUint8(0);
      clampedArray[4 * i + 1] = view.getUint8(1);
      clampedArray[4 * i + 2] = view.getUint8(2);
      clampedArray[4 * i + 3] = view.getUint8(3);
    }
  } else {
    clampedArray = new Uint8ClampedArray(pixels);
  }
  const imgData = new ImageData(clampedArray, w, h);
  return imgData;
}

function createFloatFramebuffer(glState, width, height) {
  const { gl } = glState;
  const rb = gl.createRenderbuffer();
  const fb = gl.createFramebuffer();
  const texture = gl.createTexture();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.bindRenderbuffer(gl.RENDERBUFFER, rb);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // can't use LINEAR with FLOAT textures :(
  glState.setTextureParameters(gl.NEAREST, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // attach texture to the framebuffer
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  // check
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    throw new Error('Can\'t use framebuffer');
    // See http://www.khronos.org/opengles/sdk/docs/man/xhtml/glCheckFramebufferStatus.xml
  }
  return { fb, rb, texture };
}

class Renderer {
  constructor(canvasId, canvas2dId, whiteUrl) {
    const self = this;
    this.canvas = document.getElementById(canvasId);
    if (canvas2dId) {
      this.canvas2d = document.getElementById(canvas2dId);
      this.context2d = this.canvas2d.getContext('2d');
    }
    this.mouseState = {
      amortization: 0.06,
      drag: false,
      old_x: 0,
      old_y: 0,
      dX: 0,
      dY: 0,
      theta: 0,
      phi: 0.22,
      lock: { x: false, y: false },
    };
    this.onRotation = () => {};
    this.cameraPosition = { x: 0, y: -100, z: -250 };
    // matrices
    this.projectionMatrix = VMath.getProjection(20, this.canvas.width / this.canvas.height, 1, 400);
    this.modelMatrix = VMath.getI4();
    this.viewMatrix = VMath.getI4();
    // Overwrite this function with your custom stuff
    this.drawModel = () => {};
    this.resources = {
      framebuffers: {},
      renderbuffers: {},
      textures: {},
    };
    this.outputSurface = 'default';
    const aspect = this.canvas.width / this.canvas.height;
    this.scene = {
      camera: new Camera(33.4, aspect, 0.1, 500),
      models: [],
      lights: [new SunLight(1, 0.2)],
      overlay: { alpha: 0.5 },
      labels: {
        world: {
          origin: [0, 0, 0],
        },
        model: {},
      },
    };
    this.plugins = [];
    this.plugins2d = [];
    this.init()
      .then(() => {
        Gfx.loadTexture(self.glState.gl, whiteUrl, true, (img) => {
          self.whiteTexture = img;
          self.initFramebuffers();
          self.initPlugins();
          self.initPlugins2d();
        });
        let timeOld = 0;
        const animate = (time) => {
          const dt = time - timeOld;
          timeOld = time;
          self.movementUpdate();
          self.draw(dt);
          window.requestAnimationFrame(animate); // redraw the scene
        };
        animate(0); // first lunch
      })
      .catch((e) => {
        console.error(e);
      });
  }
  initPlugins() {
    const { gl } = this.glState;
    const self = this;
    Promise.all([
      PluginLitModel.createAsync(gl, this.whiteTexture),
      PluginDots.createAsync(gl),
      PluginOverlay.createAsync(gl),
    ]).then((list) => {
      self.plugins = list;
    });
  }
  initPlugins2d() {
    this.plugins2d = [
      new PluginLabels(),
    ];
  }
  initFramebuffers() {
    this.glState.pushRenderbuffer();
    this.glState.pushFramebuffer();
    const buf = createFloatFramebuffer(this.glState, this.canvas.width, this.canvas.height);
    this.resources.framebuffers.float = buf.fb;
    this.resources.renderbuffers.float = buf.rb;
    this.resources.textures.float = buf.texture;
    this.glState.popFramebuffer();
    this.glState.popRenderbuffer();
  }
  async replaceLitShader(fragmentShaderUri) {
    const { gl } = this.glState;
    const plugin = await PluginLitModel.createAsync(gl, this.whiteTexture, fragmentShaderUri);
    this.plugins[0] = plugin;
  }
  static readImageData() {
    const p = new Promise((resolve, reject) => {
      if (captureNextFrameCallback) {
        reject(new Error('Still waiting for a previous capture'));
      } else {
        captureNextFrameCallback = (imgData) => { resolve(imgData); };
      }
    });
    return p;
  }
  draw(deltaTime) {
    const { glState, scene, context2d } = this;
    const s = this.outputSurface;
    const fb = this.resources.framebuffers[s];
    const rb = this.resources.renderbuffers[s];
    glState.pushRenderbuffer();
    glState.pushFramebuffer();
    if (fb && rb) {
      glState.gl.bindFramebuffer(glState.gl.FRAMEBUFFER, fb);
      glState.gl.bindRenderbuffer(glState.gl.RENDERBUFFER, rb);
    }
    glState.viewport(0, 0, this.canvas.width, this.canvas.height);
    glState.clear();
    this.plugins.forEach((plugin) => {
      plugin.draw(glState, scene, deltaTime);
    });
    if (captureNextFrameCallback) {
      const imgData = readPixelsAsImageData(glState.gl, s);
      captureNextFrameCallback(imgData);
      captureNextFrameCallback = null;
    }
    glState.popFramebuffer();
    glState.popRenderbuffer();
    this.plugins2d.forEach((plugin) => {
      plugin.draw(context2d, scene, deltaTime);
    });
    glState.flush();
  }
  movementUpdate() {
    if (!this.mouseState.drag) {
      this.mouseState.dX *= this.mouseState.amortization;
      this.mouseState.dY *= this.mouseState.amortization;
      this.applyAngleDeltas();
    }
  }
  mouseDown(e) {
    this.mouseState.drag = true;
    this.mouseState.old_x = e.pageX;
    this.mouseState.old_y = e.pageY;
    e.preventDefault();
    return false;
  }
  mouseUp() {
    this.mouseState.drag = false;
  }
  mouseMove(e) {
    if (!this.mouseState.drag) {
      return false;
    }
    this.mouseState.dX = (e.pageX - this.mouseState.old_x) / this.canvas.width;
    this.mouseState.dY = (e.pageY - this.mouseState.old_y) / this.canvas.height;
    if (e.buttons === 1) {
      // handle rotations on left-button drag
      this.applyAngleDeltas();
    } else {
      // handle vertical translations
      this.applyTranslationDeltas();
    }
    this.mouseState.old_x = e.pageX;
    this.mouseState.old_y = e.pageY;
    if (this.onDrag) {
      this.onDrag(this.mouseState);
    }
    e.preventDefault();
  }
  onWheel(e) {
    // eslint-disable-next-line no-nested-ternary
    const direction = e.deltaY === 0 ? 0 : e.deltaY > 0 ? 1 : -1;
    this.cameraPosition.z *= 1.0 + 0.1 * direction;
    e.preventDefault();
  }
  applyAngleDeltas() {
    const e = 0.001;
    const dX = this.mouseState.lock.x ? 0 : this.mouseState.dX;
    const dY = this.mouseState.lock.y ? 0 : this.mouseState.dY;
    if (Math.abs(dX) > e || Math.abs(dY) > e) {
      this.mouseState.theta = VMath.clampAngle(this.mouseState.theta + Math.PI * dX);
      this.mouseState.phi = VMath.clampAngle(this.mouseState.phi + Math.PI * dY);
      this.mouseState.phi = VMath.clamp(this.mouseState.phi, -Math.PI * 0.5, Math.PI * 0.5);
      this.onRotation(this.mouseState.phi, this.mouseState.theta);
    }
  }
  applyTranslationDeltas() {
    this.cameraPosition.y += this.mouseState.dY * 100;
  }
  init() {
    const self = this;
    return new Promise((resolve) => {
      // Get WebGL context
      const gl = this.canvas.getContext('webgl', { antialias: true });
      self.initExtensions(gl, ['OES_element_index_uint', 'OES_texture_float']);
      self.glState = new GlState(gl);
      // Register mouse event listeners
      self.canvas.addEventListener('mousedown', self.mouseDown.bind(self), false);
      self.canvas.addEventListener('mouseup', self.mouseUp.bind(self), false);
      self.canvas.addEventListener('mouseout', self.mouseUp.bind(self), false);
      self.canvas.addEventListener('mousemove', self.mouseMove.bind(self), false);
      self.canvas.addEventListener('wheel', self.onWheel.bind(self), false);
      resolve();
    });
  }
  initExtensions(gl, list) {
    const self = this;
    this.extensions = {};
    list.forEach((e) => {
      const ext = gl.getExtension(e);
      if (!ext) {
        console.error(`Failed to get extension: ${e}`);
      } else {
        self.extensions[e] = ext;
      }
    });
  }
  setRotationCallback(callback) {
    this.onRotation = callback;
  }
  setRotationLock(x, y) {
    this.mouseState.lock.x = x;
    this.mouseState.lock.y = y;
  }
  setModelRotationAndScale(index, rx, ry, scale) {
    this.mouseState.phi = rx;
    this.mouseState.theta = ry;
    const model = this.scene.models[index];
    if (model) {
      VMath.setScale4(model.transformMatrix, scale);
      VMath.rotateY(model.transformMatrix, ry);
      VMath.rotateX(model.transformMatrix, rx);
    }
  }
  setKeyframe(index, keyframe) {
    const model = this.scene.models[index];
    if (model && model.skinnedModel) {
      if (keyframe === -1) {
        model.skinnedModel.applyDefaultPose();
      } else {
        model.skinnedModel.applyPose(keyframe);
      }
    }
  }
  setOverlayImage(url, callback) {
    const { overlay } = this.scene;
    const { gl } = this.glState;
    Gfx.loadTexture(gl, url, true, (img) => {
      overlay.url = url;
      overlay.img = img;
      if (callback) {
        callback(img);
      }
    });
  }
  setBackgroundColor(rgb) {
    this.glState.setClearColor(rgb);
  }
  setOutputSurface(id) {
    this.outputSurface = id;
  }
}
export { Renderer as default };
