import { useCallback, useEffect, useState } from "react";

export const PONTO_CAMERA_DEVICE_KEY = "ponto_camera_device_id";

export interface CameraDevice {
  deviceId: string;
  label: string;
}

export interface UseCameraDevicesResult {
  devices: CameraDevice[];
  selectedDeviceId: string | null;
  setSelectedDeviceId: (id: string | null) => void;
  refresh: () => Promise<void>;
  hasGetUserMedia: boolean;
  loading: boolean;
  error: string | null;
}

/**
 * Lista câmeras `videoinput` e persiste o deviceId escolhido em
 * localStorage (`ponto_camera_device_id`). Não abre stream — quem consome
 * é responsável por chamar getUserMedia com o deviceId resultante.
 *
 * Observação: alguns navegadores só preenchem `label` após uma permissão
 * de câmera ter sido concedida ao menos uma vez na origem. O componente
 * consumidor pode chamar `refresh()` após o primeiro getUserMedia OK
 * para popular os rótulos. Como fallback, o label vira `Câmera N`.
 */
export function useCameraDevices(): UseCameraDevicesResult {
  const hasGetUserMedia =
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function" &&
    typeof navigator.mediaDevices.enumerateDevices === "function";

  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(PONTO_CAMERA_DEVICE_KEY);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSelectedDeviceId = useCallback((id: string | null) => {
    setSelectedDeviceIdState(id);
    try {
      if (id) localStorage.setItem(PONTO_CAMERA_DEVICE_KEY, id);
      else localStorage.removeItem(PONTO_CAMERA_DEVICE_KEY);
    } catch {
      /* storage indisponível */
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!hasGetUserMedia) {
      setError("getUserMedia indisponível neste navegador");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cams: CameraDevice[] = all
        .filter((d) => d.kind === "videoinput")
        .map((d, idx) => ({
          deviceId: d.deviceId,
          label: d.label || `Câmera ${idx + 1}`,
        }));
      setDevices(cams);
      // Se o deviceId persistido não existe mais, descarta
      setSelectedDeviceIdState((prev) => {
        if (prev && !cams.find((c) => c.deviceId === prev)) {
          try { localStorage.removeItem(PONTO_CAMERA_DEVICE_KEY); } catch { /* */ }
          return null;
        }
        return prev;
      });
    } catch (e: any) {
      setError(e?.message ?? "Falha ao listar câmeras");
    } finally {
      setLoading(false);
    }
  }, [hasGetUserMedia]);

  useEffect(() => {
    refresh();
    if (!hasGetUserMedia) return;
    const md: any = navigator.mediaDevices;
    const handler = () => refresh();
    md.addEventListener?.("devicechange", handler);
    return () => {
      md.removeEventListener?.("devicechange", handler);
    };
  }, [hasGetUserMedia, refresh]);

  return {
    devices,
    selectedDeviceId,
    setSelectedDeviceId,
    refresh,
    hasGetUserMedia,
    loading,
    error,
  };
}
