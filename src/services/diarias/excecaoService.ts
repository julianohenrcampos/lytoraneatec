// =====================================================
// SERVICE: Inclusão com EXCEÇÃO controlada
// - Persiste presença com flags is_excecao/justificativa
// - Solicita transferência para usuário comum
// - Auditoria em bd_diaria_aprovacoes
// =====================================================

import { supabase } from '@/integrations/supabase/client';
import type { TipoDiaria, TurnoDiaria } from './presencasService';

export interface ExcecaoConflito {
  outraSolicitacaoId: string;
  numeroSolicitacao?: string;
  centroCustoCodigo?: string;
  centroCustoNome?: string;
}

export interface SalvarPresencaExcecaoInput {
  solicitacaoId: string;
  funcionarioId: string;
  funcaoId: string | null;
  data: string;
  presente: boolean;
  hora_entrada?: string | null;
  valor_diaria_original: number;
  usar_diaria_exclusiva?: boolean;
  turno?: TurnoDiaria;
  recebe_refeicao?: boolean;
  valor_refeicao_aplicado?: number;
  conflito: ExcecaoConflito;
  justificativa: string;
}

/**
 * Insere presença marcada como EXCEÇÃO aprovada.
 * O CHECK constraint do banco (chk_diaria_presencas_excecao_justificativa)
 * garante: justificativa.trim().length >= 20, conflito_solicitacao_id e
 * excecao_aprovada_por preenchidos. A trigger de duplicidade libera passagem.
 *
 * Importante: o registro NÃO conta no financeiro automático
 * (ver vw_diaria_relatorio_financeiro: valor_financeiro_efetivo = 0).
 */
export async function salvarPresencaComExcecao(
  input: SalvarPresencaExcecaoInput
): Promise<{ id: string }> {
  const justificativa = (input.justificativa || '').trim();
  if (justificativa.length < 20) {
    throw new Error('Justificativa deve ter no mínimo 20 caracteres.');
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    throw new Error('Usuário não autenticado.');
  }

  const nowIso = new Date().toISOString();

  console.log('[DIARIA][INSERT_PRESENCA]', {
    funcionario_id: input.funcionarioId,
    data_enviada: input.data,
    solicitacao_id: input.solicitacaoId,
    is_excecao: true,
  });

  const { data, error } = await supabase
    .from('bd_diaria_presencas')
    .insert({
      solicitacao_id: input.solicitacaoId,
      funcionario_id: input.funcionarioId,
      funcao_id: input.funcaoId,
      data: input.data,
      presente: input.presente,
      hora_entrada: input.presente && input.hora_entrada ? input.hora_entrada : null,
      hora_saida: null,
      valor_diaria_aplicada: input.valor_diaria_original,
      tipo_diaria: null,
      recebe_refeicao: input.recebe_refeicao ?? true,
      valor_refeicao_aplicado: input.valor_refeicao_aplicado ?? 0,
      usar_diaria_exclusiva: input.usar_diaria_exclusiva ?? false,
      turno: input.turno || 'diurno',
      // Campos de exceção
      is_excecao: true,
      conflito_solicitacao_id: input.conflito.outraSolicitacaoId,
      justificativa_excecao: justificativa,
      excecao_aprovada_por: userId,
      excecao_aprovada_em: nowIso,
      confirmado_por: userId,
      confirmado_em: nowIso,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[excecaoService] erro ao inserir presença com exceção:', error);
    throw new Error(error.message);
  }

  // Auditoria: registra em bd_diaria_aprovacoes (não bloqueia se falhar)
  try {
    await supabase.from('bd_diaria_aprovacoes').insert({
      entidade: 'presenca',
      entidade_id: data.id,
      acao: 'inclusao_excecao',
      comentario:
        `[EXCEÇÃO APROVADA] Funcionário incluído mesmo já apontado em ` +
        `${input.conflito.numeroSolicitacao ?? 'outra solicitação'}` +
        (input.conflito.centroCustoCodigo
          ? ` (${input.conflito.centroCustoCodigo}${input.conflito.centroCustoNome ? ' - ' + input.conflito.centroCustoNome : ''})`
          : '') +
        ` em ${input.data}. Justificativa: ${justificativa}`,
    } as any);
  } catch (auditErr) {
    console.warn('[excecaoService] falha ao registrar auditoria (não crítico):', auditErr);
  }

  return { id: data.id };
}

export interface SolicitarTransferenciaInput {
  funcionarioId: string;
  solicitacaoOrigemId: string;
  solicitacaoDestinoId: string;
  data: string;
  justificativa: string;
}

/**
 * Cria pedido de transferência para usuário sem permissão de aprovar.
 * O pedido fica pendente e exige aprovação por SuperAdm/AdmObra/Gerente.
 */
export async function solicitarTransferenciaExcecao(
  input: SolicitarTransferenciaInput
): Promise<{ id: string }> {
  const justificativa = (input.justificativa || '').trim();
  if (justificativa.length < 20) {
    throw new Error('Justificativa deve ter no mínimo 20 caracteres.');
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) {
    throw new Error('Usuário não autenticado.');
  }

  const { data, error } = await supabase
    .from('bd_diaria_excecao_solicitacoes' as any)
    .insert({
      funcionario_id: input.funcionarioId,
      solicitacao_origem_id: input.solicitacaoOrigemId,
      solicitacao_destino_id: input.solicitacaoDestinoId,
      data: input.data,
      justificativa,
      solicitado_por: userId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[excecaoService] erro ao solicitar transferência:', error);
    throw new Error(error.message);
  }

  return { id: (data as any).id };
}
