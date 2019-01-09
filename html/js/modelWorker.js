self.importScripts('modelData.js');

onmessage = function(e) {
  var modelData = new ModelData(e.data.model);
  var msg = {
    progress: 0,
    done: false
  };
  var progress = {step: -1, done: false};
  while (!progress.done) {
    progress = modelData.stepFacesPerPositionCreation(progress.step + 1);
    msg.progress = 0.5 * (progress.step / progress.total);
    postMessage(msg);
  }
  progress.step = -1;
  progress.done = false;
  while (!progress.done) {
    progress = modelData.recomputeNormal(progress.step + 1);
    msg.progress = 0.5 + 0.5 * (progress.step / progress.total);
    postMessage(msg);
  }
  msg.progress = 1;
  msg.done = true;
  msg.vertices = modelData.vertices;
  postMessage(msg);
  close(); // this worker is done, terminate
};