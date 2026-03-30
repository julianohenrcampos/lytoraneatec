import '@/lib/pdfFonts';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { diariaStyles as styles } from './DiariaReportStyles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { RelatorioFolhaItem, RelatorioFilters } from '@/types/diarias';


// =====================================================
// TYPES
// =====================================================

interface FuncionarioConsolidado {
  funcionario_id: string;
  nome_funcionario: string;
  codigo_centro_custo: string;
  nome_funcao: string;
  matricula: string;
  cpf: string;
  banco: string;
  agencia: string;
  conta: string;
  chave_pix: string;
  total_dias: number;
  dias_uteis: number;
  dias_fds: number;
  dias_feriados: number;
  valor_total: number;
  valor_refeicao: number;
  valor_diaria_integral: number;
  valor_meia_diaria: number;
}

interface CentroCustoInfo {
  id: string;
  codigo_centro_custo: string;
  nome_centro_custo: string;
  aprovador_diarias_id: string | null;
  diretoria_id: string | null;
}

interface GerenteInfo {
  id: string;
  nome_completo: string;
}

interface DiretorInfo {
  diretoria_id: string;
  diretor_nome: string;
}

export interface RelatorioDiariasPDFConsolidadoProps {
  relatorio: RelatorioFolhaItem[];
  filtros: RelatorioFilters;
  feriados?: string[];
  logoUrl?: string;
  centrosCustoInfo: CentroCustoInfo[];
  gerentesMap: Record<string, string>; // gerente_id → nome
  diretoresMap: Record<string, string>; // diretoria_id → director name
}

// =====================================================
// HELPERS
// =====================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString + 'T12:00:00');
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return dateString;
  }
}

function formatNameTwoLines(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length <= 2) return name;
  const mid = Math.ceil(words.length / 2);
  return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ');
}

function formatCPF(cpf: string): string {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
}

function formatFuncaoTwoLines(funcao: string): string {
  const words = funcao.trim().split(/\s+/);
  if (words.length <= 1) return funcao;
  const mid = Math.ceil(words.length / 2);
  return words.slice(0, mid).join(' ') + '\n' + words.slice(mid).join(' ');
}

function formatPixTwoLines(pix: string): string {
  if (!pix || pix === '-') return pix;
  const atIndex = pix.indexOf('@');
  if (atIndex > 0) return pix.slice(0, atIndex) + '\n@' + pix.slice(atIndex + 1);
  return pix;
}

function consolidarFuncionarios(
  registros: RelatorioFolhaItem[],
  feriadosSet: Set<string>
): FuncionarioConsolidado[] {
  const funcionariosMap = new Map<string, FuncionarioConsolidado>();

  registros.forEach(item => {
    if (String(item.presenca_status) !== 'true' || !item.hora_entrada || !item.hora_saida) return;

    const existing = funcionariosMap.get(item.funcionario_id);
    const data = new Date(item.data + 'T12:00:00');
    const diaSemana = data.getDay();
    const isFds = diaSemana === 0 || diaSemana === 6;
    const isFeriado = feriadosSet.has(item.data);

    const valor = Math.ceil(item.valor_diaria_aplicada || 0);
    const tipo = item.tipo_diaria;
    let integralAdd = 0;
    let meiaAdd = 0;
    if (tipo === 'completa') integralAdd = valor;
    else if (tipo === 'meia') meiaAdd = valor;
    else if (tipo === 'uma_e_meia') { integralAdd = Math.ceil(valor * (2/3)); meiaAdd = Math.ceil(valor * (1/3)); }

    if (existing) {
      existing.total_dias += 1;
      existing.valor_total += valor;
      existing.valor_refeicao += Math.ceil(item.valor_refeicao_aplicado || 0);
      existing.valor_diaria_integral += integralAdd;
      existing.valor_meia_diaria += meiaAdd;
      if (isFeriado) existing.dias_feriados += 1;
      else if (isFds) existing.dias_fds += 1;
      else existing.dias_uteis += 1;
    } else {
      funcionariosMap.set(item.funcionario_id, {
        funcionario_id: item.funcionario_id,
        nome_funcionario: item.nome_funcionario,
        codigo_centro_custo: item.codigo_centro_custo || '-',
        nome_funcao: item.nome_funcao || '-',
        matricula: item.matricula_funcionario || '-',
        cpf: item.cpf_funcionario ? formatCPF(item.cpf_funcionario) : '-',
        banco: item.banco_funcionario || '-',
        agencia: item.agencia_funcionario || '-',
        conta: item.conta_funcionario || '-',
        chave_pix: item.pix_funcionario || '-',
        total_dias: 1,
        dias_uteis: !isFds && !isFeriado ? 1 : 0,
        dias_fds: isFds && !isFeriado ? 1 : 0,
        dias_feriados: isFeriado ? 1 : 0,
        valor_total: valor,
        valor_refeicao: Math.ceil(item.valor_refeicao_aplicado || 0),
        valor_diaria_integral: integralAdd,
        valor_meia_diaria: meiaAdd,
      });
    }
  });

  return Array.from(funcionariosMap.values()).sort((a, b) =>
    a.nome_funcionario.localeCompare(b.nome_funcionario)
  );
}

