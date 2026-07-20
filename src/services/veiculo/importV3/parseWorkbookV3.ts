// PR-1.1 V3 — Parser XLSX-only. Sem CSV, sem HTML, sem heurística fuzzy.
// Valida abas, cabeçalhos exatos, metadados; aplica Zod por linha;
// detecta duplicidade canônica e valida compatibilidade fabricante/modelo via LISTAS.

import * as XLSX from 'xlsx';
import {
  SCHEMA_VERSION,
  ABA_EQUIPAMENTOS, ABA_LISTAS, ABA_METADADOS,
} from './constants';
import {
  CABECALHOS_EQUIPAMENTOS, CHAVES_METADADOS, COLUNAS_LISTAS,
  parseCamposAtualizar,
} from './equipamentosImportExportSchema';
import { equipamentoRowSchema, type EquipamentoRowV3 } from './zodSchema';

export type CodigoBloqueio =
  | 'BLOQUEADA_DUPLICIDADE_CANONICA'
  | 'MODELO_INCOMPATIVEL_COM_FABRICANTE';

export type CodigoErroLinha =
  | 'CABECALHO_INVALIDO' | 'ABA_AUSENTE' | 'METADADOS_INVALIDOS'
  | 'SCHEMA_VERSION_INCOMPATIVEL' | 'LINHA_INVALIDA';

export interface ErroLinhaV3 {
  linha_excel: number;
  campo: string | null;
  mensagem: string;
  codigo: CodigoErroLinha;
}

export interface ParsedEquipamentoLinha {
  linha_excel: number;
  raw: Record<string, unknown>;
  parsed: EquipamentoRowV3;
}

export interface LinhaBloqueada {
  linha_excel: number;
  raw: Record<string, unknown>;
  parsed?: EquipamentoRowV3;
  codigo: CodigoBloqueio;
  mensagem: string;
}

export interface ParseWorkbookV3Result {
  schema_version: string;
  metadados: Record<string, string>;
  linhas: ParsedEquipamentoLinha[];
  linhas_invalidas: Array<{ linha_excel: number; raw: Record<string, unknown>; erros: ErroLinhaV3[] }>;
  linhas_bloqueadas: LinhaBloqueada[];
  listas: Array<Record<string, string>>;
  erros_globais: ErroLinhaV3[];
}

function celStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function extrairListas(wb: XLSX.WorkBook): Array<Record<string, string>> {
  const listas: Array<Record<string, string>> = [];
  if (!wb.SheetNames.includes(ABA_LISTAS)) return listas;
  const wsL = wb.Sheets[ABA_LISTAS];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wsL, { header: 1, raw: false, defval: null });
  if (rows.length <= 1) return listas;
  const header = (rows[0] as unknown[]).map((c) => celStr(c).trim());
  for (let i = 1; i < rows.length; i++) {
    const r = (rows[i] as unknown[]) ?? [];
    const obj: Record<string, string> = {};
    for (const key of COLUNAS_LISTAS) {
      const colIdx = header.indexOf(key);
      obj[key] = colIdx >= 0 ? celStr(r[colIdx]).trim() : '';
    }
    if (obj.tipo_catalogo) listas.push(obj);
  }
  return listas;
}

