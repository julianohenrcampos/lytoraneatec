/**
 * CT-5 — Wizard paginado da Puxada (mesmo padrão visual do CT-4).
 *
 * 4 etapas: Dados → Caminhões e motoristas → Coleta e descarga → Revisão.
 * Uma etapa por vez, header/stepper/footer fixos e apenas o miolo com scroll.
 *
 * O modelo de estado (rascunho), a validação e todos os comandos são
 * autoritativos do servidor: o rascunho é reconstruído a cada salvamento e a
 * programação revalida disponibilidade e conflitos de caminhão por data.
 */
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Loader2,
  Save,
  Send,
  Truck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import useCtMobilizacaoCadastros from "@/hooks/central-transporte/useCtMobilizacaoCadastros";
import { useCtPuxadaEdicao } from "@/hooks/central-transporte/useCtPuxada";
import {
  assinaturaRotaPuxada,
  coordenadasRotaPuxada,
  podeCalcularRotaPuxada,
  puxadaComRotaDirections,
  rotaPuxadaEstaStale,
  validarPuxada,
} from "@/lib/central-transporte/puxadaRascunho";
import {
  ETAPAS_PUXADA,
  errosDaEtapaPuxada,
  indiceEtapaPuxada,
  type PuxadaEtapa,
} from "@/lib/central-transporte/puxadaWizardSteps";
import { calcularRotaMultiparadas } from "@/services/ctRotaService";
import CtFeedbackDialog from "@/components/central-transporte/operacao/CtFeedbackDialog";
import CancelarPlanejamentoDialog from "@/components/central-transporte/mov-direta/CancelarPlanejamentoDialog";
import PontoOperacionalBloco from "@/components/central-transporte/shared/PontoOperacionalBloco";
import CaminhoesPuxadaEditor from "./CaminhoesPuxadaEditor";
import PuxadasMapa from "./PuxadasMapa";
import type { CtPuxadaRascunho } from "@/types/centralTransportePuxada";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

interface Props {
  puxadaId?: string | null;
  onFechar: () => void;
}

