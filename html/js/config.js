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
  selectedCamera: 0,
  cameras: [
    {
      distance: 3.01,
      height: 0.95,
      offsetX: 0,
      pitch: 0,
      rotationY: 0,
      fov: 26.9
    },
    {
      distance: 3.01,
      height: 0.95,
      offsetX: 0,
      pitch: 0,
      rotationY: 45,
      fov: 26.9
    },
    {
      distance: 3.01,
      height: 0.95,
      offsetX: 0,
      pitch: 0,
      rotationY: -45,
      fov: 26.9
    },
    {
      distance: 3.01,
      height: 0.95,
      offsetX: 0,
      pitch: 0,
      rotationY: 180,
      fov: 26.9
    },
  ],
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
