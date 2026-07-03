/**
 * Captura GPS do dispositivo para o Registro Manual de Aplicação.
 * Fase A: melhor esforço — retorna null se indisponível/negado/expirado.
 * Fase B/C (persistência): validação de accuracy ≤ 150m ocorrerá na RPC.
 */

export interface GeoCapture {
  latitude: number;
  longitude: number;
  accuracy: number;
  capturedAt: string; // ISO
  source: "device";
}

export interface GeoCaptureResult {
  ok: boolean;
  data: GeoCapture | null;
  error?: string;
}

export function captureGeo(timeoutMs = 8000): Promise<GeoCaptureResult> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve({ ok: false, data: null, error: "Geolocalização não suportada neste dispositivo." });
      return;
    }
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      resolve({ ok: false, data: null, error: "Tempo esgotado ao obter GPS." });
    }, timeoutMs + 500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({
          ok: true,
          data: {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            capturedAt: new Date(pos.timestamp || Date.now()).toISOString(),
            source: "device",
          },
        });
      },
      (err) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve({
          ok: false,
          data: null,
          error:
            err.code === err.PERMISSION_DENIED
              ? "Permissão de localização negada."
              : err.code === err.POSITION_UNAVAILABLE
              ? "Posição indisponível."
              : err.code === err.TIMEOUT
              ? "Tempo esgotado ao obter GPS."
              : "Falha ao obter GPS.",
        });
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}
