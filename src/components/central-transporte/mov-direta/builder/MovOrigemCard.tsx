/**
 * CT-4 Builder — ORIGEM compacta (drop target `MOV_ORIGEM`).
 *
 * Não expõe select/inputs permanentes: mostra o local canônico já resolvido e
 * um botão "Ajustar ponto" que abre o dialog central com o mapa existente.
 */
import React from "react";
import { useDroppable } from "@dnd-kit/core";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { movDropId } from "@/lib/central-transporte/movDiretaBuilder";

export interface MovOrigemCardProps {
  rotulo: string | null;
  endereco: string | null;
  pontoExato: string;
  somenteLeitura: boolean;
  onAjustarPonto: () => void;
}

export const MovOrigemCard: React.FC<MovOrigemCardProps> = ({
  rotulo,
  endereco,
  pontoExato,
  somenteLeitura,
  onAjustarPonto,
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: movDropId({ tipo: "MOV_ORIGEM" }),
    disabled: somenteLeitura,
  });

  return (
    <div
      ref={setNodeRef}
      data-testid="ct4-origem-card"
      data-definida={rotulo ? "true" : "false"}
      className={cn(
        "flex flex-wrap items-center justify-between gap-2 rounded-md border p-2",
        rotulo ? "border-solid" : "border-dashed",
        isOver && "border-primary bg-primary/10",
      )}
    >
      <div className="min-w-0">
        <p className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
          <MapPin className="h-3 w-3" /> Origem
        </p>
        {rotulo ? (
          <>
            <p className="truncate text-xs font-medium">{rotulo}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {pontoExato || endereco || "Endereço não cadastrado"}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-muted-foreground">
            Arraste o local de origem aqui.
          </p>
        )}
      </div>

      <Button
        size="sm"
        variant="outline"
        className="h-7 text-[11px]"
        onClick={onAjustarPonto}
        data-testid="ct4-ajustar-ponto-origem"
      >
        <SlidersHorizontal className="mr-1 h-3 w-3" />
        {somenteLeitura ? "Ver ponto" : "Ajustar ponto"}
      </Button>
    </div>
  );
};

export default MovOrigemCard;
