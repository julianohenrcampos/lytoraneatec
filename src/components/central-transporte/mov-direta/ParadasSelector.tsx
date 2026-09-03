/**
 * CT-4 UX — Seletor compacto de paradas.
 *
 * Requisito de layout: nenhuma parada é renderizada por inteiro em paralelo.
 * Aqui só existe navegação — o formulário expandido é o da parada selecionada.
 */
import React from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { CtParadaRascunho } from "@/types/centralTransporteMovDireta";

export interface ParadasSelectorProps {
  paradas: CtParadaRascunho[];
  selecionada: string | null;
  rotuloParada: (indice: number) => string;
  somenteLeitura: boolean;
  onSelecionar: (chaveLocal: string) => void;
  onAdicionar: () => void;
}

export const ParadasSelector: React.FC<ParadasSelectorProps> = ({
  paradas,
  selecionada,
  rotuloParada,
  somenteLeitura,
  onSelecionar,
  onAdicionar,
}) => (
  <div className="flex flex-wrap items-center gap-2" data-testid="ct4-paradas-selector">
    {paradas.map((p, i) => {
      const ativo = p.chaveLocal === selecionada;
      return (
        <button
          key={p.chaveLocal}
          type="button"
          data-testid={`ct4-parada-chip-${i + 1}`}
          data-selecionado={ativo ? "true" : "false"}
          className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-[11px] transition-colors hover:bg-muted/50 ${
            ativo ? "border-primary bg-primary/5 font-medium" : ""
          }`}
          onClick={() => onSelecionar(p.chaveLocal)}
        >
          <span>{i + 1}</span>
          <span className="text-muted-foreground">•</span>
          <span>{rotuloParada(i)}</span>
          <Badge variant="outline" className="text-[10px]">
            {p.equipamentos.length} ativo(s)
          </Badge>
        </button>
      );
    })}

    {!somenteLeitura && (
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1 text-[11px]"
        onClick={onAdicionar}
        data-testid="ct4-adicionar-parada"
      >
        <Plus className="h-3.5 w-3.5" /> Adicionar parada
      </Button>
    )}
  </div>
);

export default ParadasSelector;
