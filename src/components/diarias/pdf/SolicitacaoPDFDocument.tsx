import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { diariaStyles as styles } from './DiariaReportStyles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DiariaSolicitacao, FuncionarioPreConvocado } from '@/types/diarias';

interface SolicitacaoPDFDocumentProps {
  solicitacao: DiariaSolicitacao;
  convocados: FuncionarioPreConvocado[];
  dadosComplementares: {
    aprovadorNome?: string | null;
    apontadorNome?: string | null;
    criadorNome?: string | null;
    funcionariosMap?: Record<string, string>;
    funcoesMap?: Record<string, string>;
  };
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

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    rascunho: 'Rascunho',
    enviada: 'Aguardando Aprovação',
    autorizada: 'Autorizada',
    reprovada: 'Reprovada',
  };
  return labels[status] || status;
}

export const SolicitacaoPDFDocument = ({
  solicitacao,
  convocados,
  dadosComplementares,
  logoUrl
}: SolicitacaoPDFDocumentProps) => {
  const diasUteis = solicitacao.qtde_dias_uteis_estimado || 0;
  const diasFds = solicitacao.qtde_fds_estimado || 0;
  const diasFeriados = solicitacao.qtde_feriados_estimado || 0;
  const diasEspeciais = diasFds + diasFeriados;
  const consideraFdsEFeriado = solicitacao.considera_fds_feriado;

  // Calcular totais
  let totalDiasUteis = 0;
  let totalDiasEspeciais = 0;

  convocados.forEach(conv => {
    totalDiasUteis += (conv.valor_diaria || 0) * diasUteis;
    if (consideraFdsEFeriado) {
      totalDiasEspeciais += (conv.valor_diaria_exclusiva || conv.valor_diaria || 0) * diasEspeciais;
    }
  });

  const totalGeral = solicitacao.valor_estimado_total || (totalDiasUteis + totalDiasEspeciais);
  const centroCusto = `${solicitacao.bd_centros_custo?.codigo_centro_custo || ''} - ${solicitacao.bd_centros_custo?.nome_centro_custo || ''}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header com Logo */}
        <View style={styles.headerContainer}>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>SOLICITAÇÃO DE DIÁRIA</Text>
            <Text style={styles.headerSubtitle}>
              {centroCusto} | Período: {formatDate(solicitacao.data_inicio)} → {formatDate(solicitacao.data_fim)}
            </Text>
          </View>
        </View>

        {/* Informações Gerais */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>INFORMAÇÕES GERAIS</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Centro de Custo</Text>
              <Text style={styles.infoValueBold}>{centroCusto}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Período</Text>
              <Text style={styles.infoValueBold}>
                {formatDate(solicitacao.data_inicio)} → {formatDate(solicitacao.data_fim)}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Solicitante</Text>
              <Text style={styles.infoValue}>
                {dadosComplementares?.criadorNome || solicitacao.profiles?.nome_completo || '-'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Aprovador do CC</Text>
              <Text style={styles.infoValue}>{dadosComplementares?.aprovadorNome || '-'}</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Responsável em Campo</Text>
              <Text style={styles.infoValue}>
                {dadosComplementares?.apontadorNome || solicitacao.responsavel_campo?.nome_completo || '-'}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Considera FDS/Feriados</Text>
              <Text style={styles.infoValue}>{consideraFdsEFeriado ? 'Sim' : 'Não'}</Text>
            </View>
          </View>
        </View>

        {/* Contagem de Dias */}
        <View style={styles.statsPanel}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{diasUteis}</Text>
            <Text style={styles.statLabel}>Dias Úteis</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{diasFds}</Text>
            <Text style={styles.statLabel}>Finais de Semana</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{diasFeriados}</Text>
            <Text style={styles.statLabel}>Feriados</Text>
          </View>
        </View>

        {/* Justificativa */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>JUSTIFICATIVA</Text>
          <View style={styles.observationBox}>
            <Text style={styles.observationText}>{solicitacao.justificativa}</Text>
          </View>
        </View>

        {/* Funcionários Convocados */}
        {convocados.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FUNCIONÁRIOS CONVOCADOS ({convocados.length})</Text>
            <View style={styles.table}>
              {/* Header */}
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, { flex: 3 }]}>Funcionário</Text>
                <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Função</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Diária Útil</Text>
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Diária FDS/Fer</Text>
              </View>
              {/* Rows */}
              {convocados.map((conv, idx) => (
                <View key={conv.funcionario_id || idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                  <Text style={[styles.tableCellBold, { flex: 3 }]}>
                    {conv.nome_funcionario || 
                     dadosComplementares?.funcionariosMap?.[conv.funcionario_id] || 
                     '-'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 2 }]}>
                    {conv.nome_funcao || 
                     dadosComplementares?.funcoesMap?.[conv.funcao_id] || 
                     '-'}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(conv.valor_diaria || 0)}
                  </Text>
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria || 0)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Valor Total Estimado */}
        <View style={styles.totalsSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              Dias úteis ({diasUteis} dias × {convocados.length} func.)
            </Text>
            <Text style={styles.totalValue}>{formatCurrency(totalDiasUteis)}</Text>
          </View>
          {consideraFdsEFeriado && diasEspeciais > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                FDS/Feriados ({diasEspeciais} dias × {convocados.length} func.)
              </Text>
              <Text style={styles.totalValue}>{formatCurrency(totalDiasEspeciais)}</Text>
            </View>
          )}
          <View style={styles.totalRowMain}>
            <Text style={styles.totalLabelMain}>TOTAL ESTIMADO</Text>
            <Text style={styles.totalValueMain}>{formatCurrency(totalGeral)}</Text>
          </View>
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Os valores acima são estimativas. O valor real será apurado após confirmação de presença em campo.
            </Text>
          </View>
        </View>

        {/* Status e Observação do Gerente */}
        {(solicitacao.status === 'autorizada' || solicitacao.status === 'reprovada') && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>
              {solicitacao.status === 'reprovada' ? 'MOTIVO DA REPROVAÇÃO' : 'OBSERVAÇÃO DO GERENTE'}
            </Text>
            <View style={solicitacao.status === 'reprovada' ? styles.observationBoxRed : styles.observationBox}>
              <Text style={solicitacao.status === 'reprovada' ? styles.observationTextRed : styles.observationText}>
                {solicitacao.observacao_gerente || 'Sem observações.'}
              </Text>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Sistema MTE_TAC - Gestão de Diárias</Text>
          <Text style={styles.footerText}>
            Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </Text>
        </View>
      </Page>
    </Document>
  );
};
