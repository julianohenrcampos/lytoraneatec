/**
 * CT-6 — Card compacto do ativo já reservado (coluna esquerda do Transport Builder).
 *
 * Apresentação apenas. Arrastar é aceleração: todo comportamento existe também
 * por clique/menu e por teclado.
 */
import React from "react";
import { useDraggable } from "@dnd-kit/core";
import { CheckCircle2, GripVertical, MapPin } from "lucide-react";
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
import { rotuloAtivo } from "@/lib/central-transporte/mobilizacaoRascunho";
import {
  CT_ATIVO_ESTADO_LABEL,
  dragId,
  type CtAtivoBuilderEstado,
} from "@/lib/central-transporte/transportBuilder";
import type { CtAtivoMobilizavel } from "@/types/centralTransporteMobilizacao";

const TOM: Record<CtAtivoBuilderEstado, string> = {
  JA_NO_DESTINO: "border-emerald-600/40 bg-emerald-600/5",
  SEM_PLANEJAMENTO: "border-border",
  EM_VIAGEM_NAO_SALVA: "border-amber-500/50 bg-amber-500/5",
  SALVO: "border-emerald-600/40 bg-emerald-600/5",
  PROGRAMADO: "border-primary/40 bg-primary/5",
};

export interface AtivoBuilderCardProps {
  ativo: CtAtivoMobilizavel;
  estado: CtAtivoBuilderEstado;
  /** Rótulo da viagem em que o ativo está, quando houver. */
  viagemRotulo?: string | null;
  desabilitado?: boolean;
  selecionado?: boolean;
  /** Viagens disponíveis para o fallback "Adicionar à viagem...". */
  viagens: { chaveLocal: string; rotulo: string }[];
  onFocar: () => void;
  onAdicionarNaViagem: (chaveLocal: string) => void;
  onNovaViagem: () => void;
  onRetirar?: () => void;
}

export const AtivoBuilderCard: React.FC<AtivoBuilderCardProps> = ({
  ativo,
  estado,
  viagemRotulo = null,
  desabilitado = false,
  selecionado = false,
  viagens,
  onFocar,
  onAdicionarNaViagem,
  onNovaViagem,
  onRetirar,
}) => {
  const local = estado === "JA_NO_DESTINO";
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: dragId("ATIVO", ativo.atendimentoId),
    disabled: desabilitado || local,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct6-ativo-${ativo.atendimentoId}`}
      data-estado={estado}
      className={cn(
        "min-h-[70px] rounded-md border p-2.5 text-xs transition-shadow",
        TOM[estado],
        selecionado && "ring-2 ring-primary/60",
        isDragging && "opacity-50 shadow-lg",
      )}
    >
      <div className="flex items-start gap-1">
        {!desabilitado && !local && (
          <button
            type="button"
            aria-label={`Arrastar ${rotuloAtivo(ativo)}`}
            className="mt-0.5 cursor-grab text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={onFocar}
          data-testid={`ct6-ativo-focar-${ativo.atendimentoId}`}
        >
          <p className="truncate font-semibold">{rotuloAtivo(ativo)}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {ativo.centroCustoAtualNome ?? "Sem centro de custo atual"}
          </p>
        </button>
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {local ? (
          <Badge
            variant="outline"
            className="gap-1 border-emerald-600/50 bg-emerald-600/10 text-[10px]"
            data-testid={`ct6-ativo-local-${ativo.atendimentoId}`}
          >
            <CheckCircle2 className="h-3 w-3" /> Já no destino
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px]">
            {viagemRotulo ?? CT_ATIVO_ESTADO_LABEL[estado]}
          </Badge>
        )}
      </div>

      {local ? (
        <p className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
          <MapPin className="h-3 w-3" /> Atendimento local — sem viagem
        </p>
      ) : (
        !desabilitado && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="mt-1 h-6 w-full justify-start px-1 text-[10px]"
                data-testid={`ct6-ativo-menu-${ativo.atendimentoId}`}
              >
                Adicionar à viagem…
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="text-xs">
              <DropdownMenuLabel className="text-[10px]">Destino do ativo</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onNovaViagem()}>Criar nova viagem</DropdownMenuItem>
              {viagens.map((v) => (
                <DropdownMenuItem
                  key={v.chaveLocal}
                  onSelect={() => onAdicionarNaViagem(v.chaveLocal)}
                >
                  {v.rotulo}
                </DropdownMenuItem>
              ))}
              {onRetirar && (
                <DropdownMenuItem onSelect={() => onRetirar()}>
                  Retirar do planejamento
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )
      )}
    </div>
  );
};

export default AtivoBuilderCard;
