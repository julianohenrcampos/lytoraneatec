import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { agendamentoExamesStyles as s } from './AgendamentoExamesPDFStyles';
import { AgendamentoExame } from '@/types/ssoAgendamentoExames';
import { format } from 'date-fns';

interface Props {
  agendamentos: AgendamentoExame[];
  salarios: Record<string, number>;
  passagens: Record<string, number | null>;
  filtrosTexto: string;
}

const formatCPF = (cpf: string | null) => {
  if (!cpf) return '—';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length === 11) {
    return `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
  }
  return cpf;
};

const formatDate = (d: string | null) => {
  if (!d) return '—';
  try { return format(new Date(d + 'T12:00:00'), 'dd/MM/yyyy'); } catch { return d; }
};

const formatCurrency = (v: number | null | undefined) => {
  if (v == null) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getStatusVR = (ag: AgendamentoExame): string => {
  if (ag.vr_entregue_em) return 'Entregue';
  if (ag.vr_solicitado_em) return 'Solicitado';
  return 'Pendente';
};

const getPassagemDisplay = (ag: AgendamentoExame, passagens: Record<string, number | null>): string => {
  if (!ag.cpf) return 'NÃO necessita';
  const cpfClean = ag.cpf.replace(/\D/g, '');
  const valor = passagens[cpfClean];
  if (valor != null && valor > 0) return formatCurrency(valor);
  // Check VT status as fallback indicator
  if (ag.vt_entregue_em) return 'Entregue';
  if (ag.vt_solicitado_em) return 'Solicitado';
  return 'NÃO necessita';
};

const COLUMNS = [
  { label: 'NOME', style: 'colNome' },
  { label: 'CARGO', style: 'colCargo' },
  { label: 'ÁREA', style: 'colArea' },
  { label: 'CPF', style: 'colCpf' },
  { label: 'DATA', style: 'colData' },
  { label: 'SALÁRIO', style: 'colSalario' },
  { label: 'EXAME ADMISSIONAL', style: 'colExame' },
  { label: 'PASSAGEM', style: 'colPassagem' },
  { label: 'VR', style: 'colVr' },
] as const;

const HeaderRow = () => (
  <View style={s.headerRow} fixed>
    {COLUMNS.map((col, i) => (
      <View key={col.label} style={[s[col.style as keyof typeof s] as any, i < COLUMNS.length - 1 && s.colBorder]}>
        <Text style={s.headerCell}>
          {col.label}
        </Text>
      </View>
    ))}
  </View>
);

const DataRow = ({ ag, salario, passagens, index }: { ag: AgendamentoExame; salario: number | null; passagens: Record<string, number | null>; index: number }) => {
  const rowStyle = index % 2 === 0 ? s.row : s.rowAlt;
  const values = [
    ag.nome_colaborador,
    ag.funcao,
    ag.contrato || '—',
    formatCPF(ag.cpf),
    formatDate(ag.data_agendamento),
    formatCurrency(salario),
    ag.status,
    getPassagemDisplay(ag, passagens),
    getStatusVR(ag),
  ];

  return (
    <View style={rowStyle} wrap={false}>
      {values.map((val, i) => (
        <View key={i} style={[s[COLUMNS[i].style as keyof typeof s] as any, i < values.length - 1 && s.colBorder]}>
          <Text style={i === 0 ? s.cellLeft : s.cell}>
            {val}
          </Text>
        </View>
      ))}
    </View>
  );
};

// ===== Funções Summary Table =====
const FuncoesSummaryTable = ({ funcoesCont }: { funcoesCont: Record<string, number> }) => {
  const entries = Object.entries(funcoesCont).sort(([a], [b]) => a.localeCompare(b));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return (
    <View style={s.funcoesContainer}>
      {/* Header */}
      <View style={s.funcoesHeaderRow}>
        <View style={[{ width: '70%' }, s.funcoesCellBorderRight]}>
          <Text style={s.funcoesHeaderCell}>FUNÇÕES</Text>
        </View>
        <View style={{ width: '30%' }}>
          <Text style={s.funcoesHeaderCell}>QUANTIDADE</Text>
        </View>
      </View>
      {/* Rows */}
      {entries.map(([funcao, qtd]) => (
        <View key={funcao} style={s.funcoesRow}>
          <View style={[{ width: '70%' }, s.funcoesCellBorderRight]}>
            <Text style={s.funcoesCell}>{funcao}</Text>
          </View>
          <View style={{ width: '30%' }}>
            <Text style={s.funcoesCellCenter}>{qtd}</Text>
          </View>
        </View>
      ))}
      {/* Total */}
      <View style={s.funcoesTotalRow}>
        <View style={[{ width: '70%' }, s.funcoesCellBorderRight]}>
          <Text style={s.funcoesTotalCell}>TOTAL</Text>
        </View>
        <View style={{ width: '30%' }}>
          <Text style={s.funcoesTotalCellCenter}>{total}</Text>
        </View>
      </View>
    </View>
  );
};

// ===== Total Valor Table =====
const TotalValorTable = ({ total }: { total: number }) => (
  <View style={s.totalValorContainer}>
    <View style={s.totalValorHeader}>
      <Text style={s.totalValorHeaderText}>Total Valor</Text>
    </View>
    <View style={s.totalValorBody}>
      <Text style={s.totalValorText}>{formatCurrency(total)}</Text>
    </View>
  </View>
);

export const AgendamentoExamesPDFDocument: React.FC<Props> = ({ agendamentos, salarios, passagens, filtrosTexto }) => {
  // Group by empresa
  const grouped = agendamentos.reduce<Record<string, AgendamentoExame[]>>((acc, ag) => {
    const key = ag.empresa || 'Sem Empresa';
    if (!acc[key]) acc[key] = [];
    acc[key].push(ag);
    return acc;
  }, {});

  const groups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  // Totals — salary by funcao name
  const totalSalarios = agendamentos.reduce((sum, ag) => {
    const sal = salarios[ag.funcao];
    return sum + (sal || 0);
  }, 0);

  const funcoesCont: Record<string, number> = {};
  agendamentos.forEach(ag => {
    funcoesCont[ag.funcao] = (funcoesCont[ag.funcao] || 0) + 1;
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>
        {/* Header */}
        <Text style={s.title}><Text style={s.title}>RELATÓRIO DE ADMISSÃO</Text></Text>
        <Text style={s.subtitle}>{filtrosTexto}</Text>

        {/* Main data table */}
        {groups.map(([groupName, items]) => (
          <View key={groupName}>
            <View style={s.groupHeader}>
              <Text style={s.groupHeaderText}>{groupName} ({items.length} colaboradores)</Text>
            </View>
            <HeaderRow />
            {items.map((ag, idx) => (
              <DataRow
                key={ag.id}
                ag={ag}
                salario={salarios[ag.funcao] ?? null}
                passagens={passagens}
                index={idx}
              />
            ))}
          </View>
        ))}

        {/* Bottom section: Funções + Total Valor side by side */}
        <View style={s.bottomRow}>
          <FuncoesSummaryTable funcoesCont={funcoesCont} />
          <TotalValorTable total={totalSalarios} />
        </View>

        {/* Assinaturas */}
        <View style={s.signaturesRow}>
          <View style={s.signatureBlock}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Gerente Regional</Text>
          </View>
          <View style={s.signatureBlock}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Diretor de Engenharia</Text>
          </View>
          <View style={s.signatureBlock}>
            <View style={s.signatureLine} />
            <Text style={s.signatureLabel}>Diretor Financeiro</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
};
