import { Document, Page, View, Text, Image, Font, StyleSheet } from '@react-pdf/renderer';
import type { RelatorioFolhaItem } from '@/types/diarias';

Font.registerHyphenationCallback(word => [word]);

interface CentroCustoDetalhe {
  centroCusto: string;
  quantidade: number;
  valor: number;
  quantidadeDS: number;
  valorDS: number;
  quantidadeFS: number;
  valorFS: number;
}

interface CompiladoGerencia {
  gerenteNome: string;
  centrosCusto: CentroCustoDetalhe[];
  totalQuantidade: number;
  totalValor: number;
}

interface CompiladoDiariasPDFProps {
  dados: CompiladoGerencia[];
  mesAno: string;
  logoUrl?: string;
  totalGeralQuantidade: number;
  totalGeralValor: number;
  periodo?: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

function formatCurrencyCompact(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  }).format(value);
}


const BC = '#2c3e50';
const BW = 1;
const BW_OUTER = 2;

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
    borderBottomColor: BC,
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
    color: BC,
    textAlign: 'center' as any,
    flex: 1,
    marginLeft: 15,
    textTransform: 'uppercase' as any,
  },
  // Total Geral Block
  totalGeralBlock: {
    marginTop: 20,
    borderWidth: BW_OUTER,
    borderColor: BC,
  },
  totalGeralTitleRow: {
    backgroundColor: '#ffffff',
    padding: 8,
    alignItems: 'center' as any,
    borderBottomWidth: BW,
    borderBottomColor: BC,
  },
  totalGeralTitleText: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: BC,
    textTransform: 'uppercase' as any,
  },
  totalGeralHeaderRow: {
    flexDirection: 'row' as any,
    borderBottomWidth: BW,
    borderBottomColor: BC,
  },
  totalGeralHeaderCell: {
    width: '50%',
    padding: 4,
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: BC,
    textTransform: 'uppercase' as any,
    textAlign: 'center' as any,
    backgroundColor: '#f0f4f8',
  },
  totalGeralDataRow: {
    flexDirection: 'row' as any,
    minHeight: 32,
    alignItems: 'center' as any,
    backgroundColor: '#ffffff',
  },
  totalGeralDataCellQtd: {
    width: '50%',
    padding: 8,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: BC,
    textAlign: 'center' as any,
    borderRightWidth: BW,
    borderRightColor: BC,
  },
  totalGeralDataCellValor: {
    width: '50%',
    padding: 8,
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: BC,
    textAlign: 'center' as any,
  },
});

// =====================================================
// Card Component for a single Centro de Custo
// =====================================================

function CentroCustoCard({ cc, width, compact }: { cc: CentroCustoDetalhe; width: string; compact: boolean }) {
  const nameFontSize = compact ? 7 : 9;
  const headerFontSize = compact ? 6 : 7;
  const qtyFontSize = compact ? 8 : 10;
  const valFontSize = compact ? 6 : 7;
  return (
    <View style={{
      width,
      borderRightWidth: BW,
      borderRightColor: BC,
      borderBottomWidth: BW,
      borderBottomColor: BC,
    }}>
      {/* Centro name */}
      <View style={{ backgroundColor: '#f0f4f8', padding: compact ? 3 : 5, borderBottomWidth: BW, borderBottomColor: BC }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: nameFontSize, color: BC, textAlign: 'center' as any }}>
          {cc.centroCusto}
        </Text>
      </View>
      <View style={{ flexDirection: 'row' as any, backgroundColor: BC, borderBottomWidth: BW, borderBottomColor: BC }}>
        <View style={{ flex: 1, padding: compact ? 2 : 3, borderRightWidth: 0.5, borderRightColor: '#ffffff' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: headerFontSize, color: '#ffffff', textAlign: 'center' as any }}>D.S</Text>
        </View>
        <View style={{ flex: 1, padding: compact ? 2 : 3 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: headerFontSize, color: '#ffffff', textAlign: 'center' as any }}>F.S</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' as any, borderBottomWidth: BW, borderBottomColor: BC }}>
        <View style={{ flex: 1, padding: compact ? 2 : 4, borderRightWidth: 0.5, borderRightColor: '#d1d5db' }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: qtyFontSize, color: '#1f2937', textAlign: 'center' as any }}>
            {cc.quantidadeDS || '-'}
          </Text>
        </View>
        <View style={{ flex: 1, padding: compact ? 2 : 4 }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: qtyFontSize, color: '#1f2937', textAlign: 'center' as any }}>
            {cc.quantidadeFS || '-'}
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row' as any }}>
        <View style={{ flex: 1, padding: compact ? 2 : 4, borderRightWidth: 0.5, borderRightColor: '#d1d5db' }}>
          <Text style={{ fontSize: valFontSize, color: '#1f2937', textAlign: 'center' as any }}>
            {cc.valorDS > 0 ? formatCurrencyCompact(cc.valorDS) : '-'}
          </Text>
        </View>
        <View style={{ flex: 1, padding: compact ? 2 : 4 }}>
          <Text style={{ fontSize: valFontSize, color: '#1f2937', textAlign: 'center' as any }}>
            {cc.valorFS > 0 ? formatCurrencyCompact(cc.valorFS) : '-'}
          </Text>
        </View>
      </View>
    </View>
  );
}