function calcularTotaisDias(
  registros: RelatorioFolhaItem[],
  feriadosSet: Set<string>
): { diasUteis: number; diasFds: number; diasFeriados: number } {
  const datasUnicas = new Set<string>();
  let diasUteis = 0, diasFds = 0, diasFeriados = 0;

  registros.forEach(item => {
    if (String(item.presenca_status) !== 'true' || !item.hora_entrada || !item.hora_saida) return;
    if (!datasUnicas.has(item.data)) {
      datasUnicas.add(item.data);
      const data = new Date(item.data + 'T12:00:00');
      const diaSemana = data.getDay();
      const isFds = diaSemana === 0 || diaSemana === 6;
      const isFeriado = feriadosSet.has(item.data);
      if (isFeriado) diasFeriados += 1;
      else if (isFds) diasFds += 1;
      else diasUteis += 1;
    }
  });

  return { diasUteis, diasFds, diasFeriados };
}

function calcTotaisFromConsolidados(funcs: FuncionarioConsolidado[]) {
  const subtotalIntegral = funcs.reduce((acc, f) => acc + f.valor_diaria_integral, 0);
  const subtotalMeia = funcs.reduce((acc, f) => acc + f.valor_meia_diaria, 0);
  const valorRefeicoes = funcs.reduce((acc, f) => acc + f.valor_refeicao, 0);
  const totalDiarias = funcs.reduce((acc, f) => acc + f.total_dias, 0);
  const valorTotal = subtotalIntegral + subtotalMeia + valorRefeicoes;
  return { subtotalIntegral, subtotalMeia, valorRefeicoes, totalDiarias, valorTotal };
}

// =====================================================
// GROUPING LOGIC
// =====================================================

interface CCGroup {
  cc_id: string;
  codigo: string;
  nome: string;
  registros: RelatorioFolhaItem[];
}

interface VinculoGroup {
  tipo: 'remessa' | 'sem_remessa';
  label: string;
  centrosCusto: CCGroup[];
  registros: RelatorioFolhaItem[];
}

interface GerenteGroup {
  gerente_id: string;
  gerente_nome: string;
  vinculos: VinculoGroup[];
  registros: RelatorioFolhaItem[];
}

interface EmpresaConsolidadoGroup {
  empresa_id: string;
  empresa_nome: string;
  gerentes: GerenteGroup[];
  registros: RelatorioFolhaItem[];
}

