import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, RefreshCw, X, Upload } from "lucide-react";
import { toast } from "sonner";
import { useCameraDevices } from "@/hooks/ponto/useCameraDevices";

interface CameraCaptureProps {
  value: string | null;
  onChange: (base64: string | null) => void;
  maxBytes?: number;
  className?: string;
  disabled?: boolean;
}

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
// Tentativas de compressão: (qualidade JPEG, lado máximo px)
const COMPRESSION_STEPS: Array<{ q: number; max: number }> = [
  { q: 0.85, max: 1280 },
  { q: 0.7, max: 1280 },
  { q: 0.7, max: 960 },
  { q: 0.55, max: 960 },
  { q: 0.5, max: 720 },
];

function dataUrlBytes(dataUrl: string): number {
  // base64 inflate ~4/3
  const idx = dataUrl.indexOf(",");
  const b64 = idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl;
  return Math.floor((b64.length * 3) / 4);
}

async function compressFromSource(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  maxBytes: number,
): Promise<string | null> {
  const sw =
    (source as HTMLVideoElement).videoWidth ||
    (source as HTMLImageElement).naturalWidth ||
    (source as HTMLCanvasElement).width;
  const sh =
    (source as HTMLVideoElement).videoHeight ||
    (source as HTMLImageElement).naturalHeight ||
    (source as HTMLCanvasElement).height;
  if (!sw || !sh) return null;

  for (const step of COMPRESSION_STEPS) {
    const scale = Math.min(1, step.max / Math.max(sw, sh));
    const w = Math.round(sw * scale);
    const h = Math.round(sh * scale);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, w, h);
    const dataUrl = c.toDataURL("image/jpeg", step.q);
    if (dataUrlBytes(dataUrl) <= maxBytes) return dataUrl;
  }
  // Última tentativa: 480 / q 0.4
  const c = document.createElement("canvas");
  const scale = Math.min(1, 480 / Math.max(sw, sh));
  c.width = Math.round(sw * scale);
  c.height = Math.round(sh * scale);
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, c.width, c.height);
  const dataUrl = c.toDataURL("image/jpeg", 0.4);
  return dataUrlBytes(dataUrl) <= maxBytes ? dataUrl : null;
}

async function compressFromFile(file: File, maxBytes: number): Promise<string | null> {
  const img = new Image();
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.src = url;
    });
    return await compressFromSource(img, maxBytes);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Componente reutilizável de captura de foto.
 * - Suporta seleção de câmera USB via deviceId (persistido).
 * - Compressão iterativa para ficar abaixo de 2MB (default).
 * - Fallback automático para <input type="file"> se getUserMedia falhar.
 *
 * Não muda o contrato de payload — devolve apenas data:image/jpeg;base64,...
 */
