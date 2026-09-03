/**
 * CT-4 Builder — Card COMPACTO da parada no canvas.
 *
 * Mostra apenas o essencial (obra, data, recebedor, ativos) e é o drop target
 * da carga. Toda a edição (endereço, mapa, data/hora específica, recebedor,
 * observação) acontece no dialog "Editar entrega".
 */
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { CalendarDays, MapPin, Pencil, Trash2, UserCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  dataEspecifica,
  dataExibidaParada,
  movDropId,
  vereditoParada,
} from "@/lib/central-transporte/movDiretaBuilder";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
  type CtMovDiretaRascunho,
  type CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

export interface MovParadaCardProps {
  rascunho: CtMovDiretaRascunho;
  parada: CtParadaRascunho;
  ordem: number;
  ccLabel: string | null;
  catalogo: Map<string, CtAtivoMovimentacao>;
  somenteLeitura: boolean;
  podeRemover: boolean;
  onEditar: () => void;
  onRemover: () => void;
  onLimparRecebedor: () => void;
  onRetirarAtivo: (equipamentoId: string) => void;
  /** Nome do funcionário recebedor já resolvido pelo cadastro. */
  recebedorNome?: string | null;
}

export const MovParadaCard: React.FC<MovParadaCardProps> = ({
  rascunho,
  parada,
  ordem,
  ccLabel,
  catalogo,
  somenteLeitura,
  podeRemover,
  onEditar,
  onRemover,
  onLimparRecebedor,
  onRetirarAtivo,
  recebedorNome = null,
}) => {
  const estado = vereditoParada(parada);
  const { setNodeRef, isOver } = useDroppable({
    id: movDropId({ tipo: "MOV_PARADA_CARGA", chaveLocal: parada.chaveLocal }),
    disabled: somenteLeitura,
  });
  /* Destino e recebedor recebem LOCAL e RECEBEDOR arrastados do rail direito. */
  const destino = useDroppable({
    id: movDropId({ tipo: "MOV_PARADA_DESTINO", chaveLocal: parada.chaveLocal }),
    disabled: somenteLeitura,
  });
  const recebedorSlot = useDroppable({
    id: movDropId({ tipo: "MOV_RECEBEDOR_SLOT", chaveLocal: parada.chaveLocal }),
    disabled: somenteLeitura,
  });
  const recebedorLabel =
    parada.recebedorPrevistoNome ||
    (parada.recebedorPrevistoFuncionarioId ? recebedorNome : null);
  const data = dataExibidaParada(rascunho, parada);
  const especifica = dataEspecifica(rascunho, parada);

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct4-parada-card-${ordem}`}
      data-estado={estado}
      className={cn(
        "space-y-2 rounded-md border p-2",
        estado === "PRONTA"
          ? "border-emerald-600/40 bg-emerald-600/5"
          : "border-amber-500/50 bg-amber-500/5",
        isOver && "border-primary bg-primary/10",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div
          ref={destino.setNodeRef}
          data-testid={`ct4-parada-destino-${ordem}`}
          className={cn(
            "min-w-0 flex-1 rounded border px-1.5 py-1",
            ccLabel ? "border-transparent" : "border-dashed",
            destino.isOver && "border-primary bg-primary/10",
          )}
        >
          <p className="flex items-center gap-1 text-xs font-semibold">
            <MapPin className="h-3.5 w-3.5 text-primary" /> Parada {ordem}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ccLabel ?? "Arraste o centro de custo de destino aqui"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-[11px]"
            onClick={onEditar}
            data-testid={`ct4-editar-entrega-${ordem}`}
          >
            <Pencil className="mr-1 h-3 w-3" />
            {somenteLeitura ? "Ver entrega" : "Editar entrega"}
          </Button>
          {podeRemover && !somenteLeitura && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:bg-destructive/10"
              aria-label={`Remover parada ${ordem}`}
              onClick={onRemover}
              data-testid={`ct4-remover-parada-card-${ordem}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <Badge variant="outline" className="text-[10px]">
          <CalendarDays className="mr-1 h-3 w-3" />
          {data ? formatBrazilianDateForDisplay(data) : "sem data"}
          {parada.horaPrevista ? ` ${parada.horaPrevista.slice(0, 5)}` : ""}
        </Badge>
        {especifica && (
          <Badge variant="secondary" className="text-[10px]" data-testid={`ct4-data-especifica-${ordem}`}>
            Data específica
          </Badge>
        )}
        <span
          ref={recebedorSlot.setNodeRef}
          data-testid={`ct4-recebedor-slot-${ordem}`}
          className={cn(
            "inline-flex items-center gap-1 rounded border border-dashed px-1.5 py-0.5 text-muted-foreground",
            recebedorLabel && "border-solid text-foreground",
            recebedorSlot.isOver && "border-primary bg-primary/10",
          )}
        >
          <UserCheck className="h-3 w-3" />
          {recebedorLabel ?? "Arraste ou escolha recebedor"}
          {recebedorLabel && !somenteLeitura && (
            <button
              type="button"
              aria-label={`Remover recebedor da parada ${ordem}`}
              className="text-muted-foreground hover:text-destructive"
              onClick={onLimparRecebedor}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {parada.equipamentos.length === 0 ? (
          <p className="w-full rounded border border-dashed p-2 text-center text-[11px] text-muted-foreground">
            Arraste ativos para esta parada.
          </p>
        ) : (
          parada.equipamentos.map((id) => {
            const a = catalogo.get(id);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px]"
                data-testid={`ct4-chip-ativo-${id}`}
              >
                {a ? rotuloAtivoMovimentacao(a) : id.slice(0, 8)}
                {!somenteLeitura && (
                  <button
                    type="button"
                    aria-label="Retirar ativo desta parada"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => onRetirarAtivo(id)}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </span>
            );
          })
        )}
      </div>
    </div>
  );
};

export default MovParadaCard;