// =====================================================
// Helper to chunk arrays
// =====================================================

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

const CARDS_PER_ROW = 4;

// =====================================================
// Gerencia Block Component (chunked rows layout)
// =====================================================

function GerenciaBlock({ gerencia, mesAno, periodo }: { gerencia: CompiladoGerencia; mesAno: string; periodo?: string }) {
  const mesResumo = mesAno.split(/\s+(?:E|A)\s+/).map(m => m.substring(0, 3)).join('/');
  const rows = chunkArray(gerencia.centrosCusto, CARDS_PER_ROW);

  return (
    <View wrap={false} minPresenceAhead={40} style={{ marginBottom: 20, borderWidth: BW_OUTER, borderColor: BC }}>
      {/* Header: MÊS | GERÊNCIA */}
      <View style={{ borderBottomWidth: 0 }}>
        <View style={{ flexDirection: 'row' as any }}>
          <View style={{ width: '50%', backgroundColor: '#f0f4f8', padding: 5, borderRightWidth: BW, borderRightColor: BC, borderBottomWidth: BW, borderBottomColor: BC }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: BC, textAlign: 'center' as any, textTransform: 'uppercase' as any }}>MÊS</Text>
          </View>
          <View style={{ width: '50%', backgroundColor: '#f0f4f8', padding: 5, borderBottomWidth: BW, borderBottomColor: BC }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: BC, textAlign: 'center' as any, textTransform: 'uppercase' as any }}>GERÊNCIA</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row' as any, borderBottomWidth: BW, borderBottomColor: BC }}>
          <View style={{ width: '50%', padding: 6, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center' as any, alignItems: 'center' as any }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: '#1f2937', textAlign: 'center' as any }}>{mesResumo}</Text>
            {periodo && (
              <Text style={{ fontSize: 8, color: '#4b5563', textAlign: 'center' as any, marginTop: 2 }}>{periodo}</Text>
            )}
          </View>
          <View style={{ width: '50%', padding: 6, justifyContent: 'center' as any, alignItems: 'center' as any }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#1f2937', textAlign: 'center' as any }}>{gerencia.gerenteNome}</Text>
          </View>
        </View>
      </View>

      {/* Cost center card rows */}
      {rows.map((row, rowIdx) => {
        const colWidth = `${100 / row.length}%`;
        return (
          <View key={rowIdx} style={{ flexDirection: 'row' as any }}>
            {row.map((cc, i) => (
              <CentroCustoCard key={i} cc={cc} width={colWidth} compact={false} />
            ))}
          </View>
        );
      })}

      {/* Consolidated Footer — DIÁRIAS title full width, then 2 columns */}
      <View style={{ borderTopWidth: BW, borderTopColor: BC }}>
        {/* Row 1: DIÁRIAS spanning full width */}
        <View style={{ backgroundColor: '#ffffff', padding: 6, alignItems: 'center' as any, borderBottomWidth: BW, borderBottomColor: BC }}>
          <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 10, color: BC, textTransform: 'uppercase' as any }}>DIÁRIAS</Text>
        </View>
        {/* Row 2: Headers */}
        <View style={{ flexDirection: 'row' as any, borderBottomWidth: BW, borderBottomColor: BC }}>
          <View style={{ width: '50%', backgroundColor: '#f0f4f8', padding: 4, borderRightWidth: BW, borderRightColor: BC }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: BC, textAlign: 'center' as any, textTransform: 'uppercase' as any }}>QUANT. TOTAL</Text>
          </View>
          <View style={{ width: '50%', backgroundColor: '#f0f4f8', padding: 4 }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: BC, textAlign: 'center' as any, textTransform: 'uppercase' as any }}>VALOR TOTAL</Text>
          </View>
        </View>
        {/* Row 3: Values */}
        <View style={{ flexDirection: 'row' as any }}>
          <View style={{ width: '50%', padding: 8, borderRightWidth: BW, borderRightColor: BC, alignItems: 'center' as any }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 12, color: BC, textAlign: 'center' as any }}>{gerencia.totalQuantidade}</Text>
          </View>
          <View style={{ width: '50%', padding: 8, alignItems: 'center' as any }}>
            <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: BC, textAlign: 'center' as any }}>{formatCurrency(gerencia.totalValor)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

// =====================================================
// Main Document
// =====================================================

export const CompiladoDiariasPDF = ({
  dados,
  mesAno,
  logoUrl,
  totalGeralQuantidade,
  totalGeralValor,
  periodo,
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
          <GerenciaBlock key={gIdx} gerencia={gerencia} mesAno={mesAno} periodo={periodo} />
        ))}

        {/* Total Geral */}
        <View wrap={false} style={styles.totalGeralBlock}>
          <View style={styles.totalGeralTitleRow}>
            <Text style={styles.totalGeralTitleText}>TOTAL GERAL</Text>
          </View>
          <View style={styles.totalGeralHeaderRow}>
            <View style={{ ...styles.totalGeralHeaderCell, borderRightWidth: BW, borderRightColor: BC }}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: BC, textTransform: 'uppercase' as any, textAlign: 'center' as any }}>QUANTIDADE</Text>
            </View>
            <View style={styles.totalGeralHeaderCell}>
              <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 8, color: BC, textTransform: 'uppercase' as any, textAlign: 'center' as any }}>VALOR</Text>
            </View>
          </View>
          <View style={styles.totalGeralDataRow}>
            <Text style={styles.totalGeralDataCellQtd}>{totalGeralQuantidade}</Text>
            <Text style={styles.totalGeralDataCellValor}>{formatCurrency(totalGeralValor)}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};

