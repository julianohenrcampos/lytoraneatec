import '@/lib/pdfFonts';
import { Document, Page, View, Text, Image } from '@react-pdf/renderer';
import { diariaStyles as styles } from './DiariaReportStyles';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calcularRangesDSFS } from '@/utils/diariasPeriodoUtils';
import type { RelatorioFolhaItem, PresencaResumo, RelatorioFilters } from '@/types/diarias';


interface FuncionarioConsolidado {
  funcionario_id: string;
  nome_funcionario: string;
  nome_funcao: string;
  codigo_centro_custo: string;
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

interface RelatorioDiariasPDFProps {
  relatorio: RelatorioFolhaItem[];
  resumo: PresencaResumo;
  filtros: RelatorioFilters;
  feriados?: string[];
  logoUrl?: string;
  engenheiroSolicitante?: string;
  gerenteRegional?: string;
}

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
  relatorio: RelatorioFolhaItem[],
  feriadosSet: Set<string>
): FuncionarioConsolidado[] {
  const funcionariosMap = new Map<string, FuncionarioConsolidado>();

  relatorio.forEach(item => {
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
        nome_funcao: item.nome_funcao || '-',
        codigo_centro_custo: item.codigo_centro_custo || '-',
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
  relatorio: RelatorioFolhaItem[],
  feriadosSet: Set<string>
): { diasUteis: number; diasFds: number; diasFeriados: number } {
  const datasUnicas = new Set<string>();
  let diasUteis = 0, diasFds = 0, diasFeriados = 0;

  relatorio.forEach(item => {
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

export const RelatorioDiariasPDF = ({
  relatorio, resumo, filtros, feriados = [], logoUrl, engenheiroSolicitante, gerenteRegional
}: RelatorioDiariasPDFProps) => {
  const feriadosSet = new Set(feriados);
  const funcionariosConsolidados = consolidarFuncionarios(relatorio, feriadosSet);
  const totaisDias = calcularTotaisDias(relatorio, feriadosSet);

  const subtotalIntegral = funcionariosConsolidados.reduce((acc, f) => acc + f.valor_diaria_integral, 0);
  const subtotalMeia = funcionariosConsolidados.reduce((acc, f) => acc + f.valor_meia_diaria, 0);
  const valorRefeicoes = funcionariosConsolidados.reduce((acc, f) => acc + f.valor_refeicao, 0);
  const valorTotal = subtotalIntegral + subtotalMeia + valorRefeicoes;
  const totalDiarias = funcionariosConsolidados.reduce((acc, f) => acc + f.total_dias, 0);

  const primeiroRegistro = relatorio[0];
  const centrosCustoUnicos = [...new Set(relatorio.map(r => r.codigo_centro_custo).filter(Boolean))];
  const centrosCustoLabel = centrosCustoUnicos.join(' | ') || 'Todos';

  const empresasUnicas = [...new Set(relatorio.map(r => r.empresa_funcionario).filter(Boolean))];
  const empresasLabel = empresasUnicas.length > 2
    ? `${empresasUnicas.slice(0, 2).join(', ')} e mais ${empresasUnicas.length - 2}`
    : empresasUnicas.join(', ') || 'Não informada';

  const numerosUnicos = [...new Set(relatorio.map(r => r.numero_solicitacao).filter(Boolean))];
  const numerosLabel = numerosUnicos.map(n => n.split('-').pop()).join(' | ');

  const dataInicio = filtros.data_inicio || primeiroRegistro?.solicitacao_data_inicio;
  const dataFim = filtros.data_fim || primeiroRegistro?.solicitacao_data_fim;
  const periodoLabel = dataInicio && dataFim
    ? dataInicio === dataFim ? formatDate(dataInicio) : `${formatDate(dataInicio)} à ${formatDate(dataFim)}`
    : 'Período não definido';

  const footerContent = (
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

  return (
    <Document>
      {/* PÁGINA 1 — FOLHA DE ROSTO */}
      <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
        <View style={styles.headerContainer}>
          {logoUrl && <Image src={logoUrl} style={styles.logo} />}
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>RELATÓRIO DE DIÁRIAS EXECUTADAS</Text>
            <Text style={styles.headerSubtitle}>Centro de Custo: {centrosCustoLabel}</Text>
            <Text style={styles.headerSubtitle}>Empresa: {empresasLabel}</Text>
            <Text style={styles.headerSubtitle}>Período: {periodoLabel}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { borderBottomWidth: 0 }]}>INFORMAÇÕES GERAIS</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Centro(s) de Custo</Text>
              <Text style={styles.infoValue}>{centrosCustoLabel}</Text>
            </View>
            {numerosUnicos.length > 0 && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Nº Solicitação</Text>
                <Text style={styles.infoValueBold}>{numerosLabel}</Text>
              </View>
            )}
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>Tipo Vínculo</Text>
              <Text style={styles.infoValueBold}>
                {filtros.tipo_vinculo === 'diarista' ? 'Sem Remessa' : filtros.tipo_vinculo === 'remessa' ? 'Remessa' : 'Todos'}
              </Text>
            </View>
            {engenheiroSolicitante && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Engenheiro Solicitante</Text>
                <Text style={styles.infoValue}>{engenheiroSolicitante}</Text>
              </View>
            )}
            {gerenteRegional && (
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>Gerente Regional</Text>
                <Text style={styles.infoValue}>{gerenteRegional}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.statsPanel}>
          {(() => {
            const dsfs = calcularRangesDSFS(dataInicio || '', dataFim || '', feriados);
            return (
              <>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{totaisDias.diasUteis}</Text>
                  <Text style={styles.statLabel}>Dias Úteis</Text>
                  {dsfs.dsLabel !== '-' && <Text style={{ fontSize: 6, color: '#6b7280', marginTop: 2, textAlign: 'center' as any }}>{dsfs.dsLabel}</Text>}
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statValue}>{totaisDias.diasFds}</Text>
                  <Text style={styles.statLabel}>Finais de Semana</Text>
                  {dsfs.fsLabel !== '-' && <Text style={{ fontSize: 6, color: '#6b7280', marginTop: 2, textAlign: 'center' as any }}>{dsfs.fsLabel}</Text>}
                </View>
              </>
            );
          })()}
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

        {/* Seção de Aprovação */}
        <View style={{ marginTop: 20, paddingTop: 8 }} wrap={false}>
          <Text style={[styles.sectionTitle, { borderBottomWidth: 0 }]}>APROVAÇÃO</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingHorizontal: 20 }}>
            <View style={{ alignItems: 'center', width: '40%' }}>
              <View style={{ borderTopWidth: 1, borderTopColor: '#374151', width: '100%', marginTop: 30, marginBottom: 4 }} />
              <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#374151' }}>Gerente Regional</Text>
              <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>{gerenteRegional || '___________________________'}</Text>
            </View>
            <View style={{ alignItems: 'center', width: '40%' }}>
              <View style={{ borderTopWidth: 1, borderTopColor: '#374151', width: '100%', marginTop: 30, marginBottom: 4 }} />
              <Text style={{ fontSize: 10, fontFamily: 'Roboto', fontWeight: 'bold' as const, color: '#374151' }}>Diretor</Text>
              <Text style={{ fontSize: 8, color: '#6b7280', marginTop: 2 }}>___________________________</Text>
            </View>
          </View>
        </View>

        {footerContent}
      </Page>

      {/* PÁGINA 2+ — TABELA DE FUNCIONÁRIOS */}
      <Page size="A4" orientation="landscape" style={styles.pageLandscape}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            FUNCIONÁRIOS CONSOLIDADOS ({funcionariosConsolidados.length})
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

        {footerContent}
      </Page>
    </Document>
  );
};
