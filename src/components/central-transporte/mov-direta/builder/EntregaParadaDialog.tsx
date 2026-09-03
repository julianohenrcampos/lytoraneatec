/**
 * CT-4 Builder — Dialog CENTRAL "Dados da entrega" da parada.
 *
 * Reaproveita integralmente `ParadaEditor` (centro de custo, endereço,
 * PontoOperacionalBloco/Mapbox, data/hora específica, recebedor interno ou
 * externo e observação). Os ATIVOS não aparecem aqui: pertencem ao canvas do
 * Builder. Nenhum campo novo — apenas o formulário sob demanda.
 */
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { ComboboxOption } from "@/components/ui/combobox";
import ParadaEditor from "@/components/central-transporte/mov-direta/ParadaEditor";
import type {
  CtAtivoMovimentacao,
  CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";

export interface EntregaParadaDialogProps {
  aberto: boolean;
  parada: CtParadaRascunho | null;
  ordem: number;
  centrosCusto: ComboboxOption[];
  enderecosCentroCusto: Record<string, string | null>;
  funcionarios: ComboboxOption[];
  metadadosAtivos: Map<string, CtAtivoMovimentacao>;
  alocadosEmOutrasParadas: Map<string, { indice: number; rotulo: string }>;
  podeRemover: boolean;
  somenteLeitura: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (patch: Partial<CtParadaRascunho>) => void;
  onRemover: () => void;
  onConhecerAtivo?: (ativo: CtAtivoMovimentacao) => void;
}

export const EntregaParadaDialog: React.FC<EntregaParadaDialogProps> = ({
  aberto,
  parada,
  ordem,
  centrosCusto,
  enderecosCentroCusto,
  funcionarios,
  metadadosAtivos,
  alocadosEmOutrasParadas,
  podeRemover,
  somenteLeitura,
  onOpenChange,
  onChange,
  onRemover,
  onConhecerAtivo,
}) => (
  <Dialog open={aberto && !!parada} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl" data-testid="ct4-entrega-dialog">
      <DialogHeader>
        <DialogTitle className="text-sm">Dados da entrega — parada {ordem}</DialogTitle>
        <DialogDescription className="text-xs">
          Obra, endereço, ponto no mapa, data/hora específica e recebedor desta parada.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[68vh] overflow-y-auto pr-1">
        {parada && (
          <ParadaEditor
            key={parada.chaveLocal}
            parada={parada}
            ordem={ordem}
            centrosCusto={centrosCusto}
            enderecosCentroCusto={enderecosCentroCusto}
            funcionarios={funcionarios}
            metadadosAtivos={metadadosAtivos}
            alocadosEmOutrasParadas={alocadosEmOutrasParadas}
            ocultarAtivos
            podeRemover={podeRemover}
            desabilitado={somenteLeitura}
            onChange={onChange}
            onConhecerAtivo={onConhecerAtivo}
            onRemover={() => {
              onRemover();
              onOpenChange(false);
            }}
          />
        )}
      </div>

      <DialogFooter>
        <Button size="sm" onClick={() => onOpenChange(false)} data-testid="ct4-entrega-concluir">
          Concluir
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default EntregaParadaDialog;
