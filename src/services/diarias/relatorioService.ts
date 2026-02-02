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

export async function getRelatorioFolha(filters?: RelatorioFilters): Promise<RelatorioFolhaItem[]> {
  let query = supabase
    .from('vw_relatorio_diarias_folha')
    .select('*')
    .order('data', { ascending: false })
    .order('nome_funcionario', { ascending: true });

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
  if (filters?.status_convocacao) {
    query = query.eq('status_convocacao', filters.status_convocacao);
  }
  if (filters?.presenca_status) {
    query = query.eq('presenca_status', filters.presenca_status);
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
  // Buscar dados
  const relatorio = await getRelatorioFolha(filters);
  const resumo = await getResumoDiarias(filters);

  // Preparar dados detalhados
  const dadosDetalhados: ExcelDetalhado[] = relatorio.map(item => ({
    data: format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR }),
    centro_custo: `${item.codigo_centro_custo} - ${item.nome_centro_custo}`,
    funcionario: item.nome_funcionario,
    funcao: item.nome_funcao,
    valor_diaria: item.valor_diaria_aplicada,
    hora_entrada: item.hora_entrada || '-',
    hora_saida: item.hora_saida || '-',
    intervalo: item.intervalo_inicio && item.intervalo_fim 
      ? `${item.intervalo_inicio} - ${item.intervalo_fim}` 
      : '-',
    presenca: traduzirStatusPresenca(item.presenca_status),
    status_convocacao: traduzirStatusConvocacao(item.status_convocacao)
  }));

  // Preparar dados resumo
  const dadosResumo: ExcelResumo[] = resumo.map(item => ({
    data: format(new Date(item.data), 'dd/MM/yyyy', { locale: ptBR }),
    centro_custo: `${item.codigo_centro_custo} - ${item.nome_centro_custo}`,
    total_presentes: item.total_presentes,
    total_ausentes: item.total_ausentes,
    total_valor: item.total_valor_presentes
  }));

  // Criar workbook
  const wb = XLSX.utils.book_new();

  // Aba Detalhado
  const wsDetalhado = XLSX.utils.json_to_sheet(dadosDetalhados, {
    header: ['data', 'centro_custo', 'funcionario', 'funcao', 'valor_diaria', 'hora_entrada', 'hora_saida', 'intervalo', 'presenca', 'status_convocacao']
  });
  
  // Renomear headers
  wsDetalhado['A1'] = { v: 'Data', t: 's' };
  wsDetalhado['B1'] = { v: 'Centro de Custo', t: 's' };
  wsDetalhado['C1'] = { v: 'Funcionário', t: 's' };
  wsDetalhado['D1'] = { v: 'Função', t: 's' };
  wsDetalhado['E1'] = { v: 'Valor Diária', t: 's' };
  wsDetalhado['F1'] = { v: 'Entrada', t: 's' };
  wsDetalhado['G1'] = { v: 'Saída', t: 's' };
  wsDetalhado['H1'] = { v: 'Intervalo', t: 's' };
  wsDetalhado['I1'] = { v: 'Presença', t: 's' };
  wsDetalhado['J1'] = { v: 'Status', t: 's' };

  // Definir larguras das colunas
  wsDetalhado['!cols'] = [
    { wch: 12 },  // Data
    { wch: 35 },  // Centro de Custo
    { wch: 30 },  // Funcionário
    { wch: 20 },  // Função
    { wch: 12 },  // Valor
    { wch: 10 },  // Entrada
    { wch: 10 },  // Saída
    { wch: 15 },  // Intervalo
    { wch: 12 },  // Presença
    { wch: 15 },  // Status
  ];

  XLSX.utils.book_append_sheet(wb, wsDetalhado, 'Detalhado');

  // Aba Resumo
  const wsResumo = XLSX.utils.json_to_sheet(dadosResumo, {
    header: ['data', 'centro_custo', 'total_presentes', 'total_ausentes', 'total_valor']
  });

  wsResumo['A1'] = { v: 'Data', t: 's' };
  wsResumo['B1'] = { v: 'Centro de Custo', t: 's' };
  wsResumo['C1'] = { v: 'Total Presentes', t: 's' };
  wsResumo['D1'] = { v: 'Total Ausentes', t: 's' };
  wsResumo['E1'] = { v: 'Valor Total (R$)', t: 's' };

  wsResumo['!cols'] = [
    { wch: 12 },
    { wch: 35 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
  ];

  XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');

  // Gerar arquivo
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
