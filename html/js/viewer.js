import Renderer from './renderer.js';
import Model from './model.js';

class Viewer extends Renderer {
  loadModel(name, url, config, imageUrls, materialUrls, onProgress, onComplete, onError) {
    const self = this;
    const { gl } = this.glState;
    this.destroyAll();
    Model.createAsync(gl, name, url, config, imageUrls, materialUrls,
      onProgress, (model) => {
        self.scene.models.push(model);
        onComplete(model);
      }, onError);
  }
  destroyAll() {
    const { gl } = this.glState;
    this.scene.models.forEach((m) => {
      m.destroy(gl);
    });
    this.scene.models = [];
  }
}

export { Viewer as default };
