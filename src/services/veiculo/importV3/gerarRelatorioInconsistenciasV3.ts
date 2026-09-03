// PR-3.3 Fase C4 — Gerador do RELATÓRIO DE INCONSISTÊNCIAS do preview V3.
// Duas abas: RESUMO e INCONSISTENCIAS. Nada de banco. Nada de write. Somente XLSX.

import ExcelJS from 'exceljs';
import type {
  LinhaClassificadaSimplificada,
  ParseWorkbookV3SimplificadoResult,
} from './parseWorkbookV3Simplificado';

export interface GerarRelatorioInput {
  parsed: ParseWorkbookV3SimplificadoResult;
  arquivoNome: string;
}

export async function gerarRelatorioInconsistenciasV3(
  input: GerarRelatorioInput,
): Promise<Blob> {
  const { parsed, arquivoNome } = input;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LYTOTEC — Importador V3';
  wb.created = new Date();

  // ── RESUMO ────────────────────────────────────────────────────────────
  const wsR = wb.addWorksheet('RESUMO');
  wsR.columns = [{ width: 40 }, { width: 24 }];
  const linhasRes: [string, string | number][] = [
    ['arquivo', arquivoNome],
    ['schema_version', parsed.schema_version],
    ['tipo_arquivo', parsed.tipo_arquivo],
    ['total_linhas', parsed.resumo.total],
    ['inserir', parsed.resumo.inserir],
    ['atualizar', parsed.resumo.atualizar],
    ['sem_alteracao', parsed.resumo.sem_alteracao],
    ['ignorada', parsed.resumo.ignorada],
    ['erro', parsed.resumo.erro],
    ['linhas_com_erro', parsed.resumo.linhas_com_erro],
    ['total_inconsistencias', parsed.resumo.total_inconsistencias],
    ['warnings_globais', parsed.warnings_globais.length],
  ];
  linhasRes.forEach((r) => wsR.addRow(r));
  wsR.getRow(1).font = { bold: true };
  wsR.getColumn(1).font = { bold: true };

  if (parsed.warnings_globais.length > 0) {
    wsR.addRow([]);
    wsR.addRow(['WARNINGS GLOBAIS', '']).font = { bold: true };
    parsed.warnings_globais.forEach((w) => wsR.addRow([w.codigo, w.mensagem]));
  }

  // ── INCONSISTENCIAS ──────────────────────────────────────────────────
  const wsI = wb.addWorksheet('INCONSISTENCIAS');
  wsI.columns = [
    { header: 'linha_excel', key: 'linha', width: 12 },
    { header: 'identificador', key: 'id', width: 18 },
    { header: 'controle_ref', key: 'ref', width: 20 },
    { header: 'acao_inferida', key: 'acao', width: 18 },
    { header: 'codigo', key: 'codigo', width: 34 },
    { header: 'campo', key: 'campo', width: 22 },
    { header: 'valor', key: 'valor', width: 30 },
    { header: 'mensagem', key: 'mensagem', width: 80 },
  ];
  wsI.getRow(1).font = { bold: true };

  for (const l of parsed.linhas) {
    if (l.erros.length === 0) continue;
    for (const e of l.erros) {
      const campo = e.campo ?? '';
      const valor = campo ? String((l.raw as Record<string, unknown>)[campo] ?? '') : '';
      wsI.addRow({
        linha: l.linha_excel,
        id: l.codigo_canonico || '',
        ref: l.controle_ref ?? '',
        acao: l.acao_inferida ?? l.acao,
        codigo: e.codigo,
        campo,
        valor,
        mensagem: e.mensagem,
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

export function baixarBlobComoArquivo(blob: Blob, nome: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = nome;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
