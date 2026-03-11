import { StyleSheet } from '@react-pdf/renderer';

export const diariaStyles = StyleSheet.create({
  // Page Layout
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  pageLandscape: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },

  // Header com Logo
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#DD2C00',
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: 'contain',
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 15,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
  },
  headerTitleSmall: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
  },
  headerSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    marginTop: 2,
  },

  // Section
  section: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#DD2C00',
  },

  // Info Grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  infoItem: {
    width: '31%',
    marginBottom: 4,
  },
  infoItemFull: {
    width: '100%',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 10,
    color: '#1f2937',
  },
  infoValueBold: {
    fontSize: 10,
    color: '#1f2937',
    fontFamily: 'Helvetica-Bold',
  },

  // Stats Panel (Dias Úteis, FDS, Feriados)
  statsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 16,
  },
  statBox: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statBoxHighlight: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  statValue: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Table
  table: {
    marginTop: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1e3a5f',
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textAlign: 'left',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  tableRowAlternate: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#f9fafb',
  },
  tableCell: {
    fontSize: 9,
    color: '#374151',
  },
  tableCellBold: {
    fontSize: 9,
    color: '#374151',
    fontFamily: 'Helvetica-Bold',
  },

  // Totals Section
  totalsSection: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  totalLabel: {
    fontSize: 9,
    color: '#374151',
  },
  totalValue: {
    fontSize: 9,
    color: '#1e3a5f',
    fontFamily: 'Helvetica-Bold',
  },
  totalRowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#bfdbfe',
    marginTop: 4,
  },
  totalLabelMain: {
    fontSize: 11,
    color: '#1e3a5f',
    fontFamily: 'Helvetica-Bold',
  },
  totalValueMain: {
    fontSize: 14,
    color: '#1e3a5f',
    fontFamily: 'Helvetica-Bold',
  },

  // Status Badge
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  badgeRascunho: {
    backgroundColor: '#f1f5f9',
  },
  badgeEnviada: {
    backgroundColor: '#fef3c7',
  },
  badgeAutorizada: {
    backgroundColor: '#dcfce7',
  },
  badgeReprovada: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
  },
  badgeTextRascunho: {
    color: '#475569',
  },
  badgeTextEnviada: {
    color: '#d97706',
  },
  badgeTextAutorizada: {
    color: '#16a34a',
  },
  badgeTextReprovada: {
    color: '#dc2626',
  },

  // Observation Box
  observationBox: {
    padding: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  observationBoxRed: {
    padding: 10,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  observationText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.4,
  },
  observationTextRed: {
    fontSize: 9,
    color: '#991b1b',
    lineHeight: 1.4,
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: '#6b7280',
  },
  footerPage: {
    fontSize: 8,
    color: '#6b7280',
  },

  // Aviso
  warningBox: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fffbeb',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  warningText: {
    fontSize: 8,
    color: '#92400e',
    textAlign: 'center',
  },

  // Signature Section
  signatureSection: {
    marginTop: 30,
    paddingTop: 20,
  },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: '#374151',
    width: 200,
    marginTop: 40,
    marginBottom: 4,
  },
  signatureLabel: {
    fontSize: 10,
    color: '#374151',
    fontFamily: 'Helvetica-Bold',
  },
  signatureDate: {
    fontSize: 9,
    color: '#6b7280',
    marginTop: 8,
  },

  // Consolidated table for PDF
  consolidatedRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  consolidatedRowAlternate: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 6,
    paddingHorizontal: 6,
    backgroundColor: '#f9fafb',
  },
});
