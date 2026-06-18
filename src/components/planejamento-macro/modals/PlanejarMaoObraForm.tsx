// Fase 6H.1 / 6H.1.2 — Form de Mão de Obra planejada dentro do PlanejarRecursosDialog.
// Lista funções já planejadas (com edição inline de Qtd/Horas/Dias/Observação),
// adiciona nova função e remove. Função (funcao_id) é imutável após criação:
// para trocar, o usuário exclui e adiciona outra.

import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Trash2, Loader2, Plus, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useRecursosPorAtividade } from "@/hooks/planejamentoMacro/useRecursosPorAtividade";
import { useCriarRecursoPlanejado } from "@/hooks/planejamentoMacro/useCriarRecursoPlanejado";
import { useExcluirRecursoPlanejado } from "@/hooks/planejamentoMacro/useExcluirRecursoPlanejado";
import { useAtualizarRecursoPlanejado } from "@/hooks/planejamentoMacro/useAtualizarRecursoPlanejado";
import {
  maoObraInsertSchema,
  maoObraUpdateSchema,
} from "@/validations/planejamentoMacro/recursoSchemas";

interface Props {
  planejamentoId: string;
  atividadeId: string;
  canEdit: boolean;
}

interface FuncaoOption {
  id: string;
  nome_funcao: string;
}

