import '@/lib/pdfFonts';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { AssinaturaAprovacao } from '@/types/diarias';

const formatCPFPdf = (value?: string | null): string => {
  if (!value) return '-';
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length !== 11) return value;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
};

const truncateHash = (hash?: string | null): string => {
  if (!hash) return '-';
  return hash.length > 12 ? `${hash.slice(0, 12)}…` : hash;
};

const formatDataHora = (value?: string | null): string => {
  if (!value) return '-';
  try {
    const d = new Date(value);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${mins}`;
  } catch {
    return value;
  }
};

const TIPO_LABELS: Record<string, string> = {
  gerente_adm: 'Gerente ADM',
  diretor_operacional: 'Diretor Operacional',
  diretor_adm: 'Diretor ADM',
};

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  title: {
    fontSize: 11,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    color: '#1e3a5f',
    marginBottom: 8,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#DD2C00',
  },
  container: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  card: {
    width: 170,
    borderWidth: 0.5,
    borderColor: '#cccccc',
    borderRadius: 3,
    padding: 8,
    backgroundColor: '#fafafa',
  },
  tipoLabel: {
    fontSize: 6,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    color: '#888888',
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  imageContainer: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 40,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dddddd',
    paddingBottom: 4,
    borderStyle: 'dashed' as const,
  },
  signatureImage: {
    maxHeight: 50,
    maxWidth: 150,
    objectFit: 'contain' as const,
  },
  noSignature: {
    fontSize: 7,
    color: '#999999',
    fontFamily: 'Roboto',
    textAlign: 'center' as const,
  },
  nome: {
    fontSize: 8,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    color: '#333333',
    marginBottom: 1,
  },
  cargo: {
    fontSize: 7,
    fontFamily: 'Roboto',
    color: '#666666',
    marginBottom: 1,
  },
  cpf: {
    fontSize: 7,
    fontFamily: 'Roboto',
    color: '#666666',
    marginBottom: 3,
  },
  metaRow: {
    fontSize: 6,
    fontFamily: 'Roboto',
    color: '#888888',
    marginBottom: 0.5,
  },
  metaHash: {
    fontSize: 6,
    fontFamily: 'Roboto',
    color: '#888888',
    marginBottom: 0.5,
  },
});

interface AssinaturaPDFBlockProps {
  assinaturas: AssinaturaAprovacao[];
}

export function AssinaturaPDFBlock({ assinaturas }: AssinaturaPDFBlockProps) {
  if (!assinaturas || assinaturas.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>APROVAÇÕES</Text>
      <View style={styles.container}>
        {assinaturas.map((ass, idx) => (
          <View key={idx} style={styles.card} wrap={false}>
            <Text style={styles.tipoLabel}>
              {TIPO_LABELS[ass.tipo_assinatura || ''] || ass.tipo_assinatura || 'Aprovação'}
            </Text>

            <View style={styles.imageContainer}>
              {ass.assinatura_base64 ? (
                <Image src={ass.assinatura_base64} style={styles.signatureImage} />
              ) : (
                <Text style={styles.noSignature}>Sem assinatura</Text>
              )}
            </View>

            <Text style={styles.nome}>{ass.nome_usuario}</Text>
            {ass.cargo && <Text style={styles.cargo}>{ass.cargo}</Text>}
            {ass.cpf && <Text style={styles.cpf}>CPF: {formatCPFPdf(ass.cpf)}</Text>}

            <Text style={styles.metaRow}>Data: {formatDataHora(ass.data_assinatura)}</Text>
            <Text style={styles.metaHash}>Hash: {truncateHash(ass.hash_assinatura)}</Text>
            {ass.ip && <Text style={styles.metaRow}>IP: {ass.ip}</Text>}
          </View>
        ))}
      </View>
    </View>
  );
}
