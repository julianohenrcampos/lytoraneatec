import { supabase } from "@/integrations/supabase/client";

// NOTA: cast (supabase as any) é ajuste TEMPORÁRIO até regenerar
// src/integrations/supabase/types.ts com a tabela
// bd_funcionario_classificacao_solicitacoes (Fase 1).

export interface CriarSolicitacaoClassificacaoPayload {
  funcionario_id: string;
  centro_custo_id: string;
  cargo_atual_id: string | null;
  cargo_atual_nome: string | null;
  cargo_novo_id: string;
  cargo_novo_nome: string;
  motivo: string;
  observacao?: string | null;
  data_efetivacao_desejada?: string | null; // YYYY-MM-DD
  precisa_exame: boolean;
  /**
   * Fase 2B: quando definido, vincula a solicitação individual a um lote
   * (cabeçalho em bd_solicitacoes_classificacao). O fluxo individual
   * existente continua passando undefined/null e a coluna fica NULL.
   */
  solicitacao_lote_id?: string | null;
}

/**
 * Monta o payload de INSERT em bd_funcionario_classificacao_solicitacoes
 * a partir do payload de domínio. Helper PURO, reutilizado pelo fluxo
 * individual e pelo batch de lote (Fase 2B).
 */
export function montarPayloadClassificacaoSolicitacao(
  payload: CriarSolicitacaoClassificacaoPayload,
) {
  return {
    funcionario_id: payload.funcionario_id,
    centro_custo_id: payload.centro_custo_id,
    cargo_atual_id: payload.cargo_atual_id,
    cargo_atual_nome: payload.cargo_atual_nome,
    cargo_novo_id: payload.cargo_novo_id,
    cargo_novo_nome: payload.cargo_novo_nome,
    motivo: payload.motivo,
    observacao: payload.observacao ?? null,
    data_efetivacao_desejada: payload.data_efetivacao_desejada ?? null,
    precisa_exame: !!payload.precisa_exame,
    solicitacao_lote_id: payload.solicitacao_lote_id ?? null,
  };
}

const RLS_MSG =
  "Você não possui permissão ou vínculo com o centro de custo deste funcionário.";

/**
 * Cria uma solicitação de Nova Classificação.
 * Insere APENAS em bd_funcionario_classificacao_solicitacoes.
 * Não toca em bd_historico_funcional nem em bd_funcionarios.
 * Não envia salário. status/solicitado_por/datas vêm dos defaults do banco.
 */
export async function criarSolicitacaoClassificacao(
  payload: CriarSolicitacaoClassificacaoPayload
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const { data, error } = await (supabase as any)
    .from("bd_funcionario_classificacao_solicitacoes")
    .insert(montarPayloadClassificacaoSolicitacao(payload))
    .select("id")
    .single();

  if (error) {
    console.error("[criarSolicitacaoClassificacao] erro Supabase", {
      error,
      funcionario_id: payload.funcionario_id,
      centro_custo_id: payload.centro_custo_id,
      payload_meta: {
        cargo_atual_id: payload.cargo_atual_id,
        cargo_novo_id: payload.cargo_novo_id,
        motivo: payload.motivo,
        precisa_exame: payload.precisa_exame,
      },
    });
    const code = (error as any)?.code;
    const msg = error.message || "";
    if (code === "42501" || /row-level security|violates row-level/i.test(msg)) {
      return { ok: false, message: RLS_MSG };
    }
    return { ok: false, message: msg || "Erro ao criar solicitação." };
  }

  return { ok: true, id: (data as any).id };
}
