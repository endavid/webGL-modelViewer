import Renderer from './renderer.js';
import Model from './model.js';

class Viewer extends Renderer {
  loadModel(name, url, config, imageUrls, materialUrls, onProgress, onComplete, onError) {
    const self = this;
    const { gl } = this.glState;
    const i = this.selectedModel;
    this.destroyModel(i);
    Model.createAsync(gl, name, url, config, imageUrls, materialUrls,
      onProgress, (model) => {
        self.scene.models[i] = model;
        self.onSceneUpdate();
        onComplete(model);
      }, onError);
  }
  destroyModel(index) {
    const { gl } = this.glState;
    if (this.scene.models[index]) {
      this.scene.models[index].destroy(gl);
      this.scene.models[index] = null;
    }
  }
}

export { Viewer as default };
