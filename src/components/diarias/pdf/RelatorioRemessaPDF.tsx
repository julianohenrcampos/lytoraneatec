import '@/lib/pdfFonts';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RelatorioFolhaItem } from '@/types/diarias';
import { isRelatorioItemConfirmado, isRelatorioItemRemessa } from '@/services/diarias/relatorioMetrics';

// =====================================================
// Types
// =====================================================

interface FuncionarioRemessa {
  funcionario_id: string;
  nome: string;
  cpf: string;
  banco: string;
  agencia: string;
  conta: string;
  chave_pix: string;
  matricula: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  total_dias: number;
  valor_diaria_total: number;
  valor_refeicao_total: number;
  valor_total: number;
  is_remessa: boolean;
}

interface EmpresaGroup {
  empresa_id: string;
  empresa_nome: string;
  funcionarios: FuncionarioRemessa[];
  total_geral: number;
}

export interface RelatorioRemessaPDFProps {
  relatorio: RelatorioFolhaItem[];
  periodoLabel: string;
  logoUrl?: string;
  logoMap?: Record<string, string>;
  tipoRemessa: 'remessa' | 'sem_remessa';
  hideSensitiveFields?: boolean;
}

// =====================================================
// Styles
// =====================================================

const BORDER = { borderStyle: 'solid' as const, borderWidth: 0.5, borderColor: '#000000' };

const s = StyleSheet.create({
  page: {
    paddingTop: 20,
    paddingBottom: 40,
    paddingHorizontal: 20,
    fontSize: 9,
    fontFamily: 'Roboto',
    backgroundColor: '#ffffff',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 6,
  },
  headerTitle: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 'bold' },
  headerSubtitle: { fontSize: 8, color: '#666666', marginTop: 2 },
  empresaHeader: {
    padding: 6,
    ...BORDER,
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  empresaLogo: { height: 28, maxWidth: 60, marginRight: 8, objectFit: 'contain' as any },
  empresaTitle: { fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold', textTransform: 'uppercase' as const, color: '#000000' },
  table: { ...BORDER, borderTopWidth: 0 },
  tableHeader: {
    flexDirection: 'row',
    minHeight: 20,
  },
  tableRow: {
    flexDirection: 'row',
    minHeight: 16,
  },
  tableRowAlt: {
    flexDirection: 'row',
    minHeight: 16,
    backgroundColor: '#fafafa',
  },
  textSmall: { fontSize: 7, fontFamily: 'Roboto' },
  textNormal: { fontSize: 8, fontFamily: 'Roboto' },
  textBold: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold' },
  textHeader: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 'bold', textAlign: 'center', color: '#000000' },
  textRight: { fontSize: 8, fontFamily: 'Roboto', textAlign: 'right' },
  totalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#000000',
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    minHeight: 22,
    backgroundColor: '#f2f2f2',
  },
  totalLabel: { fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold', padding: 4 },
  totalValue: { fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold', color: '#dc2626', textAlign: 'right', padding: 4 },
  grandTotalRow: {
    flexDirection: 'row',
    ...BORDER,
    borderWidth: 2,
    minHeight: 26,
    backgroundColor: '#f2f2f2',
    marginTop: 10,
  },
  grandTotalLabel: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 'bold', padding: 4 },
  grandTotalValue: { fontSize: 11, fontFamily: 'Roboto', fontWeight: 'bold', color: '#dc2626', textAlign: 'right', padding: 4 },
  footer: {
    position: 'absolute',
    bottom: 15,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    paddingTop: 3,
  },
  footerText: { fontSize: 6, color: '#999999' },
});

// Cell with full border on all 4 sides
const cell = (width: string) => ({
  width,
  padding: 2,
  justifyContent: 'center' as const,
  borderStyle: 'solid' as const,
  borderWidth: 0.5,
  borderColor: '#000000',
});

// Column widths — COM REMESSA
const COLS_REMESSA = {
  matricula: '9%',
  cc: '7%',
  nome: '27%',
  cpf: '13%',
  banco: '9%',
  agencia: '8%',
  conta: '12%',
  dias: '5%',
  total: '10%',
};

