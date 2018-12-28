import Renderer from './renderer.js';
import Model from './model.js';

class Viewer extends Renderer {
  loadModel(name, url, invertAxis, imageUrls, materialUrls) {
    var self = this;
    const gl = this.glState.gl;
    this.destroyAll();
    return Model.createAsync(gl, name, url, invertAxis, imageUrls, materialUrls)
    .then(model => {
      self.scene.models.push(model);
      return model;
    });
  }
  destroyAll() {
    const gl = this.glState.gl;
    this.scene.models.forEach(m => {
      m.destroy(gl);
    });
    this.scene.models = [];
  }
}

export {Viewer as default};