import '@/lib/pdfFonts';
import { StyleSheet } from '@react-pdf/renderer';

export const verAgirStyles = StyleSheet.create({
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
    borderBottomColor: '#2563eb',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    textAlign: 'center',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 4,
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

  // Info Grid - 2 columns
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  infoRow: {
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoCell: {
    width: '50%',
    padding: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  infoCellLast: {
    width: '50%',
    padding: 8,
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

  // Text Content
  textContent: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.5,
    textAlign: 'justify',
    minHeight: 40,
    padding: 8,
    backgroundColor: '#f9fafb',
    borderRadius: 4,
  },

  // Photos Section
  photosContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  photoWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  photoLabel: {
    fontSize: 10,
    fontFamily: 'Roboto', fontWeight: 'bold' as const,
    color: '#1e3a5f',
    marginBottom: 6,
    textAlign: 'center',
  },
  photoFrame: {
    width: '100%',
    height: 180,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  photoPlaceholder: {
    fontSize: 9,
    color: '#9ca3af',
  },

  // Solution Section
  solutionBox: {
    padding: 10,
    backgroundColor: '#f0fdf4',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    minHeight: 50,
  },
  solutionText: {
    fontSize: 10,
    color: '#14532d',
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
});
