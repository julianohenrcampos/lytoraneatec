import { View, Text, Image } from '@react-pdf/renderer';
import { styles } from './SSOReportStyles';
import { SSOChecklistItem } from '@/types/sso';

interface SSOReportNCBlockProps {
  item: SSOChecklistItem;
  index: number;
  photoUrls: Record<string, string>;
}

export const SSOReportNCBlock = ({ item, index, photoUrls }: SSOReportNCBlockProps) => {
  const validPhotos = item.fotos?.filter(foto => {
    const url = photoUrls[foto.path] || foto.url;
    return url && (url.startsWith('http') || url.startsWith('data:'));
  }) || [];

  return (
    <View style={styles.ncBlock} wrap={false}>
      {/* Header do bloco */}
      <View style={styles.ncHeader}>
        <View style={styles.ncNumber}>
          <Text style={styles.ncNumberText}>{index + 1}</Text>
        </View>
        <View style={styles.ncCategory}>
          <Text style={styles.ncCategoryText}>{item.tema}</Text>
        </View>
        <View style={styles.ncBadge}>
          <Text style={styles.ncBadgeText}>Não Conforme</Text>
        </View>
      </View>

      {/* Descrição/Pergunta */}
      <Text style={styles.ncDescription}>{item.descricao}</Text>

      {/* Evidência Objetiva */}
      {item.evidencia && (
        <View style={styles.ncEvidenceSection}>
          <Text style={styles.ncEvidenceLabel}>📋 Evidência Objetiva:</Text>
          <Text style={styles.ncEvidenceText}>{item.evidencia}</Text>
        </View>
      )}

      {/* Fotos */}
      {validPhotos.length > 0 && (
        <View style={styles.ncPhotosSection}>
          <Text style={styles.ncPhotosLabel}>
            📷 Registro Fotográfico ({validPhotos.length} {validPhotos.length === 1 ? 'foto' : 'fotos'}):
          </Text>
          <View style={styles.ncPhotosGrid}>
            {validPhotos.slice(0, 4).map((foto, photoIdx) => {
              const photoUrl = photoUrls[foto.path] || foto.url || '';
              return (
                <View key={photoIdx} style={styles.ncPhotoContainer}>
                  <Image 
                    src={photoUrl}
                    style={styles.ncPhoto}
                  />
                  <Text style={styles.ncPhotoCaption}>
                    Foto {photoIdx + 1}
                  </Text>
                </View>
              );
            })}
          </View>
          {validPhotos.length > 4 && (
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 4 }}>
              + {validPhotos.length - 4} foto(s) adicional(is)
            </Text>
          )}
        </View>
      )}
    </View>
  );
};
