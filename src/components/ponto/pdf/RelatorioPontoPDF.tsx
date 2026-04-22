import '@/lib/pdfFonts';
import React from 'react';
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

import type {
  PontoEletronicoMainRow,
  PontoEletronicoReportData,
  PontoEletronicoSummaryItem,
} from '@/utils/pdf/gerarPdfPontoEletronico';

interface RelatorioPontoPDFProps {
  reports: PontoEletronicoReportData[];
  defaultLogoUrl?: string;
  logoMap?: Record<string, string>;
}

const BORDER = '#000000';
const CELL_WIDTHS = ['8%', '7%', '8%', '17%', '10%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%', '6.25%'] as const;
const TABLE_HEADERS = [
  'Data',
  'Previsto',
  'Interj.',
  'Realizado',
  'Intra',
  'H.D',
  'H.N',
  'H.T',
  'HE.D',
  'HE.N',
  'HE.T',
  'Trab.',
  'Atraso',
] as const;
const MAX_FINAL_ROWS = 8;
const MAX_REGULAR_ROWS = 18;

const s = StyleSheet.create({
  page: {
    paddingTop: 18,
    paddingBottom: 16,
    paddingHorizontal: 18,
    fontFamily: 'Roboto',
    fontSize: 8,
    color: BORDER,
    backgroundColor: '#ffffff',
  },
  headerTitle: {
    fontSize: 10,
    textAlign: 'center',
    fontWeight: 700,
    marginBottom: 4,
  },
  headerBox: {
    width: '100%',
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoCol: {
    width: 90,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoImage: {
    maxWidth: 76,
    maxHeight: 28,
    objectFit: 'contain',
  },
  logoFallback: {
    fontSize: 10,
    fontWeight: 700,
    textAlign: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    columnGap: 20,
    paddingHorizontal: 6,
  },
  headerCol: {
    flex: 1,
    flexDirection: 'column',
    rowGap: 4,
  },
  infoLine: {
    fontSize: 11,
    lineHeight: 1.2,
  },
  infoLabel: {
    fontWeight: 700,
  },
  headerRight: {
    width: 150,
    flexDirection: 'column',
    alignItems: 'flex-end',
    justifyContent: 'center',
    rowGap: 2,
  },
  metaText: {
    fontSize: 10,
    textAlign: 'right',
    lineHeight: 1.2,
  },
  bold: {
    fontWeight: 700,
  },
  table: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  row: {
    flexDirection: 'row',
    width: '100%',
  },
  tableCell: {
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    justifyContent: 'center',
  },
  tableCellLast: {
    borderRightWidth: 0,
  },
  headerCellText: {
    fontSize: 6.8,
    textAlign: 'center',
    fontWeight: 700,
  },
  cellText: {
    fontSize: 6.6,
    textAlign: 'center',
    lineHeight: 1.15,
  },
  cellTextLeft: {
    textAlign: 'left',
  },
  folgaText: {
    fontStyle: 'italic',
  },
  totalLabelText: {
    fontSize: 6.8,
    fontWeight: 700,
    textAlign: 'center',
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 4,
    fontSize: 8,
    fontWeight: 700,
  },
  highlightRow: {
    marginTop: 8,
    flexDirection: 'row',
    columnGap: 4,
  },
  highlightBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 5,
    minHeight: 42,
    justifyContent: 'space-between',
  },
  highlightLabel: {
    fontSize: 7,
    lineHeight: 1.2,
  },
  highlightValue: {
    fontSize: 9,
    fontWeight: 700,
    marginTop: 6,
  },
  detailRow: {
    marginTop: 4,
    flexDirection: 'row',
    columnGap: 4,
  },
  detailBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 5,
    minHeight: 92,
  },
  detailTitle: {
    fontSize: 7.2,
    fontWeight: 700,
    marginBottom: 4,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 1.5,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  detailItemLast: {
    borderBottomWidth: 0,
  },
  detailLabel: {
    flex: 1,
    fontSize: 6.8,
    paddingRight: 4,
  },
  detailValue: {
    width: 48,
    fontSize: 6.8,
    textAlign: 'right',
    fontWeight: 700,
  },
  signaturesRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    columnGap: 18,
  },
  signatureBox: {
    flex: 1,
    alignItems: 'center',
  },
  signatureLine: {
    width: '100%',
    borderTopWidth: 1,
    borderColor: BORDER,
    marginBottom: 4,
  },
  signatureName: {
    fontSize: 7,
    fontWeight: 700,
    textAlign: 'center',
  },
  signatureRole: {
    marginTop: 2,
    fontSize: 6.5,
    textAlign: 'center',
  },
  legendBox: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  legendText: {
    fontSize: 6.4,
    lineHeight: 1.25,
    textAlign: 'left',
  },
  footerMeta: {
    marginTop: 5,
    fontSize: 6.4,
    textAlign: 'right',
  },
});

