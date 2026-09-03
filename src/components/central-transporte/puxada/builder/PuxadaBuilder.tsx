/**
 * CT-5 — PUXADA BUILDER (canvas No-Code em 3 colunas, mesma linguagem do CT-4).
 *
 * [caminhões] · [puxada: data, CC, coleta, descarga, frota] · [locais/CC + motoristas]
 *
 * NADA de backend novo: arrastar/clicar apenas manipula `CtPuxadaRascunho`.
 * A gravação continua em `fn_ct_puxada_salvar_rascunho` e a programação em
 * `fn_ct_puxada_programar`. Arrastar é aceleração — todo gesto tem fallback
 * por clique.
 */
import React, { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  MousePointerSquareDashed,
  Truck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ComboboxOption } from "@/components/ui/combobox";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCtMotoristasOperacionais } from "@/hooks/central-transporte/useCtPuxada";
import {
  adicionarCaminhao,
  definirCentroCustoPorLocal,
  definirMotorista,
  motoristaEmUso,
  parsePuxDragId,
  parsePuxDropId,
  pendenciasPuxada,
  puxDropAceita,
  puxDropId,
  removerCaminhao,
} from "@/lib/central-transporte/puxadaBuilder";
import type { MovLocal } from "@/lib/central-transporte/movDiretaBuilder";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
} from "@/types/centralTransporteMovDireta";
import type { CtPuxadaRascunho } from "@/types/centralTransportePuxada";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import CaminhoesRail from "./CaminhoesRail";
import MotoristasPanel from "./MotoristasPanel";
import PuxCaminhaoCard from "./PuxCaminhaoCard";
import PuxCentroCustoCard from "./PuxCentroCustoCard";
import PuxLocaisPanel from "./PuxLocaisPanel";
import PuxTrajetoInline from "./PuxTrajetoInline";

export interface PuxadaBuilderProps {
  rascunho: CtPuxadaRascunho;
  centrosCusto: ComboboxOption[];
  /** Locais canônicos (bd_centros_custo) arrastáveis. */
  locais: MovLocal[];
  cadastrosCarregando?: boolean;
  somenteLeitura: boolean;
  onChange: (proximo: CtPuxadaRascunho) => void;
}

