import React from 'react';
import { Document, Page, Text, View, Image, StyleSheet } from '@react-pdf/renderer';
import { format, isWeekend as isWeekendFn } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// =====================================================
// TYPES
// =====================================================

export interface FolhaPontoDia {
  data: string;
  hora_entrada: string;
  intervalo_saida: string;
  intervalo_entrada: string;
  hora_saida: string;
  centro_custo: string;
}

export interface FolhaPontoFuncionario {
  nome_completo: string;
  matricula: string | null;
  cpf: string;
  data_admissao: string | null;
  funcao: string;
  departamento: string;
  banco: string | null;
  agencia: string | null;
  conta_corrente: string | null;
  dias: FolhaPontoDia[];
}

export interface FolhaPontoPDFProps {
  periodoInicio: string;
  periodoFim: string;
  funcionarios: FolhaPontoFuncionario[];
  logoUrl?: string;
}

// =====================================================
// STYLES
// =====================================================

const BORDER = '#333333';
const HEADER_BG = '#e2e8f0';

const s = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 20,
    paddingHorizontal: 25,
    fontSize: 8,
    fontFamily: 'Helvetica',
  },
  headerContainer: {
    borderWidth: 1,
    borderColor: BORDER,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  logo: {
    width: 36,
    height: 36,
    marginRight: 10,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },
  periodo: {
    fontSize: 9,
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  infoCell: {
    width: '50%',
    flexDirection: 'row',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderColor: BORDER,
  },
  infoLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7.5,
    marginRight: 4,
  },
  infoValue: {
    fontSize: 7.5,
  },
  // Table
  table: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: HEADER_BG,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    minHeight: 16,
  },
  tableRowWeekend: {
    backgroundColor: '#f1f5f9',
  },
  // Column widths — Dia 10%, Entrada 11%, Int.S 11%, Int.E 11%, Saída 11%, C.C 12%, Assinatura 34%
  colDia: { width: '10%', padding: 2, paddingLeft: 4, borderRightWidth: 0.5, borderColor: BORDER },
  colEntrada: { width: '11%', padding: 2, textAlign: 'center', borderRightWidth: 0.5, borderColor: BORDER },
  colIntS: { width: '11%', padding: 2, textAlign: 'center', borderRightWidth: 0.5, borderColor: BORDER },
  colIntE: { width: '11%', padding: 2, textAlign: 'center', borderRightWidth: 0.5, borderColor: BORDER },
  colSaida: { width: '11%', padding: 2, textAlign: 'center', borderRightWidth: 0.5, borderColor: BORDER },
  colCC: { width: '12%', padding: 2, textAlign: 'center', borderRightWidth: 0.5, borderColor: BORDER },
  colAssinatura: { width: '34%', padding: 2, paddingLeft: 4 },
  headerText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textAlign: 'center',
  },
  cellText: {
    fontSize: 7,
  },
  cellTextCenter: {
    fontSize: 7,
    textAlign: 'center',
  },
  // Footer sections
  summaryRow: {
    flexDirection: 'row',
    marginTop: 6,
    borderWidth: 1,
    borderColor: BORDER,
  },
  summaryCell: {
    width: '33.33%',
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 0.5,
    borderColor: BORDER,
  },
  observacoesBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 6,
    minHeight: 30,
  },
  legalText: {
    marginTop: 6,
    fontSize: 6.5,
    color: '#444',
    textAlign: 'justify',
    lineHeight: 1.4,
  },
  signatureArea: {
    marginTop: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  signatureBlock: {
    alignItems: 'center',
    width: '40%',
  },
  signatureLine: {
    borderTopWidth: 1,
    borderColor: '#333',
    width: '100%',
    marginBottom: 3,
  },
  signatureLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
  },
  localDataRow: {
    marginTop: 10,
    fontSize: 7.5,
    textAlign: 'center',
  },
  bankRow: {
    marginTop: 8,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: '#f8fafc',
  },
  bankCell: {
    flex: 1,
    paddingVertical: 3,
    paddingHorizontal: 6,
    borderRightWidth: 0.5,
    borderColor: BORDER,
    flexDirection: 'row',
  },
});

// =====================================================
// HELPERS
// =====================================================

