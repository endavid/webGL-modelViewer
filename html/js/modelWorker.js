self.importScripts('modelData.js');

onmessage = function(e) {
  var modelData = new ModelData(e.data.model);
  var msg = {
    progress: 0,
    done: false
  };
  var i = 0;
  var done = false;
  while (!done) {
    const progress = modelData.stepFacesPerPositionCreation(i);
    done = progress.done;
    msg.progress = 0.5 * (progress.step / progress.total);
    postMessage(msg);
    i++;
  }
  i = 0;
  done = false;
  while (!done) {
    const progress = modelData.recomputeNormal(i);
    done = progress.done;
    msg.progress = 0.5 + 0.5 * (progress.step / progress.total);
    postMessage(msg);
    i++;
  }
  msg.progress = 1;
  msg.done = true;
  msg.vertices = modelData.vertices;
  postMessage(msg);
  close(); // this worker is done, terminate
};