export const PuxadaBuilder: React.FC<PuxadaBuilderProps> = ({
  rascunho,
  centrosCusto,
  locais,
  cadastrosCarregando = false,
  somenteLeitura,
  onChange,
}) => {
  const { motoristas, isLoading, error } = useCtMotoristasOperacionais();
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [painelMobile, setPainelMobile] = useState<"CAMINHOES" | "RECURSOS" | null>(null);
  const [obsAberta, setObsAberta] = useState(() => rascunho.observacoes.trim().length > 0);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const jaEscolhidos = useMemo(
    () => new Set(rascunho.caminhoes.map((c) => c.caminhaoEquipamentoId)),
    [rascunho.caminhoes],
  );

  const destinos = useMemo(
    () => rascunho.caminhoes.map((c) => ({ chaveLocal: c.chaveLocal, rotulo: c.rotulo })),
    [rascunho.caminhoes],
  );

  const pendencias = useMemo(() => pendenciasPuxada(rascunho), [rascunho]);

  const canvas = useDroppable({ id: puxDropId({ tipo: "PUX_CANVAS" }), disabled: somenteLeitura });

  const incluir = (a: CtAtivoMovimentacao) =>
    onChange(
      adicionarCaminhao(rascunho, {
        caminhaoEquipamentoId: a.equipamentoId,
        rotulo: rotuloAtivoMovimentacao(a),
        placa: a.placa,
      }),
    );

  const aplicarMotorista = (motoristaId: string | null, chaveLocal: string) => {
    const m = motoristaId ? motoristas.find((x) => x.id === motoristaId) ?? null : null;
    onChange(
      definirMotorista(rascunho, chaveLocal, m ? { id: m.id, nome: m.nomeCompleto } : null),
    );
  };

  const aplicarLocal = (local: MovLocal) =>
    onChange(definirCentroCustoPorLocal(rascunho, local));

  const aoFinalizar = (e: DragEndEvent) => {
    setArrastando(null);
    if (somenteLeitura) return;
    const drag = parsePuxDragId(e.active.id);
    const alvo = parsePuxDropId(e.over?.id);
    if (!drag || !alvo || !puxDropAceita(drag.tipo, alvo)) return;

    if (drag.tipo === "PUX_MOTORISTA" && alvo.tipo === "PUX_MOTORISTA_SLOT") {
      aplicarMotorista(drag.id, alvo.chaveLocal);
      return;
    }
    if (drag.tipo === "PUX_LOCAL" && alvo.tipo === "PUX_CENTRO_CUSTO") {
      const dados = e.active.data.current as { local?: MovLocal } | undefined;
      const local = dados?.local ?? locais.find((l) => l.id === drag.id);
      if (local) aplicarLocal(local);
      return;
    }
    if (drag.tipo === "PUX_CAMINHAO" && alvo.tipo === "PUX_CANVAS") {
      /* O rótulo real vem do catálogo; o id arrastado é o equipamento. */
      const evento = e.active.data.current as { ativo?: CtAtivoMovimentacao } | undefined;
      if (evento?.ativo) {
        incluir(evento.ativo);
        return;
      }
      onChange(
        adicionarCaminhao(rascunho, {
          caminhaoEquipamentoId: drag.id,
          rotulo: drag.id.slice(0, 8),
          placa: null,
        }),
      );
    }
  };

  const rotuloArrastado = useMemo(() => {
    const drag = parsePuxDragId(arrastando);
    if (!drag) return null;
    if (drag.tipo === "PUX_MOTORISTA") {
      return motoristas.find((m) => m.id === drag.id)?.nomeCompleto ?? "Motorista";
    }
    if (drag.tipo === "PUX_LOCAL") {
      return locais.find((l) => l.id === drag.id)?.rotulo ?? "Local";
    }
    return "Caminhão";
  }, [arrastando, motoristas, locais]);

  const localAtual = rascunho.centroCustoId
    ? locais.find((l) => l.id === rascunho.centroCustoId) ?? null
    : null;
  const ccLabel = rascunho.centroCustoId
    ? centrosCusto.find((c) => c.value === rascunho.centroCustoId)?.label ?? null
    : null;

  const railCaminhoes = (
    <CaminhoesRail
      jaEscolhidos={jaEscolhidos}
      desabilitado={somenteLeitura}
      onAdicionar={incluir}
    />
  );

  const railLocais = (
    <PuxLocaisPanel
      locais={locais}
      isLoading={cadastrosCarregando}
      desabilitado={somenteLeitura}
      centroCustoId={rascunho.centroCustoId}
      onAplicar={aplicarLocal}
    />
  );

  const railMotoristas = (
    <MotoristasPanel
      motoristas={motoristas}
      isLoading={isLoading}
      error={error}
      desabilitado={somenteLeitura || destinos.length === 0}
      emUso={(id) => motoristaEmUso(rascunho, id)}
      destinos={destinos}
      onAplicar={(motoristaId, chaveLocal) => aplicarMotorista(motoristaId, chaveLocal)}
    />
  );

  return (
    <DndContext sensors={sensors} onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))} onDragEnd={aoFinalizar}>
      <div
        className="grid min-h-0 gap-3 lg:grid-cols-[200px_minmax(0,1fr)_250px]"
        data-testid="ct5-builder"
      >
        {/* Rail esquerda (desktop) */}
        <div className="hidden min-h-0 lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100vh-260px)] lg:flex-col">
          {railCaminhoes}
        </div>

        {/* Canvas */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setPainelMobile("CAMINHOES")}
            >
              Caminhões
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setPainelMobile("RECURSOS")}
            >
              Locais e motoristas
            </Button>
          </div>

          <Card>
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-primary" />
                  {rascunho.codigo ?? "Nova puxada"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    <CalendarDays className="mr-1 h-3 w-3" />
                    {rascunho.dataPuxada
                      ? formatBrazilianDateForDisplay(rascunho.dataPuxada)
                      : "sem data"}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {rascunho.caminhoes.length} caminhão(ões)
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Data da puxada *</Label>
                  <Input
                    type="date"
                    className="h-8 text-xs"
                    value={rascunho.dataPuxada}
                    disabled={somenteLeitura}
                    onChange={(e) => onChange({ ...rascunho, dataPuxada: e.target.value })}
                    data-testid="ct5-data-puxada"
                  />
                </div>
                <PuxCentroCustoCard
                  centroCustoId={rascunho.centroCustoId}
                  rotulo={ccLabel}
                  endereco={localAtual?.endereco ?? null}
                  centrosCusto={centrosCusto}
                  somenteLeitura={somenteLeitura}
                  onSelecionar={(id) => {
                    const local = id ? locais.find((l) => l.id === id) ?? null : null;
                    if (local) {
                      aplicarLocal(local);
                      return;
                    }
                    onChange({ ...rascunho, centroCustoId: id });
                  }}
                />
              </div>

              <PuxTrajetoInline
                coleta={{
                  endereco: rascunho.coletaEndereco,
                  latitude: rascunho.coletaLatitude,
                  longitude: rascunho.coletaLongitude,
                }}
                descarga={{
                  endereco: rascunho.descargaEndereco,
                  latitude: rascunho.descargaLatitude,
                  longitude: rascunho.descargaLongitude,
                }}
                somenteLeitura={somenteLeitura}
                rota={
                  rascunho.rotaPlanejada
                    ? {
                        distanciaKm: rascunho.rotaPlanejada.distanciaKm,
                        duracaoMin: rascunho.rotaPlanejada.duracaoMin,
                      }
                    : null
                }
                onColeta={(v) =>
                  onChange({
                    ...rascunho,
                    coletaEndereco: v.endereco,
                    coletaLatitude: v.latitude,
                    coletaLongitude: v.longitude,
                  })
                }
                onDescarga={(v) =>
                  onChange({
                    ...rascunho,
                    descargaEndereco: v.endereco,
                    descargaLatitude: v.latitude,
                    descargaLongitude: v.longitude,
                  })
                }
              />

              {obsAberta ? (
                <div className="space-y-1">
                  <Label className="text-[11px]">Observações da puxada</Label>
                  <Textarea
                    rows={2}
                    className="text-xs"
                    value={rascunho.observacoes}
                    disabled={somenteLeitura}
                    placeholder="Material transportado, janela de carregamento, instruções..."
                    onChange={(e) => onChange({ ...rascunho, observacoes: e.target.value })}
                    data-testid="ct5-observacoes"
                  />
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1 text-[11px]"
                  onClick={() => setObsAberta(true)}
                  data-testid="ct5-abrir-observacoes"
                >
                  <ChevronDown className="mr-1 h-3 w-3" /> Adicionar observações
                </Button>
              )}
            </CardContent>
          </Card>

          <div
            ref={canvas.setNodeRef}
            data-testid="ct5-canvas"
            className={cn(
              "space-y-2 rounded-md border border-dashed p-2",
              canvas.isOver && "border-primary bg-primary/5",
            )}
          >
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Caminhões da puxada
            </p>
            {rascunho.caminhoes.length === 0 ? (
              <p
                className="flex items-center justify-center gap-2 p-6 text-center text-[11px] text-muted-foreground"
                data-testid="ct5-canvas-vazio"
              >
                <MousePointerSquareDashed className="h-4 w-4" />
                Arraste caminhões para compor a puxada (ou use o “+” na lista) e solte um
                motorista em cada um.
              </p>
            ) : (
              rascunho.caminhoes.map((c) => (
                <PuxCaminhaoCard
                  key={c.chaveLocal}
                  caminhao={c}
                  somenteLeitura={somenteLeitura}
                  motoristas={motoristas}
                  onDefinirMotorista={(id) => aplicarMotorista(id, c.chaveLocal)}
                  onRemover={() => onChange(removerCaminhao(rascunho, c.chaveLocal))}
                />
              ))
            )}
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 text-[11px]"
            data-testid="ct5-pendencias"
          >
            {pendencias.length === 0 ? (
              <span className="inline-flex items-center gap-1 text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Pronto para revisão
              </span>
            ) : (
              pendencias.map((texto) => (
                <Badge key={texto} variant="outline" className="gap-1 text-[10px] text-amber-600">
                  <AlertTriangle className="h-3 w-3" /> {texto}
                </Badge>
              ))
            )}
          </div>
        </div>

        {/* Rail direita (desktop): Locais/CC + Motoristas com scroll próprio */}
        <div className="hidden min-h-0 gap-2 lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100vh-260px)] lg:flex-col">
          <div className="flex min-h-0 basis-1/2 flex-col">{railLocais}</div>
          <div className="flex min-h-0 basis-1/2 flex-col border-t pt-2">{railMotoristas}</div>
        </div>
      </div>

      {/* Rails em Sheet abaixo de 1024px */}
      <Sheet open={painelMobile !== null} onOpenChange={(o) => !o && setPainelMobile(null)}>
        <SheetContent side="left" className="w-[85vw] max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-sm">
              {painelMobile === "RECURSOS" ? "Locais e motoristas" : "Caminhões disponíveis"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex h-[calc(100vh-120px)] min-h-0 flex-col">
            {painelMobile === "RECURSOS" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex min-h-0 basis-1/2 flex-col">{railLocais}</div>
                <div className="flex min-h-0 basis-1/2 flex-col border-t pt-2">
                  {railMotoristas}
                </div>
              </div>
            ) : (
              railCaminhoes
            )}
          </div>
        </SheetContent>
      </Sheet>

      <DragOverlay dropAnimation={null}>
        {rotuloArrastado ? (
          <div className="rounded-md border bg-background px-2 py-1 text-[11px] shadow-md">
            {rotuloArrastado}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};

export default PuxadaBuilder;
