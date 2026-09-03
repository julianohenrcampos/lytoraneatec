/**
 * CT-4 Builder — Dialog CENTRAL "Ajustar ponto" da origem.
 *
 * Reaproveita integralmente `PontoOperacionalBloco` (Combobox de centro de
 * custo, AddressAutocomplete e mapa). Nenhum campo novo: apenas move o
 * formulário permanente da antiga etapa "Origem da coleta" para um dialog.
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
import PontoOperacionalBloco, {
  type PontoOperacionalPatch,
} from "@/components/central-transporte/shared/PontoOperacionalBloco";

export interface AjustarPontoDialogProps {
  aberto: boolean;
  centrosCusto: ComboboxOption[];
  centroCustoId: string | null;
  centroCustoEndereco: string | null;
  ponto: string;
  latitude: number | null;
  longitude: number | null;
  somenteLeitura: boolean;
  onOpenChange: (aberto: boolean) => void;
  onChange: (patch: PontoOperacionalPatch) => void;
}

export const AjustarPontoDialog: React.FC<AjustarPontoDialogProps> = ({
  aberto,
  centrosCusto,
  centroCustoId,
  centroCustoEndereco,
  ponto,
  latitude,
  longitude,
  somenteLeitura,
  onOpenChange,
  onChange,
}) => (
  <Dialog open={aberto} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl" data-testid="ct4-ajustar-ponto-dialog">
      <DialogHeader>
        <DialogTitle className="text-sm">Origem — ponto de coleta</DialogTitle>
        <DialogDescription className="text-xs">
          Obra/centro de custo, endereço e ponto exato de onde os ativos saem.
        </DialogDescription>
      </DialogHeader>

      <div className="max-h-[60vh] overflow-y-auto pr-1">
        <PontoOperacionalBloco
          semMoldura
          titulo="Origem — coleta"
          labelCentroCusto="Centro de custo / local"
          placeholderCentroCusto="De onde os ativos saem"
          labelPonto="Ponto exato de coleta"
          centrosCusto={centrosCusto}
          centroCustoId={centroCustoId}
          centroCustoEndereco={centroCustoEndereco}
          ponto={ponto}
          latitude={latitude}
          longitude={longitude}
          somenteLeitura={somenteLeitura}
          testId="ct4-origem"
          onChange={onChange}
        />
      </div>

      <DialogFooter>
        <Button size="sm" onClick={() => onOpenChange(false)} data-testid="ct4-ponto-concluir">
          Concluir
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default AjustarPontoDialog;
