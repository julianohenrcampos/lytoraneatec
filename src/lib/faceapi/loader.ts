import * as faceapi from "face-api.js";
import { pontoLog } from "@/lib/ponto/pontoLog";

let loadingPromise: Promise<void> | null = null;
let loaded = false;
let probePassed = false;

const MODEL_URL = "/models";
const LOAD_TIMEOUT_FIRST_MS = 30000; // 1ª tentativa: 30s (rede 3G de campo / cold start)
const LOAD_TIMEOUT_RETRY_MS = 15000; // tentativas seguintes: 15s
const MAX_ATTEMPTS = 3;

/**
 * Arquivos sondados antes de iniciar o carregamento dos nets.
 * Inclui manifests (JSON) e ao menos 1 shard binário de cada modelo,
 * para detectar SW antigo / fallback SPA servindo `index.html` no lugar do binário.
 */
const PROBE_FILES = [
  "tiny_face_detector_model-weights_manifest.json",
  "tiny_face_detector_model-shard1",
  "face_landmark_68_model-weights_manifest.json",
  "face_landmark_68_model-shard1",
  "face_recognition_model-weights_manifest.json",
  "face_recognition_model-shard1",
];

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`MODEL_LOAD_TIMEOUT:${label}`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); })
     .catch((e) => { clearTimeout(t); reject(e); });
  });
}

/**
 * Sonda os arquivos do modelo (manifests + shards) e detecta SW antigo / fallback SPA.
 * Lança `MODEL_PROBE_FAILED:<file>` ao primeiro problema, com PROBE_FAIL no log.
 * Política: PROBE_FAIL não entra no loop de retentativas — retry não resolve problema estrutural.
 */
async function probeModelAssets(): Promise<void> {
  if (probePassed) return;
  for (const file of PROBE_FILES) {
    const url = `${MODEL_URL}/${file}`;
    let status = 0;
    let contentType: string | null = null;
    let contentLength: string | null = null;
    try {
      const r = await fetch(url, { cache: "no-store" });
      status = r.status;
      contentType = r.headers.get("content-type");
      contentLength = r.headers.get("content-length");

      pontoLog("FACEAPI", "PROBE", "info", { file, status, contentType, contentLength });

      const isHtml = (contentType ?? "").toLowerCase().startsWith("text/html");
      if (status !== 200 || isHtml) {
        pontoLog("FACEAPI", "PROBE_FAIL", "error", {
          file,
          status,
          contentType,
          contentLength,
          hint: isHtml
            ? "Possível fallback SPA do servidor ou Service Worker antigo servindo index.html no lugar do binário. Limpar cache do SW / forçar atualização."
            : `Status HTTP inesperado (${status}) ao baixar arquivo do modelo.`,
        });
        try { await r.arrayBuffer(); } catch { /* noop */ }
        throw new Error(`MODEL_PROBE_FAILED:${file}`);
      }

      // Drena o corpo para liberar conexão. A face-api buscará novamente
      // (provavelmente do cache HTTP/SW) na fase de load.
      try { await r.arrayBuffer(); } catch { /* noop */ }
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      if (msg.startsWith("MODEL_PROBE_FAILED:")) throw e;
      pontoLog("FACEAPI", "PROBE_FAIL", "error", {
        file,
        status,
        contentType,
        contentLength,
        message: msg,
        hint: "Falha de rede ao sondar arquivo do modelo (offline, DNS, CORS ou bloqueio).",
      });
      throw new Error(`MODEL_PROBE_FAILED:${file}`);
    }
  }
  probePassed = true;
}

/**
 * Carrega cada net sequencialmente, pulando os já carregados.
 * Em retentativas isso economiza banda (não rebaixa o recognition de 4 MB se só o landmark caiu).
 */
async function loadOnce(timeoutMs: number, attempt: number): Promise<void> {
  const nets: Array<{ name: string; net: { isLoaded: boolean; loadFromUri: (uri: string) => Promise<void> } }> = [
    { name: "tinyFaceDetector", net: faceapi.nets.tinyFaceDetector as any },
    { name: "faceLandmark68Net", net: faceapi.nets.faceLandmark68Net as any },
    { name: "faceRecognitionNet", net: faceapi.nets.faceRecognitionNet as any },
  ];

  for (const { name, net } of nets) {
    if (net.isLoaded) {
      pontoLog("FACEAPI", "LOAD_SKIP", "info", { attempt, net: name, reason: "already loaded" });
      continue;
    }
    pontoLog("FACEAPI", "LOAD_START", "info", { attempt, net: name, timeoutMs });
    try {
      await withTimeout(net.loadFromUri(MODEL_URL), timeoutMs, name);
    } catch (e) {
      pontoLog("FACEAPI", "LOAD_ERROR", "error", {
        attempt,
        net: name,
        timeoutMs,
        message: (e as Error)?.message,
      });
      throw e;
    }
  }
}

export function loadFaceApiModels(): Promise<void> {
  // Cache forte: nunca recarregar se já carregado
  if (loaded) return Promise.resolve();
  if (loadingPromise) return loadingPromise;

  pontoLog("FACEAPI", "LOAD", "info", { modelUrl: MODEL_URL });

  loadingPromise = (async () => {
    // Sonda antes de tentar — falha de probe NÃO entra no loop de retentativas
    // porque indica problema estrutural (SW/SPA fallback) que retry não resolve.
    try {
      await probeModelAssets();
    } catch (probeErr) {
      loadingPromise = null;
      pontoLog("FACEAPI", "ERRO", "error", {
        definitivo: true,
        fase: "probe",
        message: (probeErr as Error)?.message,
      });
      throw new Error("MODEL_LOAD_FAILED");
    }

    let lastErr: unknown = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const timeoutMs = attempt === 1 ? LOAD_TIMEOUT_FIRST_MS : LOAD_TIMEOUT_RETRY_MS;
      try {
        await loadOnce(timeoutMs, attempt);
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
      fase: "load",
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
 * Também reseta o probe — em retry manual vale re-sondar (SW pode ter atualizado entre tentativas).
 */
export function resetFaceApiLoader(): void {
  loadingPromise = null;
  probePassed = false;
}

export function isFaceApiLoaded(): boolean {
  return loaded;
}

export { faceapi };
