import GlState from './glState.js';
import GFX from './libs.js';
import MATH from './math.js';
import PluginLitModel from './pluginLitModel.js';
import PluginOverlay from './pluginOverlay.js';
import PluginLabels from './pluginLabels.js';
import {SunLight} from './lights.js';
import Camera from './camera.js';

class Renderer {
  constructor(canvasId, canvas2dId, whiteUrl) {
    var self = this;
    this.canvas = document.getElementById(canvasId);
    if (canvas2dId) {
      this.canvas2d = document.getElementById(canvas2dId);
      this.context2d = this.canvas2d.getContext("2d");
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
      lock: {x: false, y: false}
    };
    this.onRotation = () => {};
    this.cameraPosition = { x: 0, y: -100, z: -250 };
    // matrices
    this.projectionMatrix = MATH.getProjection(20, this.canvas.width / this.canvas.height, 1, 400);
    this.modelMatrix = MATH.getI4();
    this.viewMatrix = MATH.getI4();
    // Overwrite this function with your custom stuff
    this.drawModel = function () {
    };
    this.resources = {};
    const aspect = this.canvas.width / this.canvas.height;
    this.scene = {
      camera: new Camera(33.4, aspect, 0.1, 500),
      models: [],
      lights: [new SunLight(1, 0.2)],
      overlay: {alpha: 0.5},
      labels: {
        world: {
          origin: [0, 0, 0]
        },
        model: {}
      }
    };
    this.plugins = [];
    this.plugins2d = [];
    this.init().then(() => {
      GFX.loadTexture(self.glState.gl, whiteUrl, true, (img) => {
        self.whiteTexture = img;
        self.initPlugins();
        self.initPlugins2d();
      });
      let timeOld = 0;
      let animate = function (time) {
        var dt = time - timeOld;
        timeOld = time;
        self.movementUpdate();
        self.draw(dt);
        window.requestAnimationFrame(animate); // redraw the scene
      };
      animate(0); // first lunch
    })
    .catch(e => {
      console.error(e);
    });
  }
  initPlugins() {
    const gl = this.glState.gl;
    var self = this;
    Promise.all([
      PluginLitModel.createAsync(gl, this.whiteTexture),
      PluginOverlay.createAsync(gl)
    ]).then((list) => {
      self.plugins = list;
    });
  }
  initPlugins2d() {
    this.plugins2d = [
      new PluginLabels()
    ];
  }
  draw(deltaTime) {
    const glState = this.glState;
    const scene = this.scene;
    glState.viewport(0, 0, this.canvas.width, this.canvas.height);
    glState.clear();
    this.plugins.forEach(plugin => {
      plugin.draw(glState, scene, deltaTime);
    });
    const ctx = this.context2d; 
    this.plugins2d.forEach(plugin => {
      plugin.draw(ctx, scene, deltaTime);
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
  mouseUp(e) {
    this.mouseState.drag = false;
  }
  mouseMove(e) {
    if (!this.mouseState.drag)
      return false;
    this.mouseState.dX = (e.pageX - this.mouseState.old_x) / this.canvas.width;
    this.mouseState.dY = (e.pageY - this.mouseState.old_y) / this.canvas.height;
    if (e.buttons === 1) {
      // handle rotations on left-button drag
      this.applyAngleDeltas();
    }
    else {
      // handle vertical translations
      this.applyTranslationDeltas();
    }
    this.mouseState.old_x = e.pageX;
    this.mouseState.old_y = e.pageY;
    if (self.onDrag) {
      this.onDrag(self.mouseState);
    }
    e.preventDefault();
  }
  onWheel(e) {
    const direction = e.deltaY === 0 ? 0 : e.deltaY > 0 ? 1 : -1;
    this.cameraPosition.z *= 1.0 + 0.1 * direction;
    e.preventDefault();
  }
  applyAngleDeltas() {
    const e = 0.001;
    const dX = this.mouseState.lock.x ? 0 : this.mouseState.dX;
    const dY = this.mouseState.lock.y ? 0 : this.mouseState.dY;
    if (Math.abs(dX) > e || Math.abs(dY) > e) {
      this.mouseState.theta = MATH.clampAngle(this.mouseState.theta + Math.PI * dX);
      this.mouseState.phi = MATH.clampAngle(this.mouseState.phi + Math.PI * dY);
      this.mouseState.phi = MATH.clamp(this.mouseState.phi, -Math.PI * 0.5, Math.PI * 0.5);
      this.onRotation(this.mouseState.phi, this.mouseState.theta);
    }
  }
  applyTranslationDeltas() {
    this.cameraPosition.y += this.mouseState.dY * 100;
  }
  init() {
    var self = this;
    return new Promise(resolve => {
      // Get WebGL context
      let gl = this.canvas.getContext("experimental-webgl", { antialias: true });
      self.initExtensions(gl, ["OES_element_index_uint"]);
      self.glState = new GlState(gl);
      //this.resources = new Resources(gl, this.canvas.width, this.canvas.height);
      // Register mouse event listeners
      self.canvas.addEventListener("mousedown", self.mouseDown.bind(self), false);
      self.canvas.addEventListener("mouseup", self.mouseUp.bind(self), false);
      self.canvas.addEventListener("mouseout", self.mouseUp.bind(self), false);
      self.canvas.addEventListener("mousemove", self.mouseMove.bind(self), false);
      self.canvas.addEventListener("wheel", self.onWheel.bind(self), false);
      resolve();
    });
  }
  initExtensions(gl, list) {
    var self = this;
    this.extensions = {};
    list.forEach(e => {
      const ext = gl.getExtension(e);
      if (!ext) {
        console.error("Failed to get extension: " + e);
      }
      else {
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
    var model = this.scene.models[index];
    if (model) {
      MATH.setScale4(model.transformMatrix, scale);
      MATH.rotateY(model.transformMatrix, ry);
      MATH.rotateX(model.transformMatrix, rx);  
    }
  }
  setKeyframe(index, keyframe) {
    var model = this.scene.models[index];
    if (model && model.skinnedModel) {
      if (keyframe === -1) {
        model.skinnedModel.applyDefaultPose();
      } else {
        model.skinnedModel.applyPose(keyframe);
      }
    }
  }
  setOverlayImage(url, callback) {
    var overlay = this.scene.overlay;
    const gl = this.glState.gl;
    GFX.loadTexture(gl, url, true, img => {
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
}
export {Renderer as default};


