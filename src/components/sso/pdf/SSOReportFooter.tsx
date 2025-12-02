import { View, Text } from '@react-pdf/renderer';
import { styles } from './SSOReportStyles';

export const SSOReportFooter = () => {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Sistema de Gestão SSO - MTE_TAC
      </Text>
      <Text 
        style={styles.footerPage}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
};
