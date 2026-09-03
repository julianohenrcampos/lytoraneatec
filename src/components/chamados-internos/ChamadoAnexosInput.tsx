/**
 * Seleção de anexos (imagens e PDF) para Chamados Internos.
 * Valida tipo, tamanho (10MB) e limite (5 arquivos) no cliente — o backend
 * reforça as mesmas regras na RPC `fn_chamado_interno_anexos_registrar`.
 */
import React from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  CHAMADO_ANEXO_MAX_ARQUIVOS,
  CHAMADO_ANEXO_MAX_BYTES,
  CHAMADO_ANEXO_MIMES_ACEITOS,
} from "@/types/chamadosInternos";

export interface ChamadoAnexosInputProps {
  inputId: string;
  arquivos: File[];
  onChange: (arquivos: File[]) => void;
  disabled?: boolean;
  label?: string;
}

const MIMES = CHAMADO_ANEXO_MIMES_ACEITOS as readonly string[];

function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const ChamadoAnexosInput: React.FC<ChamadoAnexosInputProps> = ({
  inputId,
  arquivos,
  onChange,
  disabled,
  label = "Anexos (imagens ou PDF)",
}) => {
  const [erro, setErro] = React.useState<string | null>(null);
  const urlsRef = React.useRef<Map<File, string>>(new Map());

  const previewUrl = React.useCallback((file: File): string => {
    const existente = urlsRef.current.get(file);
    if (existente) return existente;
    const url = URL.createObjectURL(file);
    urlsRef.current.set(file, url);
    return url;
  }, []);

  React.useEffect(() => {
    // Revoga URLs de arquivos que saíram da lista.
    const atuais = new Set(arquivos);
    urlsRef.current.forEach((url, file) => {
      if (!atuais.has(file)) {
        URL.revokeObjectURL(url);
        urlsRef.current.delete(file);
      }
    });
  }, [arquivos]);

  React.useEffect(() => {
    const mapa = urlsRef.current;
    return () => {
      mapa.forEach((url) => URL.revokeObjectURL(url));
      mapa.clear();
    };
  }, []);

  const adicionar = (lista: FileList) => {
    const novos: File[] = [];
    const problemas: string[] = [];

    for (const file of Array.from(lista)) {
      if (!MIMES.includes(file.type)) {
        problemas.push(`${file.name}: tipo não permitido (use JPG, PNG, WEBP ou PDF).`);
        continue;
      }
      if (file.size > CHAMADO_ANEXO_MAX_BYTES) {
        problemas.push(`${file.name}: excede 10MB.`);
        continue;
      }
      novos.push(file);
    }

    const total = [...arquivos, ...novos];
    if (total.length > CHAMADO_ANEXO_MAX_ARQUIVOS) {
      problemas.push(`Máximo de ${CHAMADO_ANEXO_MAX_ARQUIVOS} arquivos.`);
    }

    onChange(total.slice(0, CHAMADO_ANEXO_MAX_ARQUIVOS));
    setErro(problemas.length > 0 ? problemas.join(" ") : null);
  };

  const remover = (index: number) => {
    setErro(null);
    onChange(arquivos.filter((_, i) => i !== index));
  };

  const limiteAtingido = arquivos.length >= CHAMADO_ANEXO_MAX_ARQUIVOS;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>{label}</Label>
        <span className="text-xs text-muted-foreground">
          {arquivos.length}/{CHAMADO_ANEXO_MAX_ARQUIVOS} · até 10MB cada
        </span>
      </div>

      <input
        id={inputId}
        type="file"
        multiple
        accept={MIMES.join(",")}
        className="hidden"
        disabled={disabled || limiteAtingido}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) adicionar(e.target.files);
          e.target.value = "";
        }}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled || limiteAtingido}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <Paperclip className="mr-2 h-4 w-4" />
        Adicionar arquivos
      </Button>

      {arquivos.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {arquivos.map((file, i) => {
            const isImagem = file.type.startsWith("image/");
            return (
              <li
                key={`${file.name}-${i}`}
                className="relative flex w-36 flex-col gap-1 rounded-md border bg-card p-2"
              >
                <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded bg-muted">
                  {isImagem ? (
                    <img
                      src={previewUrl(file)}
                      alt={file.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <FileText className="h-8 w-8 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <span className="truncate text-[11px] font-medium" title={file.name}>
                  {file.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {formatarTamanho(file.size)}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => remover(i)}
                    className="absolute right-1 top-1 rounded bg-foreground/70 p-0.5 text-background"
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {erro && (
        <p className={cn("text-xs text-destructive")} role="alert">
          {erro}
        </p>
      )}
    </div>
  );
};

export default ChamadoAnexosInput;
