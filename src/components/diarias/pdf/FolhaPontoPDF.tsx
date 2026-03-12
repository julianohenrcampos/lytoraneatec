import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// =====================================================
// TYPES
// =====================================================

export interface FolhaPontoFuncionario {
  nome_completo: string;
  matricula: string | null;
  cpf: string;
  dias: { data: string; hora_entrada: string; hora_saida: string }[];
}

export interface FolhaPontoPDFProps {
  numeroSolicitacao: string;
  codigoCentroCusto: string;
  funcionarios: FolhaPontoFuncionario[];
  logoUrl?: string;
}

// =====================================================
// STYLES
// =====================================================

const HALF_HEIGHT = 380; // ~half of A4 portrait usable area (842pt - margins)

const s = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  // Each employee sheet occupies half the page
  sheet: {
    height: HALF_HEIGHT,
    paddingBottom: 10,
    justifyContent: 'flex-start',
  },
  separator: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#cbd5e1',
    marginBottom: 8,
  },
  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 3,
  },
  infoText: {
    fontSize: 8,
    color: '#555',
    marginBottom: 1,
  },
  funcionarioName: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    marginTop: 2,
  },
  // Table
  table: {
    width: '100%',
    marginTop: 6,
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
    minHeight: 18,
    marginTop: -1,
  },
  tableRowAlt: {
    backgroundColor: '#f8fafc',
  },
  cellData: {
    width: '28%',
    padding: 3,
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellMatricula: {
    width: '18%',
    padding: 3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellCpf: {
    width: '22%',
    padding: 3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellHoraEntrada: {
    width: '16%',
    padding: 3,
    textAlign: 'center',
    borderRightWidth: 1,
    borderColor: '#94a3b8',
  },
  cellHoraSaida: {
    width: '16%',
    padding: 3,
    textAlign: 'center',
  },
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  cellText: {
    fontSize: 8,
  },
  // Signature
  signatureArea: {
    marginTop: 'auto',
    paddingTop: 8,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderColor: '#333',
    width: '55%',
    paddingTop: 3,
    textAlign: 'center',
    alignSelf: 'center',
  },
  signatureName: {
    fontSize: 8,
    textAlign: 'center',
  },
  signatureLabel: {
    fontSize: 7,
    color: '#666',
    textAlign: 'center',
    marginTop: 1,
  },
  // Footer
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#888',
    marginTop: 4,
  },
});

// =====================================================
// INDIVIDUAL SHEET COMPONENT
// =====================================================

const FolhaIndividual: React.FC<{
  func: FolhaPontoFuncionario;
  numeroSolicitacao: string;
  codigoCentroCusto: string;
  logoUrl?: string;
  geradoEm: string;
}> = ({ func, numeroSolicitacao, codigoCentroCusto, logoUrl, geradoEm }) => {
  const formatData = (dataStr: string) => {
    try {
      const [y, m, d] = dataStr.split('-').map(Number);
      return format(new Date(y, m - 1, d), "dd/MM/yyyy (EEE)", { locale: ptBR });
    } catch {
      return dataStr;
    }
  };

  const formatTime = (time: string) => {
    if (!time) return ':';
    // time from DB is "HH:mm:ss" or "HH:mm"
    return time.substring(0, 5);
  };

  return (
    <View style={s.sheet}>
      {/* Header */}
      <View style={s.headerRow}>
        {logoUrl && <Image style={s.logo} src={logoUrl} />}
        <View style={s.headerCenter}>
          <Text style={s.title}>LISTA DE PRESENÇA</Text>
          <Text style={s.infoText}>Solicitação Nº {numeroSolicitacao}</Text>
          <Text style={s.infoText}>Centro de Custo: {codigoCentroCusto}</Text>
          <Text style={s.funcionarioName}>{func.nome_completo}</Text>
        </View>
        {/* Spacer for symmetry */}
        {logoUrl && <View style={{ width: 40 }} />}
      </View>

      {/* Table */}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <View style={s.cellData}><Text style={s.headerText}>Data</Text></View>
          <View style={s.cellMatricula}><Text style={s.headerText}>Matrícula</Text></View>
          <View style={s.cellCpf}><Text style={s.headerText}>CPF</Text></View>
          <View style={s.cellHoraEntrada}><Text style={s.headerText}>Hora Inicial</Text></View>
          <View style={s.cellHoraSaida}><Text style={s.headerText}>Hora Final</Text></View>
        </View>

        {func.dias.map((dia, i) => (
          <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]} wrap={false}>
            <View style={s.cellData}><Text style={s.cellText}>{formatData(dia.data)}</Text></View>
            <View style={s.cellMatricula}><Text style={s.cellText}>{func.matricula || '-'}</Text></View>
            <View style={s.cellCpf}><Text style={s.cellText}>{func.cpf || '-'}</Text></View>
            <View style={s.cellHoraEntrada}><Text style={s.cellText}>{dia.hora_entrada ? formatTime(dia.hora_entrada) : ':'}</Text></View>
            <View style={s.cellHoraSaida}><Text style={s.cellText}>{dia.hora_saida ? formatTime(dia.hora_saida) : ':'}</Text></View>
          </View>
        ))}
      </View>

      {/* Signature */}
      <View style={s.signatureArea}>
        <View style={s.signatureLine}>
          <Text style={s.signatureLabel}>Assinatura</Text>
          <Text style={s.signatureName}>{func.nome_completo}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={s.footer}>
        <Text>Sistema LYTEC – Gestão de Diárias</Text>
        <Text>Gerado em: {geradoEm}</Text>
      </View>
    </View>
  );
};

// =====================================================
// MAIN DOCUMENT
// =====================================================

export const FolhaPontoPDFDocument: React.FC<FolhaPontoPDFProps> = ({
  numeroSolicitacao,
  codigoCentroCusto,
  funcionarios,
  logoUrl,
}) => {
  const geradoEm = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

  // Group employees in pairs for 2-per-page layout
  const pairs: FolhaPontoFuncionario[][] = [];
  for (let i = 0; i < funcionarios.length; i += 2) {
    pairs.push(funcionarios.slice(i, i + 2));
  }

  return (
    <Document>
      {pairs.map((pair, pageIdx) => (
        <Page key={pageIdx} size="A4" style={s.page}>
          {/* First sheet */}
          <FolhaIndividual
            func={pair[0]}
            numeroSolicitacao={numeroSolicitacao}
            codigoCentroCusto={codigoCentroCusto}
            logoUrl={logoUrl}
            geradoEm={geradoEm}
          />

          {/* Separator between sheets */}
          {pair[1] && <View style={s.separator} />}

          {/* Second sheet (if exists) */}
          {pair[1] && (
            <FolhaIndividual
              func={pair[1]}
              numeroSolicitacao={numeroSolicitacao}
              codigoCentroCusto={codigoCentroCusto}
              logoUrl={logoUrl}
              geradoEm={geradoEm}
            />
          )}
        </Page>
      ))}
    </Document>
  );
};
