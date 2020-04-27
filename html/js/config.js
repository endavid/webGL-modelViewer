const Config = {
  isZAxisUp: false,
  recomputeNormals: false,
  isLockRotationY: false,
  isLockRotationX: false,
  model: {
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: 1
  },
  camera: {
    distance: 3,
    height: 1.35,
    pitch: -7,
    rotationY: 0,
    fov: 26.9
  },
  sun: {
    altitude: 1,
    eastWest: 0.2,
    intensity: 0.8,
    alpha: 1
  },
  needsReload: false,
  keyframe: -1,
  backgroundColor: 0x3d4d4d,
  pointSize: 3,
  labelScale: 1,
  showLabels: true,
  showPoints: true,
  showSkeleton: false
};
export default Config;
