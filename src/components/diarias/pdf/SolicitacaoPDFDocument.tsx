import '@/lib/pdfFonts';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { diariaStyles as styles } from './DiariaReportStyles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { DiariaSolicitacao, FuncionarioPreConvocado, AssinaturaAprovacao } from '@/types/diarias';
import { AssinaturaPDFBlock } from '@/components/assinatura/AssinaturaPDFBlock';

interface AnalisePerido {
  diasUteis: number;
  sabados: number;
  domingos: number;
  feriados: number;
}

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
  analise?: AnalisePerido;
  estimativa?: import('@/utils/diariasEstimativaPorConvocadosPre').ResumoEstimativa;
  assinaturas?: AssinaturaAprovacao[];
  aditivos?: import('@/services/diarias/aditivoService').Aditivo[];
  nomesUsuariosAditivos?: Record<string, string>;
}

const TIPO_ADITIVO_LABEL: Record<string, string> = {
  adicionar_dia: 'Adição de dia',
  remover_dia: 'Remoção de dia',
  funcionario_inclusao: 'Inclusão de funcionário',
  funcionario_remocao: 'Remoção de funcionário',
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return '—';
  }
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
  logoUrl,
  analise,
  estimativa,
  assinaturas,
  aditivos,
  nomesUsuariosAditivos,
}: SolicitacaoPDFDocumentProps) => {
  const consideraFdsEFeriado = solicitacao.considera_fds_feriado;

  // Usar análise real do período (sábados = diária normal, domingos/feriados = exclusiva)
  const diasUteisReal = analise?.diasUteis || solicitacao.qtde_dias_uteis_estimado || 0;
  const sabadosReal = analise?.sabados || 0;
  const domingosReal = analise?.domingos || 0;
  const feriadosReal = analise?.feriados || solicitacao.qtde_feriados_estimado || 0;

  const diasNormais = diasUteisReal; // apenas dias úteis pagam diária normal
  const diasExclusivos = sabadosReal + domingosReal + feriadosReal; // sábados, domingos e feriados pagam diária exclusiva

  // Fase G — Se a estimativa foi pré-calculada (modal Detalhes), usar como fonte única.
  let totalDiariasNormais: number;
  let totalDiariasExclusivas: number;
  let totalRefeicoes: number;
  let totalGeral: number;
  let ocorrenciasUteis: number;
  let ocorrenciasExclusivos: number;
  let ocorrenciasRefeicao: number;
  let mostrarDiariasExclusivas: boolean;

  if (estimativa) {
    totalDiariasNormais = estimativa.total_diarias_uteis;
    totalDiariasExclusivas = estimativa.total_diarias_fds_feriados;
    totalRefeicoes = estimativa.total_refeicoes;
    totalGeral = estimativa.total_geral;
    ocorrenciasUteis = estimativa.ocorrencias_uteis;
    ocorrenciasExclusivos = estimativa.ocorrencias_exclusivos;
    ocorrenciasRefeicao = estimativa.quantidade_pares_refeicao;
    mostrarDiariasExclusivas = ocorrenciasExclusivos > 0;
  } else {
    // Backwards-compat (chamadores externos sem estimativa).
    mostrarDiariasExclusivas = consideraFdsEFeriado && diasExclusivos > 0;
    totalDiariasNormais = 0;
    totalDiariasExclusivas = 0;
    totalRefeicoes = 0;
    convocados.forEach(conv => {
      const valorDiaria = conv.valor_diaria || 0;
      const valorExclusiva = conv.valor_diaria_exclusiva || valorDiaria * 1.2;
      const valorRefeicao = conv.valor_refeicao || 0;
      const forcarExclusiva = conv.usar_diaria_exclusiva === true;

      if (forcarExclusiva) {
        const totalDias = consideraFdsEFeriado ? diasNormais + diasExclusivos : diasNormais;
        totalDiariasExclusivas += totalDias * valorExclusiva;
        totalRefeicoes += totalDias * valorRefeicao;
      } else {
        totalDiariasNormais += diasNormais * valorDiaria;
        if (consideraFdsEFeriado) {
          totalDiariasExclusivas += diasExclusivos * valorExclusiva;
        }
        const diasParaRefeicao = consideraFdsEFeriado ? diasNormais + diasExclusivos : diasNormais;
        totalRefeicoes += diasParaRefeicao * valorRefeicao;
      }
    });
    totalGeral = totalDiariasNormais + totalDiariasExclusivas + totalRefeicoes;
    ocorrenciasUteis = diasNormais * convocados.length;
    ocorrenciasExclusivos = diasExclusivos * convocados.length;
    ocorrenciasRefeicao = (consideraFdsEFeriado ? diasNormais + diasExclusivos : diasNormais) * convocados.length;
  }
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
            <Text style={styles.statValue}>{diasUteisReal}</Text>
            <Text style={styles.statLabel}>Seg-Sex</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{sabadosReal}</Text>
            <Text style={styles.statLabel}>Sábados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{domingosReal}</Text>
            <Text style={styles.statLabel}>Domingos</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{feriadosReal}</Text>
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
                {mostrarDiariasExclusivas && (
                  <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Diária FDS/Fer</Text>
                )}
                <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: 'right' }]}>Refeição</Text>
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
                  {mostrarDiariasExclusivas && (
                    <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                      {formatCurrency(conv.valor_diaria_exclusiva || conv.valor_diaria || 0)}
                    </Text>
                  )}
                  <Text style={[styles.tableCell, { flex: 1, textAlign: 'right' }]}>
                    {formatCurrency(conv.valor_refeicao || 0)}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Valor Total Estimado */}
        <View style={styles.totalsSection}>
          {(ocorrenciasUteis > 0 || totalDiariasNormais > 0) && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Diárias Úteis + Sáb ({ocorrenciasUteis} {ocorrenciasUteis === 1 ? 'ocorrência' : 'ocorrências'})
              </Text>
              <Text style={styles.totalValue}>{formatCurrency(totalDiariasNormais)}</Text>
            </View>
          )}
          {mostrarDiariasExclusivas && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Diárias Dom/Feriados ({ocorrenciasExclusivos} {ocorrenciasExclusivos === 1 ? 'ocorrência' : 'ocorrências'})
              </Text>
              <Text style={styles.totalValue}>{formatCurrency(totalDiariasExclusivas)}</Text>
            </View>
          )}
          {totalRefeicoes > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>
                Refeições ({ocorrenciasRefeicao} {ocorrenciasRefeicao === 1 ? 'ocorrência' : 'ocorrências'})
              </Text>
              <Text style={styles.totalValue}>{formatCurrency(totalRefeicoes)}</Text>
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

        {/* Aditivos da Solicitação (Fase I.4) */}
        {aditivos && aditivos.length > 0 && (
          <View style={[styles.section, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>ADITIVOS DA SOLICITAÇÃO ({aditivos.length})</Text>
            {aditivos.map((a) => {
              const tipoLabel = TIPO_ADITIVO_LABEL[a.tipo] ?? a.tipo;
              const statusLabel = (a.status || '').toUpperCase();
              const nomeSolic = a.solicitado_por ? (nomesUsuariosAditivos?.[a.solicitado_por] ?? '—') : '—';
              const nomeDec = a.decidido_por ? (nomesUsuariosAditivos?.[a.decidido_por] ?? '—') : null;
              const rotuloDecisao =
                a.status === 'aprovado' ? 'Aprovado em' :
                a.status === 'reprovado' ? 'Reprovado em' :
                a.status === 'cancelado' ? 'Cancelado em' : null;
              return (
                <View key={a.id} style={styles.observationBox} wrap={false}>
                  <Text style={styles.infoValueBold}>
                    {tipoLabel} — {formatDate(a.data_ajustada)} — Status: {statusLabel}
                  </Text>
                  <Text style={styles.observationText}>
                    Solicitado em: {formatDateTime(a.solicitado_em)}{nomeSolic !== '—' ? ` por ${nomeSolic}` : ''}
                  </Text>
                  {rotuloDecisao && a.decidido_em && (
                    <Text style={styles.observationText}>
                      {rotuloDecisao}: {formatDateTime(a.decidido_em)}{nomeDec ? ` por ${nomeDec}` : ''}
                    </Text>
                  )}
                  {a.justificativa && (
                    <Text style={styles.observationText}>Justificativa: {a.justificativa}</Text>
                  )}
                  {a.observacao_aprovador && (
                    <Text style={styles.observationText}>Observação do aprovador: {a.observacao_aprovador}</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Assinaturas de Aprovação */}
        {assinaturas && assinaturas.length > 0 && (
          <AssinaturaPDFBlock assinaturas={assinaturas} />
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
