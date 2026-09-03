/**
 * CT-4 — MOVIMENTAÇÃO BUILDER (canvas No-Code multiparadas, 3 colunas).
 *
 * [ativos disponíveis] · [movimentação e paradas] · [recursos de transporte]
 *
 * NADA de backend novo: arrastar/clicar apenas manipula `CtMovDiretaRascunho`.
 * A gravação continua em `fn_ct_mov_direta_salvar_rascunho` e a programação em
 * `fn_ct_mov_direta_programar` (que revalidam disponibilidade e paradas).
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
  MapPin,
  MousePointerSquareDashed,
  Plus,
  Truck,
  User,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  criarParadaComLocal,
  definirDestinoParada,
  definirMotoristaViagem,
  definirOrigemPorLocal,
  definirRecebedorParada,
  definirTransportador,
  pendenciasMovimentacao,
  movDropAceita,
  movDropId,
  moverAtivoParaParada,
  parseMovDragId,
  parseMovDropId,
  retirarAtivo,
  type MovLocal,
} from "@/lib/central-transporte/movDiretaBuilder";
import { paradaVazia } from "@/lib/central-transporte/movDiretaRascunho";
import type {
  CtAtivoMovimentacao,
  CtMovDiretaRascunho,
} from "@/types/centralTransporteMovDireta";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import AtivosMovimentacaoRail from "./AtivosMovimentacaoRail";
import MovBarraSuperior from "./MovBarraSuperior";
import MovLocaisPanel from "./MovLocaisPanel";
import MovOrigemCard from "./MovOrigemCard";
import MovParadaCard from "./MovParadaCard";
import MovRecursosPanel from "./MovRecursosPanel";

export interface MovimentacaoBuilderProps {
  rascunho: CtMovDiretaRascunho;
  catalogo: Map<string, CtAtivoMovimentacao>;
  centrosCusto: ComboboxOption[];
  motoristas: ComboboxOption[];
  veiculos: ComboboxOption[];
  cadastrosCarregando: boolean;
  somenteLeitura: boolean;
  origemLabel: string | null;
  /** Locais canônicos (bd_centros_custo) arrastáveis para origem/paradas. */
  locais: MovLocal[];
  /** Recebedores possíveis (mesmo cadastro usado no dialog da entrega). */
  recebedores: ComboboxOption[];
  onAjustarOrigem: () => void;
  onChange: (proximo: CtMovDiretaRascunho) => void;
  onConhecerAtivo: (ativo: CtAtivoMovimentacao) => void;
  onEditarParada: (chaveLocal: string) => void;
}