// Column widths — SEM REMESSA
const COLS_SEM_REMESSA = {
  matricula: '7%',
  cc: '7%',
  nome: '20%',
  cpf: '11%',
  banco: '8%',
  agencia: '6%',
  conta: '10%',
  pix: '11%',
  dias: '5%',
  total: '15%',
};

// =====================================================
// Helpers
// =====================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function buildEmpresaGroups(
  relatorio: RelatorioFolhaItem[],
  tipoRemessa: 'remessa' | 'sem_remessa'
): EmpresaGroup[] {
  const empresaMap = new Map<string, { nome: string; funcMap: Map<string, FuncionarioRemessa> }>();

  relatorio.forEach(item => {
    if (!isRelatorioItemConfirmado(item)) return;

    const isRemessa = isRelatorioItemRemessa(item);

    if (tipoRemessa === 'remessa' && !isRemessa) return;
    if (tipoRemessa === 'sem_remessa' && isRemessa) return;

    const empresaId = item.empresa_id || 'sem-empresa';
    const empresaNome = item.empresa_funcionario || 'Empresa não informada';

    if (!empresaMap.has(empresaId)) {
      empresaMap.set(empresaId, { nome: empresaNome, funcMap: new Map() });
    }

    const empresa = empresaMap.get(empresaId)!;
    const funcId = item.funcionario_id;
    const valorDiaria = Number(item.valor_diaria_aplicada || 0);
    const valorRefeicao = Number(item.valor_refeicao_aplicado || 0);

    if (empresa.funcMap.has(funcId)) {
      const f = empresa.funcMap.get(funcId)!;
      f.total_dias += 1;
      f.valor_diaria_total += valorDiaria;
      f.valor_refeicao_total += valorRefeicao;
      f.valor_total += valorDiaria + valorRefeicao;
    } else {
      empresa.funcMap.set(funcId, {
        funcionario_id: funcId,
        nome: item.nome_funcionario,
        cpf: item.cpf_funcionario ? formatCPF(item.cpf_funcionario) : '-',
        banco: item.banco_funcionario || '-',
        agencia: item.agencia_funcionario || '-',
        conta: item.conta_funcionario || '-',
        chave_pix: item.pix_funcionario || '-',
        matricula: item.matricula_funcionario || '-',
        codigo_centro_custo: item.codigo_centro_custo || '-',
        nome_centro_custo: item.nome_centro_custo || '-',
        total_dias: 1,
        valor_diaria_total: valorDiaria,
        valor_refeicao_total: valorRefeicao,
        valor_total: valorDiaria + valorRefeicao,
        is_remessa: isRemessa,
      });
    }
  });

  return Array.from(empresaMap.entries()).map(([id, emp]) => {
    const funcionarios = Array.from(emp.funcMap.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    return {
      empresa_id: id,
      empresa_nome: emp.nome,
      funcionarios,
      total_geral: funcionarios.reduce((acc, f) => acc + f.valor_total, 0),
    };
  }).filter(g => g.funcionarios.length > 0).sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome));
}

// =====================================================
// Component
// =====================================================

