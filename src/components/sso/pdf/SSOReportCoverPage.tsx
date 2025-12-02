import { View, Text } from '@react-pdf/renderer';
import { styles } from './SSOReportStyles';
import { SSOChecklist } from '@/types/sso';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianDate } from '@/utils/timezoneUtils';

interface SSOReportCoverPageProps {
  checklist: SSOChecklist;
  totalNaoConformidades: number;
}

export const SSOReportCoverPage = ({ checklist, totalNaoConformidades }: SSOReportCoverPageProps) => {
  const dataFormatada = format(parseBrazilianDate(checklist.data_inspecao), 'dd/MM/yyyy', { locale: ptBR });

  const getResultadoStyle = () => {
    switch (checklist.resultado_avaliacao) {
      case 'Crítico':
        return { box: styles.statBoxCritical, value: styles.statValueCritical };
      case 'Em Atenção':
        return { box: styles.statBoxWarning, value: styles.statValueWarning };
      case 'Satisfatório':
      case 'Excelente':
        return { box: styles.statBoxSuccess, value: styles.statValueSuccess };
      default:
        return { box: styles.statBoxNeutral, value: styles.statValueNeutral };
    }
  };

  const resultadoStyle = getResultadoStyle();

  return (
    <View>
      {/* Título */}
      <Text style={styles.coverTitle}>
        CHECK LIST - AUTOS DE INFRAÇÃO MTE_TAC
      </Text>
      <Text style={styles.coverSubtitle}>
        Relatório de Não Conformidades
      </Text>
      <View style={styles.coverDivider} />

      {/* Informações da Inspeção */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>Informações da Inspeção</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Obra</Text>
            <Text style={styles.infoValue}>
              {checklist.bd_centros_custo?.nome_centro_custo || '-'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Código da Obra</Text>
            <Text style={styles.infoValue}>
              {checklist.bd_centros_custo?.codigo_centro_custo || '-'}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Data da Inspeção</Text>
            <Text style={styles.infoValue}>{dataFormatada}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Gerente Regional</Text>
            <Text style={styles.infoValue}>{checklist.gerente_regional || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Engenheiro da Obra</Text>
            <Text style={styles.infoValue}>{checklist.engenheiro_obra || '-'}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Técnico de Segurança</Text>
            <Text style={styles.infoValue}>{checklist.tecnico_seguranca || '-'}</Text>
          </View>
        </View>
      </View>

      {/* Painel de Resumo */}
      <View style={styles.infoSection}>
        <Text style={styles.infoSectionTitle}>Resumo da Avaliação</Text>
        <View style={styles.statsPanel}>
          <View style={[styles.statBox, resultadoStyle.box]}>
            <Text style={[styles.statValue, resultadoStyle.value]}>
              {checklist.resultado_avaliacao || '-'}
            </Text>
            <Text style={styles.statLabel}>Resultado</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxNeutral]}>
            <Text style={[styles.statValue, styles.statValueNeutral]}>
              {checklist.nota_real?.toFixed(1) || '-'}
            </Text>
            <Text style={styles.statLabel}>Nota Real</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxCritical]}>
            <Text style={[styles.statValue, styles.statValueCritical]}>
              {checklist.total_itens}/{totalNaoConformidades}
            </Text>
            <Text style={styles.statLabel}>Total/NC</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxNeutral]}>
            <Text style={[styles.statValue, styles.statValueNeutral]}>
              {checklist.total_efetivo || '-'}
            </Text>
            <Text style={styles.statLabel}>Efetivo</Text>
          </View>
        </View>
      </View>

      {/* Observações Gerais */}
      {checklist.observacoes_gerais && (
        <View style={styles.observationsSection}>
          <Text style={styles.observationsTitle}>Observações Gerais</Text>
          <Text style={styles.observationsText}>{checklist.observacoes_gerais}</Text>
        </View>
      )}
    </View>
  );
};
