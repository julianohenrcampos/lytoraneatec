import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ListChecks, Users, Wrench, UserCog } from "lucide-react";
import { useFuncionariosDoCC } from "@/hooks/planejamentoMacro/useFuncionariosDoCC";
import {
  useContagensAtividades,
  type ContagemAtividade,
} from "@/hooks/planejamentoMacro/useContagensAtividades";
import {
  useGerarOrdemDiariaRascunho,
  useEmitirOrdemDiaria,
  useAtualizarOrdemDiariaRascunho,
} from "@/hooks/planejamentoMacro/useOrdensDiarias";
import { usePermission } from "@/hooks/usePermission";
import {
  buscarOrdemAtivaPorChave,
  isDuplicidadeOrdemDiaria,
  type OrdemAtivaMin,
} from "@/services/planejamentoMacro/ordemDiariaService";
import VisualizarOrdemDiariaDialog from "@/components/planejamento-macro/modals/VisualizarOrdemDiariaDialog";
import { toast } from "sonner";
import type { AtividadeNaSemana, Pendencia } from "@/lib/planejamentoMacro/planoSemanal/tipos";
import type { ResponsaveisPorItem } from "@/types/ordemDiariaObra";
import { getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planejamentoId: string | null;
  centroCustoId: string | null;
  semanaInicio: string;
  semanaFim: string;
  atividadesSemana: AtividadeNaSemana[];
  pendencias?: Pendencia[];
  /** Abre o PlanejarRecursosDialog na aba de funções/recursos. */
  onAbrirRecursos?: (atividadeId: string) => void;
  /** Abre o PlanejarRecursosDialog na aba de equipe designada. */
  onAbrirEquipeDesignada?: (atividadeId: string) => void;
}

const PENDENCIAS_CRITICAS = new Set<string>([
  "FUNCAO_NAO_MAPEADA",
  "EQUIPAMENTO_SEM_CATALOGO",
  "FORA_DO_ESCOPO_OPERACIONAL",
  "RECURSO_SEM_ATIVIDADE",
  "recurso_sem_horas",
  "atividade_sem_duracao",
]);