const parseNum = (v: string): number | null => {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

const PlanejarMaoObraForm: React.FC<Props> = ({
  planejamentoId,
  atividadeId,
  canEdit,
}) => {
  const recursos = useRecursosPorAtividade(atividadeId);
  const criar = useCriarRecursoPlanejado();
  const excluir = useExcluirRecursoPlanejado();
  const atualizar = useAtualizarRecursoPlanejado();

  const funcoesQuery = useQuery({
    queryKey: ["bd-funcoes-ativas-plan-macro"],
    queryFn: async (): Promise<FuncaoOption[]> => {
      const { data, error } = await supabase
        .from("bd_funcoes")
        .select("id, nome_funcao")
        .eq("situacao", "Ativo")
        .order("nome_funcao", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FuncaoOption[];
    },
    staleTime: 5 * 60_000,
  });

  const maoObra = useMemo(
    () =>
      (recursos.data ?? []).filter((r) => r.tipo_recurso === "mao_obra"),
    [recursos.data]
  );

  const funcoesJaPlanejadas = useMemo(
    () => new Set(maoObra.map((r) => r.funcao_id).filter(Boolean) as string[]),
    [maoObra]
  );

  const options = useMemo(
    () =>
      (funcoesQuery.data ?? []).map((f) => ({
        value: f.id,
        label: f.nome_funcao,
      })),
    [funcoesQuery.data]
  );

  // ----- Estado: adicionar -----
  const [funcaoId, setFuncaoId] = useState<string>("");
  const [quantidade, setQuantidade] = useState<string>("1");
  const [horas, setHoras] = useState<string>("");
  const [dias, setDias] = useState<string>("");
  const [observacao, setObservacao] = useState<string>("");

  const resetAdd = () => {
    setFuncaoId("");
    setQuantidade("1");
    setHoras("");
    setDias("");
    setObservacao("");
  };

  // ----- Estado: editar inline -----
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQtd, setEditQtd] = useState<string>("");
  const [editHoras, setEditHoras] = useState<string>("");
  const [editDias, setEditDias] = useState<string>("");
  const [editObs, setEditObs] = useState<string>("");

  const startEdit = (r: typeof maoObra[number]) => {
    setEditingId(r.id);
    setEditQtd(String(Number(r.quantidade_prevista)));
    setEditHoras(r.horas_previstas != null ? String(Number(r.horas_previstas)) : "");
    setEditDias(r.dias_previstos != null ? String(Number(r.dias_previstos)) : "");
    setEditObs(r.observacao ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    const qtd = parseNum(editQtd);
    const h = parseNum(editHoras);
    const d = parseNum(editDias);
    if (qtd === null || Number.isNaN(qtd)) {
      toast.error("Quantidade inválida.");
      return;
    }
    if (Number.isNaN(h) || Number.isNaN(d)) {
      toast.error("Horas ou dias inválidos.");
      return;
    }
    if (h === null && d === null) {
      toast.error("Informe ao menos horas ou dias previstos.");
      return;
    }
    const parsed = maoObraUpdateSchema.safeParse({
      quantidade_prevista: qtd,
      horas_previstas: h,
      dias_previstos: d,
      observacao: editObs.trim() || null,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }
    try {
      await atualizar.mutateAsync({
        id,
        patch: {
          quantidade_prevista: parsed.data.quantidade_prevista!,
          horas_previstas: parsed.data.horas_previstas ?? null,
          dias_previstos: parsed.data.dias_previstos ?? null,
          observacao: parsed.data.observacao ?? null,
        },
      });
      setEditingId(null);
    } catch {
      // toast tratado pelo hook
    }
  };

  const handleAdicionar = async () => {
    const funcao = (funcoesQuery.data ?? []).find((f) => f.id === funcaoId);
    if (!funcao) {
      toast.error("Selecione uma função.");
      return;
    }

    if (funcoesJaPlanejadas.has(funcao.id)) {
      toast.error("Esta função já está planejada para a atividade.");
      return;
    }

    const descricao = funcao.nome_funcao.toUpperCase().trim();
    const horasNum = horas.trim() === "" ? null : Number(horas.replace(",", "."));
    const diasNum = dias.trim() === "" ? null : Number(dias.replace(",", "."));
    const qtdNum = Number(quantidade.replace(",", "."));

    const parsed = maoObraInsertSchema.safeParse({
      planejamento_id: planejamentoId,
      atividade_id: atividadeId,
      funcao_id: funcao.id,
      descricao,
      quantidade_prevista: qtdNum,
      horas_previstas: horasNum,
      dias_previstos: diasNum,
      observacao: observacao.trim() || null,
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos.");
      return;
    }

    try {
      await criar.mutateAsync({
        planejamento_id: parsed.data.planejamento_id,
        atividade_id: parsed.data.atividade_id,
        tipo_recurso: "mao_obra",
        funcao_id: parsed.data.funcao_id,
        descricao: parsed.data.descricao,
        quantidade_prevista: parsed.data.quantidade_prevista,
        horas_previstas: parsed.data.horas_previstas ?? null,
        dias_previstos: parsed.data.dias_previstos ?? null,
        observacao: parsed.data.observacao ?? null,
      });
      resetAdd();
    } catch {
      // toast tratado pelo hook
    }
  };

  const handleExcluir = (id: string) => {
    excluir.mutate({ id, atividade_id: atividadeId, planejamento_id: planejamentoId });
  };

  const editBusy = atualizar.isPending;

  return (
    <div className="space-y-4">
      {/* Lista existente */}
      <div>
        <h4 className="text-sm font-semibold mb-2">
          Funções planejadas para esta atividade{" "}
          <span className="text-muted-foreground font-normal">
            ({maoObra.length})
          </span>
        </h4>

        {recursos.isLoading ? (
          <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando...
          </div>
        ) : maoObra.length === 0 ? (
          <div className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            Nenhuma função planejada ainda. Use o formulário abaixo para adicionar.
          </div>
        ) : (
          <div className="overflow-x-auto border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="w-24 text-right">Qtd</TableHead>
                  <TableHead className="w-24 text-right">Horas</TableHead>
                  <TableHead className="w-24 text-right">Dias</TableHead>
                  <TableHead>Observação</TableHead>
                  {canEdit && <TableHead className="w-24 text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {maoObra.map((r) => {
                  const isEditing = editingId === r.id;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.funcao?.nome_funcao ?? r.descricao}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            inputMode="numeric"
                            value={editQtd}
                            onChange={(e) => setEditQtd(e.target.value)}
                            className="h-8 text-right"
                          />
                        ) : (
                          Number(r.quantidade_prevista)
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            inputMode="decimal"
                            value={editHoras}
                            onChange={(e) => setEditHoras(e.target.value)}
                            className="h-8 text-right"
                            placeholder="—"
                          />
                        ) : r.horas_previstas != null ? (
                          Number(r.horas_previstas)
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <Input
                            type="number"
                            min="0"
                            step="0.5"
                            inputMode="decimal"
                            value={editDias}
                            onChange={(e) => setEditDias(e.target.value)}
                            className="h-8 text-right"
                            placeholder="—"
                          />
                        ) : r.dias_previstos != null ? (
                          Number(r.dias_previstos)
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {isEditing ? (
                          <Input
                            value={editObs}
                            onChange={(e) => setEditObs(e.target.value)}
                            maxLength={500}
                            className="h-8"
                            placeholder="Opcional"
                          />
                        ) : (
                          r.observacao ?? "—"
                        )}
                      </TableCell>
                      {canEdit && (
                        <TableCell className="text-right">
                          {isEditing ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Salvar"
                                disabled={editBusy}
                                onClick={() => saveEdit(r.id)}
                              >
                                {editBusy ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Check className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Cancelar"
                                disabled={editBusy}
                                onClick={cancelEdit}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Editar"
                                disabled={editingId !== null}
                                onClick={() => startEdit(r)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Remover função"
                                disabled={excluir.isPending || editingId !== null}
                                onClick={() => handleExcluir(r.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        {canEdit && maoObra.length > 0 && (
          <p className="text-[11px] text-muted-foreground mt-2">
            A função não pode ser trocada após criada. Para mudar de função, exclua o
            item e adicione outro abaixo.
          </p>
        )}
      </div>

      {/* Form de adição */}
      {canEdit && (
        <div className="border rounded-md p-4 space-y-3 bg-muted/30">
          <h4 className="text-sm font-semibold">Adicionar nova função</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Função *</Label>
              <Combobox
                options={options}
                value={funcaoId}
                onChange={setFuncaoId}
                placeholder={
                  funcoesQuery.isLoading
                    ? "Carregando funções..."
                    : "Selecione uma função"
                }
                searchPlaceholder="Buscar função..."
                emptyText="Nenhuma função ativa encontrada"
                disabled={funcoesQuery.isLoading}
              />
            </div>

            <div>
              <Label className="text-xs">Quantidade prevista *</Label>
              <Input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs">Observação</Label>
              <Textarea
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Opcional"
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Informe ao menos horas ou dias previstos.
          </p>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleAdicionar}
              disabled={criar.isPending || !funcaoId}
              className="gap-2"
            >
              {criar.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Adicionar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanejarMaoObraForm;