function buildHierarchy(
  relatorio: RelatorioFolhaItem[],
  centrosCustoInfo: CentroCustoInfo[],
  gerentesMap: Record<string, string>
): EmpresaConsolidadoGroup[] {
  const ccMap = new Map<string, CentroCustoInfo>();
  centrosCustoInfo.forEach(cc => ccMap.set(cc.id, cc));

  // Group by empresa
  const empresaMap = new Map<string, EmpresaConsolidadoGroup>();

  relatorio.forEach(item => {
    const empresaId = item.empresa_id || 'sem-empresa';
    const empresaNome = item.empresa_funcionario || 'Empresa não informada';

    if (!empresaMap.has(empresaId)) {
      empresaMap.set(empresaId, { empresa_id: empresaId, empresa_nome: empresaNome, gerentes: [], registros: [] });
    }
    empresaMap.get(empresaId)!.registros.push(item);
  });

  const result: EmpresaConsolidadoGroup[] = [];

  for (const empresa of empresaMap.values()) {
    // Group by gerente
    const gerenteMap = new Map<string, { registros: RelatorioFolhaItem[] }>();

    empresa.registros.forEach(item => {
      const cc = ccMap.get(item.centro_custo_id);
      const gerenteId = cc?.aprovador_diarias_id || 'sem-gerente';
      if (!gerenteMap.has(gerenteId)) gerenteMap.set(gerenteId, { registros: [] });
      gerenteMap.get(gerenteId)!.registros.push(item);
    });

    empresa.gerentes = Array.from(gerenteMap.entries()).map(([gerenteId, g]) => {
      const gerenteNome = gerentesMap[gerenteId] || 'Gerente não informado';

      // Group by vínculo
      const remessa = g.registros.filter(r => !!r.matricula_funcionario);
      const semRemessa = g.registros.filter(r => !r.matricula_funcionario);

      const vinculos: VinculoGroup[] = [];

      for (const [tipo, regs, label] of [
        ['remessa', remessa, 'REMESSA'] as const,
        ['sem_remessa', semRemessa, 'SEM REMESSA'] as const,
      ]) {
        if (regs.length === 0) continue;

        // Group by CC
        const ccGroupMap = new Map<string, CCGroup>();
        regs.forEach(r => {
          const ccInfo = ccMap.get(r.centro_custo_id);
          const ccId = r.centro_custo_id || 'sem-cc';
          if (!ccGroupMap.has(ccId)) {
            ccGroupMap.set(ccId, {
              cc_id: ccId,
              codigo: ccInfo?.codigo_centro_custo || r.codigo_centro_custo || '-',
              nome: ccInfo?.nome_centro_custo || r.nome_centro_custo || '-',
              registros: [],
            });
          }
          ccGroupMap.get(ccId)!.registros.push(r);
        });

        vinculos.push({
          tipo,
          label,
          centrosCusto: Array.from(ccGroupMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo)),
          registros: regs,
        });
      }

      return {
        gerente_id: gerenteId,
        gerente_nome: gerenteNome,
        vinculos,
        registros: g.registros,
      };
    }).sort((a, b) => a.gerente_nome.localeCompare(b.gerente_nome));

    result.push(empresa);
  }

  return result.sort((a, b) => a.empresa_nome.localeCompare(b.empresa_nome));
}

// =====================================================
// FOOTER
// =====================================================

