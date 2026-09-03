/**
 * CT-3D.1 — Origem e Destino da viagem em dois cards únicos.
 *
 * Cada card concentra: centro de custo, ponto exato (busca de logradouro
 * reaproveitada do "Novo Registro Manual de Aplicação") e ajuste no mapa.
 * Não existe mais "endereço operacional" separado — o ponto exato é o único
 * endereço da viagem.
 *
 * A rota usa a Directions API do Mapbox e apresenta ALTERNATIVAS no padrão
 * Google Maps. A distância operacional segue a regra dos 28 km, calculada
 * também no servidor (aqui é apenas antecipação visual).
 */
import React from "react";
import { AlertTriangle, Clock, MapPin, Route } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import MapAdjustModal, { type MapAdjustResult } from "@/components/shared/MapAdjustModal";
import AddressAutocomplete, {
  type AddressResult,
  type AddressSearchScope,
} from "@/components/shared/AddressAutocomplete";
import {
  calcularAlternativasRota,
  type CtRotaAlternativa,
} from "@/services/ctRotaService";
import {
  descreverDistancia,
  distanciaOperacional,
} from "@/lib/central-transporte/distanciaOperacional";
import type { CtViagemRascunho } from "@/types/centralTransporteMobilizacao";
import useCtFuncionariosComUsuario from "@/hooks/central-transporte/useCtFuncionariosComUsuario";

export const RECEBEDOR_MANUAL = "__manual__";

export interface ViagemEnderecosEditorProps {
  viagem: CtViagemRascunho;
  somenteLeitura: boolean;
  /** Endereço cadastrado do CC de origem (null quando o CC não tem endereço). */
  origemCcEndereco: string | null;
  destinoCcEndereco: string | null;
  funcionarios: ComboboxOption[];
  centrosCusto: ComboboxOption[];
  onPatch: (patch: Partial<CtViagemRascunho>) => void;
}

