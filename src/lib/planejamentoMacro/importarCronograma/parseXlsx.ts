// Fase 6F / 6H.1.1 / 6I.2-B — Parser XLSX/XLS via SheetJS. 100% client-side.
// 6I.2-B: lê 3 abas — Tarefas, Recursos (catálogo) e Atribuições.

import * as XLSX from "xlsx";
import { construirPreview } from "./validar";
import { processarAlocacoes, processarCatalogoRecursos } from "./parseAlocacoes";
import { norm } from "./mapearColunas";
import {
  LIMITE_LINHAS_IMPORTACAO,
  type CentroCustoSelecionado,
  type RecursoCatalogoPreview,
  type ResultadoParse,
} from "./tipos";

const NOMES_TAREFAS_NORM = ["tarefas", "tasks", "atividades", "tabela tarefas", "tabela tarefas1"];
const NOMES_ALOCACOES_NORM = [
  "alocacoes",
  "assignments",
  "alocacao",
  "atribuicao",
  "atribuicoes",
  "tabela atribuicao",
  "tabela atribuicao1",
];
const NOMES_RECURSOS_NORM = [
  "recursos",
  "resources",
  "tabela recursos",
  "tabela recursos1",
];

function findSheetByNorm(sheetNames: string[], targets: string[]): string | null {
  for (const name of sheetNames) {
    const n = norm(name);
    if (targets.includes(n)) return name;
    // match parcial (ex.: "Tabela_Atribuição1" → "tabela atribuicao1")
    if (targets.some((t) => n.includes(t))) return name;
  }
  return null;
}

export async function parseXlsxParaPreview(
  file: File,
  cc: CentroCustoSelecionado,
): Promise<ResultadoParse> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });

  const tarefasSheetName =
    findSheetByNorm(wb.SheetNames, NOMES_TAREFAS_NORM) ?? wb.SheetNames[0];
  const sheetTarefas = tarefasSheetName ? wb.Sheets[tarefasSheetName] : undefined;

  if (!sheetTarefas) {
    return construirPreview({
      formato: "xlsx",
      origem: "importacao_excel",
      nomeArquivo: file.name,
      linhas: [],
      cabecalhos: [],
      cc,
    });
  }

  const rowsTarefas = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetTarefas, {
    defval: null,
    raw: false,
    rawNumbers: true,
  });

  const headersTarefas = new Set<string>();
  rowsTarefas.forEach((r) => Object.keys(r).forEach((k) => headersTarefas.add(k)));

  const resultado = construirPreview({
    formato: "xlsx",
    origem: "importacao_excel",
    nomeArquivo: file.name,
    linhas: rowsTarefas,
    cabecalhos: Array.from(headersTarefas),
    cc,
  });

  // ---------- Aba Recursos (catálogo) — 6I.2-B ----------
  let catalogo: RecursoCatalogoPreview[] = [];
  const recursosSheetName = findSheetByNorm(wb.SheetNames, NOMES_RECURSOS_NORM);
  if (recursosSheetName) {
    const sheetRec = wb.Sheets[recursosSheetName];
    const rowsRec = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetRec, {
      defval: null,
      raw: false,
      rawNumbers: true,
    });
    if (rowsRec.length > LIMITE_LINHAS_IMPORTACAO) {
      resultado.globalWarnings.push(
        `A aba "${recursosSheetName}" possui mais de ${LIMITE_LINHAS_IMPORTACAO} linhas e será ignorada nesta importação.`,
      );
    } else {
      const headersRec = new Set<string>();
      rowsRec.forEach((r) => Object.keys(r).forEach((k) => headersRec.add(k)));
      catalogo = processarCatalogoRecursos(rowsRec, Array.from(headersRec));
    }
  } else {
    resultado.globalWarnings.push(
      "Catálogo de recursos ausente — usando família declarada na aba de atribuições.",
    );
  }
  resultado.recursosCatalogo = catalogo;

  // ---------- Aba Atribuições (6H.1.1 / 6I.2-B) ----------
  const alocacoesSheetName = findSheetByNorm(wb.SheetNames, NOMES_ALOCACOES_NORM);
  if (alocacoesSheetName) {
    const sheetAloc = wb.Sheets[alocacoesSheetName];
    const rowsAloc = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheetAloc, {
      defval: null,
      raw: false,
      rawNumbers: true,
    });

    if (rowsAloc.length > LIMITE_LINHAS_IMPORTACAO) {
      resultado.globalWarnings.push(
        `A aba "${alocacoesSheetName}" possui mais de ${LIMITE_LINHAS_IMPORTACAO} linhas e será ignorada nesta importação.`,
      );
      resultado.alocacoes = [];
      resultado.recursos = null;
    } else {
      const headersAloc = new Set<string>();
      rowsAloc.forEach((r) => Object.keys(r).forEach((k) => headersAloc.add(k)));
      const { alocacoes, resumo } = processarAlocacoes(
        rowsAloc,
        Array.from(headersAloc),
        resultado.atividades,
        catalogo,
      );
      resultado.alocacoes = alocacoes;
      resultado.recursos = resumo;
    }
  }

  return resultado;
}
