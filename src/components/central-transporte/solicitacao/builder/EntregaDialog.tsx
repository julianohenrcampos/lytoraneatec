/**
 * CT-6.2 — Dialog CENTRAL "Dados da entrega" (substitui o Sheet lateral como
 * experiência comum de edição do local/recebedor da viagem).
 *
 * Reutiliza exatamente os mecanismos existentes:
 *  - `AddressAutocomplete` (busca de logradouro já usada na CT);
 *  - `MapAdjustModal` (Mapbox) aberto SOMENTE sob demanda;
 *  - campos já existentes do rascunho de viagem — nenhuma coluna nova:
 *    `destinoPontoExato`, `destinoDescargaLatitude/Longitude`,
 *    `recebedorPrevistoFuncionarioId`, `recebedorPrevistoNome`,
 *    `recebedorPrevistoTelefone`, `observacoes`.
 *
 * LIMITAÇÃO DECLARADA: o contrato atual do rascunho/RPC não possui campos
 * próprios para EMPRESA e DOCUMENTO do recebedor externo — quando informados,
 * ficam registrados em `observacoes` (campo persistido existente).
 */
import React from "react";
import { MapPin, UserCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import AddressAutocomplete from "@/components/shared/AddressAutocomplete";
import MapAdjustModal, { type MapAdjustResult } from "@/components/shared/MapAdjustModal";
import type { CtViagemRascunho } from "@/types/centralTransporteMobilizacao";
import { rotuloCc, type CcGeoInfo } from "@/utils/central-transporte/autoPreencherViagem";

export interface EntregaDialogProps {
  viagem: CtViagemRascunho | null;
  destinoCc: CcGeoInfo | null;
  destinoCcEndereco: string | null;
  /** Rótulo do recebedor funcionário já resolvido pela lista do CC destino. */
  recebedorLabel: string | null;
  somenteLeitura: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: Partial<CtViagemRascunho>) => void;
}

