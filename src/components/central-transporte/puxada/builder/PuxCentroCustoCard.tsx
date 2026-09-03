/**
 * CT-5 Builder — CENTRO DE CUSTO da puxada (drop target `PUX_CENTRO_CUSTO`).
 *
 * Mesma linguagem visual do `MovOrigemCard` (CT-4). Não cria campo concorrente:
 * escreve exatamente `centroCustoId` do rascunho já existente. Fallback por
 * clique fica na rail de Locais / CC e no Combobox de busca.
 */
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { puxDropId } from "@/lib/central-transporte/puxadaBuilder";

export interface PuxCentroCustoCardProps {
  centroCustoId: string | null;
  rotulo: string | null;
  endereco: string | null;
  centrosCusto: ComboboxOption[];
  somenteLeitura: boolean;
  onSelecionar: (id: string | null) => void;
}

export const PuxCentroCustoCard: React.FC<PuxCentroCustoCardProps> = ({
  centroCustoId,
  rotulo,
  endereco,
  centrosCusto,
  somenteLeitura,
  onSelecionar,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: puxDropId({ tipo: "PUX_CENTRO_CUSTO" }),
    disabled: somenteLeitura,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="ct5-cc-card"
      data-definido={centroCustoId ? "true" : "false"}
      className={cn(
        "space-y-1.5 rounded-md border p-2",
        centroCustoId ? "border-solid" : "border-dashed",
        isOver && "border-primary bg-primary/10",
      )}
    >
      <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
        <MapPin className="h-3 w-3" /> Centro de custo *
      </p>

      {centroCustoId ? (
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{rotulo ?? "Centro de custo"}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {endereco || "Endereço não cadastrado"}
            </p>
          </div>
          {!somenteLeitura && (
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 shrink-0"
              aria-label="Remover centro de custo"
              onClick={() => onSelecionar(null)}
              data-testid="ct5-cc-limpar"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          Arraste o Centro de Custo aqui (ou selecione abaixo).
        </p>
      )}

      {!somenteLeitura && (
        <Combobox
          value={centroCustoId ?? ""}
          options={centrosCusto}
          placeholder="Obra atendida pela puxada"
          searchPlaceholder="Buscar centro de custo..."
          onChange={(v) => onSelecionar(v || null)}
        />
      )}
    </div>
  );
};

export default PuxCentroCustoCard;