const PAPEL_LABEL: Record<string, string> = {
  encarregado: "Encarregado",
  mestre: "Mestre",
  responsavel_tecnico: "Responsável técnico",
  apontador: "Apontador",
  execucao: "Execução",
  apoio: "Apoio",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function formatFuncoesLista(
  detalhe: { nome: string; quantidade: number }[]
): string {
  if (detalhe.length === 0) return "";
  return detalhe
    .map((f) => `${f.nome}: ${Number.isFinite(f.quantidade) ? f.quantidade : 0}`)
    .join("; ");
}

const VAZIO: ContagemAtividade = {
  equipe: 0,
  funcoesPlanejadas: 0,
  funcoesPlanejadasDetalhe: [],
  funcoesDesignadasDetalhe: [],
  equipamentos: 0,
  materiais: 0,
  responsavelHerdado: null,
};

const GerarOrdemDiariaModal: React.FC<Props> = ({
  open,
  onOpenChange,
  planejamentoId,
  centroCustoId,
  semanaInicio,
  semanaFim,
  atividadesSemana,
  pendencias = [],
  onAbrirRecursos,
  onAbrirEquipeDesignada,
}) => {
  // FASE A: usar data Brasil/São Paulo — nunca UTC.
  const today = getCurrentBrazilianDate();
  const semanaEncerrada = today > semanaFim;
  const minDataOrdem = today > semanaInicio ? today : semanaInicio;
  const dentroSemana = semanaEncerrada
    ? semanaFim
    : today >= semanaInicio && today <= semanaFim
    ? today
    : semanaInicio;

  const [dataOrdem, setDataOrdem] = useState<string>(dentroSemana);
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [obsGeral, setObsGeral] = useState<string>("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [obsItem, setObsItem] = useState<Record<string, string>>({});
  // Override manual do responsável da tarefa (substitui o herdado).
  const [respItem, setRespItem] = useState<Record<string, string>>({});
  const [confirmSemRespOpen, setConfirmSemRespOpen] = useState(false);

  // Pré-checagem de duplicidade / abertura da ordem existente.
  const [ordemExistente, setOrdemExistente] = useState<OrdemAtivaMin | null>(null);
  const [visualizarOrdemId, setVisualizarOrdemId] = useState<string | null>(null);
  const [checando, setChecando] = useState(false);

  const funcQ = useFuncionariosDoCC(centroCustoId);
  const { hasActionPermission } = usePermission();
  const canEmitir = hasActionPermission("engenharia_ordem_diaria_emitir", "aprovar");

  const gerar = useGerarOrdemDiariaRascunho();
  const atualizar = useAtualizarOrdemDiariaRascunho();
  const emitir = useEmitirOrdemDiaria();

  const atividadeIds = useMemo(
    () => atividadesSemana.map((r) => r.atividade.id),
    [atividadesSemana]
  );
  const contQ = useContagensAtividades(planejamentoId, atividadeIds);
  const contagens = contQ.data ?? {};

  // pendencias por atividade
  const pendPorAtividade = useMemo(() => {
    const m: Record<string, { total: number; criticas: number }> = {};
    for (const p of pendencias) {
      if (!p.atividadeId) continue;
      const cur = (m[p.atividadeId] ??= { total: 0, criticas: 0 });
      cur.total += 1;
      if (PENDENCIAS_CRITICAS.has(p.tipo)) cur.criticas += 1;
    }
    return m;
  }, [pendencias]);

  useEffect(() => {
    if (open) {
      setDataOrdem(dentroSemana);
      setResponsavelId("");
      setObsGeral("");
      setSelecionadas(new Set(atividadesSemana.map((r) => r.atividade.id)));
      setObsItem({});
      setRespItem({});
      setConfirmSemRespOpen(false);
      setOrdemExistente(null);
      setVisualizarOrdemId(null);
      setChecando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const opcoesResp = useMemo(() => {
    return (funcQ.data ?? []).map((f) => ({
      value: f.id,
      label: f.funcao_nome ? `${f.nome_completo} — ${f.funcao_nome}` : f.nome_completo,
    }));
  }, [funcQ.data]);

  const toggle = (id: string, v: boolean) => {
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  };

  // Ações rápidas
  const selecionarTodas = () =>
    setSelecionadas(new Set(atividadesSemana.map((r) => r.atividade.id)));
  const limparSelecao = () => setSelecionadas(new Set());
  const apenasEmAndamento = () =>
    setSelecionadas(
      new Set(
        atividadesSemana
          .filter((r) => (r.atividade.status ?? "").toLowerCase() === "em_andamento")
          .map((r) => r.atividade.id)
      )
    );
  const apenasSemPendCriticas = () =>
    setSelecionadas(
      new Set(
        atividadesSemana
          .filter((r) => (pendPorAtividade[r.atividade.id]?.criticas ?? 0) === 0)
          .map((r) => r.atividade.id)
      )
    );

  // Responsável efetivo (override > herdado > principal).
  const responsavelEfetivo = (atividadeId: string): string | null => {
    const override = respItem[atividadeId];
    if (override) return override;
    const herdado = contagens[atividadeId]?.responsavelHerdado?.funcionario_id;
    if (herdado) return herdado;
    return responsavelId || null;
  };

  // Resumo agregado das selecionadas.
  const resumo = useMemo(() => {
    let equipe = 0,
      funcoesPlanejTotal = 0,
      funcoesDesigTotal = 0,
      equipamentos = 0,
      materiais = 0,
      pendTotal = 0;
    const semResponsavel: string[] = [];
    const semEquipe: string[] = [];
    for (const r of atividadesSemana) {
      const id = r.atividade.id;
      if (!selecionadas.has(id)) continue;
      const c = contagens[id] ?? VAZIO;
      equipe += c.equipe;
      funcoesPlanejTotal += c.funcoesPlanejadasDetalhe.length;
      funcoesDesigTotal += c.funcoesDesignadasDetalhe.length;
      equipamentos += c.equipamentos;
      materiais += c.materiais;
      pendTotal += pendPorAtividade[id]?.total ?? 0;
      if (c.equipe === 0) semEquipe.push(r.atividade.nome);
      if (!responsavelEfetivo(id)) semResponsavel.push(r.atividade.nome);
    }
    return {
      equipe,
      funcoesPlanejTotal,
      funcoesDesigTotal,
      equipamentos,
      materiais,
      pendTotal,
      semResponsavel,
      semEquipe,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atividadesSemana, selecionadas, contagens, pendPorAtividade, respItem, responsavelId]);

  const responsavelPrincipalNome = useMemo(() => {
    const o = opcoesResp.find((x) => x.value === responsavelId);
    return o?.label ?? "—";
  }, [opcoesResp, responsavelId]);

  // Monta o map enviado à RPC garantindo que herdado/override vão ao snapshot
  // mesmo quando o responsável principal estiver vazio.
  const buildResponsaveisPorItem = (): ResponsaveisPorItem => {
    const out: ResponsaveisPorItem = {};
    for (const id of selecionadas) {
      const override = respItem[id];
      const herdado = contagens[id]?.responsavelHerdado?.funcionario_id ?? null;
      const escolhido = override || herdado || null;
      if (escolhido && escolhido !== responsavelId) {
        out[id] = { funcionario_id: escolhido };
      }
    }
    return out;
  };

  // FASE A: se a ordem existente é rascunho vencido, vai direto p/ visualização
  // (bloqueia edição/emissão retroativa). Caso contrário mantém fluxo anterior.
  const abrirOrdemExistente = (ord: OrdemAtivaMin) => {
    const vencida = ord.data_ordem < today;
    if (ord.status === "rascunho" && vencida) {
      toast.info("Rascunho vencido. Abrindo em modo consulta.");
      setVisualizarOrdemId(ord.id);
      return;
    }
    if (ord.status === "rascunho") {
      setOrdemExistente(ord); // AlertDialog abaixo decide abrir/cancelar
    } else if (ord.status === "emitida") {
      toast.info("Já existe Ordem Diária emitida para esta data. Abrindo visualização.");
      setVisualizarOrdemId(ord.id);
    } else {
      toast.info(`Já existe Ordem Diária ativa (status: ${ord.status}) para esta data.`);
      setVisualizarOrdemId(ord.id);
    }
  };

  const dataRetroativa = dataOrdem < today;

  const persistir = async (emitirApos: boolean) => {
    if (!planejamentoId || !centroCustoId) return;
    if (selecionadas.size === 0) return;

    // FASE A: guarda inicial — defesa em profundidade antes de qualquer RPC.
    if (semanaEncerrada) {
      toast.error("Semana já encerrada. Replaneje a atividade para uma data atual ou futura.");
      return;
    }
    if (dataRetroativa) {
      toast.error("Não é possível emitir Ordem Diária retroativa. Replaneje a atividade para uma data atual ou futura.");
      return;
    }

    const ids = Array.from(selecionadas);
    const respPorItem = buildResponsaveisPorItem();
    const obsPorItem: Record<string, string> = {};
    for (const id of ids) if (obsItem[id]?.trim()) obsPorItem[id] = obsItem[id].trim();

    // 1) Pré-checagem espelhando ux_ordens_diarias_unica_ativa (status <> 'cancelada').
    try {
      setChecando(true);
      const existente = await buscarOrdemAtivaPorChave(centroCustoId, planejamentoId, dataOrdem);
      if (existente) {
        abrirOrdemExistente(existente);
        return;
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao verificar ordem existente.");
      return;
    } finally {
      setChecando(false);
    }

    // 2) Chamada da RPC com fallback amigável para 23505 / constraint (corrida).
    try {
      const ordemId = await gerar.mutateAsync({
        planejamentoId,
        dataOrdem,
        responsavelFuncionarioId: responsavelId || null,
        responsavelProfileId: null,
        atividadeIds: ids,
        observacaoGeral: obsGeral.trim() || null,
        responsaveisPorItem: respPorItem,
      });

      if (Object.keys(obsPorItem).length > 0) {
        await atualizar.mutateAsync({
          ordemId,
          responsavelFuncionarioId: responsavelId || null,
          responsavelProfileId: null,
          atividadeIds: ids,
          observacaoGeral: obsGeral.trim() || null,
          observacaoPorItem: obsPorItem,
          responsaveisPorItem: respPorItem,
        });
      }

      if (emitirApos) await emitir.mutateAsync(ordemId);
      onOpenChange(false);
    } catch (err) {
      if (isDuplicidadeOrdemDiaria(err)) {
        toast.error("Já existe Ordem Diária ativa para este centro de custo e data.");
        try {
          const existente = await buscarOrdemAtivaPorChave(
            centroCustoId, planejamentoId, dataOrdem,
          );
          if (existente) abrirOrdemExistente(existente);
        } catch {
          /* silencioso — o toast principal já foi mostrado */
        }
        return;
      }
      // demais erros: toast do hook já apareceu
    }
  };

  const handleSalvarRascunho = () => persistir(false);

  const handleEmitir = () => {
    if (resumo.semResponsavel.length > 0) {
      setConfirmSemRespOpen(true);
      return;
    }
    void persistir(true);
  };

  const pending = gerar.isPending || atualizar.isPending || emitir.isPending || checando;
  const bloqueadoRetroativo = semanaEncerrada || dataRetroativa;
  const podeEmitir = canEmitir && selecionadas.size > 0 && !bloqueadoRetroativo;
  const tooltipRetroativo = semanaEncerrada
    ? "Semana já encerrada. Replaneje a atividade para uma data atual ou futura."
    : dataRetroativa
    ? "Não é possível emitir Ordem Diária retroativa. Replaneje a atividade para uma data atual ou futura."
    : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Gerar Ordem Diária
            </DialogTitle>
            <DialogDescription>
              Distribui as tarefas já planejadas para o dia. Edições do planejamento continuam na aba
              "Tarefas da Semana". Ao emitir, a ordem vira um snapshot imutável.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {semanaEncerrada && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Semana já encerrada</AlertTitle>
                <AlertDescription>
                  Semana já encerrada. Replaneje a atividade para uma data atual ou futura.
                </AlertDescription>
              </Alert>
            )}
            {!semanaEncerrada && dataRetroativa && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Data retroativa</AlertTitle>
                <AlertDescription>
                  Não é possível emitir Ordem Diária retroativa. Escolha uma data igual ou posterior a hoje.
                </AlertDescription>
              </Alert>
            )}

            {/* Bloco 1 — Data + responsável principal */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="data-ordem">Data da ordem</Label>
                <Input
                  id="data-ordem"
                  type="date"
                  min={minDataOrdem}
                  max={semanaFim}
                  value={dataOrdem}
                  onChange={(e) => setDataOrdem(e.target.value)}
                  disabled={semanaEncerrada}
                />
              </div>
              <div className="space-y-1">
                <Label>Responsável principal (opcional — usado como fallback)</Label>
                <Combobox
                  options={opcoesResp}
                  value={responsavelId}
                  onChange={setResponsavelId}
                  placeholder={funcQ.isLoading ? "Carregando..." : "Selecione o responsável"}
                  emptyText="Nenhum funcionário ativo no CC"
                  searchPlaceholder="Buscar funcionário..."
                />
              </div>
            </div>

            {/* Bloco 2 — observação geral */}
            <div className="space-y-1">
              <Label htmlFor="obs-geral">Observação geral</Label>
              <Textarea
                id="obs-geral"
                rows={2}
                maxLength={500}
                value={obsGeral}
                onChange={(e) => setObsGeral(e.target.value)}
                placeholder="Notas para a equipe do dia..."
              />
            </div>

            {/* Bloco 3 — Atividades */}
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-base">Atividades da semana</Label>
                <Badge variant="outline">
                  {selecionadas.size} de {atividadesSemana.length} selecionada(s)
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={selecionarTodas}>
                  Selecionar todas
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={limparSelecao}>
                  Limpar seleção
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={apenasEmAndamento}>
                  Somente em andamento
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={apenasSemPendCriticas}>
                  Somente sem pendências críticas
                </Button>
              </div>

              {atividadesSemana.length === 0 ? (
                <p className="text-sm text-muted-foreground p-6 text-center border rounded-md">
                  Sem atividades na semana selecionada.
                </p>
              ) : (
                <div className="space-y-2">
                  {atividadesSemana.map((r) => {
                    const a = r.atividade;
                    const sel = selecionadas.has(a.id);
                    const c = contagens[a.id] ?? VAZIO;
                    const pend = pendPorAtividade[a.id] ?? { total: 0, criticas: 0 };
                    const pct =
                      a.percentual_manual ?? a.percentual_concluido_importado ?? null;
                    const fonte = a.fonte_progresso ?? null;
                    const herdado = c.responsavelHerdado;
                    const override = respItem[a.id];
                    const overrideFunc = override
                      ? opcoesResp.find((x) => x.value === override)
                      : null;
                    const respLabel = override
                      ? overrideFunc?.label ?? "Trocado manualmente"
                      : herdado
                      ? `${herdado.nome} (${PAPEL_LABEL[herdado.papel] ?? herdado.papel})`
                      : responsavelId
                      ? `${responsavelPrincipalNome} (principal)`
                      : "Sem responsável definido";

                    const funcoesPlanejTxt = formatFuncoesLista(c.funcoesPlanejadasDetalhe);
                    const funcoesDesigTxt = formatFuncoesLista(c.funcoesDesignadasDetalhe);

                    return (
                      <div
                        key={a.id}
                        className={`border rounded-md p-3 ${sel ? "border-primary/60 bg-accent/30" : ""}`}
                      >
                        <div className="flex items-start gap-3">
                          <Checkbox
                            checked={sel}
                            onCheckedChange={(v) => toggle(a.id, Boolean(v))}
                            className="mt-1"
                          />
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{a.nome}</span>
                              {Boolean(a.is_critica) && (
                                <Badge
                                  className="text-[10px] bg-orange-600 hover:bg-orange-700 text-white border-transparent"
                                  title="Atividade crítica do cronograma."
                                >
                                  Crítica
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[10px]">
                                {a.status ?? "—"}
                              </Badge>
                              {pend.criticas > 0 && (
                                <Badge variant="destructive" className="text-[10px]">
                                  {pend.criticas} pend. crítica(s)
                                </Badge>
                              )}
                            </div>

                            <div className="text-xs text-muted-foreground">
                              EAP: {a.outline_number ?? a.codigo_wbs ?? "—"} · Frente:{" "}
                              {a.frente_servico ?? "—"} · Progresso:{" "}
                              {pct != null ? `${Number(pct).toFixed(0)}%` : "—"}
                              {fonte ? ` (${fonte})` : ""} · Período:{" "}
                              {fmtDate(a.data_inicio)} → {fmtDate(a.data_fim)}
                              {a.quantidade_prevista != null && a.unidade
                                ? ` · Qtd: ${Number(a.quantidade_prevista).toLocaleString("pt-BR")} ${a.unidade}`
                                : ""}
                            </div>

                            <div className="space-y-1 text-xs">
                              <div>
                                <span className="text-muted-foreground">Equipe designada: </span>
                                <span className="font-medium">
                                  {c.equipe > 0
                                    ? `${c.equipe} pessoa${c.equipe === 1 ? "" : "s"}`
                                    : "Nenhuma equipe designada"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Funções planejadas: </span>
                                <span className="font-medium">
                                  {funcoesPlanejTxt || "Nenhuma função planejada"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">
                                  Equipe designada por função:{" "}
                                </span>
                                <span className="font-medium">
                                  {funcoesDesigTxt || "Nenhuma equipe designada"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Equipamentos: </span>
                                <span className="font-medium">
                                  {c.equipamentos > 0
                                    ? `${c.equipamentos} planejado${c.equipamentos === 1 ? "" : "s"}`
                                    : "Nenhum equipamento planejado"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Materiais: </span>
                                <span className="font-medium">
                                  {c.materiais > 0
                                    ? `${c.materiais} planejado${c.materiais === 1 ? "" : "s"}`
                                    : "Nenhum material planejado"}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Pendências: </span>
                                <span className="font-medium">
                                  {pend.total === 0
                                    ? "Sem pendências"
                                    : `${pend.criticas} crítica(s) · ${pend.total} totais`}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Responsável: </span>
                                <span
                                  className={`font-medium ${
                                    !override && !herdado && !responsavelId
                                      ? "text-destructive"
                                      : ""
                                  }`}
                                >
                                  {respLabel}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Dias úteis na semana: </span>
                                <span className="font-medium">{r.diasUteisNaSemana}</span>
                              </div>
                            </div>

                            {sel && (
                              <>
                                <div className="space-y-1">
                                  <Label className="text-xs">Observação da tarefa</Label>
                                  <Textarea
                                    rows={2}
                                    maxLength={300}
                                    placeholder="Opcional"
                                    value={obsItem[a.id] ?? ""}
                                    onChange={(e) =>
                                      setObsItem((p) => ({ ...p, [a.id]: e.target.value }))
                                    }
                                    className="text-xs"
                                  />
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                  {onAbrirRecursos && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onAbrirRecursos(a.id)}
                                    >
                                      <Wrench className="h-3.5 w-3.5 mr-1" />
                                      Abrir recursos
                                    </Button>
                                  )}
                                  {onAbrirEquipeDesignada && (
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onAbrirEquipeDesignada(a.id)}
                                    >
                                      <Users className="h-3.5 w-3.5 mr-1" />
                                      Abrir equipe designada
                                    </Button>
                                  )}
                                  <Popover>
                                    <PopoverTrigger asChild>
                                      <Button type="button" variant="outline" size="sm">
                                        <UserCog className="h-3.5 w-3.5 mr-1" />
                                        Trocar responsável
                                      </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[320px] p-3" align="start">
                                      <div className="space-y-2">
                                        <Label className="text-xs">
                                          Responsável da tarefa
                                        </Label>
                                        <Combobox
                                          options={opcoesResp}
                                          value={respItem[a.id] ?? ""}
                                          onChange={(v) =>
                                            setRespItem((p) => ({ ...p, [a.id]: v }))
                                          }
                                          placeholder="Selecionar funcionário"
                                          emptyText="Sem opções"
                                          searchPlaceholder="Buscar funcionário..."
                                        />
                                        {respItem[a.id] && (
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="w-full"
                                            onClick={() =>
                                              setRespItem((p) => {
                                                const n = { ...p };
                                                delete n[a.id];
                                                return n;
                                              })
                                            }
                                          >
                                            Restaurar herdado
                                          </Button>
                                        )}
                                      </div>
                                    </PopoverContent>
                                  </Popover>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Bloco 4 — Resumo + avisos */}
            {selecionadas.size > 0 && (
              <div className="space-y-2">
                <Label className="text-base">Resumo da Ordem</Label>
                <div className="border rounded-md p-3 bg-muted/30 text-sm grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Data</div>
                    <div className="font-medium">{fmtDate(dataOrdem)}</div>
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <div className="text-xs text-muted-foreground">Responsável principal</div>
                    <div className="font-medium truncate">{responsavelPrincipalNome}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Tarefas</div>
                    <div className="font-medium">{selecionadas.size}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Equipe total</div>
                    <div className="font-medium">
                      {resumo.equipe} pessoa{resumo.equipe === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Funções planejadas</div>
                    <div className="font-medium">{resumo.funcoesPlanejTotal} distintas</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Funções designadas</div>
                    <div className="font-medium">{resumo.funcoesDesigTotal} distintas</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Equipamentos</div>
                    <div className="font-medium">{resumo.equipamentos}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Materiais</div>
                    <div className="font-medium">{resumo.materiais}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Pendências</div>
                    <div className="font-medium">{resumo.pendTotal}</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Sem responsável</div>
                    <div className="font-medium">
                      {resumo.semResponsavel.length} tarefa(s)
                    </div>
                  </div>
                </div>

                {(resumo.semEquipe.length > 0 || resumo.semResponsavel.length > 0) && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Atenção</AlertTitle>
                    <AlertDescription>
                      <ul className="list-disc pl-5 space-y-0.5 text-xs">
                        {resumo.semEquipe.length > 0 && (
                          <li>{resumo.semEquipe.length} tarefa(s) sem equipe designada.</li>
                        )}
                        {resumo.semResponsavel.length > 0 && (
                          <li>
                            {resumo.semResponsavel.length} tarefa(s) sem responsável definido — a
                            emissão pedirá confirmação.
                          </li>
                        )}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-3 border-t bg-background flex flex-wrap justify-end gap-2 shrink-0">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button
              variant="secondary"
              onClick={handleSalvarRascunho}
              disabled={pending || selecionadas.size === 0 || bloqueadoRetroativo}
              title={bloqueadoRetroativo ? tooltipRetroativo : ""}
            >
              {pending ? "Salvando..." : "Salvar rascunho"}
            </Button>
            <Button
              onClick={handleEmitir}
              disabled={pending || !podeEmitir}
              title={
                bloqueadoRetroativo
                  ? tooltipRetroativo
                  : !canEmitir
                  ? "Sem permissão para emitir"
                  : selecionadas.size === 0
                  ? "Selecione ao menos uma tarefa"
                  : ""
              }
            >
              {pending ? "Processando..." : "Salvar e emitir"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmSemRespOpen} onOpenChange={setConfirmSemRespOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Emitir sem responsável definido?</AlertDialogTitle>
            <AlertDialogDescription>
              {resumo.semResponsavel.length} tarefa(s) serão emitidas sem responsável definido
              (sem override, sem responsável herdado e sem responsável principal). Deseja
              continuar mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              onClick={() => {
                setConfirmSemRespOpen(false);
                void persistir(true);
              }}
            >
              Emitir mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rascunho já existente para (CC, plano, data): oferece abrir para edição/visualização. */}
      <AlertDialog
        open={ordemExistente?.status === "rascunho"}
        onOpenChange={(o) => { if (!o) setOrdemExistente(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Já existe rascunho para esta data</AlertDialogTitle>
            <AlertDialogDescription>
              Existe um rascunho de Ordem Diária para {fmtDate(dataOrdem)} neste centro de custo.
              Deseja abrir o rascunho existente para revisar e emitir?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fechar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const id = ordemExistente?.id ?? null;
                setOrdemExistente(null);
                if (id) setVisualizarOrdemId(id);
              }}
            >
              Abrir rascunho
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Visualização/edição da ordem existente (rascunho/emitida/outro status ativo). */}
      <VisualizarOrdemDiariaDialog
        open={!!visualizarOrdemId}
        onOpenChange={(o) => {
          if (!o) {
            setVisualizarOrdemId(null);
            onOpenChange(false); // fecha o modal de geração também
          }
        }}
        ordemId={visualizarOrdemId}
        ccLabel={null}
      />
    </>
  );
};

export default GerarOrdemDiariaModal;
