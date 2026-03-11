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

const BORDER_COLOR = '#2C4466';
const BORDER_WIDTH = 1.5;

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
    borderBottomColor: BORDER_COLOR,
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
    color: BORDER_COLOR,
    textAlign: 'center' as any,
    flex: 1,
    marginLeft: 15,
    textTransform: 'uppercase' as any,
  },
  block: {
    flexDirection: 'row' as any,
    marginBottom: 20,
    gap: 0,
  },
  leftBox: {
    width: '50%',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
  },
  leftBoxHeader: {
    flexDirection: 'row' as any,
    backgroundColor: BORDER_COLOR,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
  },
  leftBoxHeaderCellMes: {
    width: '40%',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
    textTransform: 'uppercase' as any,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
    textAlign: 'center' as any,
  },
  leftBoxHeaderCellGerencia: {
    width: '60%',
    padding: 6,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
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
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
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
  rightBox: {
    width: '50%',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderLeftWidth: BORDER_WIDTH,
  },
  rightBoxHeader: {
    backgroundColor: BORDER_COLOR,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
    padding: 6,
    textAlign: 'center' as any,
  },
  rightBoxHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: '#ffffff',
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
  },
  rightBoxSubHeader: {
    flexDirection: 'row' as any,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
    backgroundColor: BORDER_COLOR,
  },
  rightBoxSubHeaderCell: {
    width: '50%',
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 7,
    color: '#ffffff',
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
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  rightBoxDataCellValor: {
    width: '50%',
    padding: 6,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1f2937',
    textAlign: 'center' as any,
  },
  ccRow: {
    flexDirection: 'row' as any,
    borderTopWidth: BORDER_WIDTH,
    borderTopColor: BORDER_COLOR,
  },
  ccLabel: {
    width: '60%',
    padding: 4,
    fontSize: 7,
    color: BORDER_COLOR,
    paddingLeft: 8,
  },
  ccQtd: {
    width: '20%',
    padding: 4,
    fontSize: 7,
    color: BORDER_COLOR,
    textAlign: 'center' as any,
  },
  ccValor: {
    width: '20%',
    padding: 4,
    fontSize: 7,
    color: BORDER_COLOR,
    textAlign: 'right' as any,
    paddingRight: 8,
  },
  totalGeralBlock: {
    flexDirection: 'row' as any,
    marginTop: 20,
  },
  totalGeralLeft: {
    width: '50%',
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    backgroundColor: BORDER_COLOR,
    padding: 6,
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
    borderWidth: BORDER_WIDTH,
    borderColor: BORDER_COLOR,
    borderLeftWidth: BORDER_WIDTH,
  },
  totalGeralRightHeader: {
    flexDirection: 'row' as any,
    backgroundColor: BORDER_COLOR,
    borderBottomWidth: BORDER_WIDTH,
    borderBottomColor: BORDER_COLOR,
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
    backgroundColor: '#ffffff',
  },
  totalGeralRightDataCellQtd: {
    width: '50%',
    padding: 8,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: BORDER_COLOR,
    textAlign: 'center' as any,
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
  },
  totalGeralRightDataCellValor: {
    width: '50%',
    padding: 8,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: BORDER_COLOR,
    textAlign: 'center' as any,
  },
  subHeaderSeparator: {
    borderRightWidth: BORDER_WIDTH,
    borderRightColor: BORDER_COLOR,
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
              {/* Centro de custo codes concatenated */}
              <View style={styles.ccRow}>
                <Text style={[styles.ccLabel, { width: '100%', textAlign: 'center' as any, flexWrap: 'wrap' as any }]}>
                  {(() => {
                    const uniqueCodes = [...new Set(gerencia.centrosCusto.map(cc => cc.centroCusto).filter(Boolean))].sort();
                    return uniqueCodes.join(' | ');
                  })()}
                </Text>
              </View>
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
    const ccLabel = item.codigo_centro_custo || '';

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
