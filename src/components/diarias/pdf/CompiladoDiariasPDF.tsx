import React from 'react';
import '@/lib/pdfFonts';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { RelatorioFolhaItem, AssinaturaAprovacao } from '@/types/diarias';
import { parseISO, format, differenceInDays } from 'date-fns';
import { AssinaturaPDFBlock } from '@/components/assinatura/AssinaturaPDFBlock';

// =====================================================
// TYPES
// =====================================================

interface PeriodoAgrupado {
  label: string;
  quantidade: number;
  valor: number;
}

interface CentroCustoCompilado {
  centroCustoId: string;
  codigoCentroCusto: string;
  nomeCentroCusto: string;
  gerencia: string;
  periodsWeekend: PeriodoAgrupado[];
  periodsWeekday: PeriodoAgrupado[];
  totalQuantidade: number;
  totalValor: number;
}

interface EmpresaCompiladoGroup {
  empresaNome: string;
  centros: CentroCustoCompilado[];
  totalQuantidade: number;
  totalValor: number;
}

interface CompiladoDiariasPDFProps {
  centros: CentroCustoCompilado[];
  empresaGroups?: EmpresaCompiladoGroup[];
  ano: number;
  sequencia: string;
  logoUrl?: string;
  logoMap?: Record<string, string>;
  totalGeralQuantidade: number;
  totalGeralValor: number;
  assinaturas?: AssinaturaAprovacao[];
}

// Legacy compat
export interface CompiladoGerencia {
  gerenteNome: string;
  centrosCusto: {
    centroCusto: string;
    quantidade: number;
    valor: number;
    quantidadeDS: number;
    valorDS: number;
    quantidadeFS: number;
    valorFS: number;
    dsLabel?: string;
    fsLabel?: string;
  }[];
  totalQuantidade: number;
  totalValor: number;
}

// =====================================================
// CONSTANTS
// =====================================================

const BC = '#000000';
const BW = 1;
const GRAY_BG = '#e5e5e5';
const ROW_H = 20;
const SECTION_H = 22;

// Column widths (4-column layout)
const COL1_W = '30%'; // Centro de Custo (rowspan)
const COL2_W = '40%'; // Período
const COL3_W = '15%'; // Quantidade
const COL4_W = '15%'; // Valor