export function parseWorkbookV3(buffer: ArrayBuffer): ParseWorkbookV3Result {
  const wb = XLSX.read(buffer, { type: 'array', cellFormula: false, cellDates: false });
  const errosGlobais: ErroLinhaV3[] = [];

  for (const aba of [ABA_EQUIPAMENTOS, ABA_METADADOS] as const) {
    if (!wb.SheetNames.includes(aba)) {
      errosGlobais.push({ linha_excel: 0, campo: null, codigo: 'ABA_AUSENTE',
        mensagem: `Aba obrigatória "${aba}" não encontrada.` });
    }
  }
  if (errosGlobais.length > 0) {
    return { schema_version: '', metadados: {}, linhas: [], linhas_invalidas: [],
      linhas_bloqueadas: [], listas: [], erros_globais: errosGlobais };
  }

  // ─── METADADOS ───────────────────────────────────────────────────────────
  const wsMeta = wb.Sheets[ABA_METADADOS];
  const metaRows = XLSX.utils.sheet_to_json<unknown[]>(wsMeta, { header: 1, raw: false, defval: null });
  const meta: Record<string, string> = {};
  for (let i = 1; i < metaRows.length; i++) {
    const r = metaRows[i] ?? [];
    const k = celStr(r[0]).trim();
    const v = celStr(r[1]).trim();
    if (k) meta[k] = v;
  }
  const schema = meta.schema_version ?? '';
  if (schema !== SCHEMA_VERSION) {
    errosGlobais.push({
      linha_excel: 0, campo: 'schema_version', codigo: 'SCHEMA_VERSION_INCOMPATIVEL',
      mensagem: `schema_version esperado "${SCHEMA_VERSION}", recebido "${schema}".`,
    });
  }
  for (const k of CHAVES_METADADOS) {
    if (!(k in meta)) {
      errosGlobais.push({ linha_excel: 0, campo: k, codigo: 'METADADOS_INVALIDOS',
        mensagem: `Metadado obrigatório "${k}" ausente.` });
    }
  }

  // ─── LISTAS (lido antes para validações cruzadas) ────────────────────────
  const listas = extrairListas(wb);

  // ─── EQUIPAMENTOS: cabeçalho ─────────────────────────────────────────────
  const wsEq = wb.Sheets[ABA_EQUIPAMENTOS];
  const eqRows = XLSX.utils.sheet_to_json<unknown[]>(wsEq, { header: 1, raw: false, defval: null });
  if (eqRows.length === 0) {
    errosGlobais.push({ linha_excel: 1, campo: null, codigo: 'CABECALHO_INVALIDO',
      mensagem: 'Aba EQUIPAMENTOS vazia.' });
    return { schema_version: schema, metadados: meta, linhas: [], linhas_invalidas: [],
      linhas_bloqueadas: [], listas, erros_globais: errosGlobais };
  }
  const cabecalho = (eqRows[0] as unknown[]).map((c) => celStr(c).trim());
  for (let i = 0; i < CABECALHOS_EQUIPAMENTOS.length; i++) {
    if (cabecalho[i] !== CABECALHOS_EQUIPAMENTOS[i]) {
      errosGlobais.push({
        linha_excel: 1, campo: CABECALHOS_EQUIPAMENTOS[i], codigo: 'CABECALHO_INVALIDO',
        mensagem: `Cabeçalho coluna ${i + 1}: esperado "${CABECALHOS_EQUIPAMENTOS[i]}", recebido "${cabecalho[i] ?? ''}".`,
      });
    }
  }
  if (errosGlobais.some((e) => e.codigo === 'CABECALHO_INVALIDO')) {
    return { schema_version: schema, metadados: meta, linhas: [], linhas_invalidas: [],
      linhas_bloqueadas: [], listas, erros_globais: errosGlobais };
  }

  // ─── EQUIPAMENTOS: parsing por linha ─────────────────────────────────────
  const linhasOk: ParsedEquipamentoLinha[] = [];
  const linhasInvalidas: ParseWorkbookV3Result['linhas_invalidas'] = [];

  for (let i = 1; i < eqRows.length; i++) {
    const r = (eqRows[i] as unknown[]) ?? [];
    const raw: Record<string, unknown> = {};
    for (let j = 0; j < CABECALHOS_EQUIPAMENTOS.length; j++) {
      raw[CABECALHOS_EQUIPAMENTOS[j]] = r[j] ?? null;
    }
    if (Object.values(raw).every((v) => v === null || String(v).trim() === '')) continue;

    const linha_excel = i + 1;
    const result = equipamentoRowSchema.safeParse(raw);
    if (result.success) {
      linhasOk.push({ linha_excel, raw, parsed: result.data });
    } else {
      linhasInvalidas.push({
        linha_excel, raw,
        erros: result.error.issues.map((iss) => ({
          linha_excel, campo: iss.path.join('.') || null,
          codigo: 'LINHA_INVALIDA', mensagem: iss.message,
        })),
      });
    }
  }

  // ─── DUPLICIDADE CANÔNICA ────────────────────────────────────────────────
  const linhasBloqueadas: LinhaBloqueada[] = [];
  const porCanonico = new Map<string, ParsedEquipamentoLinha[]>();
  for (const l of linhasOk) {
    const key = String(l.parsed.codigo_canonico ?? '').toUpperCase();
    if (!key) continue;
    (porCanonico.get(key) ?? porCanonico.set(key, []).get(key)!).push(l);
  }
  const idsBloqueados = new Set<number>();
  for (const [canonico, group] of porCanonico) {
    if (group.length > 1) {
      for (const l of group) {
        idsBloqueados.add(l.linha_excel);
        linhasBloqueadas.push({
          linha_excel: l.linha_excel, raw: l.raw, parsed: l.parsed,
          codigo: 'BLOQUEADA_DUPLICIDADE_CANONICA',
          mensagem: `codigo_canonico "${canonico}" aparece em ${group.length} linhas — nenhuma pode ser aplicada.`,
        });
      }
    }
  }

  // ─── COMPATIBILIDADE FABRICANTE ↔ MODELO (via LISTAS) ────────────────────
  // Indexa LISTAS.MODELO por id_erp → parent_id_erp (fabricante).
  const modeloParaFabricante = new Map<string, string>();
  for (const l of listas) {
    if (l.tipo_catalogo === 'MODELO' && l.id_erp) {
      modeloParaFabricante.set(l.id_erp, l.parent_id_erp || '');
    }
  }
  // Estado atual (fabricante_id / modelo_id) do ativo via LISTAS.ATIVO_EXISTENTE.
  // A "contexto" opcional carrega fabricante_id;modelo_id no formato "fab_id:<uuid>|mod_id:<uuid>".
  const estadoAtualPorCanonico = new Map<string, { fab_id: string | null; mod_id: string | null }>();
  for (const l of listas) {
    if (l.tipo_catalogo !== 'ATIVO_EXISTENTE') continue;
    const key = (l.codigo || '').toUpperCase();
    if (!key) continue;
    const ctx = l.contexto || '';
    const fab = /fab_id:([^|]+)/.exec(ctx)?.[1] ?? null;
    const mod = /mod_id:([^|]+)/.exec(ctx)?.[1] ?? null;
    estadoAtualPorCanonico.set(key, { fab_id: fab, mod_id: mod });
  }

  for (const l of linhasOk) {
    if (idsBloqueados.has(l.linha_excel)) continue;
    if (l.parsed.acao !== 'ATUALIZAR') continue;
    const tokens = parseCamposAtualizar(String(l.parsed.campos_atualizar)).tokens;
    const setT = new Set(tokens);
    const tocaFab = setT.has('FABRICANTE');
    const tocaMod = setT.has('MODELO');
    if (!tocaFab && !tocaMod) continue;

    const atual = estadoAtualPorCanonico.get(String(l.parsed.codigo_canonico).toUpperCase()) ?? { fab_id: null, mod_id: null };
    const finalFab: string | null = tocaFab ? (l.parsed.fabricante_id_erp ?? null) : atual.fab_id;
    const finalMod: string | null = tocaMod ? (l.parsed.modelo_id_erp ?? null) : atual.mod_id;

    // FABRICANTE isolado com modelo final nulo → permitido.
    if (finalMod === null) continue;
    // MODELO final preenchido: exige compatibilidade contra fabricante final.
    const fabDoModelo = modeloParaFabricante.get(finalMod);
    if (fabDoModelo === undefined) continue; // LISTAS sem mapa → não bloqueia (validação backend).
    if (finalFab && fabDoModelo && fabDoModelo === finalFab) continue;
    // Incompatível.
    idsBloqueados.add(l.linha_excel);
    linhasBloqueadas.push({
      linha_excel: l.linha_excel, raw: l.raw, parsed: l.parsed,
      codigo: 'MODELO_INCOMPATIVEL_COM_FABRICANTE',
      mensagem: `Modelo final (${finalMod}) não pertence ao fabricante final (${finalFab ?? 'nulo'}).`,
    });
  }

  const linhas = linhasOk.filter((l) => !idsBloqueados.has(l.linha_excel));

  return {
    schema_version: schema, metadados: meta,
    linhas, linhas_invalidas: linhasInvalidas, linhas_bloqueadas: linhasBloqueadas,
    listas, erros_globais: errosGlobais,
  };
}
