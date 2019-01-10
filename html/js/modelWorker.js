// eslint-disable-next-line no-restricted-globals
self.importScripts('modelData.js');

onmessage = (e) => {
  // eslint-disable-next-line no-undef
  const modelData = new ModelData(e.data.model);
  const msg = {
    progress: 0,
    done: false,
  };
  let progress = { step: -1, done: false };
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
  // eslint-disable-next-line no-restricted-globals
  close(); // this worker is done, terminate
};
