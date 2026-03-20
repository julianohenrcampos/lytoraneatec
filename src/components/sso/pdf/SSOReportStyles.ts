import '@/lib/pdfFonts';
import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
  // Page Layout
  page: {
    paddingTop: 60,
    paddingBottom: 70,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
  },
  coverPage: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 40,
    fontSize: 10,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
  },

  // Header
  header: {
    position: 'absolute',
    top: 20,
    left: 40,
    right: 40,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 11,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
  },
  headerDate: {
    fontSize: 9,
    color: '#6b7280',
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

  // Cover Page Styles
  coverTitle: {
    fontSize: 18,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    textAlign: 'center',
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 10,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  coverDivider: {
    height: 3,
    backgroundColor: '#2563eb',
    marginBottom: 20,
  },

  // Info Table
  infoSection: {
    marginBottom: 20,
  },
  infoSectionTitle: {
    fontSize: 11,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
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

  // Stats Panel
  statsPanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 10,
  },
  statBox: {
    flex: 1,
    padding: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBoxCritical: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  statBoxWarning: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  statBoxSuccess: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  statBoxNeutral: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  statValue: {
    fontSize: 20,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    marginBottom: 2,
  },
  statValueCritical: {
    color: '#dc2626',
  },
  statValueWarning: {
    color: '#d97706',
  },
  statValueSuccess: {
    color: '#16a34a',
  },
  statValueNeutral: {
    color: '#475569',
  },
  statLabel: {
    fontSize: 8,
    color: '#6b7280',
    textAlign: 'center',
  },

  // Observations
  observationsSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  observationsTitle: {
    fontSize: 10,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    marginBottom: 6,
  },
  observationsText: {
    fontSize: 9,
    color: '#374151',
    lineHeight: 1.5,
    textAlign: 'justify',
  },

  // NC Block
  ncBlock: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#fecaca',
  },
  ncHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  ncNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ncNumberText: {
    fontSize: 10,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  ncCategory: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
  },
  ncCategoryText: {
    fontSize: 9,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#dc2626',
  },
  ncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#dc2626',
    borderRadius: 4,
  },
  ncBadgeText: {
    fontSize: 8,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#ffffff',
  },
  ncDescription: {
    fontSize: 10,
    color: '#1f2937',
    marginBottom: 8,
    lineHeight: 1.4,
  },
  ncEvidenceSection: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fefce8',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#fef08a',
  },
  ncEvidenceLabel: {
    fontSize: 8,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#854d0e',
    marginBottom: 4,
  },
  ncEvidenceText: {
    fontSize: 9,
    color: '#713f12',
    lineHeight: 1.4,
  },

  // Photos
  ncPhotosSection: {
    marginTop: 10,
  },
  ncPhotosLabel: {
    fontSize: 8,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#6b7280',
    marginBottom: 6,
  },
  ncPhotosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  ncPhotoContainer: {
    width: '48%',
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  ncPhoto: {
    width: '100%',
    height: 120,
    objectFit: 'cover',
  },
  ncPhotoCaption: {
    fontSize: 7,
    color: '#6b7280',
    textAlign: 'center',
    padding: 4,
    backgroundColor: '#f9fafb',
  },

  // Content area
  content: {
    flex: 1,
  },
});
