import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer';
import type { RelatorioFolhaItem } from '@/types/diarias';

Font.registerHyphenationCallback(word => [word]);

interface CompiladoGerencia {
  gerenteNome: string;
  centrosCusto: {
    centroCusto: string;
    quantidade: number;
    valor: number;
  }[];
  totalQuantidade: number;
  totalValor: number;
}

interface CompiladoDiariasPDFProps {
  dados: CompiladoGerencia[];
  mesAno: string;
  logoUrl?: string;
  totalGeralQuantidade: number;
  totalGeralValor: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff',
  },
  headerContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#1e3a5f',
    alignItems: 'center',
  },
  logo: {
    width: 80,
    height: 40,
    objectFit: 'contain' as any,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    textAlign: 'center' as any,
    flex: 1,
    marginLeft: 15,
    textTransform: 'uppercase' as any,
  },
  // Block container for each gerência
  block: {
    flexDirection: 'row' as any,
    marginBottom: 12,
    gap: 0,
  },
  // Left box: MÊS + GERÊNCIA
  leftBox: {
    width: '50%',
    borderWidth: 1,
    borderColor: '#4b5563',
  },
  leftBoxHeader: {
    flexDirection: 'row' as any,
    backgroundColor: '#d1d5db',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
  },
  leftBoxHeaderCellMes: {
    width: '40%',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#1f2937',
    textTransform: 'uppercase' as any,
    borderRightWidth: 1,
    borderRightColor: '#4b5563',
    textAlign: 'center' as any,
  },
  leftBoxHeaderCellGerencia: {
    width: '60%',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#1f2937',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
  },
  leftBoxData: {
    flexDirection: 'row' as any,
    minHeight: 28,
    alignItems: 'center' as any,
  },
  leftBoxDataCellMes: {
    width: '40%',
    padding: 6,
    fontSize: 8,
    color: '#1f2937',
    borderRightWidth: 1,
    borderRightColor: '#4b5563',
    textAlign: 'center' as any,
    fontFamily: 'Helvetica-Bold',
  },
  leftBoxDataCellGerencia: {
    width: '60%',
    padding: 6,
    fontSize: 8,
    color: '#1f2937',
    textAlign: 'center' as any,
    fontFamily: 'Helvetica-Bold',
  },
  // Right box: DIÁRIAS (QUANTIDADE + VALOR)
  rightBox: {
    width: '50%',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderLeftWidth: 0,
  },
  rightBoxHeader: {
    backgroundColor: '#d1d5db',
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
    padding: 6,
    textAlign: 'center' as any,
  },
  rightBoxHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#1f2937',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
  },
  rightBoxSubHeader: {
    flexDirection: 'row' as any,
    borderBottomWidth: 1,
    borderBottomColor: '#4b5563',
    backgroundColor: '#e5e7eb',
  },
  rightBoxSubHeaderCell: {
    width: '50%',
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#374151',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
  },
  rightBoxData: {
    flexDirection: 'row' as any,
    minHeight: 28,
    alignItems: 'center' as any,
  },
  rightBoxDataCellQtd: {
    width: '50%',
    padding: 6,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center' as any,
    borderRightWidth: 1,
    borderRightColor: '#4b5563',
  },
  rightBoxDataCellValor: {
    width: '50%',
    padding: 6,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center' as any,
  },
  // Centro de custo detail rows
  ccRow: {
    flexDirection: 'row' as any,
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
  },
  ccLabel: {
    width: '60%',
    padding: 4,
    fontSize: 7,
    color: '#4b5563',
    paddingLeft: 8,
  },
  ccQtd: {
    width: '20%',
    padding: 4,
    fontSize: 7,
    color: '#4b5563',
    textAlign: 'center' as any,
  },
  ccValor: {
    width: '20%',
    padding: 4,
    fontSize: 7,
    color: '#4b5563',
    textAlign: 'right' as any,
    paddingRight: 8,
  },
  // Total Geral
  totalGeralBlock: {
    flexDirection: 'row' as any,
    marginTop: 20,
  },
  totalGeralLeft: {
    width: '50%',
    borderWidth: 2,
    borderColor: '#1e3a5f',
    backgroundColor: '#1e3a5f',
    padding: 10,
    justifyContent: 'center' as any,
    alignItems: 'center' as any,
  },
  totalGeralLeftText: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#ffffff',
    textTransform: 'uppercase' as any,
  },
  totalGeralRight: {
    width: '50%',
    borderWidth: 2,
    borderColor: '#1e3a5f',
    borderLeftWidth: 0,
  },
  totalGeralRightHeader: {
    flexDirection: 'row' as any,
    backgroundColor: '#1e3a5f',
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  totalGeralRightHeaderCell: {
    width: '50%',
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
  },
  totalGeralRightData: {
    flexDirection: 'row' as any,
    minHeight: 32,
    alignItems: 'center' as any,
    backgroundColor: '#f0f4f8',
  },
  totalGeralRightDataCellQtd: {
    width: '50%',
    padding: 8,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    textAlign: 'center' as any,
    borderRightWidth: 1,
    borderRightColor: '#1e3a5f',
  },
  totalGeralRightDataCellValor: {
    width: '50%',
    padding: 8,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: '#1e3a5f',
    textAlign: 'center' as any,
  },
  // Separator between left sub-header cells
  subHeaderSeparator: {
    borderRightWidth: 1,
    borderRightColor: '#4b5563',
  },
});

