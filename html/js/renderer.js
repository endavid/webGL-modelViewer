/* eslint-disable prefer-destructuring */
import GlState from './glState.js';
import Gfx from './gfx.js';
import VMath from './math.js';
import PluginBackground from './pluginBackground.js';
import PluginLitModel from './pluginLitModel.js';
import PluginIntersection from './pluginIntersection.js';
import PluginDots from './pluginDots.js';
import PluginOverlay from './pluginOverlay.js';
import PluginLabels from './pluginLabels.js';
import PluginSkeleton from './pluginSkeleton.js';
import { SunLight } from './lights.js';
import CanvasView from './canvasView.js';

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

// https://stackoverflow.com/a/17130415/1765629
function getMousePos(canvas, evt, viewRect) {
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  const {width, height} = viewRect;
  // normalized coordinates
  const u = x / width;
  const v = 1 - y / height;
  // clip coordinates (-1, 1)
  const clipx = 2 * u - 1;
  const clipy = 2 * v - 1;
  return {
    x, y, u, v, clipx, clipy,
  };
}

class Renderer {
  constructor(canvasId, canvas2dId, whiteUrl) {
    const self = this;
    this.canvas = document.getElementById(canvasId);
    if (canvas2dId) {
      this.canvas2d = document.getElementById(canvas2dId);
      this.context2d = this.canvas2d.getContext('2d');
    }
    const { width, height } = this.canvas;
    const mainWidth = 3 * width / 4;
    const auxWidth = width / 4;
    const auxHeight = height / 3;
    this.views = [
      new CanvasView({x: 0, y: 0, width: mainWidth, height}),
      new CanvasView({x: mainWidth, y: height - auxHeight, width: auxWidth, height: auxHeight}),
      new CanvasView({x: mainWidth, y: height - 2 * auxHeight, width: auxWidth, height: auxHeight}),
      new CanvasView({x: mainWidth, y: 0, width: auxWidth, height: auxHeight})
    ];
    this.mouseState = {
      amortization: 0.06,
      drag: false,
      old_x: 0,
      old_y: 0,
      dX: 0,
      dY: 0,
      theta: 0,
      phi: 0,
      lock: { x: false, y: false },
    };
    this.onRotation = () => {};
    this.onCameraHeight = () => {};
    this.onCameraDistance = () => {};
    this.onJointSelection = () => {};
    // Overwrite this function with your custom stuff
    this.drawModel = () => {};
    this.resources = {
      framebuffers: {},
      renderbuffers: {},
      textures: {},
    };
    this.outputSurface = 'default';
    this.scene = {
      models: [],
      lights: [new SunLight(1, 0.2)],
      labels: {
        world: {
          origin: [0, 0, 0],
        },
        selected: 'new',
        scale: 1,
        showLabels: true,
        showPoints: true,
      },
      settings: {
        debugJointCount: false,
      }
    };
    this.selectionRadiusInPixels = 10;
    this.selectedModel = 0;
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
      PluginBackground.createAsync(gl),
      PluginLitModel.createAsync(gl, this.whiteTexture, false, this.scene),
      PluginDots.createAsync(gl, this.scene),
      PluginOverlay.createAsync(gl),
    ]).then((list) => {
      self.plugins = list;
      self.pluginIndeces = {
        background: 0,
        litModel: 1,
        dots: 2,
        overlay: 3
      };
    });
  }
  initPlugins2d() {
    this.plugins2d = [
      new PluginLabels(),
      new PluginSkeleton()
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
  getPlugin(id) {
    if (this.pluginIndeces) {
      return this.plugins[this.pluginIndeces[id]];
    }
    return null;
  }
  async replaceLitShader(fragmentShaderUri) {
    const { gl } = this.glState;
    var plugin;
    if (fragmentShaderUri.startsWith('intersect')) {
      plugin = await PluginIntersection.createAsync(gl, this.whiteTexture, this.scene);
      if (fragmentShaderUri.endsWith('lit')) {
        plugin.doLightPass = true;
      }
    } else {
      plugin = await PluginLitModel.createAsync(gl, this.whiteTexture, fragmentShaderUri, this.scene);
    }
    this.scene.settings.debugJointCount = fragmentShaderUri.indexOf('JointCount') >= 0;
    this.plugins[this.pluginIndeces.litModel] = plugin;
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
    glState.clear();
    this.views.forEach((view) => {
      const {x, y, width, height} = view.rect;
      glState.viewport(x, y, width, height);
      this.plugins.forEach((plugin) => {
        plugin.draw(glState, scene, view, deltaTime);
      });  
    })
    if (captureNextFrameCallback) {
      const imgData = readPixelsAsImageData(glState.gl, s);
      captureNextFrameCallback(imgData);
      captureNextFrameCallback = null;
    }
    glState.popFramebuffer();
    glState.popRenderbuffer();
    const { camera } = this.views[0];
    this.plugins2d.forEach((plugin) => {
      plugin.draw(context2d, scene, camera, deltaTime);
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
    const midButton = 4;
    const bothLeftAndRight = 3; // for mice without mid button
    const screenCoords = getMousePos(this.canvas, e, this.views[0].rect);
    if (e.buttons === midButton || e.buttons === bothLeftAndRight) {
      this.tryToAddLabelAt(screenCoords);
    } else {
      this.trySelectJoint(screenCoords);
      this.mouseState.drag = true;
      this.mouseState.old_x = e.pageX;
      this.mouseState.old_y = e.pageY;
    }
    e.preventDefault();
    return false;
  }
  mouseUp(e) {
    this.mouseState.drag = false;
    e.preventDefault();
    return false;
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
    } else if (e.buttons === 2) {
      // handle vertical translations
      this.applyTranslationDeltas();
    }
    this.mouseState.old_x = e.pageX;
    this.mouseState.old_y = e.pageY;
    e.preventDefault();
    return false;
  }
  onWheel(e) {
    // eslint-disable-next-line no-nested-ternary
    const direction = e.deltaY === 0 ? 0 : e.deltaY > 0 ? 1 : -1;
    const { camera } = this.views[0];
    const z = camera.distance * (1.0 + 0.1 * direction);
    camera.setLocation(null, camera.height, z);
    // viewMatrix to camera transform => -pos
    this.onCameraDistance(z);
    e.preventDefault();
    return false;
  }
  applyAngleDeltas() {
    const e = 0.001;
    const dX = this.mouseState.lock.x ? 0 : this.mouseState.dX;
    const dY = this.mouseState.lock.y ? 0 : this.mouseState.dY;
    if (Math.abs(dX) > e || Math.abs(dY) > e) {
      this.mouseState.theta = VMath.clampAngleDeg(this.mouseState.theta + 180 * dX);
      this.mouseState.phi = VMath.clampAngleDeg(this.mouseState.phi + 180 * dY);
      this.mouseState.phi = VMath.clamp(this.mouseState.phi, -90, 90);
      this.onRotation([this.mouseState.phi, this.mouseState.theta]);
    }
  }
  applyTranslationDeltas() {
    const { camera } = this.views[0];
    const y = camera.height + this.mouseState.dY * 10;
    camera.setLocation(null, y);
    // viewMatrix to camera transform => -pos
    this.onCameraHeight(y);
  }
  init() {
    const self = this;
    return new Promise((resolve) => {
      // Get WebGL context
      const gl = this.canvas.getContext('webgl', { antialias: true, stencil: true });
      self.initExtensions(gl, ['OES_element_index_uint', 'OES_texture_float']);
      self.glState = new GlState(gl);
      // Register mouse event listeners
      self.canvas.addEventListener('mousedown', self.mouseDown.bind(self), false);
      self.canvas.addEventListener('mouseup', self.mouseUp.bind(self), false);
      self.canvas.addEventListener('mouseout', self.mouseUp.bind(self), false);
      self.canvas.addEventListener('mousemove', self.mouseMove.bind(self), false);
      self.canvas.addEventListener('wheel', self.onWheel.bind(self), false);
      // disable context menu on right-click
      self.canvas.oncontextmenu = e => e.preventDefault();
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
  getCamera(i) {
    const { camera } = this.views[i];
    return camera;
  }
  getSelectedModel() {
    return this.scene.models[this.selectedModel];
  }
  setRotationCallback(callback) {
    this.onRotation = callback;
  }
  setCameraHeightCallback(callback) {
    this.onCameraHeight = callback;
  }
  setCameraDistanceCallback(callback) {
    this.onCameraDistance = callback;
  }
  setJointSelectionCallback(callback) {
    this.onJointSelection = callback;
  }
  setRotationLock(x, y) {
    this.mouseState.lock.x = x;
    this.mouseState.lock.y = y;
  }
  // eslint-disable-next-line object-curly-newline
  setModelTransform({ index, position, rotation, scale }) {
    const i = index || this.selectedModel;
    const model = this.scene.models[i];
    if (model) {
      const p = position || model.transform.position;
      const r = rotation || model.transform.eulerAngles;
      const s = scale || model.transform.scale;
      this.mouseState.phi = r[0];
      this.mouseState.theta = r[1];
      model.transform.scale = s;
      model.transform.eulerAngles = r;
      model.transform.position = p;
    }
  }
  getPositionForLabel(modelIndex, labelId) {
    const model = this.scene.models[modelIndex];
    if (model) {
      const position = model.getPositionForLabel(labelId);
      const { scale } = model.transform;
      const scaled = position.map((a, i) => -a * scale[i]);
      return { position, scaled };
    }
    return null;
  }
  setKeyframe(keyframe) {
    const i = this.selectedModel;
    const model = this.scene.models[i];
    if (model && model.skinnedModel) {
      if (keyframe === -1) {
        model.skinnedModel.applyDefaultPose();
      } else {
        model.skinnedModel.applyPose(keyframe);
      }
    }
  }
  setImage(obj, url, callback) {
    const { gl } = this.glState;
    if (obj.img && obj.img.webglTexture) {
      let tex = obj.img.webglTexture;
      obj.img = null;
      gl.deleteTexture(tex);
    }
    if (!url) {
      if (callback) callback(img);
      return;
    }
    Gfx.loadTexture(gl, url, false, (img) => {
      obj.url = url;
      obj.img = img;
      if (callback) callback(img);
    });
  }
  setBackgroundImage(i, url, callback) {
    const { background } = this.views[i];
    this.setImage(background, url, callback);
  }
  setOverlayImage(i, url, callback) {
    const { overlay } = this.views[i];
    this.setImage(overlay, url, callback);
  }
  setBackgroundColor(rgb) {
    this.glState.setClearColor(rgb);
  }
  setOutputSurface(id) {
    this.outputSurface = id;
  }
  setPointSize(size) {
    this.getPlugin('dots').pointSize = size;
  }
  setPointColor(r, g, b, a) {
    this.getPlugin('dots').tint = [r, g, b, a];
  }
  setLabelScale(scale) {
    this.scene.labels.scale = scale;
  }
  setLabelFilter(filter) {
    this.scene.labelFilter = filter;
  }
  deleteLabel(labelName) {
    const model = this.scene.models[this.selectedModel];
    if (model && model.labels[labelName]) {
      delete model.labels[labelName];
    }
  }
  tryToAddLabelAt(screenCoords) {
    const { selected } = this.scene.labels;
    const { camera } = this.views[0];
    const { clipx, clipy } = screenCoords;
    const ray = camera.rayFromScreenCoordinates(clipx, clipy);
    const model = this.scene.models[this.selectedModel];
    if (model) {
      model.getSurfaceIntersection(ray, (si) => {
        // inverse the transform because it will be applied to the model label
        const p = model.transform.inversePoint(si.point);
        model.labels[selected] = p;
      });
    }
  }
  trySelectJoint(screenCoords) {
    const model = this.scene.models[this.selectedModel];
    if (model && model.skinnedModel && model.skinnedModel.showSkeleton) {
      const { camera } = this.views[0];
      const { width, height } = this.views[0].rect;
      const m = model.getTransformMatrix();
      const {joint, distance} = model.skinnedModel.getClosestJoint(screenCoords, m, camera, width, height);
      if (distance < this.selectionRadiusInPixels) {
        model.skinnedModel.selectedJoint = joint;
        this.onJointSelection(joint);
      }
    }
  }
  getModelLabels(modelIndex) {
    const i = modelIndex || this.selectedModel;
    const model = this.scene.models[i];
    if (!model || !model.labels) {
      return null;
    }
    const transformedLabels = {};
    const names = Object.keys(model.labels);
    const { scale } = this.scene.labels;
    names.forEach((k) => {
      const pos = model.getPositionForLabel(k);
      const [x, y, z] = VMath.mulScalar(pos, scale);
      transformedLabels[k] = {x, y, z};
      if (model.labels[k].disabled) {
        transformedLabels[k].disabled = true;
      }
    });
    return transformedLabels;
  }
  selectSubmesh(name) {
    this.scene.selectedMesh = name === 'all' ? false : name;
  }
  async onSceneUpdate() {
    for (let i = 0; i < this.plugins.length; i++) {
      if (this.plugins[i].onSceneUpdate) {
        await this.plugins[i].onSceneUpdate(this.glState, this.scene);
      }
    }
  }
}
export { Renderer as default };