/** Slot de recurso global da viagem (motorista / transportador). */
const SlotRecurso: React.FC<{
  alvo: "MOV_MOTORISTA_SLOT" | "MOV_TRANSPORTADOR_SLOT";
  titulo: string;
  valor: string | null;
  icone: React.ReactNode;
  somenteLeitura: boolean;
  onLimpar: () => void;
  testId: string;
}> = ({ alvo, titulo, valor, icone, somenteLeitura, onLimpar, testId }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: movDropId({ tipo: alvo }),
    disabled: somenteLeitura,
  });
  return (
    <div
      ref={setNodeRef}
      data-testid={testId}
      className={cn(
        "flex min-w-[190px] flex-1 items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px]",
        valor && "border-solid",
        isOver && "border-primary bg-primary/10",
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icone}</span>
      <span className="min-w-0 flex-1 truncate">
        {valor ?? <span className="text-muted-foreground">{titulo}</span>}
      </span>
      {valor && !somenteLeitura && (
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0"
          aria-label={`Remover ${titulo}`}
          onClick={onLimpar}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
};

/** Zona que cria uma parada ao receber um LOCAL (apenas no rascunho). */
const NovaParadaDropzone: React.FC = () => {
  const { setNodeRef, isOver } = useDroppable({ id: movDropId({ tipo: "MOV_NOVA_PARADA" }) });
  return (
    <div
      ref={setNodeRef}
      data-testid="ct4-nova-parada-drop"
      className={cn(
        "rounded-md border border-dashed p-2 text-center text-[11px] text-muted-foreground",
        isOver && "border-primary bg-primary/10 text-foreground",
      )}
    >
      Solte um centro de custo para criar nova parada
    </div>
  );
};

export const MovimentacaoBuilder: React.FC<MovimentacaoBuilderProps> = ({
  rascunho,
  catalogo,
  centrosCusto,
  motoristas,
  veiculos,
  cadastrosCarregando,
  somenteLeitura,
  origemLabel,
  locais,
  recebedores,
  onAjustarOrigem,
  onChange,
  onConhecerAtivo,
  onEditarParada,
}) => {
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [painelMobile, setPainelMobile] = useState<"ATIVOS" | "RECURSOS" | null>(null);
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const canvas = useDroppable({
    id: movDropId({ tipo: "MOV_CANVAS" }),
    disabled: somenteLeitura,
  });

  const rotuloCc = (id: string | null): string | null =>
    id ? centrosCusto.find((c) => c.value === id)?.label ?? null : null;

  const paradasOpcoes = useMemo(
    () =>
      rascunho.paradas.map((p, i) => ({
        chaveLocal: p.chaveLocal,
        rotulo: `Parada ${i + 1}${rotuloCc(p.centroCustoId) ? ` — ${rotuloCc(p.centroCustoId)}` : ""}`,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rascunho.paradas, centrosCusto],
  );

  const vinculos = useMemo(() => {
    const m = new Map<string, string>();
    rascunho.paradas.forEach((p, i) => {
      p.equipamentos.forEach((e) => m.set(e, `Parada ${i + 1}`));
    });
    return m;
  }, [rascunho.paradas]);

  const vincular = (
    equipamentoId: string,
    chaveLocal: string,
    ativo?: CtAtivoMovimentacao,
  ) => {
    if (ativo) onConhecerAtivo(ativo);
    onChange(moverAtivoParaParada(rascunho, equipamentoId, chaveLocal));
  };

  const aoFinalizar = (e: DragEndEvent) => {
    setArrastando(null);
    if (somenteLeitura) return;
    const drag = parseMovDragId(e.active.id);
    const alvo = parseMovDropId(e.over?.id);
    if (!drag || !alvo || !movDropAceita(drag.tipo, alvo)) return;

    if (drag.tipo === "MOV_ATIVO" && alvo.tipo === "MOV_PARADA_CARGA") {
      const dados = e.active.data.current as { ativo?: CtAtivoMovimentacao } | undefined;
      vincular(drag.id, alvo.chaveLocal, dados?.ativo);
      return;
    }
    if (drag.tipo === "MOV_MOTORISTA" && alvo.tipo === "MOV_MOTORISTA_SLOT") {
      const opcao = motoristas.find((m) => m.value === drag.id);
      onChange(
        definirMotoristaViagem(rascunho, { id: drag.id, nome: opcao?.label ?? "" }),
      );
      return;
    }
    if (drag.tipo === "MOV_TRANSPORTADOR" && alvo.tipo === "MOV_TRANSPORTADOR_SLOT") {
      const opcao = veiculos.find((v) => v.value === drag.id);
      onChange(definirTransportador(rascunho, { id: drag.id, placa: opcao?.label ?? "" }));
      return;
    }
    if (drag.tipo === "MOV_LOCAL") {
      const dados = e.active.data.current as { local?: MovLocal } | undefined;
      const local = dados?.local ?? locais.find((l) => l.id === drag.id);
      if (!local) return;
      if (alvo.tipo === "MOV_ORIGEM") {
        onChange(definirOrigemPorLocal(rascunho, local));
        return;
      }
      if (alvo.tipo === "MOV_PARADA_DESTINO") {
        onChange(definirDestinoParada(rascunho, alvo.chaveLocal, local));
        return;
      }
      if (alvo.tipo === "MOV_NOVA_PARADA") {
        onChange(criarParadaComLocal(rascunho, local, paradaVazia()));
      }
      return;
    }
    if (drag.tipo === "MOV_RECEBEDOR" && alvo.tipo === "MOV_RECEBEDOR_SLOT") {
      const opcao = recebedores.find((r) => r.value === drag.id);
      onChange(
        definirRecebedorParada(rascunho, alvo.chaveLocal, {
          id: drag.id,
          nome: opcao?.label ?? "",
        }),
      );
    }
  };

  const rotuloArrastado = useMemo(() => {
    const drag = parseMovDragId(arrastando);
    if (!drag) return null;
    if (drag.tipo === "MOV_MOTORISTA") {
      return motoristas.find((m) => m.value === drag.id)?.label ?? "Motorista";
    }
    if (drag.tipo === "MOV_TRANSPORTADOR") {
      return veiculos.find((v) => v.value === drag.id)?.label ?? "Transportador";
    }
    if (drag.tipo === "MOV_LOCAL") {
      return locais.find((l) => l.id === drag.id)?.rotulo ?? "Local";
    }
    if (drag.tipo === "MOV_RECEBEDOR") {
      return recebedores.find((r) => r.value === drag.id)?.label ?? "Recebedor";
    }
    const a = catalogo.get(drag.id);
    return a ? [a.frota, a.numeroFrota].filter(Boolean).join("-") || a.placa || "Ativo" : "Ativo";
  }, [arrastando, catalogo, motoristas, veiculos, locais, recebedores]);

  const transportado = rascunho.modalidade === "TRANSPORTADO";
  const motoristaLabel =
    motoristas.find((m) => m.value === rascunho.motoristaId)?.label ??
    (rascunho.motoristaNome || null);
  const veiculoLabel =
    veiculos.find((v) => v.value === rascunho.veiculoTransportadorId)?.label ??
    (rascunho.placaTransportador || null);

  const railAtivos = (
    <AtivosMovimentacaoRail
      conhecidos={catalogo}
      vinculos={vinculos}
      paradas={paradasOpcoes}
      desabilitado={somenteLeitura}
      onVincular={(id, chave, ativo) => vincular(id, chave, ativo)}
      onRetirar={(id) => onChange(retirarAtivo(rascunho, id))}
    />
  );

  const railRecursos = (
    <MovRecursosPanel
      motoristas={motoristas}
      veiculos={veiculos}
      isLoading={cadastrosCarregando}
      desabilitado={somenteLeitura}
      mostrarTransportadores={transportado}
      motoristaId={rascunho.motoristaId}
      veiculoId={rascunho.veiculoTransportadorId}
      recebedores={recebedores}
      onAplicarRecebedor={(id) => {
        /* Fallback por clique: aplica na primeira parada ainda sem recebedor. */
        const alvo =
          rascunho.paradas.find(
            (p) => !p.recebedorPrevistoFuncionarioId && !p.recebedorPrevistoNome.trim(),
          ) ?? rascunho.paradas[0];
        if (!alvo) return;
        onChange(
          definirRecebedorParada(rascunho, alvo.chaveLocal, {
            id,
            nome: recebedores.find((r) => r.value === id)?.label ?? "",
          }),
        );
      }}
      onAplicarMotorista={(id) =>
        onChange(
          definirMotoristaViagem(rascunho, {
            id,
            nome: motoristas.find((m) => m.value === id)?.label ?? "",
          }),
        )
      }
      onAplicarVeiculo={(id) =>
        onChange(
          definirTransportador(rascunho, {
            id,
            placa: veiculos.find((v) => v.value === id)?.label ?? "",
          }),
        )
      }
    />
  );

  const railLocais = (
    <MovLocaisPanel
      locais={locais}
      isLoading={cadastrosCarregando}
      desabilitado={somenteLeitura}
      origemId={rascunho.origemCentroCustoId}
      onAplicarComoOrigem={(local) => onChange(definirOrigemPorLocal(rascunho, local))}
    />
  );

  const pendencias = pendenciasMovimentacao(rascunho);
  const recebedorNome = (id: string | null): string | null =>
    id ? recebedores.find((r) => r.value === id)?.label ?? "Recebedor definido" : null;

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e: DragStartEvent) => setArrastando(String(e.active.id))}
      onDragEnd={aoFinalizar}
    >
      <div
        className="grid min-h-0 gap-3 lg:grid-cols-[200px_minmax(0,1fr)_250px]"
        data-testid="ct4-builder"
      >
        <div className="hidden min-h-0 lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100vh-260px)] lg:flex-col">
          {railAtivos}
        </div>

        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2 lg:hidden">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setPainelMobile("ATIVOS")}
            >
              Ativos
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setPainelMobile("RECURSOS")}
            >
              Recursos
            </Button>
          </div>

          <MovBarraSuperior
            dataPrevistaSaida={rascunho.dataPrevistaSaida}
            modalidade={rascunho.modalidade}
            tipoTransporte={rascunho.tipoTransporte}
            somenteLeitura={somenteLeitura}
            onData={(valor) => onChange({ ...rascunho, dataPrevistaSaida: valor })}
            onModalidade={(valor) =>
              onChange({
                ...rascunho,
                modalidade: valor,
                tipoTransporte: valor === "TRANSPORTADO" ? rascunho.tipoTransporte : null,
                ...(valor === "TRANSPORTADO"
                  ? {}
                  : { veiculoTransportadorId: null, placaTransportador: "" }),
              })
            }
            onTipoTransporte={(valor) => onChange({ ...rascunho, tipoTransporte: valor })}
          />

          <Card>
            <CardContent className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Truck className="h-4 w-4 text-primary" />
                  {rascunho.codigo ?? "Nova movimentação"}
                </p>
                <div className="flex items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    <MapPin className="mr-1 h-3 w-3" />
                    {origemLabel ?? "origem não informada"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    <CalendarDays className="mr-1 h-3 w-3" />
                    {rascunho.dataPrevistaSaida
                      ? formatBrazilianDateForDisplay(rascunho.dataPrevistaSaida)
                      : "sem data"}
                  </Badge>
                </div>
              </div>

              <MovOrigemCard
                rotulo={origemLabel}
                endereco={rascunho.origemEndereco || null}
                pontoExato={rascunho.origemPontoExato}
                somenteLeitura={somenteLeitura}
                onAjustarPonto={onAjustarOrigem}
              />

              <div className="flex flex-wrap gap-2">
                <SlotRecurso
                  alvo="MOV_MOTORISTA_SLOT"
                  titulo="Arraste o motorista"
                  valor={motoristaLabel}
                  icone={<User className="h-3 w-3" />}
                  somenteLeitura={somenteLeitura}
                  onLimpar={() => onChange(definirMotoristaViagem(rascunho, null))}
                  testId="ct4-slot-motorista"
                />
                {transportado && (
                  <SlotRecurso
                    alvo="MOV_TRANSPORTADOR_SLOT"
                    titulo="Arraste o transportador"
                    valor={veiculoLabel}
                    icone={<Truck className="h-3 w-3" />}
                    somenteLeitura={somenteLeitura}
                    onLimpar={() => onChange(definirTransportador(rascunho, null))}
                    testId="ct4-slot-transportador"
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <div
            ref={canvas.setNodeRef}
            data-testid="ct4-canvas"
            className="space-y-2 rounded-md border border-dashed p-2"
          >
            {rascunho.paradas.length === 0 ? (
              <p
                className="flex items-center justify-center gap-2 p-6 text-center text-[11px] text-muted-foreground"
                data-testid="ct4-canvas-vazio"
              >
                <MousePointerSquareDashed className="h-4 w-4" />
                Adicione uma parada de entrega para começar.
              </p>
            ) : (
              rascunho.paradas.map((p, i) => (
                <MovParadaCard
                  key={p.chaveLocal}
                  rascunho={rascunho}
                  parada={p}
                  ordem={i + 1}
                  ccLabel={rotuloCc(p.centroCustoId)}
                  catalogo={catalogo}
                  somenteLeitura={somenteLeitura}
                  podeRemover={rascunho.paradas.length > 1}
                  recebedorNome={recebedorNome(p.recebedorPrevistoFuncionarioId)}
                  onEditar={() => onEditarParada(p.chaveLocal)}
                  onLimparRecebedor={() =>
                    onChange(definirRecebedorParada(rascunho, p.chaveLocal, null))
                  }
                  onRemover={() =>
                    onChange({
                      ...rascunho,
                      paradas: rascunho.paradas.filter((x) => x.chaveLocal !== p.chaveLocal),
                    })
                  }
                  onRetirarAtivo={(id) =>
                    onChange({
                      ...rascunho,
                      paradas: rascunho.paradas.map((x) =>
                        x.chaveLocal === p.chaveLocal
                          ? { ...x, equipamentos: x.equipamentos.filter((e) => e !== id) }
                          : x,
                      ),
                    })
                  }
                />
              ))
            )}

            {!somenteLeitura && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-[11px]"
                onClick={() =>
                  onChange({ ...rascunho, paradas: [...rascunho.paradas, paradaVazia()] })
                }
                data-testid="ct4-adicionar-parada"
              >
                <Plus className="mr-1 h-3 w-3" /> Adicionar parada
              </Button>
            )}

            {!somenteLeitura && <NovaParadaDropzone />}
          </div>

          <div
            className="flex flex-wrap items-center gap-1.5 text-[11px]"
            data-testid="ct4-pendencias"
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

        <div className="hidden min-h-0 gap-2 lg:sticky lg:top-0 lg:flex lg:max-h-[calc(100vh-260px)] lg:flex-col">
          <div className="flex min-h-0 basis-1/2 flex-col">{railLocais}</div>
          <div className="flex min-h-0 basis-1/2 flex-col border-t pt-2">{railRecursos}</div>
        </div>
      </div>

      <Sheet open={painelMobile !== null} onOpenChange={(o) => !o && setPainelMobile(null)}>
        <SheetContent side="left" className="w-[85vw] max-w-sm">
          <SheetHeader>
            <SheetTitle className="text-sm">
              {painelMobile === "RECURSOS" ? "Recursos do transporte" : "Ativos disponíveis"}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-3 flex h-[calc(100vh-120px)] min-h-0 flex-col">
            {painelMobile === "RECURSOS" ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex min-h-0 basis-1/2 flex-col">{railLocais}</div>
                <div className="flex min-h-0 basis-1/2 flex-col border-t pt-2">{railRecursos}</div>
              </div>
            ) : (
              railAtivos
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

export default MovimentacaoBuilder;
