import * as faceapi from "face-api.js";

let loadingPromise: Promise<void> | null = null;
let loaded = false;

const MODEL_URL = "/models";
const LOAD_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`MODEL_LOAD_TIMEOUT:${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

async function loadOnce(): Promise<void> {
  await Promise.all([
    withTimeout(faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), LOAD_TIMEOUT_MS, "tinyFaceDetector"),
    withTimeout(faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), LOAD_TIMEOUT_MS, "faceLandmark68Net"),
    withTimeout(faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), LOAD_TIMEOUT_MS, "faceRecognitionNet"),
  ]);
}

export function loadFaceApiModels(): Promise<void> {
  // Cache forte: nunca recarregar se já carregado
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        await loadOnce();
        loaded = true;
        return;
      } catch (e) {
        lastErr = e;
        console.warn("[BIOMETRIA][ERRO_MODELO]", {
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          message: (e as Error)?.message,
        });
        // backoff exponencial: 500ms, 1000ms
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    // Falha definitiva — limpa promise para permitir retry futuro
    loadingPromise = null;
    console.error("[BIOMETRIA][ERRO_MODELO]", {
      definitivo: true,
      message: (lastErr as Error)?.message,
    });
    throw new Error("MODEL_LOAD_FAILED");
  })();

  return loadingPromise;
}

/**
 * Reseta o cache do loader para permitir nova tentativa via UI.
 * Não descarrega os modelos da face-api (uma vez carregados, ficam em memória),
 * mas garante que `loadFaceApiModels()` reentregue uma promise que reflita o estado.
 */
export function resetFaceApiLoader(): void {
  loadingPromise = null;
  // Mantém `loaded` como está: se já carregou, segue carregado; se nunca carregou, próxima chamada tenta de novo.
}

export function isFaceApiLoaded(): boolean {
  return loaded;
}

export { faceapi };