export const CompiladoDiariasPDF = ({
  dados,
  mesAno,
  logoUrl,
  totalGeralQuantidade,
  totalGeralValor,
}: CompiladoDiariasPDFProps) => {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
          <Text style={styles.headerTitle}>COMPILADO DE DIÁRIAS - {mesAno}</Text>
        </View>

        {/* Blocks per gerência */}
        {dados.map((gerencia, gIdx) => (
          <View key={gIdx} wrap={false} style={styles.block}>
            {/* Left box: MÊS + GERÊNCIA */}
            <View style={styles.leftBox}>
              <View style={styles.leftBoxHeader}>
                <Text style={styles.leftBoxHeaderCellMes}>MÊS</Text>
                <Text style={styles.leftBoxHeaderCellGerencia}>GERÊNCIA</Text>
              </View>
              <View style={styles.leftBoxData}>
                <Text style={styles.leftBoxDataCellMes}>{mesAno}</Text>
                <Text style={styles.leftBoxDataCellGerencia}>{gerencia.gerenteNome}</Text>
              </View>
              {/* Centro de custo details */}
              {gerencia.centrosCusto.length > 1 && gerencia.centrosCusto.map((cc, ccIdx) => (
                <View key={ccIdx} style={styles.ccRow}>
                  <Text style={styles.ccLabel}>{cc.centroCusto}</Text>
                  <Text style={styles.ccQtd}>{cc.quantidade}</Text>
                  <Text style={styles.ccValor}>{formatCurrency(cc.valor)}</Text>
                </View>
              ))}
              {gerencia.centrosCusto.length === 1 && (
                <View style={styles.ccRow}>
                  <Text style={[styles.ccLabel, { width: '100%', textAlign: 'center' as any }]}>
                    {gerencia.centrosCusto[0].centroCusto}
                  </Text>
                </View>
              )}
            </View>

            {/* Right box: DIÁRIAS */}
            <View style={styles.rightBox}>
              <View style={styles.rightBoxHeader}>
                <Text style={styles.rightBoxHeaderText}>DIÁRIAS</Text>
              </View>
              <View style={styles.rightBoxSubHeader}>
                <Text style={[styles.rightBoxSubHeaderCell, styles.subHeaderSeparator]}>QUANTIDADE</Text>
                <Text style={styles.rightBoxSubHeaderCell}>VALOR</Text>
              </View>
              <View style={styles.rightBoxData}>
                <Text style={styles.rightBoxDataCellQtd}>{gerencia.totalQuantidade}</Text>
                <Text style={styles.rightBoxDataCellValor}>{formatCurrency(gerencia.totalValor)}</Text>
              </View>
            </View>
          </View>
        ))}

        {/* Total Geral */}
        <View wrap={false} style={styles.totalGeralBlock}>
          <View style={styles.totalGeralLeft}>
            <Text style={styles.totalGeralLeftText}>TOTAL GERAL</Text>
          </View>
          <View style={styles.totalGeralRight}>
            <View style={styles.totalGeralRightHeader}>
              <Text style={styles.totalGeralRightHeaderCell}>QUANTIDADE</Text>
              <Text style={styles.totalGeralRightHeaderCell}>VALOR</Text>
            </View>
            <View style={styles.totalGeralRightData}>
              <Text style={styles.totalGeralRightDataCellQtd}>{totalGeralQuantidade}</Text>
              <Text style={styles.totalGeralRightDataCellValor}>{formatCurrency(totalGeralValor)}</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// Helper to build compilado data from relatorio items
export function buildCompiladoData(
  relatorio: RelatorioFolhaItem[],
  centrosCusto: { id: string; codigo_centro_custo: string; nome_centro_custo: string; aprovador_diarias_id: string | null }[],
  gerentesMap: Record<string, string>
): { dados: CompiladoGerencia[]; totalGeralQuantidade: number; totalGeralValor: number } {
  const confirmados = relatorio.filter(
    (r) => String(r.presenca_status) === 'true' && r.hora_entrada && r.hora_saida
  );

  const gerenteMap = new Map<string, Map<string, { quantidade: number; valor: number; label: string }>>();

  confirmados.forEach((item) => {
    const cc = centrosCusto.find((c) => c.id === item.centro_custo_id);
    const gerenteId = cc?.aprovador_diarias_id || 'sem_gerente';
    const gerenteNome = gerenteId !== 'sem_gerente' ? (gerentesMap[gerenteId] || 'Não definido') : 'Sem Gerente';
    const ccLabel = `${item.codigo_centro_custo || ''} - ${item.nome_centro_custo || ''}`;

    if (!gerenteMap.has(gerenteId)) {
      gerenteMap.set(gerenteId, new Map());
    }
    const ccMap = gerenteMap.get(gerenteId)!;
    const existing = ccMap.get(item.centro_custo_id) || { quantidade: 0, valor: 0, label: ccLabel };
    existing.quantidade += 1;
    existing.valor += (item.valor_diaria_aplicada || 0) + (item.valor_refeicao_aplicado || 0);
    ccMap.set(item.centro_custo_id, existing);
  });

  let totalGeralQuantidade = 0;
  let totalGeralValor = 0;

  const dados: CompiladoGerencia[] = [];
  gerenteMap.forEach((ccMap, gerenteId) => {
    const gerenteNome = gerenteId !== 'sem_gerente' ? (gerentesMap[gerenteId] || 'Não definido') : 'Sem Gerente';
    let totalQtd = 0;
    let totalVal = 0;
    const centros = Array.from(ccMap.values()).map((cc) => {
      totalQtd += cc.quantidade;
      totalVal += cc.valor;
      return { centroCusto: cc.label, quantidade: cc.quantidade, valor: cc.valor };
    });
    totalGeralQuantidade += totalQtd;
    totalGeralValor += totalVal;
    dados.push({ gerenteNome, centrosCusto: centros, totalQuantidade: totalQtd, totalValor: totalVal });
  });

  // Sort by total value descending (maior → menor)
  dados.sort((a, b) => b.totalValor - a.totalValor);

  return { dados, totalGeralQuantidade, totalGeralValor };
}
