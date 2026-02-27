import { Document, Page, View, Text, Image, Font } from '@react-pdf/renderer';
import { diariaStyles as styles } from './DiariaReportStyles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RelatorioFolhaItem, PresencaResumo, RelatorioFilters } from '@/types/diarias';

// Desabilitar hifenização automática para evitar quebra de palavras (ex: "CAMIN-HÃO")
Font.registerHyphenationCallback(word => [word]);

interface FuncionarioConsolidado {
  funcionario_id: string;
  nome_funcionario: string;
  nome_funcao: string;
  total_dias: number;
  dias_uteis: number;
  dias_fds: number;
  dias_feriados: number;
  valor_total: number;
  valor_refeicao: number;
  valor_diaria_integral: number;
  valor_meia_diaria: number;
}

interface RelatorioDiariasPDFProps {
  relatorio: RelatorioFolhaItem[];
  resumo: PresencaResumo;
  filtros: RelatorioFilters;
  feriados?: string[];
  logoUrl?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString + 'T12:00:00');
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateString;
  }
}

function consolidarFuncionarios(
  relatorio: RelatorioFolhaItem[],
  feriadosSet: Set<string>
): FuncionarioConsolidado[] {
  const funcionariosMap = new Map<string, FuncionarioConsolidado>();

  relatorio.forEach(item => {
    // Só considerar presenças confirmadas
    if (String(item.presenca_status) !== 'true' || !item.hora_entrada || !item.hora_saida) {
      return;
    }

    const existing = funcionariosMap.get(item.funcionario_id);
    
    // Classificar o dia
    const data = new Date(item.data + 'T12:00:00');
    const diaSemana = data.getDay();
    const isFds = diaSemana === 0 || diaSemana === 6;
    const isFeriado = feriadosSet.has(item.data);
    
    // Split valor por tipo_diaria
    const valor = item.valor_diaria_aplicada || 0;
    const tipo = item.tipo_diaria;
    let integralAdd = 0;
    let meiaAdd = 0;
    if (tipo === 'completa') { integralAdd = valor; }
    else if (tipo === 'meia') { meiaAdd = valor; }
    else if (tipo === 'uma_e_meia') { integralAdd = valor * (2/3); meiaAdd = valor * (1/3); }

    if (existing) {
      existing.total_dias += 1;
      existing.valor_total += valor;
      existing.valor_refeicao += item.valor_refeicao_aplicado || 0;
      existing.valor_diaria_integral += integralAdd;
      existing.valor_meia_diaria += meiaAdd;
      if (isFeriado) existing.dias_feriados += 1;
      else if (isFds) existing.dias_fds += 1;
      else existing.dias_uteis += 1;
    } else {
      funcionariosMap.set(item.funcionario_id, {
        funcionario_id: item.funcionario_id,
        nome_funcionario: item.nome_funcionario,
        nome_funcao: item.nome_funcao || '-',
        total_dias: 1,
        dias_uteis: isFds || isFeriado ? 0 : 1,
        dias_fds: isFds && !isFeriado ? 1 : 0,
        dias_feriados: isFeriado ? 1 : 0,
        valor_total: valor,
        valor_refeicao: item.valor_refeicao_aplicado || 0,
        valor_diaria_integral: integralAdd,
        valor_meia_diaria: meiaAdd,
      });
    }
  });

  return Array.from(funcionariosMap.values()).sort((a, b) => 
    a.nome_funcionario.localeCompare(b.nome_funcionario)
  );
}

function calcularTotaisDias(
  relatorio: RelatorioFolhaItem[],
  feriadosSet: Set<string>
): { diasUteis: number; diasFds: number; diasFeriados: number } {
  const datasUnicas = new Set<string>();
  let diasUteis = 0;
  let diasFds = 0;
  let diasFeriados = 0;

  relatorio.forEach(item => {
    if (String(item.presenca_status) !== 'true' || !item.hora_entrada || !item.hora_saida) {
      return;
    }
    
    // Contar cada data única apenas uma vez para totais
    if (!datasUnicas.has(item.data)) {
      datasUnicas.add(item.data);
      const data = new Date(item.data + 'T12:00:00');
      const diaSemana = data.getDay();
      const isFds = diaSemana === 0 || diaSemana === 6;
      const isFeriado = feriadosSet.has(item.data);
      
      if (isFeriado) diasFeriados += 1;
      else if (isFds) diasFds += 1;
      else diasUteis += 1;
    }
  });

  return { diasUteis, diasFds, diasFeriados };
}