export const EntregaDialog: React.FC<EntregaDialogProps> = ({
  viagem,
  destinoCc,
  destinoCcEndereco,
  recebedorLabel,
  somenteLeitura,
  onOpenChange,
  onPatch,
}) => {
  const [mapaAberto, setMapaAberto] = React.useState(false);

  if (!viagem) return null;

  const externo = !viagem.recebedorPrevistoFuncionarioId;
  const enderecoAtual = viagem.destinoPontoExato || destinoCcEndereco || "";

  const confirmarMapa = (r: MapAdjustResult) => {
    onPatch({
      destinoDescargaLatitude: r.latitude,
      destinoDescargaLongitude: r.longitude,
      destinoPontoExato: viagem.destinoPontoExato.trim() || r.endereco_completo || "",
    });
    setMapaAberto(false);
  };

  return (
    <>
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent
          className="max-h-[85vh] max-w-2xl overflow-y-auto"
          data-testid="ct6-dialog-entrega"
        >
          <DialogHeader>
            <DialogTitle className="text-sm">Dados da entrega</DialogTitle>
            <DialogDescription className="text-xs">
              O centro de custo da solicitação não muda: aqui você ajusta apenas o local e quem
              receberá.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-xs">
            {/* Centro de custo — informativo, nunca editável aqui. */}
            <div className="space-y-1">
              <Label className="text-[11px]">Centro de Custo</Label>
              <p
                className="rounded-md border bg-muted/40 px-2 py-1.5 text-[11px] font-medium"
                data-testid="ct6-entrega-cc"
              >
                {rotuloCc(destinoCc)}
              </p>
            </div>

            {/* Local de entrega — endereço pesquisável, mapa somente sob demanda. */}
            <div className="space-y-1">
              <Label className="text-[11px]">Local de entrega</Label>
              <div data-testid="ct6-entrega-endereco">
                <AddressAutocomplete
                  value={enderecoAtual}
                  initialLatitude={viagem.destinoDescargaLatitude}
                  initialLongitude={viagem.destinoDescargaLongitude}
                  disabled={somenteLeitura}
                  placeholder="Frente de trabalho, portaria, pátio..."
                  onAddressSelected={(r) =>
                    onPatch({
                      destinoPontoExato: r.endereco_completo,
                      destinoDescargaLatitude: r.latitude,
                      destinoDescargaLongitude: r.longitude,
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-muted-foreground">
                  {viagem.destinoDescargaLatitude === null ||
                  viagem.destinoDescargaLongitude === null
                    ? "Ponto não ajustado"
                    : `${viagem.destinoDescargaLatitude.toFixed(6)}, ${viagem.destinoDescargaLongitude.toFixed(6)}`}
                </span>
                {!somenteLeitura && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-[11px]"
                    data-testid="ct6-entrega-ajustar-mapa"
                    onClick={() => setMapaAberto(true)}
                  >
                    <MapPin className="h-3.5 w-3.5" /> Ajustar no mapa
                  </Button>
                )}
              </div>
            </div>

            {/* Quem receberá */}
            <div className="space-y-2">
              <Label className="text-[11px]">Quem receberá?</Label>
              <RadioGroup
                value={externo ? "EXTERNO" : "FUNCIONARIO"}
                disabled={somenteLeitura}
                className="flex flex-wrap gap-4"
                data-testid="ct6-entrega-tipo-recebedor"
                onValueChange={(v) =>
                  onPatch(
                    v === "EXTERNO"
                      ? { recebedorPrevistoFuncionarioId: null }
                      : { recebedorPrevistoFuncionarioId: null, recebedorPrevistoNome: "" },
                  )
                }
              >
                <label className="flex items-center gap-1.5 text-[11px]">
                  <RadioGroupItem value="FUNCIONARIO" /> Funcionário da obra
                </label>
                <label className="flex items-center gap-1.5 text-[11px]">
                  <RadioGroupItem value="EXTERNO" /> Pessoa externa / terceiro
                </label>
              </RadioGroup>

              {!externo ? (
                <div
                  className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/30 px-2 py-1.5"
                  data-testid="ct6-entrega-recebedor-funcionario"
                >
                  <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[11px] font-medium">
                    {recebedorLabel ?? "Recebedor definido no Builder"}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    Alterar no Builder (arraste um recebedor sobre o card)
                  </span>
                </div>
              ) : (
                <div
                  className="grid gap-2 md:grid-cols-2"
                  data-testid="ct6-entrega-recebedor-externo"
                >
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-[11px]">
                      Nome completo <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      className="h-8 text-xs"
                      disabled={somenteLeitura}
                      data-testid="ct6-entrega-externo-nome"
                      value={viagem.recebedorPrevistoNome}
                      onChange={(e) => onPatch({ recebedorPrevistoNome: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Telefone</Label>
                    <Input
                      className="h-8 text-xs"
                      disabled={somenteLeitura}
                      data-testid="ct6-entrega-externo-telefone"
                      value={viagem.recebedorPrevistoTelefone}
                      onChange={(e) => onPatch({ recebedorPrevistoTelefone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Observações da entrega</Label>
                    <Textarea
                      rows={2}
                      className="text-xs"
                      disabled={somenteLeitura}
                      placeholder="Empresa, documento e demais informações do terceiro"
                      data-testid="ct6-entrega-externo-observacoes"
                      value={viagem.observacoes}
                      onChange={(e) => onPatch({ observacoes: e.target.value })}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground md:col-span-2">
                    O contrato atual não possui campos próprios para empresa e documento do
                    terceiro — registre-os nas observações.
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mapa Mapbox existente — renderizado somente quando solicitado. */}
      {mapaAberto && (
        <MapAdjustModal
          open
          onOpenChange={(o) => !o && setMapaAberto(false)}
          initialLatitude={viagem.destinoDescargaLatitude}
          initialLongitude={viagem.destinoDescargaLongitude}
          initialAddress={enderecoAtual}
          onConfirm={confirmarMapa}
        />
      )}
    </>
  );
};

export default EntregaDialog;
