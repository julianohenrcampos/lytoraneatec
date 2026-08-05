// Fase Equipe Designada — service para bd_planejamento_atividade_equipe.
import { supabase } from "@/integrations/supabase/client";

export type TipoAlocacao = "proprio_cc" | "emprestado_outra_obra";
export type PapelTarefa =
  | "execucao"
  | "apoio"
  | "encarregado"
  | "mestre"
  | "responsavel_tecnico"
  | "apontador";
export type StatusEquipe = "rascunho" | "confirmado" | "substituido" | "cancelado";

export interface EquipeDesignadaRow {
  id: string;
  planejamento_id: string;
  atividade_id: string;
  centro_custo_id: string;
  funcionario_id: string;
  funcao_id: string | null;
  centro_custo_origem_id: string;
  tipo_alocacao: TipoAlocacao;
  papel_na_tarefa: PapelTarefa;
  semana_inicio: string;
  semana_fim: string;
  dias_previstos: number | null;
  horas_previstas: number | null;
  status: StatusEquipe;
  observacao: string | null;
  // enriquecido
  nome_funcionario?: string | null;
  matricula?: string | null;
  nome_funcao?: string | null;
  codigo_cc_origem?: string | null;
  nome_cc_origem?: string | null;
}

export interface FuncionarioDisponivel {
  funcionario_id: string;
  nome_completo: string;
  matricula: string | null;
  cpf_mascarado: string | null;
  status: string;
  funcao_id: string | null;
  nome_funcao: string | null;
  centro_custo_id: string;
  codigo_centro_custo: string | null;
  nome_centro_custo: string | null;
  tem_conflito_equipe: boolean;
  tem_conflito_diaria_outro_cc: boolean;
  tem_conflito_diaria_previsto: boolean;
  motivo_conflito: string | null;
}

export async function listarEquipeDesignadaPorAtividade(
  atividadeId: string
): Promise<EquipeDesignadaRow[]> {
  const { data, error } = await supabase
    .from("bd_planejamento_atividade_equipe")
    .select("*")
    .eq("atividade_id", atividadeId)
    .neq("status", "cancelado")
    .order("created_at", { ascending: true });

  if (error) throw error;
  const rows = (data ?? []) as EquipeDesignadaRow[];
  if (rows.length === 0) return rows;

  const funcIds = Array.from(new Set(rows.map((r) => r.funcionario_id)));
  const funcaoIds = Array.from(
    new Set(rows.map((r) => r.funcao_id).filter(Boolean) as string[])
  );
  const ccIds = Array.from(new Set(rows.map((r) => r.centro_custo_origem_id)));

  const [funcs, funcoes, ccs] = await Promise.all([
    supabase
      .from("bd_funcionarios")
      .select("id, nome_completo, matricula")
      .in("id", funcIds),
    funcaoIds.length
      ? supabase.from("bd_funcoes").select("id, nome_funcao").in("id", funcaoIds)
      : Promise.resolve({ data: [], error: null } as any),
    supabase
      .from("bd_centros_custo")
      .select("id, codigo_centro_custo, nome_centro_custo")
      .in("id", ccIds),
  ]);

  const fmap = new Map<string, any>(((funcs.data as any[]) ?? []).map((f) => [f.id, f]));
  const fnMap = new Map<string, any>(((funcoes.data as any[]) ?? []).map((f) => [f.id, f]));
  const ccMap = new Map<string, any>(((ccs.data as any[]) ?? []).map((c) => [c.id, c]));

  return rows.map((r) => ({
    ...r,
    nome_funcionario: fmap.get(r.funcionario_id)?.nome_completo ?? null,
    matricula: fmap.get(r.funcionario_id)?.matricula ?? null,
    nome_funcao: r.funcao_id ? fnMap.get(r.funcao_id)?.nome_funcao ?? null : null,
    codigo_cc_origem: ccMap.get(r.centro_custo_origem_id)?.codigo_centro_custo ?? null,
    nome_cc_origem: ccMap.get(r.centro_custo_origem_id)?.nome_centro_custo ?? null,
  }));
}

export async function listarFuncionariosDisponiveis(args: {
  atividadeId: string;
  incluirOutrosCc?: boolean;
  busca?: string;
  semanaInicio?: string;
  semanaFim?: string;
}): Promise<FuncionarioDisponivel[]> {
  const { data, error } = await supabase.rpc(
    "fn_listar_funcionarios_disponiveis_designacao",
    {
      p_atividade_id: args.atividadeId,
      p_incluir_outros_cc: args.incluirOutrosCc ?? false,
      p_busca: args.busca ?? null,
      p_semana_inicio: args.semanaInicio ?? null,
      p_semana_fim: args.semanaFim ?? null,
    } as any
  );
  if (error) throw error;
  return (data ?? []) as FuncionarioDisponivel[];
}

export interface DesignarInput {
  atividade_id: string;
  funcionario_id: string;
  funcao_id: string | null;
  papel: PapelTarefa;
  semana_inicio: string;
  semana_fim: string;
  dias_previstos?: number | null;
  horas_previstas?: number | null;
  observacao?: string | null;
}

export async function designarFuncionario(input: DesignarInput): Promise<string> {
  const { data, error } = await supabase.rpc("fn_designar_equipe_atividade", {
    p_atividade_id: input.atividade_id,
    p_funcionario_id: input.funcionario_id,
    p_funcao_id: input.funcao_id,
    p_papel: input.papel,
    p_semana_inicio: input.semana_inicio,
    p_semana_fim: input.semana_fim,
    p_dias: input.dias_previstos ?? null,
    p_horas: input.horas_previstas ?? null,
    p_observacao: input.observacao ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function removerDesignacao(id: string, status: StatusEquipe): Promise<void> {
  if (status === "rascunho") {
    const { error } = await supabase
      .from("bd_planejamento_atividade_equipe")
      .delete()
      .eq("id", id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("bd_planejamento_atividade_equipe")
      .update({ status: "cancelado" })
      .eq("id", id);
    if (error) throw error;
  }
}

export async function atualizarDesignacao(
  id: string,
  patch: Partial<
    Pick<
      EquipeDesignadaRow,
      | "papel_na_tarefa"
      | "dias_previstos"
      | "horas_previstas"
      | "observacao"
      | "status"
      | "funcao_id"
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from("bd_planejamento_atividade_equipe")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}
