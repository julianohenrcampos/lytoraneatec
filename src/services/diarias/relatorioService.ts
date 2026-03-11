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
  scope?: RelatorioScopeFilters
): Promise<RelatorioFolhaItem[]> {
  let query = supabase
    .from('vw_relatorio_diarias_folha')
    .select('*')
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
    // Filtrar pelo nome do centro de custo já que a view não tem o ID diretamente
    const { data: cc } = await supabase
      .from('bd_centros_custo')
      .select('nome_centro_custo')
      .eq('id', filters.centro_custo_id)
      .single();
    
    if (cc) {
      query = query.eq('nome_centro_custo', cc.nome_centro_custo);
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

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar relatório:', error);
    throw new Error(error.message);
  }

  return (data || []) as RelatorioFolhaItem[];
}

// =====================================================
// RESUMO AGREGADO (VIEW)
// =====================================================

export async function getResumoDiarias(filters?: RelatorioFilters): Promise<ResumoDiarias[]> {
  let query = supabase
    .from('vw_resumo_diarias')
    .select('*')
    .order('data', { ascending: false });

  if (filters?.data_inicio) {
    query = query.gte('data', filters.data_inicio);
  }
  if (filters?.data_fim) {
    query = query.lte('data', filters.data_fim);
  }
  if (filters?.centro_custo_id) {
    query = query.eq('centro_custo_id', filters.centro_custo_id);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Erro ao buscar resumo:', error);
    throw new Error(error.message);
  }

  return (data || []) as ResumoDiarias[];
}

// =====================================================
// ESTATÍSTICAS DE PRESENÇA
// =====================================================

export async function getPresencaResumo(filters?: RelatorioFilters): Promise<PresencaResumo> {
  const relatorio = await getRelatorioFolha(filters);
  
  const presentes = relatorio.filter(r => r.presenca_status === 'presente');
  const ausentes = relatorio.filter(r => r.presenca_status === 'ausente');
  const pendentes = relatorio.filter(r => r.presenca_status === 'pendente');
  const substituidos = relatorio.filter(r => r.presenca_status === 'substituido');

  return {
    total: relatorio.length,
    presentes: presentes.length,
    ausentes: ausentes.length,
    pendentes: pendentes.length,
    substituidos: substituidos.length,
    valor_total_presentes: presentes.reduce((acc, r) => acc + r.valor_diaria_aplicada, 0),
    valor_total_previsto: relatorio.reduce((acc, r) => acc + r.valor_diaria_aplicada, 0)
  };
}

// =====================================================
// EXPORTAÇÃO EXCEL
// =====================================================

export async function exportarRelatorioExcel(filters?: RelatorioFilters): Promise<Blob> {
  const relatorio = await getRelatorioFolha(filters);

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
    const vDiaria = item.tipo_diaria === 'completa' ? (item.valor_diaria_aplicada || 0) :
                    item.tipo_diaria === 'uma_e_meia' ? Math.ceil((item.valor_diaria_aplicada || 0) * (2/3)) : 0;
    const vMeiaDiaria = item.tipo_diaria === 'meia' ? (item.valor_diaria_aplicada || 0) :
                        item.tipo_diaria === 'uma_e_meia' ? Math.ceil((item.valor_diaria_aplicada || 0) * (1/3)) : 0;
    const vRefeicao = item.valor_refeicao_aplicado || 0;

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
