/**
 * CT-4 Builder — mini-card compacto do ativo (rail esquerda).
 *
 * Elegibilidade é do SERVIDOR (`elegivel` / `bloqueioMotivo`): bloqueado
 * continua visível e apenas não é vinculável. Arrastar é aceleração — há
 * fallback por clique ("Vincular à parada…").
 */
import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical, MapPin, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { movDragId } from "@/lib/central-transporte/movDiretaBuilder";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
} from "@/types/centralTransporteMovDireta";

const STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_REGISTRO: "Sem registro",
};

export interface MovAtivoMiniCardProps {
  ativo: CtAtivoMovimentacao;
  /** Rótulo da parada em que o ativo já está, quando houver. */
  paradaRotulo?: string | null;
  desabilitado: boolean;
  paradas: { chaveLocal: string; rotulo: string }[];
  onVincular: (chaveLocal: string) => void;
  onRetirar?: () => void;
}

export const MovAtivoMiniCard: React.FC<MovAtivoMiniCardProps> = ({
  ativo,
  paradaRotulo = null,
  desabilitado,
  paradas,
  onVincular,
  onRetirar,
}) => {
  const bloqueado = !ativo.elegivel && !paradaRotulo;
  const arrastavel = !desabilitado && !bloqueado;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: movDragId("MOV_ATIVO", ativo.equipamentoId),
    disabled: !arrastavel,
    data: { ativo },
  });

  const tom = paradaRotulo
    ? "border-primary/40 bg-primary/5"
    : bloqueado
      ? "border-destructive/40 bg-destructive/5"
      : "border-emerald-600/40 bg-emerald-600/5";

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct4-ativo-mini-${ativo.equipamentoId}`}
      data-bloqueado={bloqueado ? "true" : "false"}
      data-vinculado={paradaRotulo ? "true" : "false"}
      title={ativo.bloqueioMotivo ?? undefined}
      className={cn("rounded-md border p-1.5 text-[11px]", tom, isDragging && "opacity-50")}
    >
      <div className="flex items-center gap-1">
        {arrastavel && (
          <button
            type="button"
            aria-label={`Arrastar ${rotuloAtivoMovimentacao(ativo)}`}
            className="cursor-grab text-muted-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {rotuloAtivoMovimentacao(ativo)}
        </span>
        {!desabilitado && !bloqueado && paradas.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 shrink-0"
                aria-label={`Vincular ${rotuloAtivoMovimentacao(ativo)} a uma parada`}
                data-testid={`ct4-vincular-${ativo.equipamentoId}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel className="text-[11px]">Vincular à parada…</DropdownMenuLabel>
              {paradas.map((p) => (
                <DropdownMenuItem
                  key={p.chaveLocal}
                  className="text-xs"
                  onSelect={() => onVincular(p.chaveLocal)}
                >
                  {p.rotulo}
                </DropdownMenuItem>
              ))}
              {paradaRotulo && onRetirar && (
                <DropdownMenuItem className="text-xs text-destructive" onSelect={onRetirar}>
                  Retirar da movimentação
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <p className="truncate text-[10px] text-muted-foreground">
        {ativo.tipoAtivo || ativo.placa || "Sem tipo"}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {paradaRotulo ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <MapPin className="h-3 w-3" /> {paradaRotulo}
          </span>
        ) : bloqueado ? (
          ativo.bloqueioMotivo ?? "Indisponível"
        ) : (
          STATUS_LABEL[ativo.statusOperacional] ?? ativo.statusOperacional
        )}
      </p>
    </div>
  );
};

export default MovAtivoMiniCard;
