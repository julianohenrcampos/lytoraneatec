// =====================================================
// SERVICE: PRESENÇAS DE DIÁRIAS
// =====================================================

import { supabase } from '@/integrations/supabase/client';

export type TipoDiaria = 'completa' | 'meia' | 'nenhuma';

export interface PresencaDiaria {
  id: string;
  solicitacao_id: string;
  funcionario_id: string;
  data: string;
  presente: boolean;
  hora_entrada: string | null;
  hora_saida: string | null;
  intervalo_inicio: string | null;
  intervalo_fim: string | null;
  valor_diaria_aplicada: number;
  funcao_id: string | null;
  tipo_diaria: TipoDiaria | null;
  recebe_refeicao: boolean | null;
  valor_refeicao_aplicado: number | null;
  confirmado_por: string | null;
  confirmado_em: string | null;
  created_at: string;
  updated_at: string;
  // Relations
  bd_funcionarios?: {
    id: string;
    nome_completo: string;
    cpf: string;
    imagem: string | null;
  };
  bd_funcoes?: {
    id: string;
    nome_funcao: string;
  };
}

export interface PresencaFormData {
  funcionario_id: string;
  nome_funcionario: string;
  funcao_id: string;
  nome_funcao?: string;
  valor_diaria: number;
  valor_diaria_original: number;
  presente: boolean;
  hora_entrada?: string;
  hora_saida?: string;
  tipo_diaria?: TipoDiaria;
  recebe_refeicao?: boolean;
  valor_refeicao_aplicado?: number;
}

// Buscar presenças por solicitação e data
export async function getPresencasPorSolicitacao(
  solicitacaoId: string,
  data?: string
): Promise<PresencaDiaria[]> {
  let query = supabase
    .from('bd_diaria_presencas')
    .select(`
      *,
      bd_funcionarios (
        id,
        nome_completo,
        cpf,
        imagem
      ),
      bd_funcoes (
        id,
        nome_funcao
      )
    `)
    .eq('solicitacao_id', solicitacaoId)
    .order('created_at', { ascending: true });

  if (data) {
    query = query.eq('data', data);
  }

  const { data: presencas, error } = await query;

  if (error) {
    console.error('Erro ao buscar presenças:', error);
    throw new Error(error.message);
  }

  return (presencas || []) as PresencaDiaria[];
}

// Salvar ou atualizar presenças em batch (upsert) - DEPRECATED, usar salvarInicio/salvarFinalizacao
export async function salvarPresencas(
  solicitacaoId: string,
  data: string,
  presencas: PresencaFormData[]
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const presencasData = presencas.map((p) => ({
    solicitacao_id: solicitacaoId,
    funcionario_id: p.funcionario_id,
    data,
    presente: p.presente,
    hora_entrada: p.presente && p.hora_entrada ? p.hora_entrada : null,
    hora_saida: p.presente && p.hora_saida ? p.hora_saida : null,
    valor_diaria_aplicada: p.valor_diaria,
    funcao_id: p.funcao_id || null,
    tipo_diaria: p.tipo_diaria || 'completa',
    recebe_refeicao: p.recebe_refeicao ?? true,
    valor_refeicao_aplicado: p.valor_refeicao_aplicado ?? 0,
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }));

  const { error } = await supabase
    .from('bd_diaria_presencas')
    .upsert(presencasData, {
      onConflict: 'solicitacao_id,funcionario_id,data',
      ignoreDuplicates: false
    });

  if (error) {
    console.error('Erro ao salvar presenças:', error);
    throw new Error(error.message);
  }
}

// =====================================================
// NOVO FLUXO: Salvar em dois tempos (imutável)
// =====================================================

export interface InicioFormData {
  funcionario_id: string;
  funcao_id: string;
  presente: boolean;
  hora_entrada?: string;
  valor_diaria_original: number;
}

export interface FinalizacaoFormData {
  funcionario_id: string;
  hora_saida: string;
  tipo_diaria: TipoDiaria;
  valor_diaria_aplicada: number;
  recebe_refeicao: boolean;
  valor_refeicao_aplicado: number;
}

