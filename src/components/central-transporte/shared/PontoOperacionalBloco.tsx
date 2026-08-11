/**
 * CT-4 UX — Bloco de ponto operacional (centro de custo + ponto exato + mapa).
 *
 * Generalização puramente apresentacional do bloco "Origem — coleta" /
 * "Destino — entrega" já usado na etapa Mobilização da Solicitação: mesmos
 * componentes (Combobox de centro de custo, AddressAutocomplete e
 * MapAdjustModal), mesma tipografia, espaçamento e avisos.
 *
 * Não decide nada: apenas devolve o patch para o state do chamador.
 */
import React from "react";
import { AlertTriangle, MapPin } from "lucide-react";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import AddressAutocomplete, {
  type AddressResult,
  type AddressSearchScope,
} from "@/components/shared/AddressAutocomplete";


export interface PontoOperacionalPatch {
  centroCustoId?: string | null;
  ponto?: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PontoOperacionalBlocoProps {
  titulo: string;
  labelCentroCusto?: string;
  placeholderCentroCusto?: string;
  labelPonto: string;
  centrosCusto: ComboboxOption[];
  centroCustoId: string | null;
  /** Endereço cadastrado do CC (null quando o CC não tem endereço). */
  centroCustoEndereco: string | null;
  ponto: string;
  latitude: number | null;
  longitude: number | null;
  somenteLeitura?: boolean;
  /** Sem moldura/título — usado dentro de seções numeradas. */
  semMoldura?: boolean;
  testId: string;
  onChange: (patch: PontoOperacionalPatch) => void;
}


const coordTexto = (lat: number | null, lng: number | null): string =>
  lat === null || lng === null ? "Ponto não ajustado" : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

export const PontoOperacionalBloco: React.FC<PontoOperacionalBlocoProps> = ({
  titulo,
  labelCentroCusto = "Centro de custo",
  placeholderCentroCusto = "Selecione o centro de custo",
  labelPonto,
  centrosCusto,
  centroCustoId,
  centroCustoEndereco,
  ponto,
  latitude,
  longitude,
  somenteLeitura = false,
  semMoldura = false,
  testId,
  onChange,
}) => {
  const [escopo, setEscopo] = React.useState<AddressSearchScope>("todo_rj");

  const selecionarEndereco = (r: AddressResult) =>
    onChange({ ponto: r.endereco_completo, latitude: r.latitude, longitude: r.longitude });


  return (
    <div
      className={semMoldura ? "space-y-2" : "space-y-2 rounded-md border p-3"}
      data-testid={testId}
    >
      {!semMoldura && (
        <p className="flex items-center gap-1 text-[11px] font-medium">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {titulo}
        </p>
      )}

      <div className="space-y-1">
        <Label className="text-[11px]">{labelCentroCusto}</Label>
        <Combobox
          disabled={somenteLeitura}
          value={centroCustoId ?? ""}
          placeholder={placeholderCentroCusto}
          searchPlaceholder="Buscar centro de custo..."
          options={centrosCusto}
          onChange={(v) => onChange({ centroCustoId: v || null })}
        />
        {centroCustoId && centroCustoEndereco && (
          <p className="text-[11px] text-muted-foreground">{centroCustoEndereco}</p>
        )}
        {centroCustoId && !centroCustoEndereco && (
          <p
            className="flex items-start gap-1 text-[11px] text-amber-600"
            data-testid={`${testId}-cc-sem-endereco`}
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            O centro de custo não possui endereço cadastrado. Informe o ponto exato.
          </p>
        )}
      </div>

      <div className="space-y-1">
        <Label className="text-[11px]">{labelPonto}</Label>
        {/* O botão "Confirmar no mapa" é o do AddressAutocomplete — único por bloco. */}
        <div className="min-w-0" data-testid={`${testId}-ponto`}>
          <AddressAutocomplete
            value={ponto}
            initialLatitude={latitude}
            initialLongitude={longitude}
            disabled={somenteLeitura}
            placeholder="Busque o logradouro, portaria, pátio..."
            searchScope={escopo}
            onSearchScopeChange={setEscopo}
            onAddressSelected={selecionarEndereco}
          />
        </div>
        <span className="block text-[11px] text-muted-foreground">
          {coordTexto(latitude, longitude)}
        </span>
      </div>
    </div>

  );
};

export default PontoOperacionalBloco;
