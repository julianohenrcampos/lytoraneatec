import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { RelatorioFilters } from '@/types/diarias';

export type DiariasReportContext = 'operacional_campo' | 'aprovacao_gerencial' | 'financeiro_dp';

const VIEW_BY_CONTEXT: Record<DiariasReportContext, string> = {
  operacional_campo: 'vw_diarias_operacional_campo',
  aprovacao_gerencial: 'vw_diarias_aprovacao_gerencial',
  financeiro_dp: 'vw_diarias_financeiro_dp',
};

const AUDIT_ACTION_BY_FORMAT: Record<string, string> = {
  screen: 'consulta',
  pdf: 'exportacao_pdf',
  excel: 'exportacao_excel',
  zip: 'exportacao_zip',
};

export function getRelatorioViewForContext(context: DiariasReportContext): string {
  return VIEW_BY_CONTEXT[context];
}

export async function getCurrentDiariasReportContext(): Promise<DiariasReportContext> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 'operacional_campo';

  const [financeiro, gerencial] = await Promise.all([
    supabase.rpc('fn_can_access_diarias_financeiro', { _user_id: user.id }),
    supabase.rpc('fn_can_access_diarias_gerencial', { _user_id: user.id }),
  ]);

  if (financeiro.data === true) return 'financeiro_dp';
  if (gerencial.data === true) return 'aprovacao_gerencial';
  return 'operacional_campo';
}

export async function auditRelatorioAccess(params: {
  context: DiariasReportContext;
  format: 'screen' | 'pdf' | 'excel' | 'zip';
  fileName?: string;
  filters?: RelatorioFilters & { centro_custo_ids?: string[]; criado_por?: string };
  quantidadeRegistros?: number;
  solicitacaoId?: string;
  centroCustoId?: string;
}): Promise<void> {
  const { filters } = params;
  const auditFilters = sanitizeFiltersForAudit(filters) as Json;
  const payload = {
    p_contexto: params.context,
    p_acao: AUDIT_ACTION_BY_FORMAT[params.format] || 'consulta',
    p_formato: params.format,
    p_arquivo_nome: params.fileName ?? null,
    p_solicitacao_id: params.solicitacaoId ?? filters?.solicitacao_id ?? null,
    p_centro_custo_id: params.centroCustoId ?? filters?.centro_custo_id ?? null,
    p_periodo_inicio: filters?.data_inicio ?? null,
    p_periodo_fim: filters?.data_fim ?? null,
    p_filtros: auditFilters,
    p_quantidade_registros: params.quantidadeRegistros ?? null,
  };

  const { error } = await supabase.rpc('fn_auditar_relatorio_diarias', payload);
  if (error) {
    console.warn('[DIÁRIAS][AUDITORIA] Falha ao auditar acesso ao relatório:', error.message);
  }
}

export function canContextExportSensitive(context: DiariasReportContext): boolean {
  return context === 'financeiro_dp';
}

export function canContextSeeFinancialValues(context: DiariasReportContext): boolean {
  return context === 'financeiro_dp' || context === 'aprovacao_gerencial';
}

export function sanitizeFiltersForAudit(filters?: RelatorioFilters & { centro_custo_ids?: string[]; criado_por?: string }) {
  if (!filters) return {};

  return {
    data_inicio: filters.data_inicio,
    data_fim: filters.data_fim,
    centro_custo_id: filters.centro_custo_id,
    centro_custo_ids: filters.centro_custo_ids,
    funcionario_id: filters.funcionario_id,
    solicitacao_id: filters.solicitacao_id,
    solicitacao_ids: filters.solicitacao_ids,
    empresa_id: filters.empresa_id,
    tipo_vinculo: filters.tipo_vinculo,
    criado_por: filters.criado_por,
  };
}