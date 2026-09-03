// Fase Equipe Designada — formulário dentro da aba "Equipe designada" do modal de recursos.
import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Combobox } from "@/components/ui/combobox";
import { Loader2, Plus, Trash2, X, AlertTriangle, Info } from "lucide-react";
import {
  useDesignarFuncionario,
  useEquipeDesignadaPorAtividade,
  useFuncionariosDisponiveisDesignacao,
  useRemoverDesignacao,
} from "@/hooks/planejamentoMacro/useEquipeDesignada";
import { useRecursosPorAtividade } from "@/hooks/planejamentoMacro/useRecursosPorAtividade";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import type { PapelTarefa } from "@/services/planejamentoMacro/equipeDesignadaService";

interface Props {
  atividadeId: string;
  planejamentoId: string;
  canEdit: boolean;
  dataInicio?: string | null;
  dataFim?: string | null;
}

const papelLabel: Record<PapelTarefa, string> = {
  execucao: "Execução",
  apoio: "Apoio",
  encarregado: "Encarregado",
  mestre: "Mestre",
  responsavel_tecnico: "Resp. técnico",
  apontador: "Apontador",
};

const PlanejarEquipeDesignadaForm: React.FC<Props> = ({
  atividadeId,
  canEdit,
  dataInicio,
  dataFim,
}) => {
  const { hasActionPermission } = usePermission();
  const canManage = hasActionPermission("engenharia_planejamento_equipe_manage", "criar");
  const canEmprestimo = hasActionPermission(
    "engenharia_planejamento_equipe_emprestimo",
    "criar"
  );
  const effectiveCanEdit = canEdit && canManage;

  const equipe = useEquipeDesignadaPorAtividade(atividadeId);
  const recursos = useRecursosPorAtividade(atividadeId);
  const designar = useDesignarFuncionario(atividadeId);
  const remover = useRemoverDesignacao(atividadeId);

  // CC da atividade — para calcular Origem do funcionário selecionado
  const atividadeCcQuery = useQuery({
    queryKey: ["planejamento-macro-atividade-cc", atividadeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_planejamento_atividades")
        .select("planejamento_id, bd_planejamentos_obra!inner(centro_custo_id)")
        .eq("id", atividadeId)
        .maybeSingle();
      if (error) throw error;
      return (data as any)?.bd_planejamentos_obra?.centro_custo_id as string | undefined;
    },
    enabled: !!atividadeId,
    staleTime: 60_000,
  });
  const ccAtividadeId = atividadeCcQuery.data ?? null;

  // contagem por função (demanda vs designados)
  const demandaPorFuncao = useMemo(() => {
    const m = new Map<string, { nome: string; demanda: number; designados: number }>();
    (recursos.data ?? [])
      .filter((r) => r.tipo_recurso === "mao_obra" && r.funcao_id)
      .forEach((r) => {
        m.set(r.funcao_id as string, {
          nome: r.funcao?.nome_funcao ?? r.descricao,
          demanda: Number(r.quantidade_prevista) || 0,
          designados: 0,
        });
      });
    (equipe.data ?? []).forEach((d) => {
      if (!d.funcao_id) return;
      const cur = m.get(d.funcao_id);
      if (cur) cur.designados += 1;
      else
        m.set(d.funcao_id, {
          nome: d.nome_funcao ?? "—",
          demanda: 0,
          designados: 1,
        });
    });
    return Array.from(m.values());
  }, [recursos.data, equipe.data]);

  // ----- Form de adição -----
  const [addOpen, setAddOpen] = useState(false);
  const [incluirOutrosCc, setIncluirOutrosCc] = useState(false);
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [funcaoId, setFuncaoId] = useState<string>("");
  const [papel, setPapel] = useState<PapelTarefa>("execucao");
  const [semIni, setSemIni] = useState<string>(dataInicio ?? "");
  const [semFim, setSemFim] = useState<string>(dataFim ?? "");
  const [dias, setDias] = useState<string>("");
  const [horas, setHoras] = useState<string>("");
  const [obs, setObs] = useState<string>("");
  const [busca, setBusca] = useState<string>("");
  const [buscaDebounced, setBuscaDebounced] = useState<string>("");

  // Debounce da busca (server-side, suporta CPF)
  useEffect(() => {
    const t = setTimeout(() => setBuscaDebounced(busca.trim()), 250);
    return () => clearTimeout(t);
  }, [busca]);

  const disponiveis = useFuncionariosDisponiveisDesignacao({
    atividadeId,
    incluirOutrosCc: incluirOutrosCc && canEmprestimo,
    busca: buscaDebounced || undefined,
    semanaInicio: semIni || undefined,
    semanaFim: semFim || undefined,
    enabled: addOpen,
  });

  const funcSelecionado = useMemo(
    () => disponiveis.data?.find((f) => f.funcionario_id === funcionarioId),
    [disponiveis.data, funcionarioId]
  );

  // pre-preenche funcao_id ao escolher funcionário
  useEffect(() => {
    if (funcSelecionado?.funcao_id && !funcaoId) setFuncaoId(funcSelecionado.funcao_id);
  }, [funcSelecionado, funcaoId]);

  const opcoesFuncionario = useMemo(
    () =>
      (disponiveis.data ?? []).map((f) => {
        const flags: string[] = [];
        if (f.tem_conflito_equipe) flags.push("⚠ equipe");
        if (f.tem_conflito_diaria_outro_cc) flags.push("⛔ diária");
        else if (f.tem_conflito_diaria_previsto) flags.push("⚠ diária prevista");
        return {
          value: f.funcionario_id,
          label: `${f.nome_completo}${f.matricula ? ` · ${f.matricula}` : ""}${
            f.nome_funcao ? ` — ${f.nome_funcao}` : ""
          }${flags.length ? `  ${flags.join(" ")}` : ""}`,
        };
      }),
    [disponiveis.data]
  );

  const origemCalculada: "proprio" | "outro" | null = useMemo(() => {
    if (!funcSelecionado || !ccAtividadeId) return null;
    return funcSelecionado.centro_custo_id === ccAtividadeId ? "proprio" : "outro";
  }, [funcSelecionado, ccAtividadeId]);

  const resetAdd = () => {
    setFuncionarioId("");
    setFuncaoId("");
    setPapel("execucao");
    setDias("");
    setHoras("");
    setObs("");
    setBusca("");
    setBuscaDebounced("");
    setIncluirOutrosCc(false);
  };

  const cancelAdd = () => {
    resetAdd();
    setAddOpen(false);
  };

  const conflitoEquipe = !!funcSelecionado?.tem_conflito_equipe;
  const conflitoDiariaReal = !!funcSelecionado?.tem_conflito_diaria_outro_cc;
  const alertaDiariaPrevista = !!funcSelecionado?.tem_conflito_diaria_previsto;

  const canSubmit =
    !!funcionarioId &&
    !!semIni &&
    !!semFim &&
    !conflitoEquipe &&
    !conflitoDiariaReal &&
    !designar.isPending;

  const handleAdicionar = async () => {
    if (!canSubmit) return;
    try {
      await designar.mutateAsync({
        atividade_id: atividadeId,
        funcionario_id: funcionarioId,
        funcao_id: funcaoId || null,
        papel,
        semana_inicio: semIni,
        semana_fim: semFim,
        dias_previstos: dias.trim() === "" ? null : Number(dias.replace(",", ".")),
        horas_previstas: horas.trim() === "" ? null : Number(horas.replace(",", ".")),
        observacao: obs.trim() || null,
      });
      resetAdd();
      setAddOpen(false);
    } catch {
      /* toast já tratado */
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Cabeçalho com demanda vs designados */}
        {demandaPorFuncao.length > 0 && (
          <div className="flex flex-wrap gap-2 text-xs">
            {demandaPorFuncao.map((d) => {
              const completo = d.demanda > 0 && d.designados >= d.demanda;
              return (
                <Badge
                  key={d.nome}
                  variant={completo ? "secondary" : "outline"}
                  className="font-normal"
                >
                  {d.nome}: {d.designados}
                  {d.demanda > 0 ? `/${d.demanda}` : ""}
                </Badge>
              );
            })}
          </div>
        )}

        {/* Lista de designados */}
        <div>
          <h4 className="text-sm font-semibold mb-2">
            Equipe designada{" "}
            <span className="text-muted-foreground font-normal">
              ({(equipe.data ?? []).length})
            </span>
          </h4>

          {equipe.isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" /> Carregando...
            </div>
          ) : (equipe.data ?? []).length === 0 ? (
            <div className="rounded-md border border-dashed px-3 py-4 text-sm text-muted-foreground">
              Nenhum funcionário designado ainda.
            </div>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                    <TableHead className="text-right">Horas</TableHead>
                    {effectiveCanEdit && <TableHead className="w-16 text-right">Ações</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(equipe.data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.nome_funcionario ?? "—"}
                        {r.matricula && (
                          <span className="text-xs text-muted-foreground">
                            {" · "}
                            {r.matricula}
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{r.nome_funcao ?? "—"}</TableCell>
                      <TableCell>{papelLabel[r.papel_na_tarefa]}</TableCell>
                      <TableCell>
                        {r.tipo_alocacao === "proprio_cc" ? (
                          <Badge variant="secondary" className="font-normal">
                            Próprio CC
                          </Badge>
                        ) : (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant="outline"
                                className="font-normal border-primary text-primary"
                              >
                                Emprestado · {r.codigo_cc_origem ?? "?"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              Alocação operacional temporária. Não altera o
                              Centro de Custo oficial do funcionário no
                              cadastro mestre.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.semana_inicio} → {r.semana_fim}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.dias_previstos != null ? Number(r.dias_previstos) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {r.horas_previstas != null ? Number(r.horas_previstas) : "—"}
                      </TableCell>
                      {effectiveCanEdit && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remover designação"
                            disabled={remover.isPending}
                            onClick={() =>
                              remover.mutate({ id: r.id })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Formulário de adição */}
        {effectiveCanEdit && (
          <Collapsible open={addOpen} onOpenChange={setAddOpen}>
            {!addOpen && (
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full gap-2">
                  <Plus className="h-4 w-4" />
                  Adicionar designado
                </Button>
              </CollapsibleTrigger>
            )}

            <CollapsibleContent className="border rounded-md p-4 space-y-3 bg-muted/30 mt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Adicionar designado</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar"
                  onClick={cancelAdd}
                  disabled={designar.isPending}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Combobox único: nome / matrícula / CPF */}
              <div className="space-y-2">
                <Label className="text-xs">Funcionário *</Label>
                <Combobox
                  options={opcoesFuncionario}
                  value={funcionarioId}
                  onChange={setFuncionarioId}
                  onSearchChange={setBusca}
                  placeholder={
                    disponiveis.isLoading
                      ? "Carregando..."
                      : opcoesFuncionario.length === 0
                        ? "Nenhum funcionário disponível"
                        : "Selecione um funcionário"
                  }
                  searchPlaceholder="Digite nome, matrícula ou CPF..."
                  emptyText={
                    disponiveis.isLoading
                      ? "Buscando..."
                      : "Nenhum funcionário encontrado"
                  }
                  disabled={disponiveis.isLoading && !funcionarioId}
                />

                {canEmprestimo && (
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <Checkbox
                      checked={incluirOutrosCc}
                      onCheckedChange={(v) => {
                        setIncluirOutrosCc(!!v);
                        setFuncionarioId("");
                      }}
                    />
                    Incluir funcionários de outros Centros de Custo
                  </label>
                )}

                {/* Resumo do funcionário selecionado */}
                {funcSelecionado && (
                  <div className="rounded-md border bg-background px-3 py-2 text-xs space-y-1">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <div>
                        <span className="text-muted-foreground">Função: </span>
                        <span className="font-medium">
                          {funcSelecionado.nome_funcao ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Centro de Custo: </span>
                        <span className="font-medium">
                          {funcSelecionado.codigo_centro_custo ?? "—"}
                          {funcSelecionado.nome_centro_custo
                            ? ` — ${funcSelecionado.nome_centro_custo}`
                            : ""}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Origem: </span>
                        {origemCalculada === "proprio" ? (
                          <Badge variant="secondary" className="font-normal">
                            Próprio Centro de Custo
                          </Badge>
                        ) : origemCalculada === "outro" ? (
                          <Badge
                            variant="outline"
                            className="font-normal border-primary text-primary"
                          >
                            Outro Centro de Custo
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status: </span>
                        <span className="font-medium">{funcSelecionado.status}</span>
                      </div>
                      {funcSelecionado.matricula && (
                        <div>
                          <span className="text-muted-foreground">Matrícula: </span>
                          <span className="font-medium">{funcSelecionado.matricula}</span>
                        </div>
                      )}
                      {funcSelecionado.cpf_mascarado && (
                        <div>
                          <span className="text-muted-foreground">CPF: </span>
                          <span className="font-mono">{funcSelecionado.cpf_mascarado}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Alertas */}
              {conflitoEquipe && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Este funcionário já está designado em outra atividade no
                    período selecionado. Ajuste o período ou escolha outro
                    funcionário.
                  </div>
                </div>
              )}

              {conflitoDiariaReal && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Funcionário já possui presença registrada em diária para
                    outro Centro de Custo neste período.
                  </div>
                </div>
              )}

              {alertaDiariaPrevista && !conflitoDiariaReal && (
                <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  <Info className="h-4 w-4 mt-0.5 shrink-0" />
                  <div>
                    Atenção: funcionário possui diária prevista/aprovada em
                    outro Centro de Custo neste período, mas ainda sem
                    presença real registrada.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Papel na tarefa</Label>
                  <Select
                    value={papel}
                    onValueChange={(v) => setPapel(v as PapelTarefa)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(papelLabel).map(([v, l]) => (
                        <SelectItem key={v} value={v}>
                          {l}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Início *</Label>
                    <Input
                      type="date"
                      value={semIni}
                      onChange={(e) => setSemIni(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Fim *</Label>
                    <Input
                      type="date"
                      value={semFim}
                      onChange={(e) => setSemFim(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Dias previstos</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={dias}
                    onChange={(e) => setDias(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div>
                  <Label className="text-xs">Horas previstas</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    inputMode="decimal"
                    value={horas}
                    onChange={(e) => setHoras(e.target.value)}
                    placeholder="—"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Observação</Label>
                  <Textarea
                    value={obs}
                    onChange={(e) => setObs(e.target.value)}
                    maxLength={500}
                    rows={2}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cancelAdd}
                  disabled={designar.isPending}
                >
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={handleAdicionar}
                  disabled={!canSubmit}
                >
                  {designar.isPending && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  Designar
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <p className="text-[11px] text-muted-foreground">
          A origem é calculada automaticamente comparando o Centro de Custo do
          funcionário com o da atividade. Designar funcionário de outro CC não
          altera o cadastro mestre — o CC de origem é gravado como snapshot
          para preservar o histórico.
        </p>
      </div>
    </TooltipProvider>
  );
};

export default PlanejarEquipeDesignadaForm;
