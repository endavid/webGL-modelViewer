self.importScripts('modelData.js');

onmessage = function(e) {
  var modelData = new ModelData(e.data.model);
  var msg = {
    done: 0
  };
  var i = 0;
  var done = 0;
  while (done < 100) {
    done = modelData.stepFacesPerPositionCreation(i);
    msg.done = Math.round(0.5 * done);
    postMessage(msg);
    i++;
  }
  i = 0;
  done = 0;
  while (done < 100) {
    done = modelData.recomputeNormal(i);
    msg.done = Math.round(50 + 0.5 * done);
    postMessage(msg);
    i++;
  }
  msg.done = 100;
  msg.vertices = modelData.vertices;
  postMessage(msg);
  close(); // this worker is done, terminate
};