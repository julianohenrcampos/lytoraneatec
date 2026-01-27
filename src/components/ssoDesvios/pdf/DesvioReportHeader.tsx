import React from 'react';
import { View, Text } from '@react-pdf/renderer';
import { desvioStyles as styles } from './DesvioReportStyles';
import { ClassificacaoDesvio, StatusAcao } from '@/types/ssoDesvios';

interface DesvioReportHeaderProps {
  numeroRelatorio: string;
  classificacao: ClassificacaoDesvio;
  status: StatusAcao;
  reincidencia: boolean;
}

const getClassificacaoBadgeStyle = (classificacao: ClassificacaoDesvio) => {
  switch (classificacao) {
    case 'Crítico':
      return styles.badgeCritical;
    case 'Grave':
      return styles.badgeGrave;
    case 'Moderado':
      return styles.badgeModerate;
    case 'Leve':
      return styles.badgeMild;
    default:
      return styles.badgeNeutral;
  }
};

const getStatusBadgeStyle = (status: StatusAcao) => {
  switch (status) {
    case 'Aberto':
      return styles.badgeNeutral;
    case 'Em Tratativa':
      return styles.badgeBlue;
    case 'Corrigido':
      return styles.badgeMild;
    case 'Encerrado':
      return styles.badgeNeutral;
    case 'Reincidente':
      return styles.badgeReincident;
    default:
      return styles.badgeNeutral;
  }
};

export const DesvioReportHeader: React.FC<DesvioReportHeaderProps> = ({
  numeroRelatorio,
  classificacao,
  status,
  reincidencia
}) => {
  return (
    <View style={styles.headerContainer}>
      <Text style={styles.headerTitle}>REGISTRO DE DESVIO SSO</Text>
      <Text style={styles.headerReportNumber}>{numeroRelatorio}</Text>
      <View style={styles.badgesRow}>
        <View style={[styles.badge, getClassificacaoBadgeStyle(classificacao)]}>
          <Text style={styles.badgeText}>{classificacao}</Text>
        </View>
        <View style={[styles.badge, getStatusBadgeStyle(status)]}>
          <Text style={styles.badgeText}>{status}</Text>
        </View>
        {reincidencia && (
          <View style={[styles.badge, styles.badgeReincident]}>
            <Text style={styles.badgeText}>Reincidente</Text>
          </View>
        )}
      </View>
    </View>
  );
};