const chunkRows = (rows: PontoEletronicoMainRow[]) => {
  if (rows.length <= MAX_FINAL_ROWS) return [rows];

  const remaining = [...rows];
  const chunks: PontoEletronicoMainRow[][] = [];

  while (remaining.length > MAX_FINAL_ROWS) {
    const chunkSize = Math.min(MAX_REGULAR_ROWS, remaining.length - MAX_FINAL_ROWS);
    chunks.push(remaining.splice(0, chunkSize));
  }

  chunks.push(remaining);
  return chunks;
};

const rowToCells = (row: PontoEletronicoMainRow) => [
  row.data,
  row.previsto,
  row.interjornada,
  row.realizado,
  row.intrajornada,
  row.horasDiurnas,
  row.horasNoturnas,
  row.horasTotais,
  row.heDiurnas,
  row.heNoturnas,
  row.heTotais,
  row.horasTrabalhadas,
  row.atraso,
];

const renderSummaryItems = (items: PontoEletronicoSummaryItem[]) => {
  if (!items.length) {
    return [
      <View key="empty" style={[s.detailItem, s.detailItemLast]}>
        <Text style={s.detailLabel}>—</Text>
        <Text style={s.detailValue}>—</Text>
      </View>,
    ];
  }

  return items.map((item, index) => (
    <View key={`${item.label}-${index}`} style={[s.detailItem, index === items.length - 1 && s.detailItemLast]}>
      <Text style={s.detailLabel}>{item.label}</Text>
      <Text style={s.detailValue}>{item.value}</Text>
    </View>
  ));
};

function HeaderPontoPDF({ report, logoUrl }: { report: PontoEletronicoReportData; logoUrl?: string }) {
  return (
    <>
      <Text style={s.headerTitle}>RELATÓRIO DE PONTO ELETRÔNICO</Text>
      <View style={s.headerBox}>
        <View style={s.logoCol}>
          {logoUrl ? <Image src={logoUrl} style={s.logoImage} /> : <Text style={s.logoFallback}>LYTOTEC</Text>}
        </View>

        <View style={s.headerCenter}>
          <View style={s.headerCol}>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Empresa:</Text> {report.employee.empresa}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Empresa CPF/CNPJ:</Text> {report.employee.cnpj}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Colaborador:</Text> {report.employee.colaborador}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Colaborador CPF:</Text> {report.employee.cpf}</Text>
          </View>

          <View style={s.headerCol}>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Cargo:</Text> {report.employee.cargo}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Admissão:</Text> {report.employee.admissao}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Departamento:</Text> {report.employee.departamento}</Text>
            <Text style={s.infoLine}><Text style={s.infoLabel}>Período:</Text> {report.employee.periodo}</Text>
          </View>
        </View>

        <View style={s.headerRight}>
          <Text style={s.metaText}>Gerado pelo sistema: <Text style={s.bold}>LYTOTEC</Text></Text>
          <Text style={s.metaText}>Total de registros: {report.rows.length}</Text>
          <Text style={s.metaText}>Gerado em: {report.generatedAt}</Text>
        </View>
      </View>
    </>
  );
}

function TableHeader() {
  return (
    <View style={s.row} fixed>
      {TABLE_HEADERS.map((header, index) => (
        <View
          key={header}
          style={[
            s.tableCell,
            { width: CELL_WIDTHS[index] },
            index === TABLE_HEADERS.length - 1 && s.tableCellLast,
          ]}
        >
          <Text style={s.headerCellText}>{header}</Text>
        </View>
      ))}
    </View>
  );
}

