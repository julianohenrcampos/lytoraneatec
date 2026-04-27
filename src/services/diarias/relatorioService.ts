import { supabase } from "@/integrations/supabase/client";
import type { 
  RelatorioFolhaItem,
  ResumoDiarias,
  RelatorioFilters,
  PresencaResumo,
  ExcelDetalhado,
  ExcelResumo
} from "@/types/diarias";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { isRelatorioItemConfirmado } from '@/services/diarias/relatorioMetrics';
import {
  auditRelatorioAccess,
  getCurrentDiariasReportContext,
  getRelatorioViewForContext,
  sanitizeFiltersForAudit,
} from '@/services/diarias/secureRelatorioAccess';
import type { RelatorioFolhaSecureOptions } from '@/types/diarias';

// =====================================================
// RELATÓRIO DETALHADO (VIEW)
// =====================================================

// Interface de escopo para filtros obrigatórios
interface RelatorioScopeFilters {
  criado_por?: string;  // Engenheiro: filtra por solicitante
  centro_custo_ids?: string[];  // Gerente: filtra por CCs gerenciados
}

export async function getRelatorioFolha(
  filters?: RelatorioFilters,
  scope?: RelatorioScopeFilters,
  options?: RelatorioFolhaSecureOptions,
): Promise<RelatorioFolhaItem[]> {
  const context = options?.context || await getCurrentDiariasReportContext();
  const viewName = getRelatorioViewForContext(context);
  let query: any;

  if (viewName === 'vw_diarias_financeiro_dp') {
    query = supabase
      .from('vw_diarias_financeiro_dp')
      .select('*');
  } else if (viewName === 'vw_diarias_aprovacao_gerencial') {
    query = supabase
      .from('vw_diarias_aprovacao_gerencial')
      .select('*');
  } else {
    query = supabase
      .from('vw_diarias_operacional_campo')
      .select('*');
  }

  query = query
    .not('hora_saida', 'is', null)
    .order('data', { ascending: false })
    .order('nome_funcionario', { ascending: true });

  // Aplicar filtros de ESCOPO OBRIGATÓRIOS
  if (scope?.criado_por) {
    query = query.eq('solicitante_id', scope.criado_por);
  }
  if (scope?.centro_custo_ids?.length) {
    query = query.in('centro_custo_id', scope.centro_custo_ids);
  }

  // Aplicar filtros opcionais
  if (filters?.data_inicio) {
    query = query.gte('data', filters.data_inicio);
  }
  if (filters?.data_fim) {
    query = query.lte('data', filters.data_fim);
  }
  if (filters?.centro_custo_id) {
    const { data: cc } = await supabase
      .from('bd_centros_custo')
      .select('nome_centro_custo')
      .eq('id', filters.centro_custo_id)
      .single();
    
    if (cc) {
      query = query.eq('nome_centro_custo', cc.nome_centro_custo);
    }
  }
  // Multi-select centro de custo (client-side preferred, but support server-side too)
  if (filters?.centro_custo_ids?.length) {
    const { data: ccs } = await supabase
      .from('bd_centros_custo')
      .select('nome_centro_custo')
      .in('id', filters.centro_custo_ids);
    if (ccs?.length) {
      query = query.in('nome_centro_custo', ccs.map(c => c.nome_centro_custo));
    }
  }
  if (filters?.funcionario_id) {
    query = query.eq('funcionario_id', filters.funcionario_id);
  }
  if (filters?.solicitacao_id) {
    query = query.eq('solicitacao_id', filters.solicitacao_id);
  }
  if (filters?.presenca_status) {
    // A view retorna presenca_status como booleano - converter string para boolean
    const statusBoolean = filters.presenca_status === 'presente';
    query = query.eq('presenca_status', statusBoolean as unknown as string);
  }

  // Busca paginada para ultrapassar limite de 1000 do PostgREST
  let allData: RelatorioFolhaItem[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await query.range(from, from + pageSize - 1);

    if (error) {
      console.error('Erro ao buscar relatório:', error);
      throw new Error(error.message);
    }

    if (data && data.length > 0) {
      allData = [...allData, ...(data as RelatorioFolhaItem[])];
      hasMore = data.length === pageSize;
      from += pageSize;
    } else {
      hasMore = false;
    }
  }

  // Suplementar dados faltantes via RPC SECURITY DEFINER
  // Detectar registros com qualquer metadado crítico ausente
  const canSupplementSensitive = context === 'financeiro_dp';
  const needsSupplement = canSupplementSensitive ? allData.filter(r => r.funcionario_id && (
    !r.nome_funcionario || !r.cpf_funcionario || !r.matricula_funcionario ||
    !r.nome_funcao || !r.banco_funcionario || !r.agencia_funcionario ||
    !r.conta_funcionario || !r.pix_funcionario
  )) : [];
  if (needsSupplement.length > 0) {
    let rpcAll: any[] = [];
    let page = 0;
      while (true) {
        const { data } = await supabase.rpc('get_funcionarios_para_diarias', { p_centro_custo_id: null })
        .range(page * 1000, (page + 1) * 1000 - 1);
      if (!data?.length) break;
      rpcAll = rpcAll.concat(data);
      if (data.length < 1000) break;
      page++;
    }
    const rpcMap = new Map(rpcAll.map((f: any) => [f.id, f]));

    allData = allData.map(item => {
      if (!item.funcionario_id) return item;
      const f = rpcMap.get(item.funcionario_id);
      if (!f) return item;
      
      // Preencher apenas campos que estejam vazios/nulos
      return {
        ...item,
        nome_funcionario: item.nome_funcionario || f.nome_completo,
        cpf_funcionario: item.cpf_funcionario || f.cpf,
        matricula_funcionario: item.matricula_funcionario || f.matricula,
        nome_funcao: item.nome_funcao || f.funcao_nome,
        banco_funcionario: item.banco_funcionario || f.banco,
        agencia_funcionario: item.agencia_funcionario || f.agencia,
        conta_funcionario: item.conta_funcionario || f.conta_corrente,
        pix_funcionario: item.pix_funcionario || f.chave_pix,
      };
    });
  }

  if (options?.audit !== false) {
    await auditRelatorioAccess({
      context,
      format: options?.auditFormat || 'screen',
      fileName: options?.fileName,
      filters: sanitizeFiltersForAudit({ ...filters, ...scope }),
      quantidadeRegistros: allData.length,
    });
  }

  return allData;
}