// Salvar INÍCIO — INSERT only, rejeita se já existir
export async function salvarInicio(
  solicitacaoId: string,
  data: string,
  registros: InicioFormData[]
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  const rows = registros.map((r) => ({
    solicitacao_id: solicitacaoId,
    funcionario_id: r.funcionario_id,
    data,
    presente: r.presente,
    hora_entrada: r.presente && r.hora_entrada ? r.hora_entrada : null,
    hora_saida: null,
    valor_diaria_aplicada: r.valor_diaria_original,
    funcao_id: r.funcao_id || null,
    tipo_diaria: null,
    recebe_refeicao: null,
    valor_refeicao_aplicado: null,
    confirmado_por: userId,
    confirmado_em: new Date().toISOString(),
  }));

  const { error } = await supabase
    .from('bd_diaria_presencas')
    .insert(rows);

  if (error) {
    console.error('Erro ao salvar início:', error);
    throw new Error(error.message);
  }
}

// Salvar FINALIZAÇÃO — UPDATE only, não toca hora_entrada
export async function salvarFinalizacao(
  solicitacaoId: string,
  data: string,
  registros: FinalizacaoFormData[]
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;

  // Atualizar cada registro individualmente (update por funcionario_id + solicitacao_id + data)
  const promises = registros.map(async (r) => {
    const { error } = await supabase
      .from('bd_diaria_presencas')
      .update({
        hora_saida: r.hora_saida,
        tipo_diaria: r.tipo_diaria,
        valor_diaria_aplicada: r.valor_diaria_aplicada,
        recebe_refeicao: r.recebe_refeicao,
        valor_refeicao_aplicado: r.valor_refeicao_aplicado,
        confirmado_por: userId,
        confirmado_em: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('solicitacao_id', solicitacaoId)
      .eq('funcionario_id', r.funcionario_id)
      .eq('data', data);

    if (error) {
      console.error(`Erro ao finalizar presença de ${r.funcionario_id}:`, error);
      throw new Error(error.message);
    }
  });

  await Promise.all(promises);
}

// Buscar resumo de presenças de uma solicitação
export async function getResumoPresencas(solicitacaoId: string): Promise<{
  total_dias: number;
  total_presentes: number;
  total_ausentes: number;
  valor_total: number;
}> {
  const { data: presencas, error } = await supabase
    .from('bd_diaria_presencas')
    .select('*')
    .eq('solicitacao_id', solicitacaoId);

  if (error) {
    console.error('Erro ao buscar resumo de presenças:', error);
    throw new Error(error.message);
  }

  const diasUnicos = new Set((presencas || []).map((p) => p.data));
  const presentes = (presencas || []).filter((p) => p.presente);
  const ausentes = (presencas || []).filter((p) => !p.presente);
  const valorTotal = presentes.reduce((acc, p) => acc + (p.valor_diaria_aplicada || 0), 0);

  return {
    total_dias: diasUnicos.size,
    total_presentes: presentes.length,
    total_ausentes: ausentes.length,
    valor_total: valorTotal
  };
}

// Verificar se já existe apontamento para uma data específica
export async function verificarPresencasExistentes(
  solicitacaoId: string,
  data: string
): Promise<boolean> {
  const { count, error } = await supabase
    .from('bd_diaria_presencas')
    .select('*', { count: 'exact', head: true })
    .eq('solicitacao_id', solicitacaoId)
    .eq('data', data);

  if (error) {
    console.error('Erro ao verificar presenças existentes:', error);
    return false;
  }

  return (count || 0) > 0;
}

// Buscar datas únicas que já foram apontadas para uma solicitação
export async function getDatasApontadas(
  solicitacaoId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('bd_diaria_presencas')
    .select('data')
    .eq('solicitacao_id', solicitacaoId)
    .order('data');

  if (error) {
    console.error('Erro ao buscar datas apontadas:', error);
    return [];
  }

  // Retornar datas únicas
  return [...new Set((data || []).map((p) => p.data))];
}
