import { StyleSheet } from '@react-pdf/renderer';

export const agendamentoExamesStyles = StyleSheet.create({
  page: {
    padding: 20,
    fontFamily: 'Helvetica',
    fontSize: 8,
  },
  title: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 2,
  },
  titleAdmissao: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 4,
    color: '#CC0000',
  },
  subtitle: {
    fontSize: 8,
    textAlign: 'center',
    marginBottom: 10,
    color: '#555',
  },
  // Table
  table: {
    width: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#D9D9D9',
    borderWidth: 1,
    borderColor: '#000',
  },
  row: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  rowAlt: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    backgroundColor: '#F5F5F5',
  },
  // Header cells
  headerCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  headerCellLast: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  // Data cells
  cell: {
    fontSize: 7,
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  cellLast: {
    fontSize: 7,
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: 2,
  },
  cellLeft: {
    fontSize: 7,
    textAlign: 'left',
    paddingVertical: 3,
    paddingHorizontal: 3,
    borderRightWidth: 1,
    borderColor: '#000',
  },
  // Column widths
  colNome: { width: '20%' },
  colCargo: { width: '12%' },
  colArea: { width: '14%' },
  colCpf: { width: '12%' },
  colData: { width: '10%' },
  colSalario: { width: '10%' },
  colExame: { width: '12%' },
  colPassagem: { width: '10%' },
  // Group header
  groupHeader: {
    flexDirection: 'row',
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 3,
    paddingHorizontal: 6,
    marginTop: 6,
  },
  groupHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  // Footer section (legacy — kept for compat)
  footerSection: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#000',
    padding: 8,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  footerLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
  },
  footerValue: {
    fontSize: 8,
  },
  // ===== Funções Summary Table =====
  bottomRow: {
    flexDirection: 'row',
    marginTop: 14,
    alignItems: 'flex-start',
    gap: 20,
  },
  funcoesContainer: {
    width: '50%',
  },
  funcoesHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#F4A460', // orange-ish
    borderWidth: 1,
    borderColor: '#000',
  },
  funcoesHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  funcoesRow: {
    flexDirection: 'row',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
  },
  funcoesCell: {
    fontSize: 7,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  funcoesCellCenter: {
    fontSize: 7,
    textAlign: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  funcoesCellBorderRight: {
    borderRightWidth: 1,
    borderColor: '#000',
  },
  funcoesTotalRow: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#FFF3E0',
  },
  funcoesTotalCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    paddingVertical: 4,
    paddingHorizontal: 4,
    color: '#CC0000',
  },
  funcoesTotalCellCenter: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    color: '#CC0000',
  },
  // ===== Total Valor Table =====
  totalValorContainer: {
    width: '25%',
  },
  totalValorHeader: {
    borderWidth: 1,
    borderColor: '#CC0000',
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: '#FFF0F0',
  },
  totalValorHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9,
    textAlign: 'center',
    color: '#000',
  },
  totalValorBody: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#CC0000',
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  totalValorText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
    textAlign: 'center',
    color: '#CC0000',
  },
});
