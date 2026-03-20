import '@/lib/pdfFonts';
import React from 'react';
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ListaPresencaItem {
  nome_completo: string;
  matricula: string | null;
  cpf: string;
  hora_entrada: string;
  hora_saida: string;
}

export interface ListaPresencaPDFProps {
  numeroSolicitacao: string;
  centroCusto: string;
  dataApontamento: string;
  funcionarios: ListaPresencaItem[];
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
  },
  // Mini-header fixo (repete em todas as páginas)
  miniHeader: {
    position: 'absolute',
    top: 15,
    left: 40,
    right: 40,
    paddingBottom: 4,
    marginBottom: 6,
  },
  miniHeaderLine1: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  miniHeaderText: {
    fontSize: 9,
    color: '#444',
  },
  miniHeaderLine2: {
    fontSize: 9,
    color: '#444',
  },
  // Cabeçalho completo (só 1ª página)
  header: {
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 10,
    color: '#555',
    marginBottom: 2,
  },
  table: {
    width: '100%',
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#94a3b8',
  },
  tableRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#94a3b8',
    minHeight: 28,
    marginTop: -1,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  cellNome: {
    width: '30%',
    padding: 5,
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellMatricula: {
    width: '12%',
    padding: 5,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellCpf: {
    width: '16%',
    padding: 5,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellHoraEntrada: {
    width: '10%',
    padding: 5,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellHoraSaida: {
    width: '10%',
    padding: 5,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellAssinatura: {
    width: '22%',
    padding: 5,
  },
  headerText: {
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    fontSize: 9,
  },
  cellText: {
    fontSize: 9,
  },
  footer: {
    marginTop: 40,
  },
  signatureLine: {
    marginTop: 50,
    borderTopWidth: 1,
    borderColor: '#333',
    width: '60%',
    paddingTop: 4,
    textAlign: 'center',
    alignSelf: 'center',
  },
  timestamp: {
    marginTop: 20,
    fontSize: 8,
    color: '#888',
    textAlign: 'right',
  },
});

export const ListaPresencaPDFDocument: React.FC<ListaPresencaPDFProps> = ({
  numeroSolicitacao,
  centroCusto,
  dataApontamento,
  funcionarios,
}) => {
  const dataFormatada = (() => {
    try {
      const [y, m, d] = dataApontamento.split('-').map(Number);
      return format(new Date(y, m - 1, d), "dd/MM/yyyy (EEEE)", { locale: ptBR });
    } catch {
      return dataApontamento;
    }
  })();

  const agora = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  return (
    <Document>
      <Page size="A4" style={styles.page} wrap>
        {/* Mini-header fixo - repete a partir da página 2 */}
        <View style={styles.miniHeader} fixed>
          <View style={styles.miniHeaderLine1}>
            <Text style={styles.miniHeaderText} render={({ pageNumber }) => pageNumber === 1 ? '' : `Solicitação Nº ${numeroSolicitacao}`} />
            <Text style={styles.miniHeaderText} render={({ pageNumber }) => pageNumber === 1 ? '' : `Data: ${dataFormatada}`} />
          </View>
          <Text style={styles.miniHeaderLine2} render={({ pageNumber }) => pageNumber === 1 ? '' : `Centro de Custo: ${centroCusto}`} />
          <View render={({ pageNumber }) => pageNumber === 1 ? null : undefined} style={{ borderBottomWidth: 0.5, borderBottomColor: '#cbd5e1', marginTop: 2 }} fixed />
        </View>

        {/* Cabeçalho completo - apenas 1ª página */}
        <View style={styles.header}>
          <Text style={styles.title}>LISTA DE PRESENÇA</Text>
          <Text style={styles.subtitle}>Solicitação Nº {numeroSolicitacao}</Text>
          <Text style={styles.subtitle}>Centro de Custo: {centroCusto}</Text>
          <Text style={styles.subtitle}>Data: {dataFormatada}</Text>
        </View>

        {/* Tabela */}
        <View style={styles.table}>
          {/* Header da tabela - indivisível */}
          <View style={styles.tableHeader} wrap={false}>
            <View style={styles.cellNome}><Text style={styles.headerText}>Nome Completo</Text></View>
            <View style={styles.cellMatricula}><Text style={styles.headerText}>Matrícula</Text></View>
            <View style={styles.cellCpf}><Text style={styles.headerText}>CPF</Text></View>
            <View style={styles.cellHoraEntrada}><Text style={styles.headerText}>Hora Inicial</Text></View>
            <View style={styles.cellHoraSaida}><Text style={styles.headerText}>Hora Final</Text></View>
            <View style={styles.cellAssinatura}><Text style={styles.headerText}>Assinatura</Text></View>
          </View>

          {/* Rows - cada linha indivisível */}
          {funcionarios.map((func, i) => (
            <View key={i} style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]} wrap={false}>
              <View style={styles.cellNome}><Text style={styles.cellText}>{func.nome_completo}</Text></View>
              <View style={styles.cellMatricula}><Text style={styles.cellText}>{func.matricula || '-'}</Text></View>
              <View style={styles.cellCpf}><Text style={styles.cellText}>{func.cpf || '-'}</Text></View>
              <View style={styles.cellHoraEntrada}><Text style={styles.cellText}>{func.hora_entrada || ':'}</Text></View>
              <View style={styles.cellHoraSaida}><Text style={styles.cellText}>{func.hora_saida || ':'}</Text></View>
              <View style={styles.cellAssinatura}><Text style={styles.cellText}></Text></View>
            </View>
          ))}
        </View>

        {/* Rodapé - indivisível */}
        <View style={styles.footer} wrap={false}>
          <View style={styles.signatureLine}>
            <Text style={{ fontSize: 9 }}>Assinatura do Responsável</Text>
          </View>
          <Text style={styles.timestamp}>Gerado em: {agora}</Text>
        </View>
      </Page>
    </Document>
  );
};
