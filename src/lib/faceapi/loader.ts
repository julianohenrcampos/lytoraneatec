import * as faceapi from "face-api.js";
import { pontoLog } from "@/lib/ponto/pontoLog";

let loadingPromise: Promise<void> | null = null;
let loaded = false;

const MODEL_URL = "/models";
const LOAD_TIMEOUT_FIRST_MS = 30000; // 1ª tentativa: 30s (rede 3G de campo / cold start)
const LOAD_TIMEOUT_RETRY_MS = 15000; // tentativas seguintes: 15s
const MAX_ATTEMPTS = 3;

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`MODEL_LOAD_TIMEOUT:${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

async function loadOnce(timeoutMs: number): Promise<void> {
  await Promise.all([
    withTimeout(faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL), timeoutMs, "tinyFaceDetector"),
    withTimeout(faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL), timeoutMs, "faceLandmark68Net"),
    withTimeout(faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL), timeoutMs, "faceRecognitionNet"),
  ]);
}

export function loadFaceApiModels(): Promise<void> {
  // Cache forte: nunca recarregar se já carregado
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  pontoLog("FACEAPI", "LOAD", "info", { modelUrl: MODEL_URL });

  loadingPromise = (async () => {
    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const timeoutMs = attempt === 1 ? LOAD_TIMEOUT_FIRST_MS : LOAD_TIMEOUT_RETRY_MS;
      try {
        await loadOnce(timeoutMs);
        loaded = true;
        pontoLog("FACEAPI", "LOAD_OK", "info", { attempt, timeoutMs });
        return;
      } catch (e) {
        lastErr = e;
        pontoLog("FACEAPI", "ERRO", "warn", {
          attempt,
          maxAttempts: MAX_ATTEMPTS,
          timeoutMs,
          message: (e as Error)?.message,
        });
        if (attempt < MAX_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
        }
      }
    }
    loadingPromise = null;
    pontoLog("FACEAPI", "ERRO", "error", {
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