// =====================================================
// Helper to build compilado data from relatorio items
// =====================================================

export function buildCompiladoData(
  relatorio: RelatorioFolhaItem[],
  centrosCusto: { id: string; codigo_centro_custo: string; nome_centro_custo: string; aprovador_diarias_id: string | null }[],
  gerentesMap: Record<string, string>,
  feriados: string[] = []
): { dados: CompiladoGerencia[]; totalGeralQuantidade: number; totalGeralValor: number } {
  const confirmados = relatorio.filter(
    (r) => String(r.presenca_status) === 'true' && r.hora_entrada && r.hora_saida
  );

  const feriadosSet = new Set(feriados.map(f => f.substring(0, 10)));

  const gerenteMap = new Map<string, Map<string, CentroCustoDetalhe>>();

  confirmados.forEach((item) => {
    const cc = centrosCusto.find((c) => c.id === item.centro_custo_id);
    const gerenteId = cc?.aprovador_diarias_id || 'sem_gerente';
    const ccLabel = item.codigo_centro_custo || '';
    const valorItem = (item.valor_diaria_aplicada || 0) + (item.valor_refeicao_aplicado || 0);

    const dataStr = item.data?.substring(0, 10) || '';
    const dataObj = new Date(dataStr + 'T12:00:00');
    const isDomingo = dataObj.getDay() === 0;
    const isFeriado = feriadosSet.has(dataStr);
    const isFS = isDomingo || isFeriado;

    if (!gerenteMap.has(gerenteId)) {
      gerenteMap.set(gerenteId, new Map());
    }
    const ccMap = gerenteMap.get(gerenteId)!;
    const existing = ccMap.get(item.centro_custo_id) || {
      centroCusto: ccLabel,
      quantidade: 0,
      valor: 0,
      quantidadeDS: 0,
      valorDS: 0,
      quantidadeFS: 0,
      valorFS: 0,
    };

    existing.quantidade += 1;
    existing.valor += valorItem;

    if (isFS) {
      existing.quantidadeFS += 1;
      existing.valorFS += valorItem;
    } else {
      existing.quantidadeDS += 1;
      existing.valorDS += valorItem;
    }

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
      return cc;
    });
    totalGeralQuantidade += totalQtd;
    totalGeralValor += totalVal;
    dados.push({ gerenteNome, centrosCusto: centros, totalQuantidade: totalQtd, totalValor: totalVal });
  });

  dados.sort((a, b) => b.totalValor - a.totalValor);

  return { dados, totalGeralQuantidade, totalGeralValor };
}
