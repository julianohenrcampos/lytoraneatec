import { supabase } from '@/integrations/supabase/client';
import type { FluxoAprovacaoData, DocumentoFluxo, DocumentoRelacao } from '@/types/diarias';

// =====================================================
// APROVAÇÃO GERENTE ADM (Etapa 7)
// =====================================================

export async function aprovarComoGerenteAdm(data: FluxoAprovacaoData) {
  const { error } = await supabase.rpc('aprovar_gerente_adm', {
    p_solicitacao_id: data.solicitacao_id,
    p_assinatura_png: data.assinatura_png,
    p_nome_usuario: data.nome_usuario,
    p_cargo: data.cargo,
    p_cpf: data.cpf || null,
  });
  if (error) throw error;
}

export async function reprovarComoGerenteAdm(solicitacaoId: string, observacao?: string) {
  const { error } = await supabase.rpc('reprovar_gerente_adm', {
    p_solicitacao_id: solicitacaoId,
    p_observacao: observacao || null,
  });
  if (error) throw error;
}

// =====================================================
// APROVAÇÃO DIRETOR OPERACIONAL (Etapa 8)
// =====================================================

export async function aprovarComoDiretorOperacional(data: FluxoAprovacaoData) {
  const { error } = await supabase.rpc('aprovar_diretor_operacional', {
    p_solicitacao_id: data.solicitacao_id,
    p_assinatura_png: data.assinatura_png,
    p_nome_usuario: data.nome_usuario,
    p_cargo: data.cargo,
    p_cpf: data.cpf || null,
  });
  if (error) throw error;
}

export async function reprovarComoDiretorOperacional(solicitacaoId: string, observacao?: string) {
  const { error } = await supabase.rpc('reprovar_diretor_operacional', {
    p_solicitacao_id: solicitacaoId,
    p_observacao: observacao || null,
  });
  if (error) throw error;
}

// =====================================================
// APROVAÇÃO DIRETOR ADM (Etapa 9)
// =====================================================

export async function aprovarComoDiretorAdm(data: FluxoAprovacaoData) {
  const { error } = await supabase.rpc('aprovar_diretor_adm', {
    p_solicitacao_id: data.solicitacao_id,
    p_assinatura_png: data.assinatura_png,
    p_nome_usuario: data.nome_usuario,
    p_cargo: data.cargo,
    p_cpf: data.cpf || null,
  });
  if (error) throw error;
}

export async function reprovarComoDiretorAdm(solicitacaoId: string, observacao?: string) {
  const { error } = await supabase.rpc('reprovar_diretor_adm', {
    p_solicitacao_id: solicitacaoId,
    p_observacao: observacao || null,
  });
  if (error) throw error;
}

// =====================================================
// CONSULTA DE DOCUMENTOS
// =====================================================

export async function getDocumentosFluxo(solicitacaoId: string): Promise<DocumentoFluxo[]> {
  const { data, error } = await supabase
    .from('bd_documentos_fluxo')
    .select('*')
    .eq('solicitacao_id', solicitacaoId)
    .order('criado_em', { ascending: true });

  if (error) throw error;
  return (data || []) as DocumentoFluxo[];
}

export async function getDocumentosRelacionados(documentoId: string): Promise<DocumentoRelacao[]> {
  const { data, error } = await supabase
    .from('bd_documentos_relacao')
    .select('*')
    .eq('documento_pai_id', documentoId);

  if (error) throw error;
  return (data || []) as DocumentoRelacao[];
}