function EmpresaSection({ grupo, showPix, logoBase64, isFirst, hideSensitiveFields }: { grupo: EmpresaGroup; showPix: boolean; logoBase64?: string; isFirst?: boolean; hideSensitiveFields?: boolean }) {
  const cols = showPix ? COLS_SEM_REMESSA : COLS_REMESSA;

  return (
    <View style={{ marginBottom: 6 }} break={!isFirst}>
      <View style={s.empresaHeader}>
        {logoBase64 && <Image src={logoBase64} style={s.empresaLogo} />}
        <Text style={s.empresaTitle}>{grupo.empresa_nome}</Text>
      </View>
      <View style={s.table}>
        {/* Header */}
        <View style={s.tableHeader} fixed>
          <View style={cell(cols.matricula)}><Text style={s.textHeader}>MATRÍCULA</Text></View>
          <View style={cell(cols.cc)}><Text style={s.textHeader}>C.C</Text></View>
          <View style={cell(cols.nome)}><Text style={s.textHeader}>FUNCIONÁRIO</Text></View>
          <View style={cell(cols.cpf)}><Text style={s.textHeader}>{hideSensitiveFields ? 'CPF' : 'CPF'}</Text></View>
          <View style={cell(cols.banco)}><Text style={s.textHeader}>{hideSensitiveFields ? 'BANCO' : 'BANCO'}</Text></View>
          <View style={cell(cols.agencia)}><Text style={s.textHeader}>{hideSensitiveFields ? 'AGÊNCIA' : 'AGÊNCIA'}</Text></View>
          <View style={cell(cols.conta)}><Text style={s.textHeader}>{hideSensitiveFields ? 'CONTA' : 'CONTA'}</Text></View>
          {showPix && 'pix' in cols && <View style={cell((cols as any).pix)}><Text style={s.textHeader}>{hideSensitiveFields ? 'CHAVE PIX' : 'CHAVE PIX'}</Text></View>}
          <View style={cell(cols.dias)}><Text style={s.textHeader}>DIAS</Text></View>
          <View style={cell(cols.total)}><Text style={[s.textHeader, { textAlign: 'right' }]}>TOTAL (R$)</Text></View>
        </View>

        {/* Rows */}
        {grupo.funcionarios.map((func, idx) => (
          <View key={func.funcionario_id} style={idx % 2 === 0 ? s.tableRow : s.tableRowAlt} wrap={false}>
            <View style={cell(cols.matricula)}><Text style={[s.textSmall, { textAlign: 'center' }]}>{func.matricula || '-'}</Text></View>
            <View style={cell(cols.cc)}><Text style={[s.textSmall, { textAlign: 'center' }]}>{func.codigo_centro_custo}</Text></View>
            <View style={cell(cols.nome)}><Text style={[s.textNormal, { textTransform: 'uppercase' as const }]}>{func.nome}</Text></View>
            <View style={cell(cols.cpf)}><Text style={s.textSmall}>{hideSensitiveFields ? '***' : func.cpf}</Text></View>
            <View style={cell(cols.banco)}><Text style={s.textSmall}>{hideSensitiveFields ? '***' : func.banco}</Text></View>
            <View style={cell(cols.agencia)}><Text style={[s.textSmall, { textAlign: 'center' }]}>{hideSensitiveFields ? '***' : func.agencia}</Text></View>
            <View style={cell(cols.conta)}><Text style={s.textSmall}>{hideSensitiveFields ? '***' : func.conta}</Text></View>
            {showPix && 'pix' in cols && <View style={cell((cols as any).pix)}><Text style={s.textSmall}>{hideSensitiveFields ? '***' : func.chave_pix}</Text></View>}
            <View style={cell(cols.dias)}><Text style={[s.textNormal, { textAlign: 'center' }]}>{func.total_dias}</Text></View>
            <View style={cell(cols.total)}><Text style={s.textRight}>{formatCurrency(func.valor_total)}</Text></View>
          </View>
        ))}

        {/* Total */}
        <View style={s.totalRow} wrap={false}>
          <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 6 }}>
            <Text style={s.totalLabel}>TOTAL — {grupo.empresa_nome} ({grupo.funcionarios.length} funcionários)</Text>
          </View>
          <View style={{ width: cols.total, justifyContent: 'center', paddingRight: 6 }}>
            <Text style={s.totalValue}>{formatCurrency(grupo.total_geral)}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function buildCCSummary(grupos: EmpresaGroup[]): { codigo: string; nome: string; total: number }[] {
  const ccMap = new Map<string, { nome: string; total: number }>();
  grupos.forEach(g => {
    g.funcionarios.forEach(f => {
      const key = f.codigo_centro_custo || '-';
      if (ccMap.has(key)) {
        ccMap.get(key)!.total += f.valor_total;
      } else {
        ccMap.set(key, { nome: f.nome_centro_custo || '-', total: f.valor_total });
      }
    });
  });
  return Array.from(ccMap.entries())
    .map(([codigo, v]) => ({ codigo, nome: v.nome, total: v.total }))
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export function RelatorioRemessaPDFDocument({ relatorio, periodoLabel, logoUrl, logoMap, tipoRemessa, hideSensitiveFields }: RelatorioRemessaPDFProps) {
  const grupos = buildEmpresaGroups(relatorio, tipoRemessa);
  const totalGeral = grupos.reduce((acc, g) => acc + g.total_geral, 0);
  const showPix = tipoRemessa === 'sem_remessa';
  const tipoLabel = tipoRemessa === 'remessa' ? 'REMESSA' : 'SEM REMESSA';

  if (grupos.length === 0) {
    return (
      <Document>
        <Page size="A4" orientation="landscape" style={s.page}>
          <View style={s.headerRow} fixed>
            <Text style={s.headerTitle}>RELATÓRIO DE {tipoLabel} — Sem dados</Text>
          </View>
          <Text style={{ fontSize: 10, textAlign: 'center', marginTop: 40 }}>Nenhum funcionário encontrado para este tipo de relatório.</Text>
        </Page>
      </Document>
    );
  }

  const ccSummary = buildCCSummary(grupos);

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <View style={s.headerRow} fixed>
          <View>
            <Text style={s.headerTitle}>RELATÓRIO DE {tipoLabel}</Text>
            <Text style={s.headerSubtitle}>Período: {periodoLabel}</Text>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={s.headerTitle}>{tipoLabel} {periodoLabel.split(' a ')[0] || periodoLabel}</Text>
          </View>
        </View>

        {/* Empresa sections */}
        {grupos.map((grupo, idx) => (
          <EmpresaSection
            key={grupo.empresa_id}
            grupo={grupo}
            showPix={showPix}
            logoBase64={logoMap?.[grupo.empresa_nome] || logoUrl}
            isFirst={idx === 0}
            hideSensitiveFields={hideSensitiveFields}
          />
        ))}

        {/* Total Geral */}
        <View style={s.grandTotalRow} wrap={false}>
          <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 6 }}>
            <Text style={s.grandTotalLabel}>TOTAL GERAL</Text>
          </View>
          <View style={{ width: '20%', justifyContent: 'center', paddingRight: 6 }}>
            <Text style={s.grandTotalValue}>{formatCurrency(totalGeral)}</Text>
          </View>
        </View>

        {/* Resumo por Centro de Custo */}
        <View style={{ marginTop: 14 }} wrap={false}>
          <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold', marginBottom: 4 }}>RESUMO POR CENTRO DE CUSTO</Text>
          <View style={{ ...BORDER }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', minHeight: 20, backgroundColor: '#f2f2f2' }}>
              <View style={cell('15%')}><Text style={s.textHeader}>C.C</Text></View>
              <View style={cell('60%')}><Text style={s.textHeader}>CENTRO DE CUSTO</Text></View>
              <View style={cell('25%')}><Text style={[s.textHeader, { textAlign: 'right' }]}>TOTAL (R$)</Text></View>
            </View>
            {/* Rows */}
            {ccSummary.map((cc, idx) => (
              <View key={cc.codigo} style={{ flexDirection: 'row', minHeight: 16, backgroundColor: idx % 2 === 0 ? '#ffffff' : '#fafafa' }}>
                <View style={cell('15%')}><Text style={[s.textNormal, { textAlign: 'center', fontWeight: 'bold' }]}>{cc.codigo}</Text></View>
                <View style={cell('60%')}><Text style={s.textNormal}>{cc.nome}</Text></View>
                <View style={cell('25%')}><Text style={[s.textRight, { fontWeight: 'bold' }]}>{formatCurrency(cc.total)}</Text></View>
              </View>
            ))}
            {/* Total */}
            <View style={{ flexDirection: 'row', minHeight: 20, backgroundColor: '#f2f2f2', borderTopWidth: 1, borderTopColor: '#000000' }}>
              <View style={cell('75%')}><Text style={[s.textBold, { textAlign: 'right', paddingRight: 4 }]}>TOTAL</Text></View>
              <View style={cell('25%')}><Text style={[s.totalValue, { fontSize: 9 }]}>{formatCurrency(totalGeral)}</Text></View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>Sistema LYTEC – Gestão de Diárias</Text>
          <Text style={s.footerText}>Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</Text>
          <Text style={s.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
