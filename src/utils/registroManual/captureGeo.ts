/**
 * Captura GPS do dispositivo para o Registro Manual de Aplicação.
 * B.3.5-D.M1: robustez mobile/PWA — 2 tentativas (high→low accuracy),
 * permissions API, maximumAge, errorCode, logs estruturados.
 */

export type GeoErrorCode =
  | "permission_denied"
  | "timeout"
  | "unavailable"
  | "insecure_context"
  | "unsupported"
  | "unknown";

export interface GeoCapture {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string;
  source: "device";
}

export interface GeoCaptureResult {
  ok: boolean;
  data: GeoCapture | null;
  error?: string;
  errorCode?: GeoErrorCode;
}

export interface GeoCaptureOptions {
  timeoutMs?: number;
  maximumAge?: number;
  highAccuracy?: boolean;
}

const LOG = "[REGISTRO_MANUAL]";
const isDev =
  typeof import.meta !== "undefined" && (import.meta as any).env?.DEV === true;

function detectContext() {
  const hasApi = typeof navigator !== "undefined" && !!navigator.geolocation;
  const secureContext =
    typeof window !== "undefined" ? window.isSecureContext !== false : true;
  let inIframe = false;
  try {
    inIframe = typeof window !== "undefined" && window.top !== window.self;
  } catch {
    inIframe = true;
  }
  return { hasApi, secureContext, inIframe };
}

async function checkPermission(): Promise<PermissionState | "unknown"> {
  try {
    if (typeof navigator === "undefined" || !(navigator as any).permissions) {
      return "unknown";
    }
    const res = await (navigator as any).permissions.query({ name: "geolocation" });
    return (res?.state as PermissionState) || "unknown";
  } catch {
    return "unknown";
  }
}

type TryResult =
  | { ok: true; pos: GeolocationPosition; err?: undefined }
  | { ok: false; err: GeolocationPositionError; pos?: undefined };

function tryOnce(
  timeoutMs: number,
  highAccuracy: boolean,
  maximumAge: number
): Promise<TryResult> {
  return new Promise((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({
        ok: false,
        err: { code: 3, message: "Timeout externo", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError,
      });
    }, timeoutMs + 500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: true, pos });
      },
      (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({ ok: false, err });
      },
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge }
    );
  });
}

function mapErrCode(code: number): GeoErrorCode {
  if (code === 1) return "permission_denied";
  if (code === 2) return "unavailable";
  if (code === 3) return "timeout";
  return "unknown";
}

function mapErrMsg(code: GeoErrorCode): string {
  switch (code) {
    case "permission_denied":
      return "Localização bloqueada. Ative a permissão nas configurações do navegador/PWA.";
    case "insecure_context":
      return "Contexto não seguro. Acesse via HTTPS para usar GPS.";
    case "timeout":
      return "Tempo esgotado ao obter GPS.";
    case "unavailable":
      return "Posição indisponível.";
    case "unsupported":
      return "Geolocalização não suportada neste dispositivo.";
    default:
      return "Falha ao obter GPS.";
  }
}

export async function captureGeo(
  optsOrTimeout?: GeoCaptureOptions | number
): Promise<GeoCaptureResult> {
  const opts: GeoCaptureOptions =
    typeof optsOrTimeout === "number"
      ? { timeoutMs: optsOrTimeout }
      : optsOrTimeout || {};
  const totalTimeout = Math.max(3000, opts.timeoutMs ?? 20000);
  const maximumAge = opts.maximumAge ?? 30000;
  const startHigh = opts.highAccuracy !== false;

  const ctx = detectContext();
  const permissionState = await checkPermission();

  // eslint-disable-next-line no-console
  console.log(`${LOG}[GEO_START]`, {
    hasApi: ctx.hasApi,
    secureContext: ctx.secureContext,
    inIframe: ctx.inIframe,
    permissionState,
    totalTimeout,
    maximumAge,
  });

  if (!ctx.hasApi) {
    const errorCode: GeoErrorCode = "unsupported";
    const error = mapErrMsg(errorCode);
    console.warn(`${LOG}[GEO_ERROR]`, { code: errorCode, message: error, attempt: 0 });
    return { ok: false, data: null, error, errorCode };
  }
  if (!ctx.secureContext) {
    const errorCode: GeoErrorCode = "insecure_context";
    const error = mapErrMsg(errorCode);
    console.warn(`${LOG}[GEO_ERROR]`, { code: errorCode, message: error, attempt: 0 });
    return { ok: false, data: null, error, errorCode };
  }
  // NOTA: permissionState é APENAS informativo (log/telemetria).
  // Em PWA/iOS a Permissions API pode retornar "denied" mesmo quando a origem
  // já tem permissão concedida, o que provocava "falso bloqueio" de GPS.
  // A fonte de verdade é o retorno de getCurrentPosition (código 1 = PERMISSION_DENIED).

  // 1ª tentativa: high accuracy, ~metade do timeout total (cap 10s)
  const t1 = Math.min(10000, Math.floor(totalTimeout / 2));
  const r1 = await tryOnce(t1, startHigh, maximumAge);
  if (r1.ok) {
    const pos = r1.pos;
    console.log(`${LOG}[GEO_SUCCESS]`, {
      attempt: 1,
      highAccuracy: startHigh,
      accuracy: pos.coords.accuracy,
      ...(isDev
        ? { lat: pos.coords.latitude, lng: pos.coords.longitude }
        : {}),
    });
    return {
      ok: true,
      data: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        source: "device",
      },
    };
  }

  const code1 = mapErrCode(r1.err.code);
  console.warn(`${LOG}[GEO_ERROR]`, {
    code: code1,
    message: r1.err.message,
    attempt: 1,
  });

  // Se foi denied, não adianta 2ª tentativa
  if (code1 === "permission_denied") {
    return { ok: false, data: null, error: mapErrMsg(code1), errorCode: code1 };
  }

  // 2ª tentativa: low accuracy, restante do timeout
  const t2 = Math.max(4000, totalTimeout - t1);
  const r2 = await tryOnce(t2, false, Math.max(maximumAge, 60000));
  if (r2.ok) {
    const pos = r2.pos;
    console.log(`${LOG}[GEO_SUCCESS]`, {
      attempt: 2,
      highAccuracy: false,
      accuracy: pos.coords.accuracy,
      ...(isDev
        ? { lat: pos.coords.latitude, lng: pos.coords.longitude }
        : {}),
    });
    return {
      ok: true,
      data: {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
        source: "device",
      },
    };
  }

  const code2 = mapErrCode(r2.err.code);
  console.warn(`${LOG}[GEO_ERROR]`, {
    code: code2,
    message: r2.err.message,
    attempt: 2,
  });
  return {
    ok: false,
    data: null,
    error: mapErrMsg(code2),
    errorCode: code2,
  };
}
