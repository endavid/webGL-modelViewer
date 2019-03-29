// eslint-disable-next-line no-restricted-globals
self.importScripts('modelDistance.js');

onmessage = (e) => {
  // eslint-disable-next-line no-undef
  const modelDistance = new ModelDistance(e.data);
  const msg = {
    progress: 0,
    done: false,
  };
  let progress = { step: -1, done: false };
  while (!progress.done) {
    progress = modelDistance.step(progress.step + 1);
    msg.progress = progress.step / progress.total;
    postMessage(msg);
  }
  msg.progress = 1;
  msg.done = true;
  msg.surfaceIntersection = modelDistance.surfaceIntersection;
  msg.indices = modelDistance.indices;
  postMessage(msg);
  // eslint-disable-next-line no-restricted-globals
  close(); // this worker is done, terminate
};
