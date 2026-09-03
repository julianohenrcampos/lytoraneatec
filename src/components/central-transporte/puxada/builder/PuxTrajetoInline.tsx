/**
 * CT-5 Builder — COLETA e DESCARGA inline (sem o antigo modal "Coleta e descarga").
 *
 * Reutiliza integralmente o `AddressAutocomplete` já usado na CT (busca,
 * geocodificação e ajuste no mapa via MapAdjustModal). Nenhuma segunda camada
 * de Mapbox nem de rota: apenas devolve `endereco/latitude/longitude` ao
 * rascunho existente.
 */
import React, { useState } from "react";
import { CheckCircle2, MapPin, Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import AddressAutocomplete, {
  type AddressResult,
  type AddressSearchScope,
} from "@/components/shared/AddressAutocomplete";

export interface PuxPontoValor {
  endereco: string;
  latitude: number | null;
  longitude: number | null;
}

export interface PuxTrajetoInlineProps {
  coleta: PuxPontoValor;
  descarga: PuxPontoValor;
  somenteLeitura: boolean;
  rota: { distanciaKm: number; duracaoMin: number | null } | null;
  onColeta: (v: PuxPontoValor) => void;
  onDescarga: (v: PuxPontoValor) => void;
}

const Ponto: React.FC<{
  titulo: string;
  valor: PuxPontoValor;
  somenteLeitura: boolean;
  testId: string;
  onChange: (v: PuxPontoValor) => void;
}> = ({ titulo, valor, somenteLeitura, testId, onChange }) => {
  const [escopo, setEscopo] = useState<AddressSearchScope>("todo_rj");
  const confirmado =
    Number.isFinite(valor.latitude as number) && Number.isFinite(valor.longitude as number);

  return (
    <div className="space-y-1" data-testid={testId} data-confirmado={confirmado ? "true" : "false"}>
      <Label className="flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
        <MapPin className="h-3 w-3" /> {titulo} *
      </Label>
      <AddressAutocomplete
        value={valor.endereco}
        initialLatitude={valor.latitude}
        initialLongitude={valor.longitude}
        disabled={somenteLeitura}
        placeholder="Busque o logradouro, portaria, pátio..."
        searchScope={escopo}
        onSearchScopeChange={setEscopo}
        onAddressSelected={(r: AddressResult) =>
          onChange({
            endereco: r.endereco_completo,
            latitude: r.latitude,
            longitude: r.longitude,
          })
        }
      />
    </div>
  );
};

export const PuxTrajetoInline: React.FC<PuxTrajetoInlineProps> = ({
  coleta,
  descarga,
  somenteLeitura,
  rota,
  onColeta,
  onDescarga,
}) => (
  <div className="space-y-2" data-testid="ct5-trajeto-inline">
    <div className="grid gap-2 md:grid-cols-2">
      <Ponto
        titulo="Ponto exato de coleta"
        valor={coleta}
        somenteLeitura={somenteLeitura}
        testId="ct5-ponto-coleta"
        onChange={onColeta}
      />
      <Ponto
        titulo="Ponto exato de descarga"
        valor={descarga}
        somenteLeitura={somenteLeitura}
        testId="ct5-ponto-descarga"
        onChange={onDescarga}
      />
    </div>

    <div className="flex items-center gap-1.5 text-[11px]" data-testid="ct5-rota-resumo">
      <Badge variant="outline" className="gap-1 text-[10px]">
        <Route className="h-3 w-3" /> Rota
      </Badge>
      {rota ? (
        <span className="inline-flex items-center gap-1 text-emerald-600">
          <CheckCircle2 className="h-3.5 w-3.5" />
          {rota.distanciaKm.toFixed(1)} km
          {rota.duracaoMin ? ` · ${Math.round(rota.duracaoMin)} min` : ""}
        </span>
      ) : (
        <span className="text-muted-foreground">
          Calculada automaticamente ao programar, com coleta e descarga confirmadas.
        </span>
      )}
    </div>
  </div>
);

export default PuxTrajetoInline;
