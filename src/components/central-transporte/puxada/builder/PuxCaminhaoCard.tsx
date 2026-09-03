/**
 * CT-5 Builder — Card compacto do caminhão no canvas da puxada.
 *
 * Mostra SOMENTE o que pertence ao caminhão: identificação e motorista. Data,
 * coleta e descarga pertencem à PUXADA e vivem no container principal.
 */
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { CheckCircle2, Truck, UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { puxDropId, vereditoCaminhao } from "@/lib/central-transporte/puxadaBuilder";
import type { CtMotoristaOperacional, CtPuxadaCaminhaoRascunho } from "@/types/centralTransportePuxada";

export interface PuxCaminhaoCardProps {
  caminhao: CtPuxadaCaminhaoRascunho;
  somenteLeitura: boolean;
  /** Fallback por clique para atribuir motorista. */
  motoristas: CtMotoristaOperacional[];
  onDefinirMotorista: (motoristaId: string | null) => void;
  onRemover: () => void;
}

export const PuxCaminhaoCard: React.FC<PuxCaminhaoCardProps> = ({
  caminhao,
  somenteLeitura,
  motoristas,
  onDefinirMotorista,
  onRemover,
}) => {
  const estado = vereditoCaminhao(caminhao);
  const { setNodeRef, isOver } = useDroppable({
    id: puxDropId({ tipo: "PUX_MOTORISTA_SLOT", chaveLocal: caminhao.chaveLocal }),
    disabled: somenteLeitura,
  });

  return (
    <div
      data-testid={`ct5-card-caminhao-${caminhao.caminhaoEquipamentoId}`}
      data-estado={estado}
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border p-2",
        estado === "PRONTO"
          ? "border-emerald-600/40 bg-emerald-600/5"
          : "border-amber-500/50 bg-amber-500/5",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Truck className="h-3.5 w-3.5 shrink-0 text-primary" />
        <span className="truncate text-xs font-medium">{caminhao.rotulo}</span>
        {caminhao.placa && (
          <span className="truncate text-[11px] text-muted-foreground">· {caminhao.placa}</span>
        )}
      </div>

      <div
        ref={setNodeRef}
        data-testid={`ct5-slot-motorista-${caminhao.chaveLocal}`}
        className={cn(
          "flex min-w-[190px] items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px]",
          isOver && "border-primary bg-primary/10",
          caminhao.motoristaFuncionarioId && "border-solid",
        )}
      >
        {caminhao.motoristaFuncionarioId ? (
          <>
            <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-600" />
            <span className="min-w-0 flex-1 truncate">
              {caminhao.motoristaNome || "Motorista definido"}
            </span>
            {!somenteLeitura && (
              <Button
                size="icon"
                variant="ghost"
                className="h-5 w-5 shrink-0"
                aria-label={`Remover motorista do caminhão ${caminhao.rotulo}`}
                onClick={() => onDefinirMotorista(null)}
                data-testid={`ct5-remover-motorista-${caminhao.chaveLocal}`}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={somenteLeitura}>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1 text-left text-muted-foreground"
                data-testid={`ct5-escolher-motorista-${caminhao.chaveLocal}`}
              >
                <UserPlus className="h-3 w-3" /> Arraste ou escolha o motorista
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
              <DropdownMenuLabel className="text-[11px]">Motorista</DropdownMenuLabel>
              {motoristas.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  className="text-xs"
                  onSelect={() => onDefinirMotorista(m.id)}
                >
                  {m.nomeCompleto}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Badge variant="outline" className="shrink-0 text-[10px]">
        {estado === "PRONTO" ? "Completo" : "Sem motorista"}
      </Badge>

      {!somenteLeitura && (
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
          aria-label={`Remover caminhão ${caminhao.rotulo}`}
          onClick={onRemover}
          data-testid={`ct5-remover-caminhao-${caminhao.caminhaoEquipamentoId}`}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default PuxCaminhaoCard;