function TableRowPonto({ row }: { row: PontoEletronicoMainRow }) {
  const cells = rowToCells(row);

  return (
    <View style={s.row} wrap={false}>
      {cells.map((cell, index) => (
        <View
          key={`${row.data}-${index}`}
          style={[
            s.tableCell,
            { width: CELL_WIDTHS[index] },
            index === TABLE_HEADERS.length - 1 && s.tableCellLast,
          ]}
        >
          <Text
            style={[
              s.cellText,
              index === 3 && s.cellTextLeft,
              row.isFolga && index === 3 && s.folgaText,
            ]}
          >
            {cell || '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

function TotalRow({ report }: { report: PontoEletronicoReportData }) {
  const values = [
    'Total',
    '',
    '',
    '',
    '',
    report.totals.horasDiurnas,
    report.totals.horasNoturnas,
    report.totals.horasTotais,
    report.totals.heDiurnas,
    report.totals.heNoturnas,
    report.totals.heTotais,
    report.totals.horasTrabalhadas,
    report.totals.atraso,
  ];

  return (
    <View style={s.row} wrap={false}>
      {values.map((value, index) => (
        <View
          key={`total-${index}`}
          style={[
            s.tableCell,
            { width: CELL_WIDTHS[index], borderBottomWidth: 0 },
            index === TABLE_HEADERS.length - 1 && s.tableCellLast,
          ]}
        >
          <Text style={index === 0 ? s.totalLabelText : s.headerCellText}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

function ResumoPontoPDF({ report }: { report: PontoEletronicoReportData }) {
  return (
    <>
      <View style={s.highlightRow}>
        {report.summaries.highlights.map((item, index) => (
          <View key={`${item.label}-${index}`} style={s.highlightBox}>
            <Text style={s.highlightLabel}>{item.label}</Text>
            <Text style={s.highlightValue}>{item.value}</Text>
          </View>
        ))}
      </View>

      <View style={s.detailRow}>
        <View style={s.detailBox}>
          <Text style={s.detailTitle}>Resumo semanal</Text>
          {renderSummaryItems(report.summaries.horasPorDiaSemana)}
        </View>

        <View style={s.detailBox}>
          <Text style={s.detailTitle}>Horas por escala</Text>
          {renderSummaryItems(report.summaries.horasPorEscala)}
        </View>

        <View style={s.detailBox}>
          <Text style={s.detailTitle}>Ocorrências</Text>
          {renderSummaryItems(report.summaries.ocorrencias)}
        </View>
      </View>
    </>
  );
}

function AssinaturasPontoPDF({ report }: { report: PontoEletronicoReportData }) {
  return (
    <View style={s.signaturesRow} wrap={false}>
      <View style={s.signatureBox}>
        <View style={s.signatureLine} />
        <Text style={s.signatureName}>{report.signatures.employee}</Text>
        <Text style={s.signatureRole}>Colaborador</Text>
      </View>

      <View style={s.signatureBox}>
        <View style={s.signatureLine} />
        <Text style={s.signatureName}>{report.signatures.company}</Text>
        <Text style={s.signatureRole}>Empresa</Text>
      </View>
    </View>
  );
}

function LegendaPontoPDF({ report }: { report: PontoEletronicoReportData }) {
  return (
    <View style={s.legendBox} wrap={false}>
      <Text style={s.legendText}>{report.legend}</Text>
      <Text style={s.footerMeta}>Emitido por {report.generatedBy}</Text>
    </View>
  );
}

function RelatorioPontoPage({
  report,
  logoUrl,
  rows,
  isLastChunk,
}: {
  report: PontoEletronicoReportData;
  logoUrl?: string;
  rows: PontoEletronicoMainRow[];
  isLastChunk: boolean;
}) {
  return (
    <Page size="A4" orientation="landscape" style={s.page}>
      <HeaderPontoPDF report={report} logoUrl={logoUrl} />

      <View style={s.table}>
        <TableHeader />
        {rows.map((row, index) => (
          <TableRowPonto key={`${row.data}-${index}`} row={row} />
        ))}
        {isLastChunk && <TotalRow report={report} />}
      </View>

      {isLastChunk && (
        <>
          <ResumoPontoPDF report={report} />
          <AssinaturasPontoPDF report={report} />
          <LegendaPontoPDF report={report} />
        </>
      )}
    </Page>
  );
}

export function RelatorioPontoPDF({ reports, defaultLogoUrl, logoMap }: RelatorioPontoPDFProps) {
  return (
    <Document>
      {reports.flatMap((report, reportIndex) => {
        const chunks = chunkRows(report.rows);
        const logoUrl = logoMap?.[report.employee.empresa] || defaultLogoUrl;

        return chunks.map((chunk, chunkIndex) => (
          <RelatorioPontoPage
            key={`${report.employee.colaborador}-${reportIndex}-${chunkIndex}`}
            report={report}
            logoUrl={logoUrl}
            rows={chunk}
            isLastChunk={chunkIndex === chunks.length - 1}
          />
        ));
      })}
    </Document>
  );
}
