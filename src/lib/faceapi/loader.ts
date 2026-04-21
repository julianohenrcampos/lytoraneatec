import * as faceapi from "face-api.js";

let loadingPromise: Promise<void> | null = null;
let loaded = false;

const MODEL_URL = "/models";

export function loadFaceApiModels(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);
    loaded = true;
  })();
  return loadingPromise;
}

export { faceapi };
