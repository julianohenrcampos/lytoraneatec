import { View, Text } from '@react-pdf/renderer';
import { styles } from './SSOReportStyles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianDate } from '@/utils/timezoneUtils';

interface SSOReportHeaderProps {
  dataInspecao: string;
}

export const SSOReportHeader = ({ dataInspecao }: SSOReportHeaderProps) => {
  const dataFormatada = format(parseBrazilianDate(dataInspecao), 'dd/MM/yyyy', { locale: ptBR });

  return (
    <View style={styles.header} fixed>
      <Text style={styles.headerTitle}>
        RELATÓRIO DE NÃO CONFORMIDADES – MTE_TAC
      </Text>
      <Text style={styles.headerDate}>
        Inspeção: {dataFormatada}
      </Text>
    </View>
  );
};