// =====================================================
// RESUMO AGREGADO (VIEW)
// =====================================================

export async function getResumoDiarias(filters?: RelatorioFilters): Promise<ResumoDiarias[]> {
  // Query diretamente de bd_diaria_presencas (view vw_resumo_diarias foi removida)
  let query = supabase
    .from('bd_diaria_presencas')
    .select(`
      solicitacao_id,
      data,
      presente,
      valor_diaria_aplicada,
      bd_diaria_solicitacoes!inner (
        centro_custo_id,
        bd_centros_custo (
          id,
          codigo_centro_custo,
          nome_centro_custo
        )
      )
    `)
    .order('data', { ascending: false });

  if (filters?.data_inicio) {
    query = query.gte('data', filters.data_inicio);
  }
  if (filters?.data_fim) {
    query = query.lte('data', filters.data_fim);
  }
  if (filters?.centro_custo_id) {
    query = query.eq('bd_diaria_solicitacoes.centro_custo_id', filters.centro_custo_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar resumo:', error);
    throw new Error(error.message);
  }

  // Agrupar por data + centro_custo_id
  const agrupado: Record<string, ResumoDiarias> = {};
  (data || []).forEach((p: any) => {
    const cc = p.bd_diaria_solicitacoes?.bd_centros_custo;
    const ccId = cc?.id || p.bd_diaria_solicitacoes?.centro_custo_id || '';
    const key = `${p.data}_${ccId}`;

    if (!agrupado[key]) {
      agrupado[key] = {
        data: p.data,
        centro_custo_id: ccId,
        codigo_centro_custo: cc?.codigo_centro_custo || '',
        nome_centro_custo: cc?.nome_centro_custo || '',
        total_presentes: 0,
        total_ausentes: 0,
        total_pendentes: 0,
        total_substituidos: 0,
        total_convocados: 0,
        total_valor_presentes: 0,
        total_valor_previsto: 0,
      };
    }

    const item = agrupado[key];
    item.total_convocados++;
    item.total_valor_previsto += p.valor_diaria_aplicada || 0;

    if (p.presente === true) {
      item.total_presentes++;
      item.total_valor_presentes += p.valor_diaria_aplicada || 0;
    } else if (p.presente === false) {
      item.total_ausentes++;
    } else {
      item.total_pendentes++;
    }
  });

  return Object.values(agrupado);
}

// =====================================================
// ESTATÍSTICAS DE PRESENÇA
// =====================================================

export async function getPresencaResumo(filters?: RelatorioFilters): Promise<PresencaResumo> {
  const relatorio = await getRelatorioFolha(filters);
  
  const presentes = relatorio.filter(isRelatorioItemConfirmado);
  const ausentes = relatorio.filter(r => !isRelatorioItemConfirmado(r) && String(r.presenca_status) === 'false');
  const pendentes = relatorio.filter(r => !isRelatorioItemConfirmado(r) && (r.presenca_status === null || r.presenca_status === undefined));
  const substituidos = relatorio.filter(r => !isRelatorioItemConfirmado(r) && String(r.presenca_status).toLowerCase() === 'substituido');

  return {
    total: relatorio.length,
    presentes: presentes.length,
    ausentes: ausentes.length,
    pendentes: pendentes.length,
    substituidos: substituidos.length,
    valor_total_presentes: presentes.reduce((acc, r) => acc + Math.ceil(r.valor_diaria_aplicada || 0), 0),
    valor_total_previsto: relatorio.reduce((acc, r) => acc + Math.ceil(r.valor_diaria_aplicada || 0), 0)
  };
}

// =====================================================
// EXPORTAÇÃO EXCEL
// =====================================================

export async function exportarRelatorioExcel(
  filters?: RelatorioFilters,
  scope?: RelatorioScopeFilters,
  options?: RelatorioFolhaSecureOptions,
): Promise<Blob> {
  const relatorio = await getRelatorioFolha(filters, scope, {
    ...options,
    audit: false,
  });

  const wb = XLSX.utils.book_new();

  // =====================================================
  // ABA ÚNICA: FOLHA DE PAGAMENTO (14 colunas A-N)
  // =====================================================
  const headers = [
    'Data', 'Matrícula', 'Funcionário', 'Função', 'Centro de Custo',
    'CPF', 'Banco', 'Agência', 'Conta', 'Chave Pix',
    'V. Diária', 'V. ½ Diária', 'V. Refeição', 'Total'
  ];

  // Build data rows
  const dataRows = relatorio.map((item, idx) => {
    const rowNum = idx + 2; // Excel row (1-indexed, header is row 1)
    const valorBase = Math.ceil(item.valor_diaria_aplicada || 0);
    const integralUmaEMeia = Math.round(valorBase * (2/3));
    const vDiaria = item.tipo_diaria === 'completa' ? valorBase :
                    item.tipo_diaria === 'uma_e_meia' ? integralUmaEMeia : 0;
    const vMeiaDiaria = item.tipo_diaria === 'meia' ? valorBase :
                        item.tipo_diaria === 'uma_e_meia' ? (valorBase - integralUmaEMeia) : 0;
    const vRefeicao = Math.ceil(item.valor_refeicao_aplicado || 0);

    return [
      format(new Date(item.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
      item.matricula_funcionario || '-',
      item.nome_funcionario,
      item.nome_funcao || '-',
      item.nome_centro_custo?.startsWith(item.codigo_centro_custo)
        ? item.nome_centro_custo
        : `${item.codigo_centro_custo} - ${item.nome_centro_custo}`,
      item.cpf_funcionario || '-',
      item.banco_funcionario || '-',
      item.agencia_funcionario || '-',
      item.conta_funcionario || '-',
      item.pix_funcionario || '-',
      vDiaria,
      vMeiaDiaria,
      vRefeicao,
      null // placeholder for formula
    ];
  });

  // Create worksheet with header + data
  const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);

  const dataCount = dataRows.length;
  const lastDataRow = dataCount + 1; // last data row number in Excel

  // Add Excel formulas for Total column (N) in each data row
  for (let i = 0; i < dataCount; i++) {
    const excelRow = i + 2;
    const cellRef = XLSX.utils.encode_cell({ r: excelRow - 1, c: 13 }); // col N = index 13
    ws[cellRef] = { t: 'n', f: `K${excelRow}+L${excelRow}+M${excelRow}` };
  }

  // Add TOTAL row
  const totalRowIdx = lastDataRow + 1;
  const totalRow = ['', '', '', '', '', '', '', '', '', 'TOTAL', null, null, null, null];
  XLSX.utils.sheet_add_aoa(ws, [totalRow], { origin: `A${totalRowIdx}` });

  // Add SUM formulas for K, L, M, N in total row
  const sumCols = [10, 11, 12, 13]; // K=10, L=11, M=12, N=13
  const colLetters = ['K', 'L', 'M', 'N'];
  sumCols.forEach((colIdx, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: totalRowIdx - 1, c: colIdx });
    ws[cellRef] = { t: 'n', f: `SUM(${colLetters[i]}2:${colLetters[i]}${lastDataRow})` };
  });

  // Update sheet range
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRowIdx - 1, c: 13 } });

  // Currency format for columns K, L, M, N (all data rows + total row)
  const currencyFormat = 'R$ #,##0.00';
  for (let row = 1; row <= totalRowIdx - 1; row++) {
    for (const colIdx of sumCols) {
      const cellRef = XLSX.utils.encode_cell({ r: row, c: colIdx });
      if (ws[cellRef]) {
        ws[cellRef].z = currencyFormat;
      }
    }
  }

  // Column widths
  ws['!cols'] = [
    { wch: 12 },  // Data
    { wch: 12 },  // Matrícula
    { wch: 30 },  // Funcionário
    { wch: 20 },  // Função
    { wch: 30 },  // Centro de Custo
    { wch: 15 },  // CPF
    { wch: 20 },  // Banco
    { wch: 12 },  // Agência
    { wch: 15 },  // Conta
    { wch: 25 },  // Chave Pix
    { wch: 14 },  // V. Diária
    { wch: 14 },  // V. ½ Diária
    { wch: 14 },  // V. Refeição
    { wch: 14 },  // Total
  ];

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };

  // Sheet protection with password "lytec"
  (ws as any)['!protect'] = {
    password: 'lytec',
    sheet: true,
    objects: true,
    scenarios: true,
    selectLockedCells: false,    // false = ALLOWED
    selectUnlockedCells: false,  // false = ALLOWED
    formatCells: true,
    formatColumns: true,
    formatRows: true,
    insertColumns: true,
    insertRows: true,
    insertHyperlinks: true,
    deleteColumns: true,
    deleteRows: true,
    sort: true,
    autoFilter: true,
    pivotTables: true
  };

  XLSX.utils.book_append_sheet(wb, ws, 'Folha de Pagamento');

  await auditRelatorioAccess({
    context: options?.context || await getCurrentDiariasReportContext(),
    format: 'excel',
    fileName: options?.fileName,
    filters: sanitizeFiltersForAudit({ ...filters, ...scope }),
    quantidadeRegistros: relatorio.length,
  });

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function downloadExcel(blob: Blob, filename?: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `relatorio_diarias_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// =====================================================
// HELPERS
// =====================================================

function traduzirStatusPresenca(status: string): string {
  const map: Record<string, string> = {
    'pendente': 'Pendente',
    'presente': 'Presente',
    'ausente': 'Ausente',
    'substituido': 'Substituído'
  };
  return map[status] || status;
}

function traduzirStatusConvocacao(status: string): string {
  const map: Record<string, string> = {
    'rascunho': 'Rascunho',
    'enviada_aprovacao': 'Aguardando Aprovação',
    'aprovada': 'Aprovada',
    'reprovada': 'Reprovada',
    'executando': 'Em Execução',
    'finalizada': 'Finalizada',
    'cancelada': 'Cancelada'
  };
  return map[status] || status;
}

// =====================================================
// AÇÕES DE RELATÓRIO (Sede)
// =====================================================

export async function marcarEnviadoSede(convocacaoId: string): Promise<void> {
  await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade: 'relatorio',
      entidade_id: convocacaoId,
      acao: 'enviado_sede'
    });
}

export async function registrarDivergencia(convocacaoId: string, comentario: string): Promise<void> {
  await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade: 'relatorio',
      entidade_id: convocacaoId,
      acao: 'divergencia',
      comentario
    });
}

export async function aprovarRelatorioFinal(convocacaoId: string, comentario?: string): Promise<void> {
  await supabase
    .from('bd_diaria_aprovacoes')
    .insert({
      entidade: 'relatorio',
      entidade_id: convocacaoId,
      acao: 'aprovado_final',
      comentario
    });
}

// =====================================================
// MATERIALIZED VIEW — RPCs OTIMIZADAS
// =====================================================

/**
 * Traduz erros das RPCs em mensagens amigáveis.
 */
function traduzirErroRpc(message: string): string {
  if (message.includes('NAO_AUTENTICADO')) return 'Sessão expirada. Faça login novamente.';
  if (message.includes('PERIODO_OBRIGATORIO')) return 'Informe a data de início e a data de fim.';
  if (message.includes('PERIODO_INVALIDO')) return 'A data de fim deve ser posterior à data de início.';
  if (message.includes('PERIODO_MAXIMO_EXCEDIDO')) return 'O período máximo para exportação completa é de 92 dias.';
  if (message.includes('VOLUME_EXCEDIDO')) return 'A consulta retornou mais de 50.000 linhas. Reduza o período ou aplique filtros.';
  return message;
}

export interface RelatorioPaginadoParams {
  data_inicio: string;
  data_fim: string;
  centro_custo_ids?: string[];
  funcionario_ids?: string[];
  offset?: number;
  limit?: number;
}

export interface RelatorioPaginadoResult {
  rows: any[];
  total_count: number;
}

/**
 * Busca paginada do relatório via materialized view (server-side).
 * Datas obrigatórias. Permissão validada no servidor.
 */
export async function getRelatorioFolhaPaginado(
  params: RelatorioPaginadoParams
): Promise<RelatorioPaginadoResult> {
  const { data, error } = await supabase.rpc('get_relatorio_diarias', {
    p_data_inicio: params.data_inicio,
    p_data_fim: params.data_fim,
    p_centro_custo_ids: params.centro_custo_ids || null,
    p_funcionario_ids: params.funcionario_ids || null,
    p_offset: params.offset ?? 0,
    p_limit: Math.min(params.limit ?? 50, 200),
  });

  if (error) {
    throw new Error(traduzirErroRpc(error.message));
  }

  const result = (data as any) || { rows: [], total_count: 0 };
  return {
    rows: result.rows || [],
    total_count: Number(result.total_count) || 0,
  };
}

/**
 * Exportação completa via MV (até 92 dias / 50.000 linhas).
 */
export async function getRelatorioFolhaCompleto(params: {
  data_inicio: string;
  data_fim: string;
  centro_custo_ids?: string[];
  funcionario_ids?: string[];
}): Promise<RelatorioPaginadoResult> {
  const { data, error } = await supabase.rpc('get_relatorio_diarias_full', {
    p_data_inicio: params.data_inicio,
    p_data_fim: params.data_fim,
    p_centro_custo_ids: params.centro_custo_ids || null,
    p_funcionario_ids: params.funcionario_ids || null,
  });

  if (error) {
    throw new Error(traduzirErroRpc(error.message));
  }

  const result = (data as any) || { rows: [], total_count: 0 };
  return {
    rows: result.rows || [],
    total_count: Number(result.total_count) || 0,
  };
}

/**
 * Força atualização da materialized view (apenas SuperAdm em prática).
 */
export async function refreshRelatorioDiarias(force = true): Promise<{ refreshed: boolean }> {
  const { data, error } = await supabase.rpc('refresh_relatorio_diarias', { p_force: force });
  if (error) {
    throw new Error(traduzirErroRpc(error.message));
  }
  return (data as any) || { refreshed: false };
}
