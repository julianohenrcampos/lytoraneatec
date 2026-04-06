import React from 'react';
import { Document, Page, View, Text } from '@react-pdf/renderer';
import { agendamentoExamesStyles as s } from './AgendamentoExamesPDFStyles';
import { AgendamentoExame } from '@/types/ssoAgendamentoExames';
import { format } from 'date-fns';

interface Props {
  agendamentos: AgendamentoExame[];
  salarios: Record<string, number>;
  passagens: Record<string, number | null>;
  centrosCustoMap: Record<string, string>; // nome_centro_custo → codigo_centro_custo
  centrosCustoNomeMap: Record<string, string>; // codigo_centro_custo → nome_centro_custo
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
  const valor = passagens[ag.id];
  if (valor != null && valor > 0) return formatCurrency(valor);
  if (ag.vt_entregue_em) return 'Entregue';
  if (ag.vt_solicitado_em) return 'Solicitado';
  return 'Não necessita';
};

const getMotivoAbrev = (motivo: string | null): string => {
  if (motivo === 'Nova Contratação') return 'NC';
  if (motivo === 'Substituição') return 'SUB';
  return '—';
};

const COLUMNS = [
  { label: 'NOME', style: 'colNome' },
  { label: 'CARGO', style: 'colCargo' },
  { label: 'ÁREA', style: 'colArea' },
  { label: 'CPF', style: 'colCpf' },
  { label: 'DATA', style: 'colData' },
  { label: 'SALÁRIO', style: 'colSalario' },
  { label: 'EX.ADM', style: 'colExame' },
  { label: 'PASSAGEM', style: 'colPassagem' },
  { label: 'VR', style: 'colVr' },
  { label: 'MOTIVO', style: 'colMotivo' },
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

const DataRow = ({ ag, salario, passagens, index, codigoCentro, centroNome }: { ag: AgendamentoExame; salario: number | null; passagens: Record<string, number | null>; index: number; codigoCentro?: string; centroNome?: string }) => {
  const rowStyle = index % 2 === 0 ? s.row : s.rowAlt;
  const areaDisplay = codigoCentro && centroNome ? `${codigoCentro} - ${centroNome}` : codigoCentro || ag.contrato || '—';
  const values = [
    ag.nome_colaborador,
    ag.funcao,
    areaDisplay,
    formatCPF(ag.cpf),
    '',
    formatCurrency(salario),
    ag.status,
    getPassagemDisplay(ag, passagens),
    getStatusVR(ag),
    getMotivoAbrev(ag.motivo_contratacao),
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

export const AgendamentoExamesPDFDocument: React.FC<Props> = ({ agendamentos, salarios, passagens, centrosCustoMap, centrosCustoNomeMap }) => {
  // Group by empresa first, then by centro de custo
  const groupedByEmpresa = agendamentos.reduce<Record<string, Record<string, AgendamentoExame[]>>>((acc, ag) => {
    const empresa = ag.empresa || 'Sem Empresa';
    const cc = ag.contrato || 'Sem Centro de Custo';
    if (!acc[empresa]) acc[empresa] = {};
    if (!acc[empresa][cc]) acc[empresa][cc] = [];
    acc[empresa][cc].push(ag);
    return acc;
  }, {});

  const empresas = Object.entries(groupedByEmpresa).sort(([a], [b]) => a.localeCompare(b));

  return (
    <Document>
      {empresas.map(([empresaNome, centros]) => {
        const centroEntries = Object.entries(centros).sort(([a], [b]) => a.localeCompare(b));

        return centroEntries.map(([centroNome, items]) => {
          const codigoCentro = centrosCustoMap[centroNome] || centroNome;

          // Per-group totals
          const totalSalarios = items.reduce((sum, ag) => {
            const sal = salarios[ag.funcao?.toUpperCase().trim()];
            return sum + (sal || 0);
          }, 0);

          const funcoesCont: Record<string, number> = {};
          items.forEach(ag => {
            const fn = ag.funcao?.toUpperCase().trim() || ag.funcao;
            funcoesCont[fn] = (funcoesCont[fn] || 0) + 1;
          });

          return (
            <Page key={`${empresaNome}-${centroNome}`} size="A4" orientation="landscape" style={s.page}>
              {/* Header */}
              <Text style={s.title}>RELATÓRIO DE ADMISSÃO</Text>

              {/* Group header */}
              <View style={s.groupHeader}>
                <Text style={s.groupHeaderText}>{empresaNome} ({items.length} colaboradores)</Text>
              </View>

              {/* Table */}
              <HeaderRow />
              {items.map((ag, idx) => (
                <DataRow
                  key={ag.id}
                  ag={ag}
                  salario={salarios[ag.funcao?.toUpperCase().trim()] ?? null}
                  passagens={passagens}
                  index={idx}
                  codigoCentro={codigoCentro}
                  centroNome={centroNome}
                />
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
          );
        });
      })}
    </Document>
  );
};
