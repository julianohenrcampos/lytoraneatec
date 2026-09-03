/**
 * CT-4 Builder — Rail direita: LOCAIS / CENTROS DE CUSTO arrastáveis.
 *
 * Fonte: exatamente `useCtMobilizacaoCadastros` (bd_centros_custo com endereço
 * e coordenadas). O drag é puramente do cliente: soltar um local apenas
 * preenche o rascunho com os dados CANÔNICOS do cadastro.
 */
import React, { useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MapPinned } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { movDragId, type MovLocal } from "@/lib/central-transporte/movDiretaBuilder";

const LocalItem: React.FC<{
  local: MovLocal;
  escolhido: boolean;
  desabilitado: boolean;
  onAplicar: () => void;
}> = ({ local, escolhido, desabilitado, onAplicar }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: movDragId("MOV_LOCAL", local.id),
    disabled: desabilitado,
    data: { local },
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct4-local-${local.id}`}
      data-escolhido={escolhido ? "true" : "false"}
      title={local.endereco ?? local.rotulo}
      className={cn(
        "flex items-start gap-1 rounded-md border px-1.5 py-1 text-[11px]",
        escolhido ? "border-primary/50 bg-primary/5" : "border-border",
        isDragging && "opacity-50",
      )}
    >
      {!desabilitado && (
        <button
          type="button"
          aria-label={`Arrastar ${local.rotulo}`}
          className="mt-0.5 cursor-grab text-muted-foreground"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <button
        type="button"
        disabled={desabilitado}
        className="min-w-0 flex-1 text-left"
        onClick={onAplicar}
      >
        <span className="block truncate font-medium">{local.rotulo}</span>
        {local.endereco && (
          <span className="block truncate text-[10px] text-muted-foreground">
            {local.endereco}
          </span>
        )}
      </button>
    </div>
  );
};


export interface MovLocaisPanelProps {
  locais: MovLocal[];
  isLoading: boolean;
  desabilitado: boolean;
  origemId: string | null;
  /** Clique = fallback do drag: aplica como ORIGEM quando ela está vazia. */
  onAplicarComoOrigem: (local: MovLocal) => void;
}

export const MovLocaisPanel: React.FC<MovLocaisPanelProps> = ({
  locais,
  isLoading,
  desabilitado,
  origemId,
  onAplicarComoOrigem,
}) => {
  const [termo, setTermo] = useState("");

  const filtrados = useMemo(() => {
    const t = termo.trim().toUpperCase();
    if (!t) return locais;
    return locais.filter((l) => `${l.rotulo} ${l.endereco ?? ""}`.toUpperCase().includes(t));
  }, [locais, termo]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5" data-testid="ct4-painel-locais">
      <div className="flex items-center justify-between gap-1">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
          <MapPinned className="h-3.5 w-3.5" /> Locais / CC
        </p>
        <Badge variant="outline" className="text-[10px]">
          {filtrados.length}
        </Badge>
      </div>

      <Input
        value={termo}
        placeholder="Buscar local..."
        className="h-7 text-[11px]"
        onChange={(e) => setTermo(e.target.value)}
        data-testid="ct4-locais-busca"
      />

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain pr-0.5">
        {isLoading ? (
          <>
            <Skeleton className="h-7 w-full" />
            <Skeleton className="h-7 w-full" />
          </>
        ) : filtrados.length === 0 ? (
          <p className="rounded-md border border-dashed p-2 text-center text-[11px] text-muted-foreground">
            Nenhum local encontrado.
          </p>
        ) : (
          filtrados.map((l) => (
            <LocalItem
              key={l.id}
              local={l}
              escolhido={l.id === origemId}
              desabilitado={desabilitado}
              onAplicar={() => onAplicarComoOrigem(l)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default MovLocaisPanel;