export const RelatorioDiariasPDF = ({
  relatorio,
  resumo,
  filtros,
  feriados = [],
  logoUrl
}: RelatorioDiariasPDFProps) => {
  const feriadosSet = new Set(feriados);
  
  // Consolidar funcionários
  const funcionariosConsolidados = consolidarFuncionarios(relatorio, feriadosSet);
  
  // Calcular totais de dias únicos
  const totaisDias = calcularTotaisDias(relatorio, feriadosSet);
  
  // Calcular valor total
  const valorDiarias = funcionariosConsolidados.reduce((acc, f) => acc + f.valor_total, 0);
  const valorRefeicoes = funcionariosConsolidados.reduce((acc, f) => acc + f.valor_refeicao, 0);
  const valorTotal = valorDiarias + valorRefeicoes;
  const totalDiarias = funcionariosConsolidados.reduce((acc, f) => acc + f.total_dias, 0);

  // Extrair informações do primeiro registro para cabeçalho
  const primeiroRegistro = relatorio[0];
  const centrosCustoUnicos = [...new Set(relatorio.map(r => `${r.codigo_centro_custo} - ${r.nome_centro_custo}`))];
  const centrosCustoLabel = centrosCustoUnicos.length > 2 
    ? `${centrosCustoUnicos.slice(0, 2).join(', ')} e mais ${centrosCustoUnicos.length - 2}` 
    : centrosCustoUnicos.join(', ') || 'Todos';

  const empresasUnicas = [...new Set(relatorio.map(r => r.empresa_funcionario).filter(Boolean))];
  const empresasLabel = empresasUnicas.length > 2
    ? `${empresasUnicas.slice(0, 2).join(', ')} e mais ${empresasUnicas.length - 2}`
    : empresasUnicas.join(', ') || 'Não informada';

  // Solicitantes e apontadores únicos
  const solicitantesUnicos = [...new Set(relatorio.map(r => r.solicitante_nome).filter(Boolean))];
  const apontadoresUnicos = [...new Set(relatorio.map(r => r.apontador_nome).filter(Boolean))];
  const numerosUnicos = [...new Set(relatorio.map(r => r.numero_solicitacao).filter(Boolean))];

  // Usar datas da solicitação original (definidas quando a solicitação foi criada)
  const dataInicioSolicitacao = primeiroRegistro?.solicitacao_data_inicio;
  const dataFimSolicitacao = primeiroRegistro?.solicitacao_data_fim;

  // Período - usar datas da solicitação (período original definido)
  const periodoLabel = dataInicioSolicitacao && dataFimSolicitacao
    ? dataInicioSolicitacao === dataFimSolicitacao
      ? formatDate(dataInicioSolicitacao)
      : `${formatDate(dataInicioSolicitacao)} → ${formatDate(dataFimSolicitacao)}`
    : filtros.data_inicio && filtros.data_fim 
      ? `${formatDate(filtros.data_inicio)} → ${formatDate(filtros.data_fim)}`
      : 'Período não definido';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header com Logo */}
        <View style={styles.headerContainer}>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>RELATÓRIO DE DIÁRIAS EXECUTADAS</Text>
            <Text style={styles.headerSubtitle}>Centro de Custo: {centrosCustoLabel}</Text>
            <Text style={styles.headerSubtitle}>Empresa: {empresasLabel}</Text>
            <Text style={[styles.headerSubtitle, { fontSize: 7 }]}>Período: {periodoLabel}</Text>
          </View>
        </View>

        {/* Informações Gerais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMAÇÕES GERAIS</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Período</Text>
              <Text style={styles.infoValueBold}>{periodoLabel}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Centro(s) de Custo</Text>
              <Text style={styles.infoValue}>{centrosCustoLabel}</Text>
            </View>
            {numerosUnicos.length > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Nº Solicitação</Text>
                <Text style={styles.infoValueBold}>
                  {numerosUnicos.length === 1 ? numerosUnicos[0] : `${numerosUnicos.length} solicitações`}
                </Text>
              </View>
            )}
            {solicitantesUnicos.length > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Solicitante(s)</Text>
                <Text style={styles.infoValue}>
                  {solicitantesUnicos.length === 1 ? solicitantesUnicos[0] : `${solicitantesUnicos.length} solicitantes`}
                </Text>
              </View>
            )}
            {apontadoresUnicos.length > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Apontador(es)</Text>
                <Text style={styles.infoValue}>
                  {apontadoresUnicos.length === 1 ? apontadoresUnicos[0] : `${apontadoresUnicos.length} apontadores`}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats Panel - Dias */}
        <View style={styles.statsPanel}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totaisDias.diasUteis}</Text>
            <Text style={styles.statLabel}>Dias Úteis</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totaisDias.diasFds}</Text>
            <Text style={styles.statLabel}>Finais de Semana</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totaisDias.diasFeriados}</Text>
            <Text style={styles.statLabel}>Feriados</Text>
          </View>
          <View style={styles.statBoxHighlight}>
            <Text style={styles.statValue}>{totalDiarias}</Text>
            <Text style={styles.statLabel}>Total Diárias</Text>
          </View>
        </View>

        {/* Tabela Consolidada de Funcionários */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            FUNCIONÁRIOS CONSOLIDADOS ({funcionariosConsolidados.length})
          </Text>
          <View style={styles.table}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Funcionário</Text>
              <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Função</Text>
              <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'center' }]}>Dias</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>V. Diária</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>V. ½ Diária</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>V. Refeição</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
            </View>
            {/* Rows */}
            {funcionariosConsolidados.map((func, idx) => (
              <View 
                key={func.funcionario_id} 
                style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}
              >
                <Text style={[styles.tableCellBold, { flex: 3, fontSize: 7 }]}>
                  {func.nome_funcionario}
                </Text>
                <Text style={[styles.tableCell, { flex: 2, fontSize: 7 }]}>
                  {func.nome_funcao}
                </Text>
                <Text style={[styles.tableCellBold, { flex: 0.8, textAlign: 'center' }]}>
                  {func.total_dias}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>
                  {formatCurrency(func.valor_diaria_integral)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>
                  {formatCurrency(func.valor_meia_diaria)}
                </Text>
                <Text style={[styles.tableCell, { flex: 1.2, textAlign: 'right' }]}>
                  {formatCurrency(func.valor_refeicao)}
                </Text>
                <Text style={[styles.tableCellBold, { flex: 1.2, textAlign: 'right' }]}>
                  {formatCurrency(func.valor_diaria_integral + func.valor_meia_diaria + func.valor_refeicao)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Totals Section */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal Diárias</Text>
            <Text style={styles.totalValue}>{formatCurrency(funcionariosConsolidados.reduce((acc, f) => acc + f.valor_diaria_integral, 0))}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal ½ Diárias</Text>
            <Text style={styles.totalValue}>{formatCurrency(funcionariosConsolidados.reduce((acc, f) => acc + f.valor_meia_diaria, 0))}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal Refeições</Text>
            <Text style={styles.totalValue}>{formatCurrency(valorRefeicoes)}</Text>
          </View>
          <View style={styles.totalRowMain}>
            <Text style={styles.totalLabelMain}>TOTAL A PAGAR</Text>
            <Text style={styles.totalValueMain}>{formatCurrency(valorTotal)}</Text>
          </View>
        </View>

        {/* Seção de Assinatura */}
        <View style={styles.signatureSection}>
          <Text style={styles.sectionTitle}>APROVAÇÃO</Text>
          <View style={styles.signatureLine} />
          <Text style={styles.signatureLabel}>Diretor</Text>
          <Text style={styles.signatureDate}>Data: ____/____/________</Text>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Sistema MTE_TAC - Gestão de Diárias</Text>
          <Text style={styles.footerText}>
            Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Text>
          <Text 
            style={styles.footerPage}
            render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
};
