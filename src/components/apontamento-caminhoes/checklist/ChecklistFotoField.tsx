import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X } from "lucide-react";
import { getSignedFotoUrl } from "@/services/apontamentoCaminhoesService";

interface FotoLocal {
  localId: string;
  file: File;
  previewUrl: string;
}

interface Props {
  itemCodigo: string;
  fotosSalvas: string[]; // storage paths já persistidos
  fotosNovas: FotoLocal[]; // pendentes de upload
  onAddFiles: (files: File[]) => void;
  onRemoveLocal: (localId: string) => void;
  onRemoveSalva: (path: string) => void;
  disabled?: boolean;
}

const ChecklistFotoField: React.FC<Props> = ({
  itemCodigo,
  fotosSalvas,
  fotosNovas,
  onAddFiles,
  onRemoveLocal,
  onRemoveSalva,
  disabled,
}) => {
  const [signedMap, setSignedMap] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      const missing = fotosSalvas.filter((p) => !(p in signedMap));
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (p) => [p, await getSignedFotoUrl(p)] as const)
      );
      if (cancel) return;
      setSignedMap((prev) => {
        const next = { ...prev };
        for (const [p, u] of entries) next[p] = u;
        return next;
      });
    })();
    return () => {
      cancel = true;
    };
  }, [fotosSalvas, signedMap]);

  const inputId = `checklist-foto-${itemCodigo}`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {fotosSalvas.map((path) => {
          const url = signedMap[path];
          return (
            <div
              key={path}
              className="relative w-16 h-16 sm:w-20 sm:h-20 border rounded overflow-hidden bg-muted"
            >
              {url ? (
                <img src={url} alt="" className="object-cover w-full h-full" />
              ) : url === null ? (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                  Indisponível
                </div>
              ) : (
                <div className="w-full h-full animate-pulse" />
              )}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onRemoveSalva(path)}
                  className="absolute top-0 right-0 bg-black/60 text-white rounded-bl px-1"
                  aria-label="Remover foto"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
        {fotosNovas.map((f) => (
          <div
            key={f.localId}
            className="relative w-16 h-16 sm:w-20 sm:h-20 border rounded overflow-hidden bg-muted"
          >
            <img src={f.previewUrl} alt="" className="object-cover w-full h-full" />
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemoveLocal(f.localId)}
                className="absolute top-0 right-0 bg-black/60 text-white rounded-bl px-1"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <div>
        <input
          id={inputId}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          multiple
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            if (!e.target.files || e.target.files.length === 0) return;
            const files = Array.from(e.target.files);
            onAddFiles(files);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => document.getElementById(inputId)?.click()}
        >
          <Camera className="h-4 w-4 mr-1" />
          Adicionar foto
        </Button>
      </div>
    </div>
  );
};

export default ChecklistFotoField;
