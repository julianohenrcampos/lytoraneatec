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
  // Buscar dados
  const relatorio = await getRelatorioFolha(filters);

  // Criar workbook
  const wb = XLSX.utils.book_new();

  // =====================================================
  // ABA 1: DETALHADO (com dados bancários)
  // =====================================================
  const dadosDetalhados = relatorio.map(item => ({
    'Data': format(new Date(item.data + 'T12:00:00'), 'dd/MM/yyyy', { locale: ptBR }),
    'Centro de Custo': `${item.codigo_centro_custo} - ${item.nome_centro_custo}`,
    'Solicitante': item.solicitante_nome || '-',
    'Apontador': item.apontador_nome || '-',
    'Funcionário': item.nome_funcionario,
    'Função': item.nome_funcao || '-',
    'Tipo Diária': item.tipo_diaria === 'uma_e_meia' ? '1½ Diária' : item.tipo_diaria === 'completa' ? '1 Diária' : item.tipo_diaria === 'meia' ? '½ Diária' : '-',
    'V. Diária': item.tipo_diaria === 'completa' ? (item.valor_diaria_aplicada || 0) : item.tipo_diaria === 'uma_e_meia' ? (item.valor_diaria_aplicada || 0) * (2/3) : 0,
    'V. ½ Diária': item.tipo_diaria === 'meia' ? (item.valor_diaria_aplicada || 0) : item.tipo_diaria === 'uma_e_meia' ? (item.valor_diaria_aplicada || 0) * (1/3) : 0,
    'V. Refeição': item.valor_refeicao_aplicado || 0,
    'Total': (item.valor_diaria_aplicada || 0) + (item.valor_refeicao_aplicado || 0),
    'Entrada': item.hora_entrada || '-',
    'Saída': item.hora_saida || '-',
    // DADOS BANCÁRIOS NOVOS
    'CPF': item.cpf_funcionario || '-',
    'Banco': item.banco_funcionario || '-',
    'Agência': item.agencia_funcionario || '-',
    'Conta': item.conta_funcionario || '-',
    'Chave Pix': item.pix_funcionario || '-'
  }));

  const wsDetalhado = XLSX.utils.json_to_sheet(dadosDetalhados);

  wsDetalhado['!cols'] = [
    { wch: 12 },  // Data
    { wch: 35 },  // Centro de Custo
    { wch: 25 },  // Solicitante
    { wch: 25 },  // Apontador
    { wch: 30 },  // Funcionário
    { wch: 20 },  // Função
    { wch: 12 },  // Tipo Diária
    { wch: 14 },  // V. Diária
    { wch: 14 },  // V. ½ Diária
    { wch: 14 },  // V. Refeição
    { wch: 14 },  // Total
    { wch: 10 },  // Entrada
    { wch: 10 },  // Saída
    { wch: 15 },  // CPF
    { wch: 20 },  // Banco
    { wch: 12 },  // Agência
    { wch: 15 },  // Conta
    { wch: 30 },  // Chave Pix
  ];

  XLSX.utils.book_append_sheet(wb, wsDetalhado, 'Detalhado');

  // =====================================================
  // ABA 2: RESUMO POR FUNCIONÁRIO (TOTALIZAÇÃO)
  // =====================================================
  
  // Agrupar por funcionário
  const porFuncionario = new Map<string, {
    nome_funcionario: string;
    funcao: string;
    cpf: string;
    banco: string;
    agencia: string;
    conta: string;
    pix: string;
    qtd_dias: number;
    valor_total: number;
  }>();

  relatorio.forEach(item => {
    const key = item.funcionario_id;
    const existing = porFuncionario.get(key);

    if (existing) {
      existing.qtd_dias += 1;
      existing.valor_total += item.valor_diaria_aplicada || 0;
    } else {
      porFuncionario.set(key, {
        nome_funcionario: item.nome_funcionario,
        funcao: item.nome_funcao || '-',
        cpf: item.cpf_funcionario || '-',
        banco: item.banco_funcionario || '-',
        agencia: item.agencia_funcionario || '-',
        conta: item.conta_funcionario || '-',
        pix: item.pix_funcionario || '-',
        qtd_dias: 1,
        valor_total: item.valor_diaria_aplicada || 0
      });
    }
  });

  const resumoFuncionarios = Array.from(porFuncionario.values())
    .sort((a, b) => a.nome_funcionario.localeCompare(b.nome_funcionario))
    .map(f => ({
      'Funcionário': f.nome_funcionario,
      'Função': f.funcao,
      'CPF': f.cpf,
      'Banco': f.banco,
      'Agência': f.agencia,
      'Conta': f.conta,
      'Chave Pix': f.pix,
      'Qtd. Dias Trabalhados': f.qtd_dias,
      'Valor Total (R$)': f.valor_total
    }));

  const wsResumoFunc = XLSX.utils.json_to_sheet(resumoFuncionarios);

  wsResumoFunc['!cols'] = [
    { wch: 30 },  // Funcionário
    { wch: 20 },  // Função
    { wch: 15 },  // CPF
    { wch: 20 },  // Banco
    { wch: 12 },  // Agência
    { wch: 15 },  // Conta
    { wch: 30 },  // Pix
    { wch: 20 },  // Qtd Dias
    { wch: 18 },  // Valor Total
  ];

  XLSX.utils.book_append_sheet(wb, wsResumoFunc, 'Resumo por Funcionário');

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
