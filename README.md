WebGL Model Viewer
==================

The purpose of this project is to have a base for testing WebGL and previewing models in the browser without any further dependencies to other frameworks.
If you are looking for something more powerful, take a look at Three.js.

Installation
------------

You will need to open it within a web server (because of CORS issues, it can't be opened as a local file). Just open `html/modelViewer.html`.
You can see it running here: http://endavid.com/webGL-modelViewer/html/modelViewer.html

Alternatively, you can install it as a Chrome plugin. Just point to the location of the `html` folder when adding it as a extension.

Supported formats
-----------------

* Partial support for Object Wavefront (.OBJ)
* Partial support for Collada (.DAE)

Rigged Collada models are supported as well. You can preview the keyframes in an animation, inspect the skeleton, and transform the joints. At the moment, the joint transforms are limited to Collada files where those transforms are stored as separate rotations, and not as a single matrix.


Development
-----------
### Style
We target ECMAScript 2016 (or ES7), so we can use all modern syntactic sugar. Older versions of Javascript are not supported.
Use ESLint to get the style right. I'm using AirBnB Javascript style as base. To install it, install Node.js first. Then, from the console, run `npm install` inside the root directory of this repository.

Preferred style:

* Declare classes with the `class` keyword, never with `function`.
* Keep files shorter than 500 lines. If they grow bigger, try to split the files in modules.
* Prefer modules and avoid the old `(function(global) {})(this);` wrapping construct.
* Prefer *readability* over backwards-compatibiliy.
* Use `Promises` for async operations, with the only exception of things that do not need to be waited for. For instance, images are loaded asynchronously, but we don't need to wait for them to be ready (for a WebGL texture to be created). A model can be loaded and displayed with a default white texture, and as images get loaded, the textures will appear.
* Use `async` and `await` syntactic sugar for Promises.
* Unfortunately, *Workers* do not support modules at the moment, so code involving workers will look uglier. Try to make the `Worker` code as independent as possible (even if it means copy-pasting a couple of already existing functions).


### Architecture
The code is roughly divided into 2 main blocks: UI and rendering. All the UI is created throw `controls.js`, with some helpers from `uiutils.js`. The rest of the code is related to rendering. The main rendering loop is in `renderer.js`. A `Renderer` contains a series of 3D and 2D plugins. The 3D plugins render things in the WebGL canvas, while the 2D plugins are used to overlay things using a 2D context.

A `Renderer` contains a `scene`, that looks like this,

```javascript
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
}
```

`PluginLitModel` takes care of rendering all the `models` in the scene, but at the moment the viewer only lets you load one model at a time.

The labels inside the `world` section are labels with coordinates in world space, while the `model` section is used for model space (not implemented yet).



