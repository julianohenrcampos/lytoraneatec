import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { obterArquivoAssinado } from "@/services/atestadosService";

export type AtestadoPreviewKind = "pdf" | "image" | "unknown";

function extFromMime(mime: string): string {
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

function kindFromMime(mime: string): AtestadoPreviewKind {
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("image/")) return "image";
  return "unknown";
}

export function useAtestadoArquivoAssinado() {
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [previewFor, setPreviewFor] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [kind, setKind] = useState<AtestadoPreviewKind>("unknown");
  const [mime, setMime] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const revokeCurrent = () => {
    if (currentUrlRef.current) {
      try {
        URL.revokeObjectURL(currentUrlRef.current);
      } catch {
        /* noop */
      }
      currentUrlRef.current = null;
    }
  };

  const reset = useCallback(() => {
    revokeCurrent();
    setObjectUrl(null);
    setPreviewFor(null);
    setKind("unknown");
    setMime("");
    setError(null);
  }, []);

  const load = useCallback(
    async (atestadoId: string, opts?: { force?: boolean }) => {
      if (loadingId) return;
      if (
        !opts?.force &&
        previewFor === atestadoId &&
        currentUrlRef.current
      ) {
        return;
      }
      setLoadingId(atestadoId);
      setError(null);
      try {
        // signed_url exists only in this local scope — never persisted.
        const { signed_url } = await obterArquivoAssinado(atestadoId);
        let resp: Response;
        try {
          resp = await fetch(signed_url);
        } catch {
          throw Object.assign(new Error("fetch_failed"), { status: 0 });
        }
        if (!resp.ok) {
          throw Object.assign(new Error("fetch_failed"), { status: resp.status });
        }
        const arrayBuffer = await resp.arrayBuffer();
        const head = new Uint8Array(arrayBuffer.slice(0, 8));
        const isPdf =
          head[0] === 0x25 &&
          head[1] === 0x50 &&
          head[2] === 0x44 &&
          head[3] === 0x46;
        const isPng =
          head[0] === 0x89 &&
          head[1] === 0x50 &&
          head[2] === 0x4e &&
          head[3] === 0x47;
        const isJpg =
          head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;

        let detectedMime: string;
        let detectedKind: AtestadoPreviewKind;
        if (isPdf) {
          detectedMime = "application/pdf";
          detectedKind = "pdf";
        } else if (isPng) {
          detectedMime = "image/png";
          detectedKind = "image";
        } else if (isJpg) {
          detectedMime = "image/jpeg";
          detectedKind = "image";
        } else {
          detectedMime =
            resp.headers.get("content-type") || "application/octet-stream";
          detectedKind = kindFromMime(detectedMime);
        }

        const blob = new Blob([arrayBuffer], { type: detectedMime });
        const url = URL.createObjectURL(blob);
        revokeCurrent();
        currentUrlRef.current = url;
        setObjectUrl(url);
        setMime(detectedMime);
        setKind(detectedKind);
        setPreviewFor(atestadoId);

      } catch (e: any) {
        const status = e?.status;
        if (status === 401) {
          setError("session_expired");
          toast.error("Sua sessão expirou. Faça login novamente.");
        } else if (status === 403) {
          setError("forbidden");
          toast.error(
            "Você não tem permissão para baixar este atestado. Solicite a permissão `saude_atestados_download` ao SuperAdm."
          );
        } else if (status === 404) {
          setError("not_found");
          toast.error("Arquivo do atestado não encontrado.");
        } else {
          setError("preview_failed");
          toast.error(
            "Não foi possível carregar a pré-visualização do arquivo. Tente novamente."
          );
        }
      } finally {
        setLoadingId(null);
      }
    },
    [loadingId, previewFor]
  );

  const download = useCallback(
    (protocolo: string) => {
      if (!objectUrl) return;
      const ext = extFromMime(mime);
      const filename = `atestado-${protocolo}.${ext}`;
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    },
    [objectUrl, mime]
  );

  return {
    loadingId,
    previewFor,
    objectUrl,
    kind,
    mime,
    error,
    load,
    reset,
    download,
  };
}
