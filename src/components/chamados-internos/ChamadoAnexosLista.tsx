/**
 * Exibe anexos já persistidos de um Chamado Interno.
 * Bucket privado: cada item resolve uma URL assinada sob demanda.
 */
import React from "react";
import { FileText, Loader2 } from "lucide-react";
import { getSignedAnexoUrl } from "@/services/chamadosInternosService";
import type { ChamadoInternoAnexoRow } from "@/types/chamadosInternos";

export interface ChamadoAnexosListaProps {
  anexos: ChamadoInternoAnexoRow[];
  isLoading?: boolean;
  titulo?: string;
  compacto?: boolean;
}

export const ChamadoAnexosLista: React.FC<ChamadoAnexosListaProps> = ({
  anexos,
  isLoading,
  titulo,
  compacto,
}) => {
  const [urls, setUrls] = React.useState<Record<string, string | null>>({});

  React.useEffect(() => {
    let cancelado = false;
    (async () => {
      const faltantes = anexos.filter((a) => !(a.storage_path in urls));
      if (faltantes.length === 0) return;
      const pares = await Promise.all(
        faltantes.map(
          async (a) => [a.storage_path, await getSignedAnexoUrl(a.storage_path)] as const,
        ),
      );
      if (cancelado) return;
      setUrls((prev) => {
        const next = { ...prev };
        for (const [p, u] of pares) next[p] = u;
        return next;
      });
    })();
    return () => {
      cancelado = true;
    };
  }, [anexos, urls]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando anexos...
      </div>
    );
  }

  if (anexos.length === 0) return null;

  return (
    <div className="space-y-2">
      {titulo && (
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</div>
      )}
      <ul className="flex flex-wrap gap-2">
        {anexos.map((a) => {
          const url = urls[a.storage_path];
          const isImagem = a.mime_type.startsWith("image/");
          const tamanho = compacto ? "h-16 w-16" : "h-20 w-24";
          return (
            <li key={a.id} className="flex flex-col items-start gap-1">
              <a
                href={url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className={`flex ${tamanho} items-center justify-center overflow-hidden rounded border bg-muted`}
                aria-label={`Abrir ${a.nome_arquivo}`}
              >
                {isImagem && url ? (
                  <img src={url} alt={a.nome_arquivo} className="h-full w-full object-cover" />
                ) : url === null ? (
                  <span className="px-1 text-center text-[10px] text-muted-foreground">
                    Indisponível
                  </span>
                ) : isImagem ? (
                  <span className="h-full w-full animate-pulse" />
                ) : (
                  <FileText className="h-6 w-6 text-muted-foreground" aria-hidden />
                )}
              </a>
              <span
                className="max-w-[6rem] truncate text-[10px] text-muted-foreground"
                title={a.nome_arquivo}
              >
                {a.nome_arquivo}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ChamadoAnexosLista;
