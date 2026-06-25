// Fase 7A — Parser nativo de MS Project XML (schema 2003).
// Reusa o pipeline de validação (construirPreview, processarCatalogoRecursos, processarAlocacoes)
// gerando linhas com cabeçalhos canônicos do mapeador.
//
// Preserva UID/ID externo, WBS, OutlineNumber/OutlineLevel, Summary, Milestone,
// Duration/Work, PercentComplete (preview-only) e tenta resolver "Família" via
// ExtendedAttributes + OutlineCodes.

import { XMLParser } from "fast-xml-parser";
import { construirPreview } from "./validar";
import { processarAlocacoes, processarCatalogoRecursos } from "./parseAlocacoes";
import { normalizarDataMsProject, durationIsoParaHoras } from "./normalizarDataMsProject";
import type {
  AvisoParser,
  CentroCustoSelecionado,
  ProjetoDetectado,
  RecursoCatalogoPreview,
  ResultadoParse,
} from "./tipos";

interface ExtAttrAliasInfo {
  alias: string;
  fieldName: string | null;
}

// ----- helpers -----

function asArray<T>(v: T | T[] | null | undefined): T[] {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function textOrNull(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (Array.isArray(v)) {
    if (v.length === 0) return null;
    return textOrNull(v[0]);
  }
  if (typeof v === "object") return null;
  const s = String(v).trim();
  return s ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolFromMsp(v: unknown): boolean {
  const s = String(v ?? "").trim();
  return s === "1" || s.toLowerCase() === "true";
}

function normAlias(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

const ALIASES_FAMILIA_NORM = new Set([
  "familia",
  "family",
  "text1",
  "outlinecode1",
]);

// Fase 1C — aliases ExtendedAttribute para quantidade/unidade física.
const ALIASES_QUANTIDADE_NORM = new Set([
  "quantidade",
  "quantidade prevista",
  "quantity",
  "qtd",
  "qtde",
]);
const ALIASES_UNIDADE_NORM = new Set([
  "unidade",
  "unidade de medida",
  "unit",
  "uom",
]);

function ehAliasFamilia(alias: string | null | undefined, fieldName: string | null | undefined): boolean {
  if (ALIASES_FAMILIA_NORM.has(normAlias(alias))) return true;
  if (ALIASES_FAMILIA_NORM.has(normAlias(fieldName))) return true;
  return false;
}

function ehAliasQuantidade(alias: string | null | undefined, fieldName: string | null | undefined): boolean {
  if (ALIASES_QUANTIDADE_NORM.has(normAlias(alias))) return true;
  if (ALIASES_QUANTIDADE_NORM.has(normAlias(fieldName))) return true;
  return false;
}

function ehAliasUnidade(alias: string | null | undefined, fieldName: string | null | undefined): boolean {
  if (ALIASES_UNIDADE_NORM.has(normAlias(alias))) return true;
  if (ALIASES_UNIDADE_NORM.has(normAlias(fieldName))) return true;
  return false;
}

// ----- main parser -----

export interface ParseMsProjectXmlOptions {
  cc: CentroCustoSelecionado;
  nomeArquivo: string;
  formato: "xml_msproject" | "csv_com_xml";
}

export interface ParseMsProjectXmlResult extends ResultadoParse {
  projetoDetectado: ProjetoDetectado | null;
  avisos: AvisoParser[];
}

export function parseMsProjectXml(
  xmlConteudo: string,
  opts: ParseMsProjectXmlOptions,
): ParseMsProjectXmlResult {
  const avisos: AvisoParser[] = [];

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: true,
    isArray: (name) => {
      // garantir arrays para nós repetíveis
      return [
        "Task",
        "Resource",
        "Assignment",
        "ExtendedAttribute",
        "OutlineCode",
        "Value",
        "ValueList",
      ].includes(name);
    },
  });

  let doc: Record<string, unknown>;
  try {
    doc = parser.parse(xmlConteudo) as Record<string, unknown>;
  } catch (err) {
    avisos.push({
      codigo: "XML_INVALIDO",
      mensagem: `Falha ao interpretar XML: ${err instanceof Error ? err.message : String(err)}`,
    });
    return montarResultadoVazio(opts, avisos, "Arquivo XML inválido — não foi possível interpretar.");
  }

  const project = (doc as { Project?: Record<string, unknown> }).Project;
  if (!project) {
    avisos.push({ codigo: "PROJECT_AUSENTE", mensagem: "Tag <Project> não encontrada." });
    return montarResultadoVazio(opts, avisos, "Arquivo XML não contém um nó <Project>.");
  }

  // Cabeçalho
  const projetoDetectado: ProjetoDetectado = {
    uid: textOrNull(project["UID"]),
    nome: textOrNull(project["Name"]) ?? textOrNull(project["Title"]),
    autor: textOrNull(project["Author"]),
    dataCriacao: normalizarDataMsProject(project["CreationDate"]),
    dataInicioProjeto: normalizarDataMsProject(project["StartDate"]),
    dataFimProjeto: normalizarDataMsProject(project["FinishDate"]),
    calendarioPadrao: textOrNull(project["CalendarUID"]),
  };

  // --- ExtendedAttributes: FieldID → {alias, fieldName} ---
  const extAttrMap = new Map<string, ExtAttrAliasInfo>();
  const extAttrsRoot = project["ExtendedAttributes"] as
    | { ExtendedAttribute?: unknown }
    | undefined;
  for (const ea of asArray(extAttrsRoot?.ExtendedAttribute)) {
    const r = ea as Record<string, unknown>;
    const fid = textOrNull(r["FieldID"]);
    if (!fid) continue;
    extAttrMap.set(fid, {
      alias: textOrNull(r["Alias"]) ?? "",
      fieldName: textOrNull(r["FieldName"]),
    });
  }

  // --- OutlineCodes: FieldID → Map<ValueID, ValueText> ---
  const outlineValuesPorField = new Map<string, Map<string, string>>();
  const outlineRoot = project["OutlineCodes"] as { OutlineCode?: unknown } | undefined;
  for (const oc of asArray(outlineRoot?.OutlineCode)) {
    const r = oc as Record<string, unknown>;
    const fid = textOrNull(r["FieldID"]);
    if (!fid) continue;
    const m = new Map<string, string>();
    const values = (r["Values"] as { Value?: unknown } | undefined)?.Value;
    for (const v of asArray(values)) {
      const vr = v as Record<string, unknown>;
      const vid =
        textOrNull(vr["ValueID"]) ?? textOrNull(vr["ValueIDInt"]) ?? null;
      const vtxt = textOrNull(vr["FieldValue"]) ?? textOrNull(vr["Value"]);
      if (vid && vtxt) m.set(vid, vtxt);
    }
    outlineValuesPorField.set(fid, m);
    if (!extAttrMap.has(fid)) {
      // OutlineCode também pode ter alias = "Família"
      extAttrMap.set(fid, {
        alias: textOrNull(r["Alias"]) ?? "",
        fieldName: textOrNull(r["FieldName"]),
      });
    }
  }

  function resolverFamiliaDeExtAttrs(node: Record<string, unknown>): string | null {
    const eas = asArray((node["ExtendedAttribute"] ?? null) as unknown);
    for (const ea of eas) {
      const r = ea as Record<string, unknown>;
      const fid = textOrNull(r["FieldID"]);
      if (!fid) continue;
      const info = extAttrMap.get(fid);
      if (!info) continue;
      if (!ehAliasFamilia(info.alias, info.fieldName)) continue;
      const valueIDRef = textOrNull(r["ValueID"]);
      const valueText = textOrNull(r["Value"]);
      if (valueIDRef) {
        const lookup = outlineValuesPorField.get(fid);
        const resolved = lookup?.get(valueIDRef);
        if (resolved) return resolved;
      }
      if (valueText) return valueText;
    }
    return null;
  }

  // Fase 1C — resolve quantidade física via ExtendedAttribute (Number/Text com alias).
  function resolverQuantidadeDeExtAttrs(node: Record<string, unknown>): number | null {
    const eas = asArray((node["ExtendedAttribute"] ?? null) as unknown);
    for (const ea of eas) {
      const r = ea as Record<string, unknown>;
      const fid = textOrNull(r["FieldID"]);
      if (!fid) continue;
      const info = extAttrMap.get(fid);
      if (!info) continue;
      if (!ehAliasQuantidade(info.alias, info.fieldName)) continue;
      const v = numOrNull(r["Value"]);
      if (v != null) return v;
    }
    return null;
  }

  function resolverUnidadeDeExtAttrs(node: Record<string, unknown>): string | null {
    const eas = asArray((node["ExtendedAttribute"] ?? null) as unknown);
    for (const ea of eas) {
      const r = ea as Record<string, unknown>;
      const fid = textOrNull(r["FieldID"]);
      if (!fid) continue;
      const info = extAttrMap.get(fid);
      if (!info) continue;
      if (!ehAliasUnidade(info.alias, info.fieldName)) continue;
      const v = textOrNull(r["Value"]);
      if (v) return v;
    }
    return null;
  }

  // --- Tasks ---
  const tasksRoot = project["Tasks"] as { Task?: unknown } | undefined;
  const tasks = asArray(tasksRoot?.Task) as Array<Record<string, unknown>>;
  const tasksRows: Array<Record<string, unknown>> = [];
  const enriquecimentoPorLinha = new Map<
    number,
    {
      outline_number: string | null;
      outline_level: number | null;
      is_resumo: boolean;
      is_marco: boolean;
      duracao_horas: number | null;
      trabalho_previsto_horas: number | null;
      percentual_concluido_importado: number | null;
      familia: string | null;
      // Fase 1C
      is_critica: boolean;
      quantidade_ext: number | null;
      unidade_ext: string | null;
    }
  >();

  tasks.forEach((t, idx) => {
    const linhaOriginal = idx + 2; // mesmo padrão do construirPreview (header=1)
    const uid = textOrNull(t["UID"]);
    const id = textOrNull(t["ID"]);
    const nome = textOrNull(t["Name"]) ?? "";
    const wbs = textOrNull(t["WBS"]);
    const start = normalizarDataMsProject(t["Start"]);
    const finish = normalizarDataMsProject(t["Finish"]);
    const summary = boolFromMsp(t["Summary"]);
    const milestone = boolFromMsp(t["Milestone"]);
    const outlineNumber = textOrNull(t["OutlineNumber"]);
    const outlineLevel = numOrNull(t["OutlineLevel"]);
    const duracaoHoras = durationIsoParaHoras(t["Duration"]);
    const trabalhoHoras = durationIsoParaHoras(t["Work"]);
    const pct = numOrNull(t["PercentComplete"]);
    const familia = resolverFamiliaDeExtAttrs(t);
    // Fase 1C — Critical + ExtendedAttributes opcionais (quantidade/unidade).
    const isCritica = boolFromMsp(t["Critical"]);
    const quantidadeExt = resolverQuantidadeDeExtAttrs(t);
    const unidadeExt = resolverUnidadeDeExtAttrs(t);

    tasksRows.push({
      "UID Tarefa": uid,
      "Nome": nome,
      "Data Início": start,
      "Data Fim": finish,
      "WBS": wbs,
      // Tipo linha — para que `ehLinhaResumo` marque como ignored
      "Summary": summary ? "Sim" : "Não",
      // Apenas para visibilidade — não impacta validador
      "Outline Number": outlineNumber,
    });

    enriquecimentoPorLinha.set(linhaOriginal, {
      outline_number: outlineNumber,
      outline_level: outlineLevel,
      is_resumo: summary,
      is_marco: milestone,
      duracao_horas: duracaoHoras,
      trabalho_previsto_horas: trabalhoHoras,
      percentual_concluido_importado: pct,
      familia,
      is_critica: isCritica,
      quantidade_ext: quantidadeExt,
      unidade_ext: unidadeExt,
    });

    if (!familia) {
      avisos.push({
        codigo: "FAMILIA_NAO_RESOLVIDA",
        mensagem: `Tarefa "${nome || uid || "?"}" sem família resolvida.`,
        ref: uid,
      });
    }
    // (mantemos id em referência para fallback)
    void id;
  });

  // Pipeline padrão — construirPreview valida e produz AtividadeImportadaPreview[]
  const cabecalhosTarefas = ["UID Tarefa", "Nome", "Data Início", "Data Fim", "WBS", "Summary", "Outline Number"];
  const base = construirPreview({
    formato: opts.formato === "xml_msproject" ? "xml_msproject" : "csv_com_xml",
    origem: "importacao_msproject",
    nomeArquivo: opts.nomeArquivo,
    linhas: tasksRows,
    cabecalhos: cabecalhosTarefas,
    cc: opts.cc,
  });

  // Anexa id_externo + enriquecimentos por linha
  base.atividades.forEach((a) => {
    const enr = enriquecimentoPorLinha.get(a.linhaOriginal);
    if (!enr) return;
    a.outline_number = enr.outline_number;
    a.outline_level = enr.outline_level;
    a.is_resumo = enr.is_resumo;
    a.is_marco = enr.is_marco;
    a.duracao_horas = enr.duracao_horas;
    a.trabalho_previsto_horas = enr.trabalho_previsto_horas;
    a.percentual_concluido_importado = enr.percentual_concluido_importado;
    // Fase 1C — criticidade + quantidade/unidade via ExtendedAttribute.
    a.is_critica = enr.is_critica;
    if (enr.quantidade_ext != null) a.quantidade_prevista = enr.quantidade_ext;
    if (enr.unidade_ext) a.unidade = enr.unidade_ext;
    if (enr.quantidade_ext != null || (enr.unidade_ext ?? "").trim() !== "") {
      a.quantidade_origem = "msproject_extattr";
    } else {
      a.quantidade_origem = "indefinido";
    }
    // ID externo do MS Project (vem do <ID> da tarefa)
    const tIdx = a.linhaOriginal - 2;
    const rawTask = tasks[tIdx];
    if (rawTask) {
      a.idTarefa = textOrNull(rawTask["ID"]) ?? a.idTarefa;
    }
  });

  // --- Resources (catálogo) ---
  const resourcesRoot = project["Resources"] as { Resource?: unknown } | undefined;
  const resources = asArray(resourcesRoot?.Resource) as Array<Record<string, unknown>>;
  const catalogoRows: Array<Record<string, unknown>> = [];
  for (const r of resources) {
    const familia = resolverFamiliaDeExtAttrs(r) ?? textOrNull(r["Group"]);
    if (!familia) {
      avisos.push({
        codigo: "FAMILIA_NAO_RESOLVIDA",
        mensagem: `Recurso "${textOrNull(r["Name"]) ?? textOrNull(r["UID"]) ?? "?"}" sem família detectável.`,
        ref: textOrNull(r["UID"]),
      });
    }
    catalogoRows.push({
      "UID Recurso": textOrNull(r["UID"]),
      "ID Recurso": textOrNull(r["ID"]),
      "Nome Recurso": textOrNull(r["Name"]),
      "Grupo": textOrNull(r["Group"]),
      "Família": familia,
      "Unidade": textOrNull(r["MaterialLabel"]) ?? null,
    });
  }
  const catalogoHeaders = ["UID Recurso", "ID Recurso", "Nome Recurso", "Grupo", "Família", "Unidade"];
  let catalogo: RecursoCatalogoPreview[] = [];
  if (catalogoRows.length > 0) {
    catalogo = processarCatalogoRecursos(catalogoRows, catalogoHeaders);
  }
  base.recursosCatalogo = catalogo;

  // --- Assignments ---
  const assignmentsRoot = project["Assignments"] as { Assignment?: unknown } | undefined;
  const assignments = asArray(assignmentsRoot?.Assignment) as Array<Record<string, unknown>>;
  // Para enriquecer alocações com nomeTarefa/WBS lookup TaskUID→task
  const tasksPorUid = new Map<string, Record<string, unknown>>();
  for (const t of tasks) {
    const uid = textOrNull(t["UID"]);
    if (uid) tasksPorUid.set(uid, t);
  }
  const recursosPorUid = new Map<string, Record<string, unknown>>();
  for (const r of resources) {
    const uid = textOrNull(r["UID"]);
    if (uid) recursosPorUid.set(uid, r);
  }

  const assignRows: Array<Record<string, unknown>> = [];
  for (const a of assignments) {
    const taskUid = textOrNull(a["TaskUID"]);
    const resUid = textOrNull(a["ResourceUID"]);
    const task = taskUid ? tasksPorUid.get(taskUid) : undefined;
    const res = resUid ? recursosPorUid.get(resUid) : undefined;
    if (!res) continue; // sem recurso, não há atribuição utilizável
    const familia =
      (res ? resolverFamiliaDeExtAttrs(res) : null) ??
      (task ? resolverFamiliaDeExtAttrs(task) : null) ??
      (res ? textOrNull(res["Group"]) : null);
    assignRows.push({
      "UID Tarefa": taskUid,
      "WBS": task ? textOrNull(task["WBS"]) : null,
      "Nome Tarefa": task ? textOrNull(task["Name"]) : null,
      "UID Recurso": resUid,
      "Nome Recurso": res ? textOrNull(res["Name"]) : null,
      "Grupo": res ? textOrNull(res["Group"]) : null,
      "Família": familia,
      "Trabalho Horas": durationIsoParaHoras(a["Work"]),
      "Unidades": numOrNull(a["Units"]),
    });
  }

  if (assignRows.length > 0) {
    const headersAtrib = [
      "UID Tarefa",
      "WBS",
      "Nome Tarefa",
      "UID Recurso",
      "Nome Recurso",
      "Grupo",
      "Família",
      "Trabalho Horas",
      "Unidades",
    ];
    const { alocacoes, resumo } = processarAlocacoes(
      assignRows,
      headersAtrib,
      base.atividades,
      catalogo,
    );
    base.alocacoes = alocacoes;
    base.recursos = resumo;
  }

  // Campos visíveis em preview mas não persistidos nesta fase:
  const camposNaoPersistidos = ["percentual_concluido_importado"];

  return {
    ...base,
    projetoDetectado,
    avisos,
    camposNaoPersistidos,
  };
}

function montarResultadoVazio(
  opts: ParseMsProjectXmlOptions,
  avisos: AvisoParser[],
  motivo: string,
): ParseMsProjectXmlResult {
  return {
    formato: opts.formato === "xml_msproject" ? "xml_msproject" : "csv_com_xml",
    origem: "importacao_msproject",
    nomeArquivo: opts.nomeArquivo,
    totalLinhas: 0,
    atividades: [],
    cc: { presente: false, valorBruto: null, divergente: false },
    globalErrors: [motivo],
    globalWarnings: [],
    bloqueado: true,
    motivoBloqueio: motivo,
    periodo: { inicio: null, fim: null },
    resumo: { validas: 0, ignoradas: 0, comErro: 0 },
    alocacoes: [],
    recursosCatalogo: [],
    recursos: null,
    projetoDetectado: null,
    avisos,
  };
}
