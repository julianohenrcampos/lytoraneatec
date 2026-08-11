import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, X } from "lucide-react";
import { getSignedFotoCtUrl } from "@/services/ctOperacaoService";

interface Props {
  inputId: string;
  fotos: string[];
  onUpload: (files: File[]) => Promise<void>;
  onRemove: (path: string) => void;
  disabled?: boolean;
}

/** CT-3E — Fotos do checklist/recebimento no bucket privado ct-checklists. */
const CtFotoField: React.FC<Props> = ({ inputId, fotos, onUpload, onRemove, disabled }) => {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const faltantes = fotos.filter((p) => !(p in urls));
      if (faltantes.length === 0) return;
      const pares = await Promise.all(
        faltantes.map(async (p) => [p, await getSignedFotoCtUrl(p)] as const),
      );
      if (cancel) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [p, u] of pares) next[p] = u;
        return next;
      });
    })();
    return () => {
      cancel = true;
    };
  }, [fotos, urls]);

  return (
    <div className="space-y-2">
      {fotos.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {fotos.map((path) => (
            <div
              key={path}
              className="relative h-16 w-16 overflow-hidden rounded border bg-muted sm:h-20 sm:w-20"
            >
              {urls[path] ? (
                <img src={urls[path] as string} alt="" className="h-full w-full object-cover" />
              ) : urls[path] === null ? (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">
                  Indisponível
                </div>
              ) : (
                <div className="h-full w-full animate-pulse" />
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemove(path)}
                  className="absolute right-0 top-0 rounded-bl bg-foreground/60 px-1 text-background"
                  aria-label="Remover foto"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        className="hidden"
        disabled={disabled || enviando}
        onChange={async (e) => {
          if (!e.target.files || e.target.files.length === 0) return;
          const files = Array.from(e.target.files);
          e.target.value = "";
          setEnviando(true);
          try {
            await onUpload(files);
          } finally {
            setEnviando(false);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={disabled || enviando}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        {enviando ? (
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Camera className="mr-1 h-3.5 w-3.5" />
        )}
        Adicionar foto
      </Button>
    </div>
  );
};

export default CtFotoField;