function FooterContent() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>Sistema LYTEC – Gestão de Diárias</Text>
      <Text style={styles.footerText}>
        Gerado em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
      </Text>
      <Text
        style={styles.footerPage}
        render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`}
      />
    </View>
  );
}

// =====================================================
// COVER SHEET (Folha de Rosto)
// =====================================================

function CoverSheet({
  empresaNome,
  gerenteNome,
  tipoVinculoLabel,
  centrosCusto,
  filtros,
  feriadosSet,
  registros,
  logoUrl,
  diretorNome,
}: {
  empresaNome: string;
  gerenteNome: string;
  tipoVinculoLabel: string;
  centrosCusto: CCGroup[];
  filtros: RelatorioFilters;
  feriadosSet: Set<string>;
  registros: RelatorioFolhaItem[];
  logoUrl?: string;
  diretorNome?: string;
}) {
  const funcionariosConsolidados = consolidarFuncionarios(registros, feriadosSet);
  const totaisDias = calcularTotaisDias(registros, feriadosSet);
  const { subtotalIntegral, subtotalMeia, valorRefeicoes, totalDiarias, valorTotal } = calcTotaisFromConsolidados(funcionariosConsolidados);

  const ccLabels = centrosCusto.map(cc => cc.codigo).join(' | ');
  const periodoLabel = filtros.data_inicio && filtros.data_fim
    ? filtros.data_inicio === filtros.data_fim
      ? formatDate(filtros.data_inicio)
      : `${formatDate(filtros.data_inicio)} à ${formatDate(filtros.data_fim)}`
    : 'Período não definido';

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <View style={styles.headerContainer}>
        {logoUrl && <Image src={logoUrl} style={styles.logo} />}
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>RELATÓRIO DE DIÁRIAS EXECUTADAS</Text>
          <Text style={styles.headerSubtitle}>{empresaNome}</Text>
          <Text style={styles.headerSubtitle}>Período: {periodoLabel}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { borderBottomWidth: 0 }]}>INFORMAÇÕES GERAIS</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Empresa</Text>
            <Text style={styles.infoValueBold}>{empresaNome}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Centro(s) de Custo</Text>
            <Text style={styles.infoValue}>{ccLabels}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Período</Text>
            <Text style={styles.infoValue}>{periodoLabel}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Gerente Regional</Text>
            <Text style={styles.infoValueBold}>{gerenteNome}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Tipo de Vínculo</Text>
            <Text style={styles.infoValueBold}>{tipoVinculoLabel}</Text>
          </View>
        </View>
      </View>

      <View style={styles.statsPanel}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totaisDias.diasUteis}</Text>
          <Text style={styles.statLabel}>Dias Úteis</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totaisDias.diasFds}</Text>
          <Text style={styles.statLabel}>Finais de Semana</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totaisDias.diasFeriados}</Text>
          <Text style={styles.statLabel}>Feriados</Text>
        </View>
        <View style={styles.statBoxHighlight}>
          <Text style={styles.statValue}>{totalDiarias}</Text>
          <Text style={styles.statLabel}>Total Diárias</Text>
        </View>
      </View>

      <View style={[styles.totalsSection, { marginTop: 8, marginBottom: 8 }]}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal Diárias</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotalIntegral)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal ½ Diárias</Text>
          <Text style={styles.totalValue}>{formatCurrency(subtotalMeia)}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Subtotal Refeições</Text>
          <Text style={styles.totalValue}>{formatCurrency(valorRefeicoes)}</Text>
        </View>
        <View style={styles.totalRowMain}>
          <Text style={styles.totalLabelMain}>TOTAL A PAGAR</Text>
          <Text style={styles.totalValueMain}>{formatCurrency(valorTotal)}</Text>
        </View>
      </View>

      {/* Aprovação */}
      <View style={{ marginTop: 20, paddingTop: 8 }} wrap={false}>
        <Text style={[styles.sectionTitle, { borderBottomWidth: 0 }]}>APROVAÇÃO</Text>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 20 }}>
          <View style={{ alignItems: 'center', width: '40%' }}>
            <View style={{ borderTopWidth: 1, borderTopColor: '#374151', width: '100%', marginTop: 30, marginBottom: 4 }} />
            <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#374151' }}>Gerente Regional</Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>{gerenteNome}</Text>
          </View>
          <View style={{ alignItems: 'center', width: '40%' }}>
            <View style={{ borderTopWidth: 1, borderTopColor: '#374151', width: '100%', marginTop: 30, marginBottom: 4 }} />
            <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#374151' }}>Diretor</Text>
            <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>{diretorNome || '___________________________'}</Text>
          </View>
        </View>
      </View>

      <FooterContent />
    </Page>
  );
}

// =====================================================
// EMPLOYEE TABLE PAGE (per CC)
// =====================================================

function FuncionariosPage({
  empresaNome,
  ccCodigo,
  ccNome,
  registros,
  feriadosSet,
  filtros,
}: {
  empresaNome: string;
  ccCodigo: string;
  ccNome: string;
  registros: RelatorioFolhaItem[];
  feriadosSet: Set<string>;
  filtros: RelatorioFilters;
}) {
  const funcionariosConsolidados = consolidarFuncionarios(registros, feriadosSet);
  const periodoLabel = filtros.data_inicio && filtros.data_fim
    ? `${formatDate(filtros.data_inicio)} à ${formatDate(filtros.data_fim)}`
    : '';

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {empresaNome} — FUNCIONÁRIOS CONSOLIDADOS ({funcionariosConsolidados.length})
        </Text>
        <Text style={{ fontSize: 8, color: '#6b7280', marginBottom: 6 }}>
          CENTRO DE CUSTO: {ccCodigo} - {ccNome} | PERÍODO: {periodoLabel}
        </Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, { flex: 1.8, textAlign: 'left' }]}>Funcionário</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'left' }]}>C.Custo</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.0, textAlign: 'left' }]}>Função</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'left' }]}>Matrícula</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'left' }]}>CPF</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'left' }]}>Banco</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.6, textAlign: 'right' }]}>Agência</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.7, textAlign: 'left' }]}>Conta</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'left' }]}>Chave Pix</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.4, textAlign: 'center' }]}>Dias</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>V. Diária</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>V. ½ Diária</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>V. Refeição</Text>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'right' }]}>Total</Text>
          </View>
          {funcionariosConsolidados.map((func, idx) => (
            <View
              key={func.funcionario_id}
              style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}
              wrap={false}
            >
              <Text style={[styles.tableCellBold, { flex: 1.8, fontSize: 6, textAlign: 'left', lineHeight: 1.2 }]}>{formatNameTwoLines(func.nome_funcionario)}</Text>
              <Text style={[styles.tableCell, { flex: 0.4, fontSize: 6.5, textAlign: 'left' }]}>{func.codigo_centro_custo}</Text>
              <Text style={[styles.tableCell, { flex: 1.0, fontSize: 6, textAlign: 'left', lineHeight: 1.2 }]}>{formatFuncaoTwoLines(func.nome_funcao)}</Text>
              <Text style={[styles.tableCell, { flex: 0.8, fontSize: 6.5, textAlign: 'left' }]}>{func.matricula}</Text>
              <Text style={[styles.tableCell, { flex: 1.2, fontSize: 6.5, textAlign: 'left' }]}>{func.cpf}</Text>
              <Text style={[styles.tableCell, { flex: 0.7, fontSize: 5.5, textAlign: 'left' }]}>{func.banco}</Text>
              <Text style={[styles.tableCell, { flex: 0.6, fontSize: 6.5, textAlign: 'right', paddingRight: 4 }]}>{func.agencia}</Text>
              <Text style={[styles.tableCell, { flex: 0.7, fontSize: 6.5, textAlign: 'left', paddingLeft: 4 }]}>{func.conta}</Text>
              <Text style={[styles.tableCell, { flex: 1.2, fontSize: 6.5, textAlign: 'left', lineHeight: 1.2 }]}>{formatPixTwoLines(func.chave_pix)}</Text>
              <Text style={[styles.tableCellBold, { flex: 0.4, textAlign: 'center', fontSize: 6.5 }]}>{func.total_dias}</Text>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', fontSize: 6.5 }]}>{formatCurrency(func.valor_diaria_integral)}</Text>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', fontSize: 6.5 }]}>{formatCurrency(func.valor_meia_diaria)}</Text>
              <Text style={[styles.tableCell, { flex: 0.8, textAlign: 'right', fontSize: 6.5 }]}>{formatCurrency(func.valor_refeicao)}</Text>
              <Text style={[styles.tableCellBold, { flex: 0.8, textAlign: 'right', fontSize: 6.5 }]}>{formatCurrency(func.valor_diaria_integral + func.valor_meia_diaria + func.valor_refeicao)}</Text>
            </View>
          ))}
        </View>
      </View>
      <FooterContent />
    </Page>
  );
}

// =====================================================
// FINANCIAL SUMMARY PAGE
// =====================================================

interface SummaryRow {
  nivel: string;
  label: string;
  valor: number;
  isBold?: boolean;
  isTotal?: boolean;
  isSeparator?: boolean;
}

function ResumoFinanceiroPage({
  empresas,
  feriadosSet,
}: {
  empresas: EmpresaConsolidadoGroup[];
  feriadosSet: Set<string>;
}) {
  const rows: SummaryRow[] = [];
  let totalGeral = 0;

  // By empresa
  rows.push({ nivel: '', label: 'POR EMPRESA', valor: 0, isSeparator: true });
  empresas.forEach(emp => {
    const funcs = consolidarFuncionarios(emp.registros, feriadosSet);
    const { valorTotal } = calcTotaisFromConsolidados(funcs);
    totalGeral += valorTotal;
    rows.push({ nivel: 'EMPRESA', label: emp.empresa_nome, valor: valorTotal });
  });

  // By gerente
  rows.push({ nivel: '', label: 'POR GERENTE REGIONAL', valor: 0, isSeparator: true });
  const gerenteAggMap = new Map<string, { nome: string; valor: number }>();
  empresas.forEach(emp => {
    emp.gerentes.forEach(g => {
      const funcs = consolidarFuncionarios(g.registros, feriadosSet);
      const { valorTotal } = calcTotaisFromConsolidados(funcs);
      const existing = gerenteAggMap.get(g.gerente_id);
      if (existing) existing.valor += valorTotal;
      else gerenteAggMap.set(g.gerente_id, { nome: g.gerente_nome, valor: valorTotal });
    });
  });
  Array.from(gerenteAggMap.values()).sort((a, b) => a.nome.localeCompare(b.nome)).forEach(g => {
    rows.push({ nivel: 'GERENTE', label: g.nome, valor: g.valor });
  });

  // By CC
  rows.push({ nivel: '', label: 'POR CENTRO DE CUSTO', valor: 0, isSeparator: true });
  const ccAggMap = new Map<string, { codigo: string; nome: string; valor: number }>();
  empresas.forEach(emp => {
    emp.gerentes.forEach(g => {
      g.vinculos.forEach(v => {
        v.centrosCusto.forEach(cc => {
          const funcs = consolidarFuncionarios(cc.registros, feriadosSet);
          const { valorTotal } = calcTotaisFromConsolidados(funcs);
          const existing = ccAggMap.get(cc.cc_id);
          if (existing) existing.valor += valorTotal;
          else ccAggMap.set(cc.cc_id, { codigo: cc.codigo, nome: cc.nome, valor: valorTotal });
        });
      });
    });
  });
  Array.from(ccAggMap.values()).sort((a, b) => a.codigo.localeCompare(b.codigo)).forEach(cc => {
    rows.push({ nivel: 'CC', label: `${cc.codigo} - ${cc.nome}`, valor: cc.valor });
  });

  // Total geral
  rows.push({ nivel: '', label: 'TOTAL GERAL', valor: totalGeral, isTotal: true });

  return (
    <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>RESUMO FINANCEIRO CONSOLIDADO</Text>
        <View style={styles.table}>
          <View style={styles.tableHeader} fixed>
            <Text style={[styles.tableHeaderCell, { flex: 0.8, textAlign: 'left' }]}>Nível</Text>
            <Text style={[styles.tableHeaderCell, { flex: 3, textAlign: 'left' }]}>Descrição</Text>
            <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: 'right' }]}>Total</Text>
          </View>
          {rows.map((row, idx) => {
            if (row.isSeparator) {
              return (
                <View key={idx} style={{ flexDirection: 'row', backgroundColor: '#e5e7eb', paddingVertical: 4, paddingHorizontal: 4 }}>
                  <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#1e3a5f' }}>{row.label}</Text>
                </View>
              );
            }
            if (row.isTotal) {
              return (
                <View key={idx} style={{ flexDirection: 'row', backgroundColor: '#1e3a5f', paddingVertical: 6, paddingHorizontal: 4 }}>
                  <Text style={{ flex: 3.8, fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#ffffff' }}>{row.label}</Text>
                  <Text style={{ flex: 1.2, fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#ffffff', textAlign: 'right' }}>{formatCurrency(row.valor)}</Text>
                </View>
              );
            }
            return (
              <View key={idx} style={idx % 2 === 0 ? styles.tableRow : styles.tableRowAlternate}>
                <Text style={[styles.tableCell, { flex: 0.8, fontSize: 7, textAlign: 'left' }]}>{row.nivel}</Text>
                <Text style={[styles.tableCell, { flex: 3, fontSize: 7, textAlign: 'left' }]}>{row.label}</Text>
                <Text style={[styles.tableCellBold, { flex: 1.2, fontSize: 7, textAlign: 'right' }]}>{formatCurrency(row.valor)}</Text>
              </View>
            );
          })}
        </View>
      </View>
      <FooterContent />
    </Page>
  );
}

// =====================================================
// MAIN DOCUMENT
// =====================================================

export const RelatorioDiariasPDFConsolidado = ({
  relatorio,
  filtros,
  feriados = [],
  logoUrl,
  centrosCustoInfo,
  gerentesMap,
  diretoresMap,
}: RelatorioDiariasPDFConsolidadoProps) => {
  const feriadosSet = new Set(feriados);

  // Build CC → diretoria mapping
  const ccDiretoriaMap = new Map<string, string>();
  centrosCustoInfo.forEach(cc => {
    if (cc.diretoria_id) ccDiretoriaMap.set(cc.id, cc.diretoria_id);
  });

  const empresas = buildHierarchy(relatorio, centrosCustoInfo, gerentesMap);

  // Resolve director name for a set of CCs
  const resolveDiretorNome = (ccGroups: CCGroup[]): string | undefined => {
    for (const cc of ccGroups) {
      const diretoriaId = ccDiretoriaMap.get(cc.cc_id);
      if (diretoriaId && diretoresMap[diretoriaId]) {
        return diretoresMap[diretoriaId];
      }
    }
    return undefined;
  };

  return (
    <Document>
      {empresas.map(empresa =>
        empresa.gerentes.map(gerente =>
          gerente.vinculos.map(vinculo => {
            const diretorNome = resolveDiretorNome(vinculo.centrosCusto);
            return [
              <CoverSheet
                key={`cover-${empresa.empresa_id}-${gerente.gerente_id}-${vinculo.tipo}`}
                empresaNome={empresa.empresa_nome}
                gerenteNome={gerente.gerente_nome}
                tipoVinculoLabel={vinculo.label}
                centrosCusto={vinculo.centrosCusto}
                filtros={filtros}
                feriadosSet={feriadosSet}
                registros={vinculo.registros}
                logoUrl={logoUrl}
                diretorNome={diretorNome}
              />,
              ...vinculo.centrosCusto.map(cc => (
                <FuncionariosPage
                  key={`funcs-${empresa.empresa_id}-${gerente.gerente_id}-${vinculo.tipo}-${cc.cc_id}`}
                  empresaNome={empresa.empresa_nome}
                  ccCodigo={cc.codigo}
                  ccNome={cc.nome}
                  registros={cc.registros}
                  feriadosSet={feriadosSet}
                  filtros={filtros}
                />
              )),
            ];
          })
        )
      )}
      <ResumoFinanceiroPage empresas={empresas} feriadosSet={feriadosSet} />
    </Document>
  );
};