export default function CameraCapture({
  value,
  onChange,
  maxBytes = DEFAULT_MAX_BYTES,
  className,
  disabled,
}: CameraCaptureProps) {
  const { devices, selectedDeviceId, setSelectedDeviceId, refresh, hasGetUserMedia } = useCameraDevices();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [streamReady, setStreamReady] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(!hasGetUserMedia);
  const [capturando, setCapturando] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStreamReady(false);
  }, []);

  // Abre/troca stream conforme deviceId
  useEffect(() => {
    if (usingFallback) return;
    if (value) return; // já existe foto — não precisa câmera ligada
    if (!hasGetUserMedia) {
      setUsingFallback(true);
      return;
    }
    let cancelled = false;
    stopStream();
    setStreamError(null);

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 } },
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setStreamReady(true);
        // Após 1ª permissão, labels passam a vir preenchidos
        refresh();
      } catch (e: any) {
        if (cancelled) return;
        const name = e?.name ?? "";
        // OverconstrainedError: deviceId salvo sumiu/mudou — limpa e re-tenta sem constraint
        if (name === "OverconstrainedError" && selectedDeviceId) {
          setSelectedDeviceId(null);
          return;
        }
        setStreamError(
          name === "NotAllowedError"
            ? "Permissão de câmera negada"
            : name === "NotFoundError"
            ? "Nenhuma câmera encontrada"
            : "Câmera indisponível",
        );
        setUsingFallback(true);
      }
    })();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [hasGetUserMedia, selectedDeviceId, usingFallback, value, stopStream, refresh, setSelectedDeviceId]);

  // Cleanup final
  useEffect(() => () => stopStream(), [stopStream]);

  const handleCapturar = useCallback(async () => {
    const v = videoRef.current;
    if (!v || !streamReady || v.videoWidth === 0) {
      toast.error("Câmera não está pronta.");
      return;
    }
    setCapturando(true);
    try {
      const dataUrl = await compressFromSource(v, maxBytes);
      if (!dataUrl) {
        toast.error("Não foi possível comprimir a foto abaixo de 2MB.");
        return;
      }
      onChange(dataUrl);
      stopStream();
    } finally {
      setCapturando(false);
    }
  }, [streamReady, maxBytes, onChange, stopStream]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setCapturando(true);
      try {
        const dataUrl = await compressFromFile(file, maxBytes);
        if (!dataUrl) {
          toast.error("Imagem maior que 2MB mesmo após compressão.");
          return;
        }
        onChange(dataUrl);
      } catch (err: any) {
        toast.error(err?.message ?? "Falha ao ler a imagem.");
      } finally {
        setCapturando(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [maxBytes, onChange],
  );

  const handleRemover = useCallback(() => {
    onChange(null);
  }, [onChange]);

  const handleTrocar = useCallback(() => {
    onChange(null);
    setUsingFallback(false);
    setStreamError(null);
  }, [onChange]);

  // Caso já tenha foto: preview + ações
  if (value) {
    return (
      <div className={className}>
        <div className="space-y-2">
          <img src={value} alt="Foto capturada" className="max-h-64 rounded border" />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="outline" onClick={handleTrocar} disabled={disabled}>
              <RefreshCw className="w-4 h-4 mr-1" /> Tirar de novo
            </Button>
            <Button size="sm" variant="destructive" onClick={handleRemover} disabled={disabled}>
              <X className="w-4 h-4 mr-1" /> Remover
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Fallback (sem getUserMedia ou erro)
  if (usingFallback) {
    return (
      <div className={className}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled}
        />
        {streamError && (
          <p className="text-sm text-destructive mb-2">⚠️ {streamError}. Use o seletor de arquivo.</p>
        )}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || capturando}
          >
            <Upload className="w-4 h-4 mr-1" /> {capturando ? "Processando..." : "Selecionar / capturar foto"}
          </Button>
          {hasGetUserMedia && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setUsingFallback(false);
                setStreamError(null);
              }}
              disabled={disabled}
            >
              Tentar usar a câmera
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Câmera ao vivo
  return (
    <div className={className}>
      {devices.length > 1 && (
        <div className="mb-2">
          <Select
            value={selectedDeviceId ?? ""}
            onValueChange={(v) => setSelectedDeviceId(v || null)}
            disabled={disabled}
          >
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Câmera (selecione)" />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="relative bg-black rounded overflow-hidden max-w-md aspect-video">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {!streamReady && !streamError && (
          <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
            Iniciando câmera...
          </div>
        )}
      </div>

      {streamError && (
        <p className="text-sm text-destructive mt-2">⚠️ {streamError}</p>
      )}

      <div className="flex gap-2 mt-2 flex-wrap">
        <Button onClick={handleCapturar} disabled={!streamReady || capturando || disabled}>
          <Camera className="w-4 h-4 mr-1" /> {capturando ? "Processando..." : "Capturar foto"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => refresh()} disabled={disabled}>
          <RefreshCw className="w-4 h-4 mr-1" /> Atualizar lista
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setUsingFallback(true)}
          disabled={disabled}
        >
          <Upload className="w-4 h-4 mr-1" /> Usar arquivo
        </Button>
      </div>
    </div>
  );
}
