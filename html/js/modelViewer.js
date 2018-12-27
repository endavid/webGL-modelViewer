(function(global) {
  "use strict";

  var ViewParameters = {
    model: {
      name: "pear.json",
      uri: "resources/pear.json",
    },
    labels: {
      world: {
        origin: [0, 0, 0]
      },
      model: {}
    },
    imageUris: {
      "banana.png": "resources/banana.png",
      "orange.png": "resources/orange.png",
      "pear.png": "resources/pear.png",
      "white": "resources/white.png",
      "missing": "resources/UVTextureChecker4096.png"
    },
    materialUris: {
    },
    overlayImage: null,
    overlayAlpha: 0.5,
    isZAxisUp: false,
    isLockRotationY: false,
    isLockRotationX: false,
    modelRotationTheta: 0,
    modelRotationPhi: 0,
    modelScale: 1,
    cameraDistance: 6,
    cameraHeight: 0.7,
    cameraPitch: 0,
    cameraFOV: 33.4,
    needsReload: false,
    keyframe: -1,
    backgroundColor: 0x3d4d4d,
    onRotation: function() {},
    onModelLoad: function() {},
    onChangeKeyframe: function() {},
    getSunAltitude: function() { return Light.altitude; },
    getSunEastWest: function() { return Light.eastWest; },
    setSunAltitude: function(value) {
      Light.altitude = value;
      Light.updateDirection();
    },
    setSunEastWest: function(value) {
      Light.eastWest = value;
      Light.updateDirection();
    },
    addPose: function(pose) {
      if (modelData.skinnedModel) {
        modelData.skinnedModel.addPose(pose);
        ViewParameters.onModelLoad(modelData);
      } else {
        ViewParameters.warn("No skinned model");
      }
    },
    addJointRotationOrder: function(jro) {
      if (modelData.skinnedModel) {
        modelData.skinnedModel.updateJointRotationOrder(jro.jointRotationOrder);
      } else {
        ViewParameters.warn("No skinned model");
      }
    },
    saveCurrentPose: function() {
      if (modelData.skinnedModel) {
        var frame = ViewParameters.keyframe;
        var pose = modelData.skinnedModel.getPoseFile(frame);
        var fn = GFX.getFileNameWithoutExtension(ViewParameters.model.name);
        GFX.exportPose(pose, fn + "_" + frame);
      } else {
        ViewParameters.warn("No skinned model");
      }
    },
    warn: function(text) {
      console.warn(text);
    },
    info: function(text) {
      console.log(text);
    }
  };

  var Light = {
    altitude: 1,
    eastWest: 0.2,
    updateDirection: function() {
        Light.direction = MATH.normalize([Light.eastWest, Light.altitude, 1.0]);
    },
  };
  Light.updateDirection();
  // ------------------------------------
  // model data
  // ------------------------------------
  var modelData = {
    modelURL: "",
    vertexBuffer: false,
    meshes: false
  };

  class Shader {
    constructor(gl, vs, fs, attribs, uniforms) {
      var self = this;
      self.attribs = {};
      self.uniforms = {};
      GFX.useShader(gl, vs, fs, function (shaderProgram) {
        self.program = shaderProgram;
        attribs.forEach(function (a) {
          self.attribs[a] = gl.getAttribLocation(self.program, a);
        });
        uniforms.forEach(function (u) {
          self.uniforms[u] = gl.getUniformLocation(self.program, u);
        });
      });
    }
    enableVertexAttributes(gl) {
      const attribKeys = Object.keys(this.attribs);
      for (let i = 0; i < attribKeys.length; i++) {
        gl.enableVertexAttribArray(this.attribs[attribKeys[i]]);
      }
    }
    disableVertexAttributes(gl) {
      const attribKeys = Object.keys(this.attribs);
      for (let i = 0; i < attribKeys.length; i++) {
        gl.disableVertexAttribArray(this.attribs[attribKeys[i]]);
      }
    }
    use(gl) {
      gl.useProgram(this.program);
      this.enableVertexAttributes(gl);
    }
    disable(gl) {
      this.disableVertexAttributes(gl);
    }
  }

  // ============================================
  /// Class to init resources
  class Resources {
    constructor(gl, width, height) {
      this.gl = gl;
      this.width = width;
      this.height = height;
      this.quad = GFX.createQuad(gl);
      this.initExtensions(["OES_element_index_uint"]);
      this.initShaders();
    }
    ready() {
      return this.shaders.lit.program;
    }
    initExtensions(list) {
      var self = this;
      this.extensions = {};
      list.forEach(function (e) {
        const ext = self.gl.getExtension(e);
        if (!ext) {
          console.error("Failed to get extension: " + e);
        }
        else {
          self.extensions[e] = ext;
        }
      });
    }
    initShaders() {
      this.shaders = {
        lit: new Shader(this.gl, "shaders/geometry.vs", "shaders/lighting.fs", ["uv", "position", "normal"], ["Pmatrix", "Vmatrix", "Mmatrix", "lightDirection", "sampler"]),
        litSkin: new Shader(this.gl, "shaders/skinning.vs", "shaders/lighting.fs", ["uv", "position", "normal", "boneWeights", "boneIndices"], ["Pmatrix", "Vmatrix", "Mmatrix", "lightDirection", "sampler", "joints"]),
        colour: new Shader(this.gl, "shaders/fullscreen.vs", "shaders/colour.fs", ["position"], ["scale", "offset", "colourTransform", "colourBias"])
      };
    }
    setDefaultTextureParameters() {
      const gl = this.gl;
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); // can't use LINEAR with FLOAT textures :(
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    setOverlayParameters() {
      const gl = this.gl;
      const shader = this.shaders.colour;
      gl.uniform2f(shader.uniforms.scale, 1, 1);
      gl.uniform2f(shader.uniforms.offset, 0, 0);
      gl.uniform4f(shader.uniforms.colourBias, 0, 0, 0, 0);
      const t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, ViewParameters.overlayAlpha];
      gl.uniformMatrix4fv(shader.uniforms.colourTransform, false, t);
    }
    drawFullScreenQuad() {
      const gl = this.gl;
      const shader = this.shaders.colour;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad.vertexBuffer);
      gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false, 4 * 3, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quad.indexBuffer);
      gl.drawElements(gl.TRIANGLE_STRIP, this.quad.faces.length, gl.UNSIGNED_SHORT, 0);
    }
    setOpaquePass() {
      const gl = this.gl;
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(true); // enable ZWRITE
      gl.enable(gl.CULL_FACE); // cull back faces
      gl.disable(gl.BLEND);
    }
    setBlendPass() {
      const gl = this.gl;
      gl.disable(gl.DEPTH_TEST);
      gl.depthMask(false); // disable ZWRITE
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.BLEND);
      gl.blendEquationSeparate(gl.FUNC_ADD, gl.FUNC_ADD);
      gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    }
  }

  // https://webglfundamentals.org/webgl/lessons/webgl-text-canvas2d.html
  function drawLabel(ctx, pixelX, pixelY, label) {
    // save all the canvas settings
    ctx.save();
    // translate the canvas origin so 0, 0 is at
    // the top front right corner of our F
    ctx.translate(pixelX, pixelY);
    // draw an arrow
    ctx.beginPath();
    ctx.moveTo(10, 5);
    ctx.lineTo(0, 0);
    ctx.lineTo(5, 10);
    ctx.moveTo(0, 0);
    ctx.lineTo(15, 15);
    ctx.stroke();
    // draw the text.
    ctx.fillText(label, 20, 20);
    // restore the canvas to its old settings.
    ctx.restore();
  }

  function drawAllLabels(ctx, projectionMatrix, viewMatrix, modelMatrix, canvasWidth, canvasHeight) {
    var labels = ViewParameters.labels;
    function worldToPixels(world) {
      var view = MATH.mulVector(viewMatrix, world);
      var clip = MATH.mulVector(projectionMatrix, view);
      clip[0] /= clip[3]; clip[1] /= clip[3];
      // convert from clipspace to pixels
      return [(clip[0] *  0.5 + 0.5) * canvasWidth, (clip[1] * -0.5 + 0.5) * canvasHeight];
    }
    Object.keys(labels.world).forEach(function (k) {
      var pos = labels.world[k];
      pos[3] = 1;
      var pix = worldToPixels(pos);
      drawLabel(ctx, pix[0], pix[1], k);
    });
    Object.keys(labels.model).forEach(function (k) {
      var pos = labels.model[k];
      pos[3] = 1;
      var world = MATH.mulVector(modelMatrix, pos);
      var pix = worldToPixels(world);
      drawLabel(ctx, pix[0], pix[1], k);
    });
  }

  // ============================================
  var main = function()
  {
    var canvas = document.getElementById("glCanvas");
    var textCanvas = document.getElementById("text");
    var ctx = textCanvas.getContext("2d");

    // -------------------------------------------------
    // capture mouse events
    // -------------------------------------------------
    var amortization=0.95;
    var drag=false;
    var old_x, old_y;
    var dX=0, dY=0;

    var updateViewRotation = function(dX, dY) {
      if (!ViewParameters.isLockRotationY) {
        ViewParameters.modelRotationTheta += dX;
      }
      if (!ViewParameters.isLockRotationX) {
        ViewParameters.modelRotationPhi += dY;
      }
      if (!ViewParameters.isLockRotationX && !ViewParameters.isLockRotationY) {
        if (Math.abs(dX) > 0.001 || Math.abs(dY) > 0.001) {
          ViewParameters.onRotation();
        }
      }
    };

    var mouseDown=function(e) {
      drag=true;
      old_x=e.pageX;
      old_y=e.pageY;
      e.preventDefault();
      return false;
    };

    var mouseUp=function(e){
      drag=false;
    };

    var mouseMove=function(e) {
      if (!drag) return false;
      dX=(e.pageX-old_x)*Math.PI/canvas.width;
      dY=(e.pageY-old_y)*Math.PI/canvas.height;
      updateViewRotation(dX, dY);
      old_x=e.pageX;
      old_y=e.pageY;
      e.preventDefault();
    };

    canvas.addEventListener("mousedown", mouseDown, false);
    canvas.addEventListener("mouseup", mouseUp, false);
    canvas.addEventListener("mouseout", mouseUp, false);
    canvas.addEventListener("mousemove", mouseMove, false);

    // -------------------------------------------------
    // Get WebGL context
    // -------------------------------------------------
    var gl;
    try {
      gl = canvas.getContext("experimental-webgl", {
        antialias: true,
        // set it to true to be able to take screen captures
        preserveDrawingBuffer: false
      });
    } catch (e) {
      alert("Your browser is not WebGL compatible :(");
      return false;
    }
    // ------------------------------------
    // Resources
    // ------------------------------------
    var res = new Resources(gl, canvas.width, canvas.height);
    var whiteTexture = GFX.loadTexture(gl, ViewParameters.imageUris.white, true /* keep in textureCache forever */);
    var overlay = {
      uri: null,
      texture: null
    };

    GFX.loadModel(gl, ViewParameters, modelData, function() {animate(0);});

    // ------------------------------------
    // matrices
    // ------------------------------------
    var fov = ViewParameters.cameraFOV;
    var near = 0.1;
    var far = 500;
    var aspect = canvas.width / canvas.height;
    var projectionMatrix = MATH.getProjection(fov, aspect, near, far);
    var modelMatrix = MATH.getI4();
    var viewMatrix = MATH.getI4();

    // --------------------------------------------
    // Drawing
    // --------------------------------------------

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#ffffff";
    var clearColor = MATH.rgbToFloat(ViewParameters.backgroundColor);
    gl.clearColor(clearColor[0], clearColor[1], clearColor[2], 1);
    gl.clearDepth(1.0);
    var time_old=0;
    var keyframe = -1;
    var animate = function(time)
    {
      var dt=time-time_old;
      time_old=time;

      if (ViewParameters.model.uri !== modelData.modelURL || ViewParameters.needsReload) {
        ViewParameters.needsReload = false;
        GFX.loadModel(gl, ViewParameters, modelData, function() {
          console.log("Loaded: "+modelData.modelURL);
          ViewParameters.onModelLoad(modelData);
        });
      }
      if (ViewParameters.overlayImage !== overlay.uri) {
        GFX.loadTexture(gl, ViewParameters.overlayImage, true, function(img) {
          overlay.uri = ViewParameters.overlayImage;
          overlay.texture = img;
          var aspect = img.height / img.width;
          var sizeinfo = img.width + "×" + img.height;
          if (Math.abs(aspect - 1.5) > 0.01) {
            ViewParameters.warn("Overlay aspect should be 2:3 but loaded image is " + sizeinfo);
          } else {
            ViewParameters.info("Overlay size: " + sizeinfo);
          }
        });
      }
      if (!drag) {
        dX*=amortization;
        dY*=amortization;
        updateViewRotation(dX, dY);
      }
      if (Math.abs(ViewParameters.cameraFOV - fov) > 0.001) {
        fov = ViewParameters.cameraFOV;
        projectionMatrix = MATH.getProjection(fov, aspect, near, far);
      }
      MATH.setScale4(modelMatrix, ViewParameters.modelScale);
      MATH.rotateY(modelMatrix, ViewParameters.modelRotationTheta);
      MATH.rotateX(modelMatrix, ViewParameters.modelRotationPhi);
      MATH.setI4(viewMatrix);
      MATH.translateZ(viewMatrix, -ViewParameters.cameraDistance);
      MATH.translateY(viewMatrix, -ViewParameters.cameraHeight);
      MATH.rotateX(viewMatrix, MATH.degToRad(ViewParameters.cameraPitch));

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      if (modelData.vertexBuffer && res.ready() && whiteTexture.webglTexture) {
        res.setOpaquePass();
        var skinned = modelData.skinnedModel;
        if (skinned && keyframe !== ViewParameters.keyframe) {
          keyframe = ViewParameters.keyframe;
          if (keyframe === -1) {
            skinned.applyDefaultPose();
          } else {
            skinned.applyPose(keyframe);
          }
          ViewParameters.onChangeKeyframe(skinned);
        }
        var shader = skinned ? res.shaders.litSkin : res.shaders.lit;
        var stride = 4 * modelData.stride; // in bytes
        shader.use(gl);
        gl.uniform1i(shader.uniforms.sampler, 0);
        gl.uniformMatrix4fv(shader.uniforms.Pmatrix, false, projectionMatrix);
        gl.uniformMatrix4fv(shader.uniforms.Vmatrix, false, viewMatrix);
        gl.uniformMatrix4fv(shader.uniforms.Mmatrix, false, modelMatrix);
        gl.uniform3f(shader.uniforms.lightDirection, Light.direction[0], Light.direction[1], Light.direction[2]);
        gl.bindBuffer(gl.ARRAY_BUFFER, modelData.vertexBuffer);
        gl.vertexAttribPointer(shader.attribs.position, 3, gl.FLOAT, false, stride, 0);
        gl.vertexAttribPointer(shader.attribs.normal, 3, gl.FLOAT, false, stride, 4*3);
        gl.vertexAttribPointer(shader.attribs.uv, 2, gl.FLOAT, false, stride, 4*(3+3));
        if (skinned) {
          gl.vertexAttribPointer(shader.attribs.boneWeights, 4, gl.FLOAT, false, stride, 4*(3+3+2));
          gl.vertexAttribPointer(shader.attribs.boneIndices, 4, gl.FLOAT, false, stride, 4*(3+3+2+4));
          gl.uniformMatrix4fv(shader.uniforms.joints, false, skinned.joints);
        }

        // draw all submeshes
        modelData.meshes.forEach(function (mesh) {
          gl.activeTexture(gl.TEXTURE0);
          var albedoMap = mesh.albedoMap || whiteTexture;
          var glTexture = albedoMap.webglTexture || whiteTexture.webglTexture;
          if (glTexture) {
            gl.bindTexture(gl.TEXTURE_2D, glTexture);
          } else {
            console.error("Not even the white texture is ready!");
          }
          gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, mesh.indexBuffer);
          gl.drawElements(gl.TRIANGLES, mesh.numPoints, gl.UNSIGNED_INT, 0);
        });
        shader.disable(gl);
      }
      if (res.ready() && overlay.texture) {
        res.setBlendPass();
        res.shaders.colour.use(gl);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, overlay.texture.webglTexture);
        res.setOverlayParameters();
        res.drawFullScreenQuad();
        res.shaders.colour.disable(gl);
      }
      drawAllLabels(ctx, projectionMatrix, viewMatrix, modelMatrix, gl.canvas.width, gl.canvas.height);
      gl.flush();
      window.requestAnimationFrame(animate); // redraw the scene
    };
  };

  $( document ).ready(function() {
  //window.addEventListener('load', function() {
    main();
  });

  // Exposed globals (needed in controls.js)
  global.ViewParameters = (global.module || {}).exports = ViewParameters;
})(this);
