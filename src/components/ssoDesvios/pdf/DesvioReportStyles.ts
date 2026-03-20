import '@/lib/pdfFonts';
import { StyleSheet } from '@react-pdf/renderer';

export const desvioStyles = StyleSheet.create({
  // Page Layout
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
  },

  // Header
  headerContainer: {
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 3,
    borderBottomColor: '#dc2626',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerReportNumber: {
    fontSize: 14,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#dc2626',
    textAlign: 'center',
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeCritical: {
    backgroundColor: '#7f1d1d',
  },
  badgeGrave: {
    backgroundColor: '#dc2626',
  },
  badgeModerate: {
    backgroundColor: '#d97706',
  },
  badgeMild: {
    backgroundColor: '#16a34a',
  },
  badgeNeutral: {
    backgroundColor: '#6b7280',
  },
  badgeBlue: {
    backgroundColor: '#2563eb',
  },
  badgeReincident: {
    backgroundColor: '#ea580c',
  },
  badgeText: {
    fontSize: 9,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#ffffff',
  },

  // Section
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },

  // Info Grid
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoItem: {
    width: '48%',
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
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
  },

  // Tipos de Desvio
  tiposContainer: {
    marginTop: 8,
  },
  tipoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  tipoCheckmark: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  tipoCheckmarkText: {
    fontSize: 10,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  tipoText: {
    fontSize: 10,
    color: '#1f2937',
  },
  tipoOutros: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 4,
  },
  tipoOutrosLabel: {
    fontSize: 8,
    color: '#6b7280',
    marginBottom: 2,
  },
  tipoOutrosText: {
    fontSize: 9,
    color: '#374151',
  },

  // Text Sections
  textContent: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  // Ações Corretivas
  acaoSection: {
    marginTop: 8,
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  acaoLabel: {
    fontSize: 9,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#166534',
    marginBottom: 4,
  },
  acaoText: {
    fontSize: 10,
    color: '#14532d',
    lineHeight: 1.4,
  },
  acaoGrid: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 20,
  },
  acaoItem: {
    flex: 1,
  },

  // Photos Section
  photosSection: {
    marginTop: 8,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  photoContainer: {
    width: '23%',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  photo: {
    width: '100%',
    height: 100,
    objectFit: 'cover',
  },
  photoCaption: {
    fontSize: 7,
    color: '#6b7280',
    textAlign: 'center',
    padding: 4,
    backgroundColor: '#f9fafb',
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
});
