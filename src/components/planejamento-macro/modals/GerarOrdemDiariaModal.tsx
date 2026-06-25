import React, { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, ListChecks } from "lucide-react";
import { useFuncionariosDoCC } from "@/hooks/planejamentoMacro/useFuncionariosDoCC";
import { useContagensAtividades } from "@/hooks/planejamentoMacro/useContagensAtividades";
import {
  useGerarOrdemDiariaRascunho,
  useEmitirOrdemDiaria,
  useAtualizarOrdemDiariaRascunho,
} from "@/hooks/planejamentoMacro/useOrdensDiarias";
import { usePermission } from "@/hooks/usePermission";
import type { AtividadeNaSemana, Pendencia } from "@/lib/planejamentoMacro/planoSemanal/tipos";
import type { ResponsaveisPorItem } from "@/types/ordemDiariaObra";
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
}

const PENDENCIAS_CRITICAS = new Set<string>([
  "FUNCAO_NAO_MAPEADA",
  "EQUIPAMENTO_SEM_CATALOGO",
  "FORA_DO_ESCOPO_OPERACIONAL",
  "RECURSO_SEM_ATIVIDADE",
  "recurso_sem_horas",
  "atividade_sem_duracao",
]);

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

const GerarOrdemDiariaModal: React.FC<Props> = ({
  open,
  onOpenChange,
  planejamentoId,
  centroCustoId,
  semanaInicio,
  semanaFim,
  atividadesSemana,
  pendencias = [],
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const dentroSemana = today >= semanaInicio && today <= semanaFim ? today : semanaInicio;

  const [dataOrdem, setDataOrdem] = useState<string>(dentroSemana);
  const [responsavelId, setResponsavelId] = useState<string>("");
  const [obsGeral, setObsGeral] = useState<string>("");
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [obsItem, setObsItem] = useState<Record<string, string>>({});
  const [respItem, setRespItem] = useState<Record<string, string>>({});

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const opcoesResp = useMemo(() => {
    return (funcQ.data ?? []).map((f) => ({
      value: f.id,
      label: f.funcao_nome ? `${f.nome_completo} — ${f.funcao_nome}` : f.nome_completo,
    }));
  }, [funcQ.data]);

  const opcoesRespItem = useMemo(
    () => [{ value: "", label: "Usar responsável principal" }, ...opcoesResp],
    [opcoesResp]
  );

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

  // Resumo agregado das selecionadas
  const resumo = useMemo(() => {
    let equipe = 0,
      funcoes = 0,
      equipamentos = 0,
      materiais = 0,
      pendTotal = 0;
    const semEquipe: string[] = [];
    const semFuncao: string[] = [];
    const comPend: string[] = [];
    for (const r of atividadesSemana) {
      const id = r.atividade.id;
      if (!selecionadas.has(id)) continue;
      const c = contagens[id] ?? { equipe: 0, funcoes: 0, equipamentos: 0, materiais: 0 };
      equipe += c.equipe;
      funcoes += c.funcoes;
      equipamentos += c.equipamentos;
      materiais += c.materiais;
      const p = pendPorAtividade[id]?.total ?? 0;
      pendTotal += p;
      if (c.equipe === 0) semEquipe.push(r.atividade.nome);
      if (c.funcoes === 0) semFuncao.push(r.atividade.nome);
      if (p > 0) comPend.push(r.atividade.nome);
    }
    return { equipe, funcoes, equipamentos, materiais, pendTotal, semEquipe, semFuncao, comPend };
  }, [atividadesSemana, selecionadas, contagens, pendPorAtividade]);

  const responsavelPrincipalNome = useMemo(() => {
    const o = opcoesResp.find((x) => x.value === responsavelId);
    return o?.label ?? "—";
  }, [opcoesResp, responsavelId]);

  const buildResponsaveisPorItem = (): ResponsaveisPorItem => {
    const out: ResponsaveisPorItem = {};
    for (const id of selecionadas) {
      const v = respItem[id];
      if (v && v !== responsavelId) out[id] = { funcionario_id: v };
    }
    return out;
  };

  const submit = async (emitirApos: boolean) => {
    if (!planejamentoId) return;
    if (selecionadas.size === 0) return;
    const ids = Array.from(selecionadas);
    const respPorItem = buildResponsaveisPorItem();
    const obsPorItem: Record<string, string> = {};
    for (const id of ids) if (obsItem[id]?.trim()) obsPorItem[id] = obsItem[id].trim();

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

      // Persistir observações por item (se houver) via atualização
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
    } catch {
      // toast nos hooks
    }
  };

  const pending = gerar.isPending || atualizar.isPending || emitir.isPending;
  const podeEmitir = canEmitir && !!responsavelId && selecionadas.size > 0;

  return (
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
          {/* Bloco 1 — Data + responsável principal */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="data-ordem">Data da ordem</Label>
              <Input
                id="data-ordem"
                type="date"
                min={semanaInicio}
                max={semanaFim}
                value={dataOrdem}
                onChange={(e) => setDataOrdem(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Responsável principal (funcionário do CC)</Label>
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
                  const c = contagens[a.id] ?? {
                    equipe: 0,
                    funcoes: 0,
                    equipamentos: 0,
                    materiais: 0,
                  };
                  const pend = pendPorAtividade[a.id] ?? { total: 0, criticas: 0 };
                  const pct = a.percentual_manual ?? a.percentual_concluido_importado ?? null;
                  const fonte = a.fonte_progresso ?? null;
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
                        <div className="flex-1 min-w-0 space-y-1">
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
                            {fonte ? ` (${fonte})` : ""} · Período: {fmtDate(a.data_inicio)} →{" "}
                            {fmtDate(a.data_fim)}
                            {a.quantidade_prevista != null && a.unidade
                              ? ` · Qtd: ${Number(a.quantidade_prevista).toLocaleString("pt-BR")} ${a.unidade}`
                              : ""}
                          </div>
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px] text-muted-foreground pt-1">
                            <span>Equipe: <b className="text-foreground">{c.equipe}</b></span>
                            <span>Funções: <b className="text-foreground">{c.funcoes}</b></span>
                            <span>Equip.: <b className="text-foreground">{c.equipamentos}</b></span>
                            <span>Materiais: <b className="text-foreground">{c.materiais}</b></span>
                            <span>Pend.: <b className="text-foreground">{pend.total}</b></span>
                            <span>Dias: <b className="text-foreground">{r.diasUteisNaSemana}</b></span>
                          </div>

                          {sel && (
                            <div className="mt-2 grid gap-2 md:grid-cols-2">
                              <div className="space-y-1">
                                <Label className="text-xs">Responsável da tarefa</Label>
                                <Combobox
                                  options={opcoesRespItem}
                                  value={respItem[a.id] ?? ""}
                                  onChange={(v) => setRespItem((p) => ({ ...p, [a.id]: v }))}
                                  placeholder="Usar responsável principal"
                                  emptyText="Sem opções"
                                  searchPlaceholder="Buscar funcionário..."
                                />
                              </div>
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
                            </div>
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
                  <div className="font-medium">{resumo.equipe}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Funções</div>
                  <div className="font-medium">{resumo.funcoes}</div>
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
              </div>

              {(resumo.semEquipe.length > 0 ||
                resumo.semFuncao.length > 0 ||
                resumo.comPend.length > 0) && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Atenção</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-5 space-y-0.5 text-xs">
                      {resumo.semEquipe.length > 0 && (
                        <li>{resumo.semEquipe.length} tarefa(s) sem equipe designada.</li>
                      )}
                      {resumo.semFuncao.length > 0 && (
                        <li>{resumo.semFuncao.length} tarefa(s) sem função planejada.</li>
                      )}
                      {resumo.comPend.length > 0 && (
                        <li>{resumo.comPend.length} tarefa(s) com pendências.</li>
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
            onClick={() => submit(false)}
            disabled={pending || selecionadas.size === 0}
          >
            {pending ? "Salvando..." : "Salvar rascunho"}
          </Button>
          <Button
            onClick={() => submit(true)}
            disabled={pending || !podeEmitir}
            title={
              !canEmitir
                ? "Sem permissão para emitir"
                : !responsavelId
                ? "Defina o responsável principal"
                : ""
            }
          >
            {pending ? "Processando..." : "Salvar e emitir"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GerarOrdemDiariaModal;