const PuxadaWizard: React.FC<Props> = ({ puxadaId = null, onFechar }) => {
  const capabilities = useCentralTransporteCapabilities();
  const cadastros = useCtMobilizacaoCadastros();
  const edicao = useCtPuxadaEdicao({ puxadaId });
  const { rascunho, setRascunho } = edicao;
  const persistida = edicao.puxadaPersistida;

  const [feedback, setFeedback] = useState<{
    tipo: "SUCESSO" | "ERRO";
    titulo: string;
    mensagem: string;
    tentarNovamente?: () => void;
    aoFechar?: () => void;
  } | null>(null);
  const [comando, setComando] = useState<"SALVAR" | "PROGRAMAR" | "CANCELAR" | null>(null);
  const [cancelarAberto, setCancelarAberto] = useState(false);
  const [etapa, setEtapa] = useState<PuxadaEtapa>(
    puxadaId ? "REVISAO" : "DADOS",
  );
  const assinaturaCalculada = useRef<string | null>(null);
  const programarRef = useRef<() => void>(() => undefined);

  /* Programada/em execução/concluída/cancelada é somente leitura. */
  const somenteLeitura =
    !capabilities.canCriar ||
    (!!persistida && persistida.status !== "RASCUNHO");

  const errosProgramar = useMemo(() => validarPuxada(rascunho, "PROGRAMAR"), [rascunho]);

  /**
   * Garante a rota real da Directions API e devolve o snapshot já composto —
   * o mesmo objeto que será enviado e persistido (sem depender de re-render).
   */
  const garantirRota = useCallback(async (): Promise<
    { ok: true; snapshot: CtPuxadaRascunho } | { ok: false }
  > => {
    if (!podeCalcularRotaPuxada(rascunho)) return { ok: true, snapshot: rascunho };
    if (!rotaPuxadaEstaStale(rascunho, assinaturaCalculada.current)) {
      return { ok: true, snapshot: rascunho };
    }
    const rota = await calcularRotaMultiparadas(coordenadasRotaPuxada(rascunho));
    if (!rota) return { ok: false };
    const composto = puxadaComRotaDirections(rascunho, rota);
    if (!composto) return { ok: false };
    assinaturaCalculada.current = assinaturaRotaPuxada(composto);
    setRascunho(composto);
    return { ok: true, snapshot: composto };
  }, [rascunho, setRascunho]);

  const feedbackRotaFalhou = () =>
    setFeedback({
      tipo: "ERRO",
      titulo: "Rota não calculada",
      mensagem:
        "Não foi possível calcular a rota rodoviária entre coleta e descarga. " +
        "Reconfirme os pontos no mapa e tente novamente.",
      tentarNovamente: () => programarRef.current(),
    });

  const salvar = async (
    exibirSucesso = true,
    snapshot?: CtPuxadaRascunho,
  ): Promise<string | null> => {
    const errosBase = validarPuxada(snapshot ?? rascunho, "RASCUNHO");
    if (errosBase.length > 0) {
      setFeedback({ tipo: "ERRO", titulo: "Revise os dados", mensagem: errosBase[0] });
      return null;
    }
    setFeedback(null);
    setComando("SALVAR");
    try {
      const out = await edicao.salvar(snapshot);
      if (out.status === "ok") {
        if (exibirSucesso) {
          setFeedback({
            tipo: "SUCESSO",
            titulo: "Rascunho salvo",
            mensagem: `${out.data.puxada?.codigo ?? "A puxada"} foi salva como rascunho.`,
          });
        }
        return out.data.puxadaId;
      }
      setFeedback({
        tipo: "ERRO",
        titulo: "Rascunho não salvo",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "O salvamento não foi confirmado. Repita a mesma tentativa — nada será duplicado.",
        tentarNovamente: () => void salvar(exibirSucesso, snapshot),
      });
      return null;
    } catch (e) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Rascunho não salvo",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
      });
      return null;
    } finally {
      setComando(null);
    }
  };

  const programar = async () => {
    if (errosProgramar.length > 0) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Ainda não é possível programar",
        mensagem: errosProgramar[0],
      });
      return;
    }
    const rota = await garantirRota();
    if (!rota.ok) {
      feedbackRotaFalhou();
      return;
    }
    const id = await salvar(false, rota.snapshot);
    if (!id) return;
    setComando("PROGRAMAR");
    try {
      const out = await edicao.programar(id);
      if (out.status === "ok") {
        setFeedback({
          tipo: "SUCESSO",
          titulo: "Puxada programada",
          mensagem:
            "Os caminhões e motoristas ficaram comprometidos com esta puxada na data planejada.",
          aoFechar: onFechar,
        });
        return;
      }
      setFeedback({
        tipo: "ERRO",
        titulo: "Puxada não programada",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "A programação não foi confirmada. Repita a mesma tentativa — nada será duplicado.",
        tentarNovamente: () => void programar(),
      });
    } catch (e) {
      setFeedback({
        tipo: "ERRO",
        titulo: "Puxada não programada",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
      });
    } finally {
      setComando(null);
    }
  };

  programarRef.current = () => void programar();

  const podeCancelar =
    !!persistida &&
    capabilities.canCriar &&
    (persistida.status === "RASCUNHO" || persistida.status === "PROGRAMADA");

  const cancelarPlanejamento = async (motivo: string) => {
    if (!persistida) return;
    setFeedback(null);
    setComando("CANCELAR");
    try {
      const out = await edicao.cancelar(persistida.id, motivo);
      setCancelarAberto(false);
      if (out.status === "ok") {
        setFeedback({
          tipo: "SUCESSO",
          titulo: "Puxada cancelada",
          mensagem: `${persistida.codigo || "A puxada"} foi cancelada. Os caminhões foram liberados.`,
          aoFechar: onFechar,
        });
        return;
      }
      void edicao.recarregar();
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível cancelar",
        mensagem:
          out.status === "error"
            ? out.error.message
            : "O cancelamento não foi confirmado. Atualize a puxada e verifique o status antes de repetir.",
      });
    } catch (e) {
      setCancelarAberto(false);
      void edicao.recarregar();
      setFeedback({
        tipo: "ERRO",
        titulo: "Não foi possível cancelar",
        mensagem: e instanceof Error ? e.message : "Erro inesperado.",
      });
    } finally {
      setComando(null);
    }
  };

  if (capabilities.isLoading || (puxadaId && edicao.isLoading)) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!capabilities.canCriar && !puxadaId) {
    return (
      <div className="p-4">
        <Alert variant="destructive" data-testid="ct5-sem-permissao">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-sm">Sem permissão</AlertTitle>
          <AlertDescription className="text-xs">
            Seu acesso não permite planejar puxadas na Central do Transporte.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const etapaIndice = indiceEtapaPuxada(etapa);
  const errosEtapaAtual = errosDaEtapaPuxada(rascunho, etapa);

  const avancar = () => {
    if (errosEtapaAtual.length > 0) {
      setFeedback({ tipo: "ERRO", titulo: "Revise esta etapa", mensagem: errosEtapaAtual[0] });
      return;
    }
    const proxima = ETAPAS_PUXADA[etapaIndice + 1];
    if (proxima) setEtapa(proxima.id);
  };

  const voltar = () => {
    const anterior = ETAPAS_PUXADA[etapaIndice - 1];
    if (anterior) setEtapa(anterior.id);
  };

  const ccLabel = rascunho.centroCustoId
    ? cadastros.centrosCusto.find((c) => c.value === rascunho.centroCustoId)?.label ?? null
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="ct5-wizard" data-etapa={etapa}>
      {/* Header fixo */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          <Truck className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{rascunho.codigo ?? "Nova puxada"}</span>
          {persistida && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">
            {persistida?.status ?? "RASCUNHO"}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            {rascunho.caminhoes.length} caminhão(ões)
          </Badge>
        </div>
      </div>

      {/* Stepper fixo */}
      <div className="flex items-center justify-between gap-1 border-b px-4 py-3">
        {ETAPAS_PUXADA.map((s, i) => {
          const ativa = i === etapaIndice;
          const concluida = i < etapaIndice;
          return (
            <React.Fragment key={s.id}>
              <button
                type="button"
                data-testid={`ct5-step-${s.id}`}
                onClick={() => {
                  if (i <= etapaIndice) setEtapa(s.id);
                  else avancar();
                }}
                className={`flex items-center gap-2 transition-colors ${
                  ativa ? "text-primary" : concluida ? "text-primary/60" : "text-muted-foreground"
                }`}
              >
                <span
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                    ativa
                      ? "border-primary bg-primary text-primary-foreground"
                      : concluida
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-muted-foreground/30 bg-muted"
                  }`}
                >
                  {concluida ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                </span>
                <span className="hidden text-xs font-medium sm:inline">{s.label}</span>
              </button>
              {i < ETAPAS_PUXADA.length - 1 && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded ${
                    i < etapaIndice ? "bg-primary/60" : "bg-muted"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Miolo: rola somente o conteúdo da etapa atual */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4">
        {somenteLeitura && persistida && persistida.status !== "RASCUNHO" && (
          <Alert className="mb-3" data-testid="ct5-somente-leitura">
            <AlertTitle className="text-xs">
              {persistida.status === "CANCELADA" ? "Puxada cancelada" : "Puxada já programada"}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {persistida.status === "CANCELADA"
                ? `Este planejamento foi cancelado e é exibido apenas como histórico.${
                    persistida.motivoCancelamento
                      ? ` Motivo: ${persistida.motivoCancelamento}`
                      : ""
                  }`
                : "Programações vigentes não são editadas: cancele e planeje novamente se algo mudou."}
            </AlertDescription>
          </Alert>
        )}

        {etapa === "DADOS" && (
          <div className="space-y-4" data-testid="ct5-etapa-dados">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Data da puxada *</Label>
                <Input
                  type="date"
                  value={rascunho.dataPuxada}
                  disabled={somenteLeitura}
                  onChange={(e) =>
                    setRascunho((p) => ({ ...p, dataPuxada: e.target.value }))
                  }
                  data-testid="ct5-data-puxada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px]">Centro de custo *</Label>
                <Combobox
                  disabled={somenteLeitura}
                  value={rascunho.centroCustoId ?? ""}
                  options={cadastros.centrosCusto}
                  placeholder="Obra atendida pela puxada"
                  searchPlaceholder="Buscar centro de custo..."
                  onChange={(v) =>
                    setRascunho((p) => ({ ...p, centroCustoId: v || null }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px]">Observações da puxada</Label>
              <Textarea
                rows={3}
                value={rascunho.observacoes}
                disabled={somenteLeitura}
                placeholder="Material transportado, janela de carregamento, instruções..."
                onChange={(e) =>
                  setRascunho((p) => ({ ...p, observacoes: e.target.value }))
                }
              />
            </div>
          </div>
        )}

        {etapa === "CAMINHOES" && (
          <div data-testid="ct5-etapa-caminhoes">
            <CaminhoesPuxadaEditor
              caminhoes={rascunho.caminhoes}
              somenteLeitura={somenteLeitura}
              onChange={(caminhoes) => setRascunho((p) => ({ ...p, caminhoes }))}
            />
          </div>
        )}

        {etapa === "TRAJETO" && (
          <div className="space-y-4" data-testid="ct5-etapa-trajeto">
            <PontoOperacionalBloco
              semMoldura
              titulo="Coleta do material"
              labelCentroCusto="Centro de custo / local de coleta"
              placeholderCentroCusto="De onde o material sai"
              labelPonto="Ponto exato de coleta"
              centrosCusto={cadastros.centrosCusto}
              centroCustoId={rascunho.centroCustoId}
              centroCustoEndereco={
                rascunho.centroCustoId
                  ? cadastros.enderecosCentroCusto[rascunho.centroCustoId] ?? null
                  : null
              }
              ponto={rascunho.coletaEndereco}
              latitude={rascunho.coletaLatitude}
              longitude={rascunho.coletaLongitude}
              somenteLeitura={somenteLeitura}
              testId="ct5-coleta"
              onChange={(patch) =>
                setRascunho((p) => ({
                  ...p,
                  centroCustoId:
                    patch.centroCustoId !== undefined ? patch.centroCustoId : p.centroCustoId,
                  coletaEndereco: patch.ponto !== undefined ? patch.ponto : p.coletaEndereco,
                  coletaLatitude:
                    patch.latitude !== undefined ? patch.latitude : p.coletaLatitude,
                  coletaLongitude:
                    patch.longitude !== undefined ? patch.longitude : p.coletaLongitude,
                }))
              }
            />

            <div className="border-t pt-3">
              <PontoOperacionalBloco
                semMoldura
                titulo="Descarga do material"
                labelCentroCusto="Centro de custo de referência"
                placeholderCentroCusto="Selecione o centro de custo"
                labelPonto="Ponto exato de descarga"
                centrosCusto={[]}
                centroCustoId={null}
                centroCustoEndereco={null}
                ponto={rascunho.descargaEndereco}
                latitude={rascunho.descargaLatitude}
                longitude={rascunho.descargaLongitude}
                somenteLeitura={somenteLeitura}
                testId="ct5-descarga"
                onChange={(patch) =>
                  setRascunho((p) => ({
                    ...p,
                    descargaEndereco:
                      patch.ponto !== undefined ? patch.ponto : p.descargaEndereco,
                    descargaLatitude:
                      patch.latitude !== undefined ? patch.latitude : p.descargaLatitude,
                    descargaLongitude:
                      patch.longitude !== undefined ? patch.longitude : p.descargaLongitude,
                  }))
                }
              />
            </div>

            {!podeCalcularRotaPuxada(rascunho) && (
              <Alert data-testid="ct5-trajeto-incompleto">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs">Trajeto incompleto</AlertTitle>
                <AlertDescription className="text-xs">
                  Confirme no mapa os dois pontos (coleta e descarga). A rota rodoviária é
                  calculada e persistida na programação.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {etapa === "REVISAO" && (
          <div className="space-y-3" data-testid="ct5-etapa-revisao">
            <div className="grid gap-3 lg:grid-cols-2">
              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-xs">Resumo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pb-3 text-[11px]">
                  <p>
                    <span className="text-muted-foreground">Data: </span>
                    {rascunho.dataPuxada
                      ? formatBrazilianDateForDisplay(rascunho.dataPuxada)
                      : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Centro de custo: </span>
                    {ccLabel ?? "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Coleta: </span>
                    {rascunho.coletaEndereco || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Descarga: </span>
                    {rascunho.descargaEndereco || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Distância: </span>
                    {rascunho.rotaPlanejada
                      ? `${rascunho.rotaPlanejada.distanciaKm.toFixed(1)} km`
                      : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Duração: </span>
                    {rascunho.rotaPlanejada?.duracaoMin
                      ? `${Math.round(rascunho.rotaPlanejada.duracaoMin)} min`
                      : "—"}
                  </p>
                  {persistida?.planejadorNome && (
                    <p>
                      <span className="text-muted-foreground">Planejador: </span>
                      {persistida.planejadorNome}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-2">
                  <CardTitle className="text-xs">
                    Caminhões e motoristas ({rascunho.caminhoes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 pb-3 text-[11px]">
                  {rascunho.caminhoes.length === 0 ? (
                    <p className="text-muted-foreground">Nenhum caminhão adicionado.</p>
                  ) : (
                    rascunho.caminhoes.map((c) => (
                      <p key={c.chaveLocal} className="truncate">
                        <span className="font-medium">{c.rotulo}</span>
                        {" — "}
                        {c.motoristaNome || "sem motorista"}
                      </p>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>

            {persistida && (
              <div className="h-[260px] overflow-hidden rounded-md border">
                <PuxadasMapa
                  puxadas={[persistida]}
                  selecionadoId={persistida.id}
                  onSelecionar={() => undefined}
                />
              </div>
            )}

            {errosProgramar.length > 0 && !somenteLeitura && (
              <Alert variant="destructive" data-testid="ct5-erro">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle className="text-xs">Pendências para programar</AlertTitle>
                <AlertDescription className="text-xs">{errosProgramar[0]}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      {/* Footer fixo — Salvar/Programar existem SOMENTE na revisão */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2 sm:px-4">
        <div className="flex items-center gap-2">
          {etapa === "DADOS" ? (
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={onFechar}>
              <ArrowLeft className="h-3.5 w-3.5" /> Cancelar
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={voltar}
              data-testid="ct5-voltar-etapa"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Voltar
            </Button>
          )}
          {somenteLeitura && (
            <span className="text-[11px] text-muted-foreground">Modo somente leitura.</span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {etapa !== "REVISAO" ? (
            <Button size="sm" onClick={avancar} data-testid="ct5-proxima-etapa">
              {etapa === "DADOS"
                ? "Próximo: Caminhões"
                : etapa === "CAMINHOES"
                  ? "Próximo: Coleta e descarga"
                  : "Revisar puxada"}{" "}
              →
            </Button>
          ) : (
            <>
              {!somenteLeitura && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={comando !== null}
                    onClick={() => void salvar()}
                    data-testid="ct5-salvar-rascunho"
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
                    disabled={comando !== null}
                    onClick={() => void programar()}
                    data-testid="ct5-programar"
                  >
                    {comando === "PROGRAMAR" ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-4 w-4" />
                    )}
                    Programar puxada
                  </Button>
                </>
              )}
              {podeCancelar && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  disabled={comando !== null}
                  onClick={() => setCancelarAberto(true)}
                  data-testid="ct5-cancelar-planejamento"
                >
                  {comando === "CANCELAR" ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="mr-1 h-4 w-4" />
                  )}
                  Cancelar planejamento
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <CancelarPlanejamentoDialog
        aberto={cancelarAberto}
        codigo={persistida?.codigo || "desta puxada"}
        emAndamento={comando === "CANCELAR"}
        onFechar={() => setCancelarAberto(false)}
        onConfirmar={(motivo) => void cancelarPlanejamento(motivo)}
      />

      <CtFeedbackDialog
        aberto={feedback !== null}
        tipo={feedback?.tipo ?? "SUCESSO"}
        titulo={feedback?.titulo ?? ""}
        mensagem={feedback?.mensagem}
        onTentarNovamente={
          feedback?.tentarNovamente
            ? () => {
                const repetir = feedback.tentarNovamente;
                setFeedback(null);
                repetir?.();
              }
            : undefined
        }
        onFechar={() => {
          const depois = feedback?.aoFechar;
          setFeedback(null);
          depois?.();
        }}
      />
    </div>
  );
};

export default PuxadaWizard;
