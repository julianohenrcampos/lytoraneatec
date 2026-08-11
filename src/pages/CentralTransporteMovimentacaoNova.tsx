/**
 * CT-4 — Planejamento de uma Movimentação Direta (viagem sem solicitação).
 *
 * CT-4 UX — apresentação em master/detail, no mesmo padrão da etapa
 * Mobilização da Solicitação: painel lateral de ativos + card único da viagem,
 * paradas em seletor compacto (uma expandida por vez) e barra de ações sticky.
 *
 * O modelo de estado (rascunho), a validação e todos os comandos permanecem
 * exatamente os mesmos: nada é decidido no cliente, o rascunho é reconstruído
 * no servidor a cada salvamento e a programação revalida disponibilidade.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MapPin,
  Save,
  Send,
  Truck,
} from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";

import { usePageTitle } from "@/contexts/PageTitleContext";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import useCtMobilizacaoCadastros from "@/hooks/central-transporte/useCtMobilizacaoCadastros";
import { useCtMovDiretaEdicao } from "@/hooks/central-transporte/useCtMovDireta";
import {
  ativosDaMovimentacao,
  equipamentosJaAlocados,
  paradaVazia,
  validarRascunho,
} from "@/lib/central-transporte/movDiretaRascunho";
import { fetchEstadoEfetivoAtivos } from "@/services/centralTransporteEstadoEfetivoService";
import AtivosMovimentacaoPanel from "@/components/central-transporte/mov-direta/AtivosMovimentacaoPanel";
import ParadaEditor from "@/components/central-transporte/mov-direta/ParadaEditor";
import ParadasSelector from "@/components/central-transporte/mov-direta/ParadasSelector";
import SelecionarAtivoDialog from "@/components/central-transporte/mov-direta/SelecionarAtivoDialog";
import PontoOperacionalBloco from "@/components/central-transporte/shared/PontoOperacionalBloco";
import {
  CT_MODALIDADE_LABELS,
  CT_TIPO_TRANSPORTE_LABELS,
  type CtModalidade,
  type CtOrdemCarga,
  type CtTipoTransporte,
} from "@/types/centralTransporteMobilizacao";

import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
  type CtParadaRascunho,
} from "@/types/centralTransporteMovDireta";


const CentralTransporteMovimentacaoNova: React.FC = () => {
  usePageTitle("Planejar Movimentação");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { viagemId } = useParams<{ viagemId?: string }>();
  const capabilities = useCentralTransporteCapabilities();
  const cadastros = useCtMobilizacaoCadastros();
  const edicao = useCtMovDiretaEdicao({ viagemId: viagemId ?? null });
  const { rascunho, setRascunho } = edicao;
  const persistida = edicao.viagemPersistida;

  const [erro, setErro] = useState<string | null>(null);
  const [comando, setComando] = useState<"SALVAR" | "PROGRAMAR" | null>(null);
  const [paradaSelecionada, setParadaSelecionada] = useState<string | null>(null);
  const [ativoSelecionado, setAtivoSelecionado] = useState<string | null>(null);
  const [seletorAberto, setSeletorAberto] = useState(false);
  /** Dados de catálogo dos ativos escolhidos no seletor nesta sessão. */
  const [catalogoEscolhido, setCatalogoEscolhido] = useState<
    Record<string, CtAtivoMovimentacao>
  >({});

  /** Conjunto B — ativos participantes da movimentação (com ou sem parada). */
  const planejados = useMemo(() => ativosDaMovimentacao(rascunho), [rascunho]);

  /* Reidratação após F5: metadados cadastrais vêm das cargas persistidas... */
  const cargasPersistidas = useMemo(() => {
    const m = new Map<string, CtOrdemCarga>();
    (persistida?.cargas ?? []).forEach((c) => m.set(c.equipamentoId, c));
    return m;
  }, [persistida]);

  /* ...e CC atual / disponibilidade / compromisso, da RPC de estado efetivo. */
  const estadoAtivos = useQuery({
    enabled: planejados.length > 0,
    queryKey: ["ct4", "estado-ativos", [...planejados].sort().join(",")],
    staleTime: 30 * 1000,
    queryFn: () => fetchEstadoEfetivoAtivos({ equipamentoIds: planejados }),
  });

  const catalogo = useMemo(() => {
    const m = new Map<string, CtAtivoMovimentacao>();
    planejados.forEach((id) => {
      const c = cargasPersistidas.get(id);
      const e = estadoAtivos.data?.get(id) ?? null;
      const ccId = e?.centroCustoId ?? null;
      m.set(id, {
        equipamentoId: id,
        frota: c?.frota ?? null,
        numeroFrota: c?.numeroFrota ?? null,
        placa: c?.placa ?? null,
        tipoAtivo: c?.tipoAtivo ?? null,
        modelo: c?.modelo ?? null,
        centroCustoId: ccId,
        centroCustoLabel: ccId
          ? cadastros.centrosCusto.find((o) => o.value === ccId)?.label ?? null
          : null,
        statusOperacional: e?.condicaoOperacional ?? "SEM_REGISTRO",
        possuiRegistro: e?.possuiRegistroOperacional ?? false,
        compromissoViagem: null,
        elegivel: true,
        bloqueioMotivo: null,
      });
    });
    /* O que veio do seletor é a informação mais completa: prevalece. */
    Object.values(catalogoEscolhido).forEach((a) => {
      const atual = m.get(a.equipamentoId);
      m.set(a.equipamentoId, atual ? { ...atual, ...a } : a);
    });
    return m;
  }, [planejados, cargasPersistidas, estadoAtivos.data, catalogoEscolhido, cadastros.centrosCusto]);

  const carregandoAtivos = planejados.length > 0 && estadoAtivos.isLoading;

  const somenteLeitura =
    !capabilities.canCriar || (!!persistida && persistida.status !== "RASCUNHO");


  const errosRascunho = useMemo(() => validarRascunho(rascunho, "RASCUNHO"), [rascunho]);
  const errosProgramar = useMemo(() => validarRascunho(rascunho, "PROGRAMAR"), [rascunho]);

  /** Rótulo curto da parada: código do CC quando existir. */
  const rotuloParada = (indice: number): string => {
    const p = rascunho.paradas[indice];
    if (!p) return `Parada ${indice + 1}`;
    if (!p.centroCustoId) return "Sem destino";
    const opcao = cadastros.centrosCusto.find((c) => c.value === p.centroCustoId);
    return opcao?.label.split(" — ")[0] ?? "Destino";
  };

  const paradaAtual =
    rascunho.paradas.find((p) => p.chaveLocal === paradaSelecionada) ?? rascunho.paradas[0] ?? null;
  const indiceAtual = paradaAtual
    ? rascunho.paradas.findIndex((p) => p.chaveLocal === paradaAtual.chaveLocal)
    : -1;

  const alocacoes = useMemo(() => {
    const m = new Map<string, { indice: number; rotulo: string }>();
    rascunho.paradas.forEach((p, i) => {
      p.equipamentos.forEach((e) => m.set(e, { indice: i, rotulo: rotuloParada(i) }));
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunho.paradas, cadastros.centrosCusto]);

  const patchParada = (chave: string, patch: Partial<CtParadaRascunho>) =>
    setRascunho((prev) => ({
      ...prev,
      paradas: prev.paradas.map((p) => (p.chaveLocal === chave ? { ...p, ...patch } : p)),
    }));

  const adicionarParada = () => {
    const nova = paradaVazia();
    setRascunho((p) => ({ ...p, paradas: [...p.paradas, nova] }));
    setParadaSelecionada(nova.chaveLocal);
  };

  /** Seletor de ativo EXISTENTE: apenas referencia o ativo no planejamento. */
  const planejarAtivo = (a: CtAtivoMovimentacao) => {
    if (planejados.includes(a.equipamentoId)) {
      selecionarAtivo(a.equipamentoId);
      return;
    }
    setCatalogoEscolhido((p) => ({ ...p, [a.equipamentoId]: a }));
    setRascunho((p) => ({
      ...p,
      ativosPlanejados: Array.from(new Set([...p.ativosPlanejados, a.equipamentoId])),
    }));
    setAtivoSelecionado(a.equipamentoId);
  };

  /** Remove o ativo da movimentação (e de qualquer parada). Não altera cadastro. */
  const removerAtivoDaMovimentacao = (id: string) => {
    setRascunho((p) => ({
      ...p,
      ativosPlanejados: p.ativosPlanejados.filter((x) => x !== id),
      paradas: p.paradas.map((par) => ({
        ...par,
        equipamentos: par.equipamentos.filter((e) => e !== id),
      })),
    }));
    setAtivoSelecionado((atual) => (atual === id ? null : atual));
  };


  /** Clicar no card do ativo apenas troca o conteúdo do editor único. */
  const selecionarAtivo = (id: string) => {
    const parada = rascunho.paradas.find((p) => p.equipamentos.includes(id));
    if (parada) setParadaSelecionada(parada.chaveLocal);
    setAtivoSelecionado(id);
  };



  const salvar = async (): Promise<string | null> => {
    setErro(null);
    if (errosRascunho.length > 0) {
      setErro(errosRascunho[0]);
      return null;
    }
    setComando("SALVAR");
    try {
      const out = await edicao.salvar();
      if (out.status === "ok") {
        toast({ title: "Rascunho salvo", description: "O planejamento foi persistido." });
        return out.data.viagemId;
      }
      setErro(
        out.status === "error"
          ? out.error.message
          : "A operação não foi confirmada. Repita a mesma tentativa — nada será duplicado.",
      );
      return null;
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
      return null;
    } finally {
      setComando(null);
    }
  };

  const programar = async () => {
    setErro(null);
    if (errosProgramar.length > 0) {
      setErro(errosProgramar[0]);
      return;
    }
    const id = await salvar();
    if (!id) return;
    setComando("PROGRAMAR");
    try {
      const out = await edicao.programar(id);
      if (out.status === "ok") {
        toast({
          title: "Movimentação programada",
          description: "A ordem já aparece para o motorista em Minhas Mobilizações.",
        });
        navigate("/gestao-maquinas/central-transporte");
        return;
      }
      setErro(
        out.status === "error"
          ? out.error.message
          : "A programação não foi confirmada. Repita a mesma tentativa — nada será duplicado.",
      );
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setComando(null);
    }
  };

  if (capabilities.isLoading || (viagemId && edicao.isLoading)) {
    return (
      <MainLayout>
        <div className="space-y-3 p-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!capabilities.canCriar) {
    return (
      <MainLayout>
        <div className="p-4">
          <Alert variant="destructive" data-testid="ct4-sem-permissao">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="text-sm">Sem permissão</AlertTitle>
            <AlertDescription className="text-xs">
              Seu acesso não permite planejar movimentações na Central do Transporte.
            </AlertDescription>
          </Alert>
        </div>
      </MainLayout>
    );
  }

  const totalAtivos = rascunho.paradas.reduce((acc, p) => acc + p.equipamentos.length, 0);
  const transportado = rascunho.modalidade === "TRANSPORTADO";
  const terceiro = rascunho.tipoTransporte === "TERCEIRO";
  const motoristaLabel =
    cadastros.motoristas.find((m) => m.value === rascunho.motoristaId)?.label ??
    (rascunho.motoristaNome || null);
  const veiculoLabel =
    cadastros.veiculos.find((v) => v.value === rascunho.veiculoTransportadorId)?.label ?? null;
  const origemLabel = rascunho.origemCentroCustoId
    ? cadastros.centrosCusto
        .find((c) => c.value === rascunho.origemCentroCustoId)
        ?.label.split(" — ")[0] ?? "Origem"
    : null;


  return (
    <MainLayout>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={() => navigate("/gestao-maquinas/central-transporte")}
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar à Central
          </Button>
          <div className="flex items-center gap-2">
            {rascunho.codigo && <Badge variant="outline">{rascunho.codigo}</Badge>}
            <Badge variant="secondary">{persistida?.status ?? "RASCUNHO"}</Badge>
            <Badge variant="outline">{totalAtivos} ativo(s)</Badge>
          </div>
        </div>

        {erro && (
          <Alert variant="destructive" data-testid="ct4-erro">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">{erro}</AlertDescription>
          </Alert>
        )}

        {somenteLeitura && persistida && persistida.status !== "RASCUNHO" && (
          <Alert data-testid="ct4-somente-leitura">
            <AlertTitle className="text-xs">Movimentação já programada</AlertTitle>
            <AlertDescription className="text-xs">
              Programações vigentes não são editadas: cancele e planeje novamente se algo mudou.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          {carregandoAtivos ? (
            <Skeleton className="h-64 w-full" />
          ) : (
            <AtivosMovimentacaoPanel
              planejados={planejados}
              catalogo={catalogo}
              rascunho={rascunho}
              origemLabel={origemLabel}
              ativoSelecionado={ativoSelecionado}
              rotuloParada={rotuloParada}
              viagemProgramada={!!persistida && persistida.status !== "RASCUNHO"}
              somenteLeitura={somenteLeitura}
              onSelecionarAtivo={selecionarAtivo}
              onAbrirSeletor={() => setSeletorAberto(true)}
              onRemoverAtivo={removerAtivoDaMovimentacao}
            />
          )}

          <div className="space-y-3" data-testid="ct4-detalhe-viagem">
            {/* Cabeçalho da viagem, no padrão da Mobilização. */}
            <div className="flex flex-wrap items-center gap-2">
              {persistida && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              <Badge
                variant="outline"
                className={
                  persistida
                    ? "border-emerald-600/50 bg-emerald-600/10 text-[10px]"
                    : "text-[10px]"
                }
              >
                {persistida && persistida.status !== "RASCUNHO"
                  ? "Programada"
                  : persistida
                    ? "Salva no rascunho"
                    : "Rascunho"}
              </Badge>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Truck className="h-3.5 w-3.5 text-primary" />
                {rascunho.codigo ?? "Nova viagem"} · {totalAtivos} ativo(s) ·{" "}
                {rascunho.paradas.length} parada(s)
              </span>
              {ativoSelecionado && (
                <Badge variant="secondary" className="text-[10px]" data-testid="ct4-ativo-em-foco">
                  Editando:{" "}
                  {(() => {
                    const a = catalogo.get(ativoSelecionado);
                    return a ? rotuloAtivoMovimentacao(a) : ativoSelecionado.slice(0, 8);
                  })()}
                </Badge>
              )}

            </div>

            <Card>
              <CardHeader className="px-4 pb-2 pt-4">
                <CardTitle className="flex items-center gap-1.5 text-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  Origem da coleta (detalhes da saída)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-4 pb-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-[11px]">Data prevista de saída *</Label>
                    <Input
                      type="date"
                      value={rascunho.dataPrevistaSaida}
                      disabled={somenteLeitura}
                      onChange={(e) =>
                        setRascunho((p) => ({ ...p, dataPrevistaSaida: e.target.value }))
                      }
                    />
                  </div>
                </div>

                  <PontoOperacionalBloco
                    semMoldura
                    titulo="Origem — coleta"
                    labelCentroCusto="Centro de custo / local"
                    placeholderCentroCusto="De onde os ativos saem"
                    labelPonto="Ponto exato de coleta"
                    centrosCusto={cadastros.centrosCusto}
                    centroCustoId={rascunho.origemCentroCustoId}
                    centroCustoEndereco={
                      rascunho.origemCentroCustoId
                        ? cadastros.enderecosCentroCusto[rascunho.origemCentroCustoId] ?? null
                        : null
                    }
                    ponto={rascunho.origemPontoExato}
                    latitude={rascunho.origemLatitude}
                    longitude={rascunho.origemLongitude}
                    somenteLeitura={somenteLeitura}
                    testId="ct4-origem"
                    onChange={(patch) =>
                      setRascunho((p) => ({
                        ...p,
                        ...(patch.centroCustoId !== undefined
                          ? {
                              origemCentroCustoId: patch.centroCustoId,
                              origemEndereco:
                                p.origemEndereco ||
                                (patch.centroCustoId
                                  ? cadastros.enderecosCentroCusto[patch.centroCustoId] ?? ""
                                  : ""),
                            }
                          : {}),
                        ...(patch.ponto !== undefined ? { origemPontoExato: patch.ponto } : {}),
                        ...(patch.latitude !== undefined ? { origemLatitude: patch.latitude } : {}),
                        ...(patch.longitude !== undefined
                          ? { origemLongitude: patch.longitude }
                          : {}),
                      }))
                    }
                  />

                <div className="grid gap-3 md:grid-cols-2">

                    <div className="space-y-1">
                      <Label className="text-[11px]">Modalidade *</Label>
                      <Combobox
                        options={Object.entries(CT_MODALIDADE_LABELS).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                        value={rascunho.modalidade ?? ""}
                        disabled={somenteLeitura}
                        placeholder="Como o ativo se desloca"
                        onChange={(v) =>
                          setRascunho((p) => ({
                            ...p,
                            modalidade: (v || null) as CtModalidade | null,
                            tipoTransporte: v === "TRANSPORTADO" ? p.tipoTransporte : null,
                          }))
                        }
                      />
                    </div>

                    {transportado && (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Tipo de transporte *</Label>
                        <Combobox
                          options={Object.entries(CT_TIPO_TRANSPORTE_LABELS).map(
                            ([value, label]) => ({ value, label }),
                          )}
                          value={rascunho.tipoTransporte ?? ""}
                          disabled={somenteLeitura}
                          placeholder="Próprio ou terceiro"
                          onChange={(v) =>
                            setRascunho((p) => ({
                              ...p,
                              tipoTransporte: (v || null) as CtTipoTransporte | null,
                            }))
                          }
                        />
                      </div>
                    )}

                    <div className="space-y-1">
                      <Label className="text-[11px]">Motorista do transporte *</Label>
                      <Combobox
                        options={cadastros.motoristas}
                        value={rascunho.motoristaId ?? ""}
                        disabled={somenteLeitura}
                        placeholder="Quem executa o deslocamento"
                        searchPlaceholder="Buscar funcionário..."
                        onChange={(v) => setRascunho((p) => ({ ...p, motoristaId: v || null }))}
                      />
                      {rascunho.motoristaNome && !rascunho.motoristaId && (
                        <p className="text-[11px] text-muted-foreground">
                          Registrado: {rascunho.motoristaNome}
                        </p>
                      )}
                    </div>

                    {transportado && (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Veículo transportador</Label>
                        <Combobox
                          options={cadastros.veiculos}
                          value={rascunho.veiculoTransportadorId ?? ""}
                          disabled={somenteLeitura}
                          placeholder="Prancha / carreta"
                          searchPlaceholder="Buscar veículo..."
                          onChange={(v) =>
                            setRascunho((p) => ({ ...p, veiculoTransportadorId: v || null }))
                          }
                        />
                      </div>
                    )}

                    {transportado && terceiro && (
                      <div className="space-y-1">
                        <Label className="text-[11px]">Transportadora</Label>
                        <Combobox
                          options={cadastros.empresas}
                          value={rascunho.empresaTransportadoraId ?? ""}
                          disabled={somenteLeitura}
                          placeholder="Empresa terceira"
                          searchPlaceholder="Buscar empresa..."
                          onChange={(v) =>
                            setRascunho((p) => ({ ...p, empresaTransportadoraId: v || null }))
                          }
                        />
                      </div>
                    )}
                  </div>

                <div className="space-y-1.5">

                  <Label className="text-[11px]">Observações gerais</Label>
                  <Textarea
                    rows={2}
                    value={rascunho.observacoes}
                    disabled={somenteLeitura}
                    onChange={(e) => setRascunho((p) => ({ ...p, observacoes: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>


            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">
                  Paradas de entrega{" "}
                  <span className="text-muted-foreground">({rascunho.paradas.length})</span>
                </h2>
              </div>

              <ParadasSelector
                paradas={rascunho.paradas}
                selecionada={paradaAtual?.chaveLocal ?? null}
                rotuloParada={rotuloParada}
                somenteLeitura={somenteLeitura}
                onSelecionar={setParadaSelecionada}
                onAdicionar={adicionarParada}
              />

              {paradaAtual ? (
                <ParadaEditor
                  key={paradaAtual.chaveLocal}
                  parada={paradaAtual}
                  ordem={indiceAtual + 1}
                  centrosCusto={cadastros.centrosCusto}
                  enderecosCentroCusto={cadastros.enderecosCentroCusto}
                  funcionarios={cadastros.motoristas}
                  ativos={planejados.map((id) => catalogo.get(id)!).filter(Boolean)}
                  bloqueados={equipamentosJaAlocados(rascunho, paradaAtual.chaveLocal)}
                  alocacoes={alocacoes}
                  podeRemover={rascunho.paradas.length > 1}
                  desabilitado={somenteLeitura}
                  onChange={(patch) => patchParada(paradaAtual.chaveLocal, patch)}
                  onRemover={() => {
                    setRascunho((prev) => ({
                      ...prev,
                      paradas: prev.paradas.filter((x) => x.chaveLocal !== paradaAtual.chaveLocal),
                    }));
                    setParadaSelecionada(null);
                  }}
                />
              ) : (
                <Alert>
                  <AlertTitle className="text-xs">Nenhuma parada em edição</AlertTitle>
                  <AlertDescription className="text-xs">
                    Adicione uma parada de entrega para planejar a movimentação.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </div>
        </div>

        {/* Barra de ações sticky — a validação vive no disabled do botão. */}
        <div className="sticky bottom-0 -mx-3 border-t bg-background/95 px-3 py-2 backdrop-blur sm:-mx-4 sm:px-4">
          <div className="flex flex-wrap items-center justify-end gap-2">
            {somenteLeitura && (
              <span className="mr-auto text-[11px] text-muted-foreground">
                Movimentação em modo somente leitura.
              </span>
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={somenteLeitura || comando !== null}
              onClick={() => void salvar()}
              data-testid="ct4-salvar-rascunho"
            >
              {comando === "SALVAR" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              Salvar rascunho
            </Button>
            <Button
              size="sm"
              disabled={somenteLeitura || comando !== null || errosProgramar.length > 0}
              onClick={() => void programar()}
              data-testid="ct4-programar"
            >
              {comando === "PROGRAMAR" ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1 h-4 w-4" />
              )}
              Programar movimentação
            </Button>
          </div>
        </div>

        <SelecionarAtivoDialog
          open={seletorAberto}
          onOpenChange={setSeletorAberto}
          jaPlanejados={new Set(planejados)}
          onSelecionar={planejarAtivo}
        />
      </div>
    </MainLayout>
  );
};

export default CentralTransporteMovimentacaoNova;