const formatDateBR = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'dd/MM', { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const formatDateShort = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return format(new Date(y, m - 1, d), 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateStr;
  }
};

const formatTime = (time: string) => {
  if (!time) return '';
  return time.substring(0, 5);
};

const isWeekendDate = (dateStr: string) => {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return isWeekendFn(new Date(y, m - 1, d));
  } catch {
    return false;
  }
};

const formatAdmissao = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return formatDateShort(dateStr);
};

const formatCPFDisplay = (cpf: string) => {
  if (!cpf) return '-';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

// =====================================================
// INDIVIDUAL PAGE COMPONENT
// =====================================================

const FolhaPontoPage: React.FC<{
  func: FolhaPontoFuncionario;
  periodoInicio: string;
  periodoFim: string;
  logoUrl?: string;
}> = ({ func, periodoInicio, periodoFim, logoUrl }) => {
  const totalFaltas = func.dias.filter(d => !isWeekendDate(d.data) && !d.hora_entrada).length;

  return (
    <Page size="A4" style={s.page}>
      {/* HEADER */}
      <View style={s.headerContainer}>
        <View style={s.headerRow}>
          {logoUrl && <Image style={s.logo} src={logoUrl} />}
          <View style={s.headerCenter}>
            <Text style={s.title}>FOLHA DE PONTO</Text>
            <Text style={s.periodo}>
              Período: {formatDateShort(periodoInicio)} a {formatDateShort(periodoFim)}
            </Text>
          </View>
          {logoUrl && <View style={{ width: 36 }} />}
        </View>

        {/* INFO GRID */}
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Funcionário:</Text>
            <Text style={s.infoValue}>{func.nome_completo}</Text>
          </View>
          <View style={[s.infoCell, { borderRightWidth: 0 }]}>
            <Text style={s.infoLabel}>Função:</Text>
            <Text style={s.infoValue}>{func.funcao || '-'}</Text>
          </View>
        </View>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Matrícula:</Text>
            <Text style={s.infoValue}>{func.matricula || '-'}</Text>
          </View>
          <View style={[s.infoCell, { borderRightWidth: 0 }]}>
            <Text style={s.infoLabel}>Admissão:</Text>
            <Text style={s.infoValue}>{formatAdmissao(func.data_admissao)}</Text>
          </View>
        </View>
        <View style={s.infoGrid}>
          <View style={s.infoCell}>
            <Text style={s.infoLabel}>Departamento:</Text>
            <Text style={s.infoValue}>{func.departamento || '-'}</Text>
          </View>
          <View style={[s.infoCell, { borderRightWidth: 0 }]}>
            <Text style={s.infoLabel}>Jornada:</Text>
            <Text style={s.infoValue}></Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', paddingVertical: 3, paddingHorizontal: 6 }}>
          <Text style={s.infoLabel}>Descanso Semanal:</Text>
          <Text style={s.infoValue}>SAB / DOM</Text>
        </View>
      </View>

      {/* TABLE */}
      <View style={s.table}>
        <View style={s.tableHeader}>
          <View style={s.colDia}><Text style={s.headerText}>Dia</Text></View>
          <View style={s.colEntrada}><Text style={s.headerText}>Entrada</Text></View>
          <View style={s.colIntS}><Text style={s.headerText}>Int. Saída</Text></View>
          <View style={s.colIntE}><Text style={s.headerText}>Int. Entrada</Text></View>
          <View style={s.colSaida}><Text style={s.headerText}>Saída</Text></View>
          <View style={s.colCC}><Text style={s.headerText}>C.C</Text></View>
          <View style={s.colAssinatura}><Text style={s.headerText}>Assinatura Diária</Text></View>
        </View>

        {func.dias.map((dia, i) => {
          const weekend = isWeekendDate(dia.data);
          return (
            <View key={i} style={[s.tableRow, weekend ? s.tableRowWeekend : {}]} wrap={false}>
              <View style={s.colDia}>
                <Text style={s.cellText}>{formatDateBR(dia.data)}</Text>
              </View>
              <View style={s.colEntrada}>
                <Text style={s.cellTextCenter}>{formatTime(dia.hora_entrada)}</Text>
              </View>
              <View style={s.colIntS}>
                <Text style={s.cellTextCenter}>{formatTime(dia.intervalo_saida)}</Text>
              </View>
              <View style={s.colIntE}>
                <Text style={s.cellTextCenter}>{formatTime(dia.intervalo_entrada)}</Text>
              </View>
              <View style={s.colSaida}>
                <Text style={s.cellTextCenter}>{formatTime(dia.hora_saida)}</Text>
              </View>
              <View style={s.colCC}>
                <Text style={s.cellTextCenter}>{dia.centro_custo || ''}</Text>
              </View>
              <View style={s.colAssinatura}>
                <Text style={s.cellText}></Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* SUMMARY */}
      <View style={s.summaryRow}>
        <View style={s.summaryCell}>
          <Text style={s.infoLabel}>Total de Faltas: <Text style={s.infoValue}>{totalFaltas}</Text></Text>
        </View>
        <View style={s.summaryCell}>
          <Text style={s.infoLabel}>Total de Atraso: <Text style={s.infoValue}>______</Text></Text>
        </View>
        <View style={[s.summaryCell, { borderRightWidth: 0 }]}>
          <Text style={s.infoLabel}>Dias Trabalhados: <Text style={s.infoValue}>{func.dias.filter(d => !!d.hora_entrada).length}</Text></Text>
        </View>
      </View>

      {/* OBSERVATIONS */}
      <View style={s.observacoesBox}>
        <Text style={s.infoLabel}>Observações:</Text>
      </View>

      {/* LEGAL TEXT */}
      <Text style={s.legalText}>
        Os horários deverão ser assinalados pelo próprio empregado, e qualquer engano ou omissão, 
        comunicado ao encarregado de pessoal, para as devidas correções. A marcação de ponto é 
        obrigatória, e sua falta constitui falta grave, sujeita às penalidades previstas em lei.
      </Text>

      {/* SIGNATURES */}
      <View style={s.signatureArea}>
        <View style={s.signatureBlock}>
          <View style={s.signatureLine} />
          <Text style={s.signatureLabel}>Encarregado</Text>
        </View>
        <View style={s.signatureBlock}>
          <View style={s.signatureLine} />
          <Text style={s.signatureLabel}>Funcionário</Text>
        </View>
      </View>

      <Text style={s.localDataRow}>
        ____________, _____ de _________________ de {new Date().getFullYear()}
      </Text>

      {/* BANK INFO */}
      <View style={s.bankRow}>
        <View style={s.bankCell}>
          <Text style={s.infoLabel}>CPF: </Text>
          <Text style={s.infoValue}>{formatCPFDisplay(func.cpf)}</Text>
        </View>
        <View style={s.bankCell}>
          <Text style={s.infoLabel}>Banco: </Text>
          <Text style={s.infoValue}>{func.banco || '-'}</Text>
        </View>
        <View style={s.bankCell}>
          <Text style={s.infoLabel}>Agência: </Text>
          <Text style={s.infoValue}>{func.agencia || '-'}</Text>
        </View>
        <View style={[s.bankCell, { borderRightWidth: 0 }]}>
          <Text style={s.infoLabel}>Conta: </Text>
          <Text style={s.infoValue}>{func.conta_corrente || '-'}</Text>
        </View>
      </View>
    </Page>
  );
};

// =====================================================
// MAIN DOCUMENT
// =====================================================

export const FolhaPontoPDFDocument: React.FC<FolhaPontoPDFProps> = ({
  periodoInicio,
  periodoFim,
  funcionarios,
  logoUrl,
}) => {
  if (funcionarios.length === 0) {
    return (
      <Document>
        <Page size="A4" style={s.page}>
          <Text style={{ fontSize: 14, textAlign: 'center', marginTop: 40 }}>
            Nenhum dado encontrado para gerar a folha de ponto.
          </Text>
        </Page>
      </Document>
    );
  }

  return (
    <Document>
      {funcionarios.map((func, idx) => (
        <FolhaPontoPage
          key={idx}
          func={func}
          periodoInicio={periodoInicio}
          periodoFim={periodoFim}
          logoUrl={logoUrl}
        />
      ))}
    </Document>
  );
};