const coordTexto = (lat: number | null, lng: number | null): string =>
  lat === null || lng === null ? "Ponto não ajustado" : `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

const duracaoTexto = (min: number | null): string => {
  if (min === null) return "";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

export const ViagemEnderecosEditor: React.FC<ViagemEnderecosEditorProps> = ({
  viagem,
  somenteLeitura,
  origemCcEndereco,
  destinoCcEndereco,
  funcionarios,
  centrosCusto,
  onPatch,
}) => {
  const [mapaAberto, setMapaAberto] = React.useState<"origem" | "destino" | null>(null);
  const [calculando, setCalculando] = React.useState(false);
  const [rotaIndisponivel, setRotaIndisponivel] = React.useState(false);
  const [alternativas, setAlternativas] = React.useState<CtRotaAlternativa[]>([]);
  const [escopoOrigem, setEscopoOrigem] = React.useState<AddressSearchScope>("todo_rj");
  const [escopoDestino, setEscopoDestino] = React.useState<AddressSearchScope>("todo_rj");

  const recebedorManual = !viagem.recebedorPrevistoFuncionarioId;
  const { comUsuario } = useCtFuncionariosComUsuario(!somenteLeitura);

  const confirmarMapa = (r: MapAdjustResult) => {
    if (mapaAberto === "origem") {
      onPatch({
        origemColetaLatitude: r.latitude,
        origemColetaLongitude: r.longitude,
        origemPontoExato: viagem.origemPontoExato.trim() || r.endereco_completo || "",
      });
    } else if (mapaAberto === "destino") {
      onPatch({
        destinoDescargaLatitude: r.latitude,
        destinoDescargaLongitude: r.longitude,
        destinoPontoExato: viagem.destinoPontoExato.trim() || r.endereco_completo || "",
      });
    }
    setMapaAberto(null);
  };

  const selecionarEndereco = (lado: "origem" | "destino", r: AddressResult) => {
    setAlternativas([]);
    if (lado === "origem") {
      onPatch({
        origemPontoExato: r.endereco_completo,
        origemColetaLatitude: r.latitude,
        origemColetaLongitude: r.longitude,
      });
    } else {
      onPatch({
        destinoPontoExato: r.endereco_completo,
        destinoDescargaLatitude: r.latitude,
        destinoDescargaLongitude: r.longitude,
      });
    }
  };

  const aplicarRota = (r: CtRotaAlternativa) =>
    onPatch({
      distanciaRotaKm: r.distanciaKm,
      duracaoRotaMin: r.duracaoMin,
      rotaResumo: r.resumo,
      distanciaKm: String(distanciaOperacional(r.distanciaKm) ?? ""),
    });

  const calcularRota = async () => {
    setCalculando(true);
    setRotaIndisponivel(false);
    const rotas = await calcularAlternativasRota(
      viagem.origemColetaLatitude !== null && viagem.origemColetaLongitude !== null
        ? { latitude: viagem.origemColetaLatitude, longitude: viagem.origemColetaLongitude }
        : null,
      viagem.destinoDescargaLatitude !== null && viagem.destinoDescargaLongitude !== null
        ? { latitude: viagem.destinoDescargaLatitude, longitude: viagem.destinoDescargaLongitude }
        : null,
    );
    setCalculando(false);
    if (!rotas || rotas.length === 0) {
      setAlternativas([]);
      setRotaIndisponivel(true);
      return;
    }
    setAlternativas(rotas);
    aplicarRota(rotas[0]);
  };

  const bloco = (lado: "origem" | "destino") => {
    const isOrigem = lado === "origem";
    const ponto = isOrigem ? viagem.origemPontoExato : viagem.destinoPontoExato;
    const lat = isOrigem ? viagem.origemColetaLatitude : viagem.destinoDescargaLatitude;
    const lng = isOrigem ? viagem.origemColetaLongitude : viagem.destinoDescargaLongitude;
    const ccEndereco = isOrigem ? origemCcEndereco : destinoCcEndereco;
    const ccId = isOrigem ? viagem.origemCentroCustoId : viagem.destinoCentroCustoId;
    const escopo = isOrigem ? escopoOrigem : escopoDestino;
    const setEscopo = isOrigem ? setEscopoOrigem : setEscopoDestino;

    return (
      <div
        className="space-y-2 rounded-md border p-3"
        data-testid={`ct3d-bloco-${lado}-${viagem.chaveLocal}`}
      >
        <p className="flex items-center gap-1 text-[11px] font-medium">
          <MapPin className="h-3.5 w-3.5 text-primary" />
          {isOrigem ? "Origem — coleta" : "Destino — entrega"}
        </p>

        <div className="space-y-1">
          <Label className="text-[11px]">Centro de custo</Label>
          <Combobox
            disabled={somenteLeitura}
            value={ccId ?? ""}
            placeholder={isOrigem ? "Centro de custo de origem" : "Centro de custo de destino"}
            searchPlaceholder="Buscar centro de custo..."
            options={centrosCusto}
            onChange={(v) =>
              onPatch(
                isOrigem
                  ? { origemCentroCustoId: v || null }
                  : { destinoCentroCustoId: v || null },
              )
            }
          />
          {ccId && ccEndereco && (
            <p className="text-[11px] text-muted-foreground">{ccEndereco}</p>
          )}
          {ccId && !ccEndereco && (
            <p
              className="flex items-start gap-1 text-[11px] text-amber-600"
              data-testid={`ct3d-aviso-cc-sem-endereco-${lado}-${viagem.chaveLocal}`}
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              O centro de custo não possui endereço cadastrado. Informe o ponto exato.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-[11px]">
            {isOrigem ? "Ponto exato de coleta" : "Ponto exato de entrega"}
          </Label>
          <div data-testid={`ct3d-ponto-${lado}-${viagem.chaveLocal}`}>
            <AddressAutocomplete
              value={ponto}
              initialLatitude={lat}
              initialLongitude={lng}
              disabled={somenteLeitura}
              placeholder="Busque o logradouro, portaria, pátio..."
              searchScope={escopo}
              onSearchScopeChange={setEscopo}
              onAddressSelected={(r) => selecionarEndereco(lado, r)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">{coordTexto(lat, lng)}</span>
          {!somenteLeitura && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              data-testid={`ct3d-ajustar-mapa-${lado}-${viagem.chaveLocal}`}
              onClick={() => setMapaAberto(lado)}
            >
              Ajustar no mapa
            </Button>
          )}
        </div>
      </div>
    );
  };

  const latAtual =
    mapaAberto === "origem" ? viagem.origemColetaLatitude : viagem.destinoDescargaLatitude;
  const lngAtual =
    mapaAberto === "origem" ? viagem.origemColetaLongitude : viagem.destinoDescargaLongitude;
  const endAtual =
    mapaAberto === "origem"
      ? viagem.origemPontoExato || origemCcEndereco || ""
      : viagem.destinoPontoExato || destinoCcEndereco || "";

  return (
    <div className="space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        {bloco("origem")}
        {bloco("destino")}
      </div>

      <div className="space-y-2 rounded-md border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-1 text-[11px] font-medium">
            <Route className="h-3.5 w-3.5 text-primary" /> Rota e distância
          </p>
          {!somenteLeitura && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-[11px]"
              disabled={calculando}
              data-testid={`ct3d-calcular-rota-${viagem.chaveLocal}`}
              onClick={calcularRota}
            >
              <Route className="h-3.5 w-3.5" />
              {calculando ? "Calculando..." : "Calcular alternativas de rota"}
            </Button>
          )}
        </div>

        {rotaIndisponivel && (
          <p
            className="text-[11px] text-muted-foreground"
            data-testid={`ct3d-rota-nao-calculada-${viagem.chaveLocal}`}
          >
            Rota não calculada — informe os pontos exatos de coleta e entrega.
          </p>
        )}

        {alternativas.length > 0 && (
          <ul className="space-y-1" data-testid={`ct3d-rota-alternativas-${viagem.chaveLocal}`}>
            {alternativas.map((r) => {
              const selecionada = viagem.distanciaRotaKm === r.distanciaKm;
              return (
                <li key={r.indice}>
                  <button
                    type="button"
                    disabled={somenteLeitura}
                    data-testid={`ct3d-rota-opcao-${r.indice}-${viagem.chaveLocal}`}
                    onClick={() => aplicarRota(r)}
                    className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors ${
                      selecionada ? "border-primary bg-primary/5" : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Badge variant={selecionada ? "default" : "outline"} className="text-[10px]">
                        {r.indice === 0 ? "Mais rápida" : `Alternativa ${r.indice + 1}`}
                      </Badge>
                      <span className="text-muted-foreground">{r.resumo}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {r.duracaoMin !== null && (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-3 w-3" /> {duracaoTexto(r.duracaoMin)}
                        </span>
                      )}
                      <span className="font-medium">
                        {r.distanciaKm.toFixed(1).replace(".", ",")} km
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <p
          className="text-[11px] text-muted-foreground"
          data-testid={`ct3d-distancia-operacional-${viagem.chaveLocal}`}
        >
          Distância operacional: {descreverDistancia(viagem.distanciaRotaKm)}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Recebedor previsto</Label>
          <Combobox
            disabled={somenteLeitura}
            value={viagem.recebedorPrevistoFuncionarioId ?? RECEBEDOR_MANUAL}
            placeholder="Selecione quem receberá"
            searchPlaceholder="Buscar funcionário..."
            options={[{ value: RECEBEDOR_MANUAL, label: "Pessoa não cadastrada" }, ...funcionarios]}
            onChange={(v) =>
              onPatch(
                v && v !== RECEBEDOR_MANUAL
                  ? { recebedorPrevistoFuncionarioId: v, recebedorPrevistoNome: "" }
                  : { recebedorPrevistoFuncionarioId: null },
              )
            }
          />
        </div>
        {!recebedorManual &&
          comUsuario !== null &&
          viagem.recebedorPrevistoFuncionarioId !== null &&
          !comUsuario.has(viagem.recebedorPrevistoFuncionarioId) && (
            <p
              className="text-[11px] text-amber-600 md:col-span-3"
              data-testid={`ct3e-recebedor-sem-usuario-${viagem.chaveLocal}`}
            >
              Este recebedor não possui usuário do sistema e, por isso, não conseguirá confirmar o
              recebimento pelo aplicativo. A conferência será feita por quem tem acesso ao centro de
              custo de destino.
            </p>
          )}
        {recebedorManual && (
          <div className="space-y-1">
            <Label className="text-[11px]">Nome do recebedor</Label>
            <Input
              disabled={somenteLeitura}
              value={viagem.recebedorPrevistoNome}
              placeholder="Nome completo"
              data-testid={`ct3d-recebedor-nome-${viagem.chaveLocal}`}
              onChange={(e) => onPatch({ recebedorPrevistoNome: e.target.value })}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label className="text-[11px]">Telefone do recebedor (opcional)</Label>
          <Input
            disabled={somenteLeitura}
            value={viagem.recebedorPrevistoTelefone}
            placeholder="(00) 00000-0000"
            onChange={(e) => onPatch({ recebedorPrevistoTelefone: e.target.value })}
          />
        </div>
      </div>

      {mapaAberto && (
        <MapAdjustModal
          open
          onOpenChange={(o) => !o && setMapaAberto(null)}
          initialLatitude={latAtual}
          initialLongitude={lngAtual}
          initialAddress={endAtual}
          onConfirm={confirmarMapa}
        />
      )}
    </div>
  );
};

export default ViagemEnderecosEditor;