// =====================================================
// STYLES
// =====================================================

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 50,
    paddingHorizontal: 30,
    fontSize: 8,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
  },
  // Header table (3 columns: 20% | 60% | 20%)
  headerTable: {
    flexDirection: 'row',
    borderWidth: BW,
    borderColor: BC,
    marginBottom: 16,
  },
  headerCol1: {
    width: '20%',
    borderRightWidth: BW,
    borderRightColor: BC,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  headerCol2: {
    width: '60%',
    borderRightWidth: BW,
    borderRightColor: BC,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  headerCol3: {
    width: '20%',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  logo: {
    width: 70,
    height: 35,
    objectFit: 'contain' as any,
  },
  headerTitle: {
    fontSize: 14,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    textAlign: 'center' as any,
  },
  // Sub-table inside col3 for sequence number
  seqSubTable: {
    borderWidth: BW,
    borderColor: BC,
    width: '100%',
  },
  seqLabelRow: {
    backgroundColor: GRAY_BG,
    borderBottomWidth: BW,
    borderBottomColor: BC,
    padding: 3,
    alignItems: 'center',
  },
  seqValueRow: {
    padding: 4,
    alignItems: 'center',
  },
  seqLabel: {
    fontSize: 7,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    textAlign: 'center' as any,
  },
  seqValue: {
    fontSize: 10,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    textAlign: 'center' as any,
  },
  // CC + Gerência row (2 columns: 50% | 50%)
  ccGerenciaRow: {
    flexDirection: 'row',
    borderWidth: BW,
    borderColor: BC,
    borderBottomWidth: 0,
    backgroundColor: GRAY_BG,
  },
  ccGerenciaCell: {
    width: '50%',
    padding: 5,
  },
  ccGerenciaCellRight: {
    width: '50%',
    padding: 5,
    borderLeftWidth: BW,
    borderLeftColor: BC,
  },
  ccGerenciaLabel: {
    fontSize: 6,
    fontFamily: 'Roboto',
    fontWeight: 'normal' as const,
    textTransform: 'uppercase' as const,
    color: '#555555',
  },
  ccGerenciaValue: {
    fontSize: 10,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    marginTop: 3,
  },
  // Main block outer border
  blockOuter: {
    borderWidth: BW,
    borderColor: BC,
    marginBottom: 14,
  },
  // 4-column data row
  dataRow: {
    flexDirection: 'row',
    minHeight: ROW_H,
  },
  // Section title row (spans cols 2-4 area)
  sectionRow: {
    flexDirection: 'row',
    minHeight: SECTION_H,
    backgroundColor: GRAY_BG,
  },
  // Cells
  cellCol1: {
    width: COL1_W,
    borderRightWidth: BW,
    borderRightColor: BC,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  cellCol2: {
    width: COL2_W,
    borderRightWidth: BW,
    borderRightColor: BC,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  cellCol3: {
    width: COL3_W,
    borderRightWidth: BW,
    borderRightColor: BC,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  cellCol4: {
    width: COL4_W,
    justifyContent: 'center',
    padding: 4,
  },
  // Separator between rows
  rowBorder: {
    borderBottomWidth: BW,
    borderBottomColor: BC,
  },
  // Text styles
  textCenter: {
    fontSize: 8,
    textAlign: 'center' as any,
    fontFamily: 'Roboto',
  },
  textCenterBold: {
    fontSize: 9,
    textAlign: 'center' as any,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
  },
  textRight: {
    fontSize: 8,
    textAlign: 'right' as any,
    fontFamily: 'Roboto',
  },
  textRightBold: {
    fontSize: 8,
    textAlign: 'right' as any,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
  },
  textHeaderBold: {
    fontSize: 8,
    textAlign: 'center' as any,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
  },
  ccNameText: {
    fontSize: 10,
    textAlign: 'center' as any,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
  },
  // Total Geral block
  totalBlock: {
    borderWidth: 2,
    borderColor: BC,
    marginTop: 12,
  },
  totalTitleRow: {
    backgroundColor: GRAY_BG,
    padding: 6,
    alignItems: 'center',
    borderBottomWidth: BW,
    borderBottomColor: BC,
  },
  totalTitleText: {
    fontSize: 12,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
  },
  totalHeaderRow: {
    flexDirection: 'row',
    backgroundColor: GRAY_BG,
    borderBottomWidth: BW,
    borderBottomColor: BC,
  },
  totalDataRow: {
    flexDirection: 'row',
  },
  totalCellBorder: {
    width: '50%',
    padding: 8,
    borderRightWidth: BW,
    borderRightColor: BC,
    alignItems: 'center',
  },
  totalCell: {
    width: '50%',
    padding: 8,
    alignItems: 'center',
  },
  totalValue: {
    fontSize: 14,
    fontFamily: 'Roboto',
    fontWeight: 'bold' as const,
    textAlign: 'center' as any,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: BW,
    borderTopColor: '#cccccc',
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: '#666666',
  },
});

// =====================================================
// HELPERS
// =====================================================

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

const MESES_PT = [
  'JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO',
  'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO',
];

function buildPeriodLabel(dates: string[]): string {
  if (dates.length === 0) return '-';
  const sorted = [...dates].sort();
  
  const ranges: { start: string; end: string }[] = [];
  let rangeStart = sorted[0];
  let prev = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    const diff = differenceInDays(parseISO(sorted[i]), parseISO(prev));
    if (diff === 1) {
      prev = sorted[i];
    } else {
      ranges.push({ start: rangeStart, end: prev });
      rangeStart = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push({ start: rangeStart, end: prev });
  
  return ranges.map(r => {
    const sd = parseISO(r.start);
    const ed = parseISO(r.end);
    const startDay = format(sd, 'dd');
    const endDay = format(ed, 'dd');
    const mes = MESES_PT[ed.getMonth()];
    
    if (r.start === r.end) {
      return `${startDay} / ${mes}`;
    }
    const diffDays = differenceInDays(ed, sd);
    if (diffDays === 1) {
      return `${startDay} E ${endDay} / ${mes}`;
    }
    return `${startDay} ATÉ ${endDay} / ${mes}`;
  }).join(', ');
}

// =====================================================
// CC BLOCK — Simulated rowspan: left col (30%) + right col (70%)
// Left col = CC name centered vertically across all rows
// Right col = stacked rows with 3 sub-columns
// =====================================================

const RIGHT_PERIODO = '57.14%'; // 40/70
const RIGHT_QTD = '21.43%';    // 15/70
const RIGHT_VALOR = '21.43%';  // 15/70

function RightRow({ children, bg, isLast }: { children: React.ReactNode; bg?: string; isLast?: boolean }) {
  return (
    <View style={{
      flexDirection: 'row' as const,
      minHeight: ROW_H,
      ...(bg ? { backgroundColor: bg } : {}),
      ...(!isLast ? { borderBottomWidth: BW, borderBottomColor: BC } : {}),
    }}>
      {children}
    </View>
  );
}

function DataCell3({ label, qtd, valor, bg }: { label: string; qtd: number; valor: number; bg?: string }) {
  return (
    <RightRow bg={bg}>
      <View style={{ width: RIGHT_PERIODO, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center', alignItems: 'center', padding: 4 }}>
        <Text style={s.textCenter}>{label}</Text>
      </View>
      <View style={{ width: RIGHT_QTD, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center', alignItems: 'center', padding: 4 }}>
        <Text style={s.textCenter}>{qtd}</Text>
      </View>
      <View style={{ width: RIGHT_VALOR, justifyContent: 'center', padding: 4 }}>
        <Text style={s.textRight}>{formatBRL(valor)}</Text>
      </View>
    </RightRow>
  );
}

function HeaderRow3({ title }: { title: string }) {
  return (
    <RightRow bg={GRAY_BG}>
      <View style={{ width: RIGHT_PERIODO, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center', alignItems: 'center', padding: 3 }}>
        <Text style={s.textHeaderBold}>{title}</Text>
      </View>
      <View style={{ width: RIGHT_QTD, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center', alignItems: 'center', padding: 3 }}>
        <Text style={s.textHeaderBold}>Quant. Diária</Text>
      </View>
      <View style={{ width: RIGHT_VALOR, justifyContent: 'center', alignItems: 'center', padding: 3 }}>
        <Text style={s.textHeaderBold}>Valor</Text>
      </View>
    </RightRow>
  );
}

function SubtotalRow3({ label, qtd, valor, isLast }: { label: string; qtd: number; valor: number; isLast?: boolean }) {
  return (
    <RightRow bg={GRAY_BG} isLast={isLast}>
      <View style={{ width: RIGHT_PERIODO, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center', alignItems: 'center', padding: 4 }}>
        <Text style={s.textHeaderBold}>{label}</Text>
      </View>
      <View style={{ width: RIGHT_QTD, borderRightWidth: BW, borderRightColor: BC, justifyContent: 'center', alignItems: 'center', padding: 4 }}>
        <Text style={s.textHeaderBold}>{qtd}</Text>
      </View>
      <View style={{ width: RIGHT_VALOR, justifyContent: 'center', padding: 4 }}>
        <Text style={s.textRightBold}>{formatBRL(valor)}</Text>
      </View>
    </RightRow>
  );
}

function SectionTitleRow({ label }: { label: string }) {
  return (
    <RightRow bg={GRAY_BG}>
      <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
        <Text style={s.textHeaderBold}>{label}</Text>
      </View>
    </RightRow>
  );
}

function CentroCustoBlock({ cc }: { cc: CentroCustoCompilado }) {
  const weekendQtd = cc.periodsWeekend.reduce((s, p) => s + p.quantidade, 0);
  const weekendVal = cc.periodsWeekend.reduce((s, p) => s + p.valor, 0);
  const weekdayQtd = cc.periodsWeekday.reduce((s, p) => s + p.quantidade, 0);
  const weekdayVal = cc.periodsWeekday.reduce((s, p) => s + p.valor, 0);
  const ccLabel = `${cc.codigoCentroCusto} - ${cc.nomeCentroCusto}`;

  return (
    <View wrap={false} style={{ marginBottom: 14 }}>
      {/* CC + Gerência header */}
      <View style={s.ccGerenciaRow}>
        <View style={s.ccGerenciaCell}>
          <Text style={s.ccGerenciaValue}>CENTRO DE CUSTO</Text>
        </View>
        <View style={s.ccGerenciaCellRight}>
          <Text style={s.ccGerenciaLabel}>GERÊNCIA</Text>
          <Text style={s.ccGerenciaValue}>{cc.gerencia}</Text>
        </View>
      </View>

      {/* Main table: 2 columns simulating rowspan */}
      <View style={{ borderWidth: BW, borderColor: BC, flexDirection: 'row' as const }}>
        {/* COL 1 — CC name (rowspan: fills entire block height) */}
        <View style={{
          width: COL1_W,
          borderRightWidth: BW,
          borderRightColor: BC,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 6,
        }}>
          <Text style={s.ccNameText}>{ccLabel}</Text>
        </View>

        {/* COL 2-4 — Right side with all rows */}
        <View style={{ width: '70%' }}>
          {/* FINAL DE SEMANA */}
          <HeaderRow3 title="FINAL DE SEMANA" />
          {cc.periodsWeekend.length > 0 ? cc.periodsWeekend.map((p, i) => (
            <DataCell3 key={`we-${i}`} label={p.label} qtd={p.quantidade} valor={p.valor} />
          )) : (
            <RightRow>
              <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
                <Text style={{ ...s.textCenter, color: '#888888' }}>Nenhum registro</Text>
              </View>
            </RightRow>
          )}
          <SubtotalRow3 label="SUBTOTAL F.S" qtd={weekendQtd} valor={weekendVal} />

          {/* DIA ÚTIL SEMANA */}
          <HeaderRow3 title="DIA ÚTIL SEMANA" />
          {cc.periodsWeekday.length > 0 ? cc.periodsWeekday.map((p, i) => (
            <DataCell3 key={`wd-${i}`} label={p.label} qtd={p.quantidade} valor={p.valor} />
          )) : (
            <RightRow>
              <View style={{ width: '100%', justifyContent: 'center', alignItems: 'center', padding: 4 }}>
                <Text style={{ ...s.textCenter, color: '#888888' }}>Nenhum registro</Text>
              </View>
            </RightRow>
          )}
          <SubtotalRow3 label="SUBTOTAL D.S" qtd={weekdayQtd} valor={weekdayVal} isLast />
        </View>
      </View>
    </View>
  );
}

// =====================================================
// MAIN DOCUMENT
// =====================================================

export const CompiladoDiariasPDF = ({
  centros,
  empresaGroups,
  ano,
  sequencia,
  logoUrl,
  logoMap,
  totalGeralQuantidade,
  totalGeralValor,
  assinaturas,
}: CompiladoDiariasPDFProps) => {
  const groups = empresaGroups && empresaGroups.length > 0 ? empresaGroups : null;

  const HeaderBlock = () => (
    <View style={s.headerTable} fixed>
      <View style={[s.headerCol1, s.headerCol2, { width: '80%' }]}>
        <Text style={s.headerTitle}>{`RELATÓRIO DE DIÁRIAS ${ano}`}</Text>
      </View>
      <View style={s.headerCol3}>
        <View style={s.seqSubTable}>
          <View style={s.seqLabelRow}>
            <Text style={s.seqLabel}>Nº SEQUÊNCIA</Text>
          </View>
          <View style={s.seqValueRow}>
            <Text style={s.seqValue}>{sequencia}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const FooterBlock = () => (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>Relatório de Diárias - {ano}</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    </View>
  );

  const TotalGeralBlock = () => (
    <View wrap={false} style={s.totalBlock}>
      <View style={s.totalTitleRow}>
        <Text style={s.totalTitleText}>TOTAL GERAL</Text>
      </View>
      <View style={s.totalHeaderRow}>
        <View style={s.totalCellBorder}><Text style={s.textHeaderBold}>QUANTIDADE</Text></View>
        <View style={s.totalCell}><Text style={s.textHeaderBold}>VALOR</Text></View>
      </View>
      <View style={s.totalDataRow}>
        <View style={s.totalCellBorder}><Text style={s.totalValue}>{totalGeralQuantidade}</Text></View>
        <View style={s.totalCell}><Text style={s.totalValue}>{formatBRL(totalGeralValor)}</Text></View>
      </View>
    </View>
  );

  // If we have empresa groups, render each empresa on its own page
  if (groups) {
    return (
      <Document>
        {groups.map((eg, egIdx) => (
          <Page key={egIdx} size="A4" style={s.page}>
            <HeaderBlock />

            {/* Empresa header with logo */}
            <View style={{
              padding: 6,
              borderWidth: 1,
              borderColor: '#000000',
              borderStyle: 'solid' as const,
              flexDirection: 'row' as const,
              alignItems: 'center' as const,
              marginTop: 4,
            }}>
              {(logoMap?.[eg.empresaNome] || logoUrl) && (
                <Image
                  src={logoMap?.[eg.empresaNome] || logoUrl!}
                  style={{ height: 28, maxWidth: 60, marginRight: 8, objectFit: 'contain' as any }}
                />
              )}
              <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#000000', textTransform: 'uppercase' as const }}>
                {eg.empresaNome}
              </Text>
            </View>

            {/* CC Blocks inside this empresa */}
            {eg.centros.map((cc, idx) => (
              <CentroCustoBlock key={idx} cc={cc} />
            ))}

            {/* Subtotal empresa */}
            <View wrap={false} style={{
              borderWidth: 1.5,
              borderColor: '#000000',
              borderStyle: 'solid' as const,
              marginTop: 4,
              marginBottom: 4,
            }}>
              <View style={{
                flexDirection: 'row' as const,
                backgroundColor: '#e5e5e5',
              }}>
                <View style={{ width: '50%', padding: 6, borderRightWidth: 1, borderRightColor: '#000000' }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const }}>
                    SUBTOTAL — {eg.empresaNome} (Qtd: {eg.totalQuantidade})
                  </Text>
                </View>
                <View style={{ width: '50%', padding: 6, alignItems: 'flex-end' as const }}>
                  <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#dc2626' }}>
                    {formatBRL(eg.totalValor)}
                  </Text>
                </View>
              </View>
            </View>

            {/* Total Geral and signatures on the last empresa page */}
            {egIdx === groups.length - 1 && (
              <>
                {assinaturas && assinaturas.length > 0 && (
                  <AssinaturaPDFBlock assinaturas={assinaturas} />
                )}
              </>
            )}

            <FooterBlock />
          </Page>
        ))}
      </Document>
    );
  }

  // Fallback: no empresa groups — single page
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <HeaderBlock />
        {centros.map((cc, idx) => (
          <CentroCustoBlock key={idx} cc={cc} />
        ))}
        {assinaturas && assinaturas.length > 0 && (
          <AssinaturaPDFBlock assinaturas={assinaturas} />
        )}
        <FooterBlock />
      </Page>
    </Document>
  );
};

// =====================================================
// BUILD DATA FUNCTION
// =====================================================

export function buildCompiladoData(
  relatorio: RelatorioFolhaItem[],
  centrosCusto: { id: string; codigo_centro_custo: string; nome_centro_custo: string; aprovador_diarias_id: string | null }[],
  gerentesMap: Record<string, string>,
  feriados: string[] = [],
  tipoRemessa?: 'remessa' | 'sem_remessa'
): { dados: CompiladoGerencia[]; centros: CentroCustoCompilado[]; empresaGroups: EmpresaCompiladoGroup[]; totalGeralQuantidade: number; totalGeralValor: number } {
  let confirmados = relatorio.filter(
    (r) => String(r.presenca_status) === 'true' && r.hora_entrada && r.hora_saida
  );

  // Filter by remessa type if specified
  if (tipoRemessa) {
    confirmados = confirmados.filter(item => {
      const hasMatricula = !!item.matricula_funcionario && item.matricula_funcionario !== '---' && String(item.matricula_funcionario).trim() !== '';
      return tipoRemessa === 'remessa' ? hasMatricula : !hasMatricula;
    });
  }

  const feriadosSet = new Set(feriados.map(f => f.substring(0, 10)));

  // Group by CC only — consolidate all solicitations for the same CC
  const ccMap = new Map<string, {
    ccId: string;
    codigo: string;
    nome: string;
    gerencia: string;
    empresaContagem: Map<string, number>;
    weekendDates: Map<string, { qtd: number; valor: number }>;
    weekdayDates: Map<string, { qtd: number; valor: number }>;
    totalQtd: number;
    totalValor: number;
  }>();

  confirmados.forEach((item) => {
    const cc = centrosCusto.find((c) => c.id === item.centro_custo_id);
    const gerenteId = cc?.aprovador_diarias_id || 'sem_gerente';
    const gerencia = gerenteId !== 'sem_gerente' ? (gerentesMap[gerenteId] || 'Não definido') : 'Sem Gerente';
    const ccLabel = cc?.codigo_centro_custo || item.codigo_centro_custo || '';
    const ccNome = cc?.nome_centro_custo || item.nome_centro_custo || '';
    const empresaNome = item.empresa_funcionario || 'Empresa não informada';
    const valorItem = Math.ceil(item.valor_diaria_aplicada || 0) + Math.ceil(item.valor_refeicao_aplicado || 0);

    const dataStr = item.data?.substring(0, 10) || '';
    const dataObj = new Date(dataStr + 'T12:00:00');
    const isDomingo = dataObj.getDay() === 0;
    const isSabado = dataObj.getDay() === 6;
    const isFeriado = feriadosSet.has(dataStr);
    const isFS = isDomingo || isSabado || isFeriado;

    const groupKey = item.centro_custo_id;

    if (!ccMap.has(groupKey)) {
      ccMap.set(groupKey, {
        ccId: groupKey,
        codigo: ccLabel,
        nome: ccNome,
        gerencia,
        empresaContagem: new Map(),
        weekendDates: new Map(),
        weekdayDates: new Map(),
        totalQtd: 0,
        totalValor: 0,
      });
    }
    const entry = ccMap.get(groupKey)!;
    entry.totalQtd += 1;
    entry.totalValor += valorItem;

    // Track empresa counts to determine predominant empresa per CC
    entry.empresaContagem.set(empresaNome, (entry.empresaContagem.get(empresaNome) || 0) + 1);

    const targetMap = isFS ? entry.weekendDates : entry.weekdayDates;
    const existing = targetMap.get(dataStr) || { qtd: 0, valor: 0 };
    existing.qtd += 1;
    existing.valor += valorItem;
    targetMap.set(dataStr, existing);
  });

  let totalGeralQuantidade = 0;
  let totalGeralValor = 0;

  const centros: CentroCustoCompilado[] = [];
  const ccEmpresaMap = new Map<string, string>();

  ccMap.forEach((entry) => {
    totalGeralQuantidade += entry.totalQtd;
    totalGeralValor += entry.totalValor;

    // Determine predominant empresa for this CC
    let empresaPredominante = 'Empresa não informada';
    let maxCount = 0;
    entry.empresaContagem.forEach((count, emp) => {
      if (count > maxCount) {
        maxCount = count;
        empresaPredominante = emp;
      }
    });
    ccEmpresaMap.set(entry.ccId, empresaPredominante);

    const weekendPeriods = groupDatesByPeriod(entry.weekendDates);
    const weekdayPeriods = groupDatesByPeriod(entry.weekdayDates);

    centros.push({
      centroCustoId: entry.ccId,
      codigoCentroCusto: entry.codigo,
      nomeCentroCusto: entry.nome,
      gerencia: entry.gerencia,
      periodsWeekend: weekendPeriods,
      periodsWeekday: weekdayPeriods,
      totalQuantidade: entry.totalQtd,
      totalValor: entry.totalValor,
    });
  });

  centros.sort((a, b) => a.codigoCentroCusto.localeCompare(b.codigoCentroCusto));

  // Build empresa groups
  const empresaGroupMap = new Map<string, EmpresaCompiladoGroup>();
  centros.forEach(cc => {
    const empNome = ccEmpresaMap.get(cc.centroCustoId) || 'Empresa não informada';
    if (!empresaGroupMap.has(empNome)) {
      empresaGroupMap.set(empNome, {
        empresaNome: empNome,
        centros: [],
        totalQuantidade: 0,
        totalValor: 0,
      });
    }
    const eg = empresaGroupMap.get(empNome)!;
    eg.centros.push(cc);
    eg.totalQuantidade += cc.totalQuantidade;
    eg.totalValor += cc.totalValor;
  });
  const empresaGroups = Array.from(empresaGroupMap.values()).sort((a, b) => a.empresaNome.localeCompare(b.empresaNome));

  // Build legacy dados
  const gerenteGroupMap = new Map<string, CompiladoGerencia>();
  centros.forEach(cc => {
    const key = cc.gerencia;
    if (!gerenteGroupMap.has(key)) {
      gerenteGroupMap.set(key, {
        gerenteNome: cc.gerencia,
        centrosCusto: [],
        totalQuantidade: 0,
        totalValor: 0,
      });
    }
    const g = gerenteGroupMap.get(key)!;
    const weekendQtd = cc.periodsWeekend.reduce((s, p) => s + p.quantidade, 0);
    const weekendVal = cc.periodsWeekend.reduce((s, p) => s + p.valor, 0);
    const weekdayQtd = cc.periodsWeekday.reduce((s, p) => s + p.quantidade, 0);
    const weekdayVal = cc.periodsWeekday.reduce((s, p) => s + p.valor, 0);

    g.centrosCusto.push({
      centroCusto: cc.codigoCentroCusto,
      quantidade: cc.totalQuantidade,
      valor: cc.totalValor,
      quantidadeDS: weekdayQtd,
      valorDS: weekdayVal,
      quantidadeFS: weekendQtd,
      valorFS: weekendVal,
    });
    g.totalQuantidade += cc.totalQuantidade;
    g.totalValor += cc.totalValor;
  });

  const dados = Array.from(gerenteGroupMap.values());
  dados.sort((a, b) => b.totalValor - a.totalValor);

  return { dados, centros, empresaGroups, totalGeralQuantidade, totalGeralValor };
}

function groupDatesByPeriod(dateMap: Map<string, { qtd: number; valor: number }>): PeriodoAgrupado[] {
  if (dateMap.size === 0) return [];

  const sorted = [...dateMap.entries()].sort(([a], [b]) => a.localeCompare(b));
  const ranges: { dates: string[]; qtd: number; valor: number }[] = [];

  let currentRange: { dates: string[]; qtd: number; valor: number } = {
    dates: [sorted[0][0]],
    qtd: sorted[0][1].qtd,
    valor: sorted[0][1].valor,
  };

  for (let i = 1; i < sorted.length; i++) {
    const [date, data] = sorted[i];
    const prevDate = currentRange.dates[currentRange.dates.length - 1];
    const diff = differenceInDays(parseISO(date), parseISO(prevDate));

    if (diff <= 2) {
      currentRange.dates.push(date);
      currentRange.qtd += data.qtd;
      currentRange.valor += data.valor;
    } else {
      ranges.push(currentRange);
      currentRange = { dates: [date], qtd: data.qtd, valor: data.valor };
    }
  }
  ranges.push(currentRange);

  return ranges.map(r => ({
    label: buildPeriodLabel(r.dates),
    quantidade: r.qtd,
    valor: r.valor,
  }));
}
