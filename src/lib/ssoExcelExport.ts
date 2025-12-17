import * as XLSX from 'xlsx';
import { ChecklistExportData, ChecklistExportRow } from '@/services/sso/ssoExportService';

const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
};

const formatNota = (nota: number | null): string | number => {
  if (nota === null) return '';
  return Number(nota.toFixed(2));
};

// Cor de fundo baseada na nota
const getNotaColor = (nota: number | null): string | null => {
  if (nota === null) return null;
  if (nota <= 50) return 'FFFF0000'; // Vermelho
  if (nota <= 75) return 'FFFFFF00'; // Amarelo
  return 'FF00FF00'; // Verde
};

export const generateSSOExcel = (data: ChecklistExportData): void => {
  const { rows, summary } = data;

  // Criar dados da planilha
  const wsData: (string | number)[][] = [];

  // Linha 1: Título
  wsData.push(['', '', 'CONTROLE DE ENTREGA - CHECK LIST AUTOS DE INFRAÇÃO MTE/TAC', '', '', '', '', '', '', '', 'SSO']);
  
  // Linha 2: Vazia
  wsData.push([]);

  // Linha 3: Cabeçalho
  wsData.push([
    'TÉCNICO',
    'GERENTE',
    'ENGENHEIRO RESPONSÁVEL',
    'CONTRATO',
    '1ª ETAPA', '', // DATA, NOTA
    '2ª ETAPA', '', // DATA, NOTA
    '3ª ETAPA', ''  // DATA, NOTA
  ]);

  // Linha 4: Sub-cabeçalho para etapas
  wsData.push([
    '', '', '', '',
    'DATA', 'NOTA',
    'DATA', 'NOTA',
    'DATA', 'NOTA'
  ]);

  // Dados
  rows.forEach(row => {
    wsData.push([
      row.tecnico,
      row.gerente,
      row.engenheiro,
      row.contrato,
      formatDate(row.etapa1_data),
      formatNota(row.etapa1_nota),
      formatDate(row.etapa2_data),
      formatNota(row.etapa2_nota),
      formatDate(row.etapa3_data),
      formatNota(row.etapa3_nota)
    ]);
  });

  // Linhas vazias
  wsData.push([]);
  wsData.push([]);

  // Resumo
  wsData.push(['CANTEIROS:', summary.totalCanteiros]);
  wsData.push(['ATENDIDOS:', summary.canteirosAtendidos]);
  wsData.push([]);
  wsData.push(['PARÂMETRO', 'QTDE']);
  wsData.push(['ATÉ 50', summary.parametros.ate50]);
  wsData.push(['DE 51 ATÉ 75', summary.parametros.de51a75]);
  wsData.push(['DE 76 A 100', summary.parametros.de76a100]);

  // Criar worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Configurar larguras de colunas
  ws['!cols'] = [
    { wch: 20 }, // TÉCNICO
    { wch: 15 }, // GERENTE
    { wch: 25 }, // ENGENHEIRO
    { wch: 15 }, // CONTRATO
    { wch: 10 }, // DATA 1
    { wch: 10 }, // NOTA 1
    { wch: 10 }, // DATA 2
    { wch: 10 }, // NOTA 2
    { wch: 10 }, // DATA 3
    { wch: 10 }, // NOTA 3
    { wch: 5 },  // SSO
  ];

  // Merge de células para título
  ws['!merges'] = [
    { s: { r: 0, c: 2 }, e: { r: 0, c: 9 } }, // Título
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } }, // 1ª ETAPA
    { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, // 2ª ETAPA
    { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } }, // 3ª ETAPA
  ];

  // Aplicar formatação condicional de cores nas notas
  // Nota: xlsx não suporta formatação condicional nativa, mas podemos usar estilos
  // Para uma solução completa, seria necessário usar xlsx-style ou similar
  
  // Criar workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Controle Checklists');

  // Gerar nome do arquivo com data
  const today = new Date().toISOString().split('T')[0];
  const filename = `CONTROLE_CHECK_LIST_SSO_${today}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
};

export const generateSSOExcelFormatted = (data: ChecklistExportData): void => {
  const { rows, summary } = data;

  // Criar workbook
  const wb = XLSX.utils.book_new();

  // Criar dados da planilha com estrutura mais detalhada
  const wsData: any[][] = [];

  // Linha 1: Cabeçalho principal
  wsData.push([
    '', '', 
    'CONTROLE DE ENTREGA - CHECK LIST AUTOS DE INFRAÇÃO MTE/TAC', 
    '', '', '', '', '', '', '', 
    'SSO'
  ]);

  // Linha 2: Vazia
  wsData.push([]);

  // Linha 3: Headers das colunas
  wsData.push([
    'TÉCNICO',
    'GERENTE',
    'ENGENHEIRO RESPONSÁVEL',
    'CONTRATO',
    '1ª ETAPA', '',
    '2ª ETAPA', '',
    '3ª ETAPA', ''
  ]);

  // Linha 4: Sub-headers (DATA/NOTA)
  wsData.push([
    '', '', '', '',
    'DATA', 'NOTA',
    'DATA', 'NOTA',
    'DATA', 'NOTA'
  ]);

  // Dados das obras
  rows.forEach((row) => {
    const rowData = [
      row.tecnico,
      row.gerente,
      row.engenheiro,
      row.contrato,
      formatDate(row.etapa1_data),
      row.etapa1_nota !== null ? Number(row.etapa1_nota.toFixed(2)) : '',
      formatDate(row.etapa2_data),
      row.etapa2_nota !== null ? Number(row.etapa2_nota.toFixed(2)) : '',
      formatDate(row.etapa3_data),
      row.etapa3_nota !== null ? Number(row.etapa3_nota.toFixed(2)) : ''
    ];
    wsData.push(rowData);
  });

  // Linhas vazias antes do resumo
  wsData.push([]);
  wsData.push([]);

  // Resumo
  const summaryStartRow = wsData.length;
  wsData.push(['CANTEIROS:', summary.totalCanteiros]);
  wsData.push(['ATENDIDOS:', summary.canteirosAtendidos]);
  wsData.push([]);
  wsData.push(['PARÂMETRO', 'QTDE']);
  wsData.push(['ATÉ 50', summary.parametros.ate50]);
  wsData.push(['DE 51 ATÉ 75', summary.parametros.de51a75]);
  wsData.push(['DE 76 A 100', summary.parametros.de76a100]);

  // Criar worksheet
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Configurar larguras de colunas
  ws['!cols'] = [
    { wch: 22 }, // TÉCNICO
    { wch: 18 }, // GERENTE
    { wch: 28 }, // ENGENHEIRO
    { wch: 15 }, // CONTRATO
    { wch: 12 }, // DATA 1
    { wch: 10 }, // NOTA 1
    { wch: 12 }, // DATA 2
    { wch: 10 }, // NOTA 2
    { wch: 12 }, // DATA 3
    { wch: 10 }, // NOTA 3
    { wch: 6 },  // SSO
  ];

  // Merge de células
  ws['!merges'] = [
    { s: { r: 0, c: 2 }, e: { r: 0, c: 9 } }, // Título central
    { s: { r: 2, c: 4 }, e: { r: 2, c: 5 } }, // 1ª ETAPA header
    { s: { r: 2, c: 6 }, e: { r: 2, c: 7 } }, // 2ª ETAPA header
    { s: { r: 2, c: 8 }, e: { r: 2, c: 9 } }, // 3ª ETAPA header
  ];

  // Adicionar ao workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Controle Checklists');

  // Gerar nome do arquivo
  const today = new Date().toISOString().split('T')[0];
  const filename = `CONTROLE_CHECK_LIST_SSO_${today}.xlsx`;

  // Download
  XLSX.writeFile(wb, filename);
};
