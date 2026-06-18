// Fase 6H.1.1 / 6I.2-B — Parser puro das abas Recursos e Atribuições.
// Resolve vínculo alocação→atividade em memória usando UID → ID → WBS+Nome → Nome.
// Resolve recurso da atribuição via catálogo (Recursos) — catálogo vence.
//
// REGRA DE PERSISTÊNCIA (6I.2-B): apenas MOD/MOI operacional saem com motivoIgnorado=null.
// EQ/MAT/SUB/ADM e FATURAMENTO SEMPRE saem com motivoIgnorado ≠ null,
// garantindo que o filtro do hook de gravação não os envie ao banco.

import {
  chaveNomeFuncao,
  mapearCabecalhosAlocacoes,
  mapearCabecalhosRecursos,
  norm,
  type MapaCabecalhoAlocacao,
  type MapaCabecalhoRecurso,
} from "./mapearColunas";
import { parseNumeroBR } from "./validar";
import type {
  AlocacaoPreview,
  AtividadeImportadaPreview,
  DivergenciaFamiliaItem,
  FamiliaRecurso,
  GrupoRecurso,
  NaturezaOperacional,
  RecursoCatalogoPreview,
  RecursosImportacaoResumo,
  SuspeitaClassificacaoItem,
} from "./tipos";

function getStr(row: Record<string, unknown>, key: string | undefined): string | null {
  if (!key) return null;
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

const FAMILIAS_VALIDAS: Record<string, FamiliaRecurso> = {
  mod: "MOD",
  moi: "MOI",
  eq: "EQ",
  equipamento: "EQ",
  equipamentos: "EQ",
  mat: "MAT",
  material: "MAT",
  materiais: "MAT",
  sub: "SUB",
  subempreiteiro: "SUB",
  subempreiteiros: "SUB",
  adm: "ADM",
  administrativo: "ADM",
  administracao: "ADM",
  "adm contratual": "ADM_CONTRATUAL",
  adm_contratual: "ADM_CONTRATUAL",
  admcontratual: "ADM_CONTRATUAL",
  "administrativo contratual": "ADM_CONTRATUAL",
  se: "SE",
  servico: "SE",
  servicos: "SE",
};

function classificarFamilia(raw: string | null): FamiliaRecurso {
  if (!raw) return "desconhecida";
  const n = norm(raw);
  if (FAMILIAS_VALIDAS[n]) return FAMILIAS_VALIDAS[n];
  for (const key of Object.keys(FAMILIAS_VALIDAS)) {
    if (n === key || n.split(" ").includes(key)) return FAMILIAS_VALIDAS[key];
  }
  return "desconhecida";
}


function classificarGrupo(raw: string | null): GrupoRecurso {
  if (!raw) return "desconhecido";
  const n = norm(raw);
  if (n.includes("faturamento") || n === "fat") return "FATURAMENTO";
  if (n.includes("insumo") || n === "ins" || n.includes("operacional")) return "INSUMOS";
  return "desconhecido";
}

/**
 * Heurística conservadora de classificação. NÃO altera família/tipo;
 * apenas gera "suspeita" para diagnóstico no preview/XLSX.
 */
const DICIONARIO_SUSPEITAS: Array<{ regex: RegExp; familia: FamiliaRecurso; motivo: string }> = [
  { regex: /\b(escavadeira|retro|retroescavadeira|p[áa] carregadeira|carregadeira|caminh[ãa]o|rolo|motoniveladora|p[áa] mec[âa]nica|trator|moto[ -]?nivel|vibroacabadora|fresadora|acabadora|usina)\b/i, familia: "EQ", motivo: "Nome compatível com equipamento" },
  { regex: /\b(cimento|brita|areia|cap|asfalto|emuls[ãa]o|a[çc]o|concreto|agregado|p[óo] de pedra|cimento asf[áa]ltico|cbuq|pmf)\b/i, familia: "MAT", motivo: "Nome compatível com material" },
  { regex: /\b(terceirizado|empreiteiro|subempreiteiro|subcontratado)\b/i, familia: "SUB", motivo: "Nome compatível com subempreiteiro" },
];

function detectarSuspeita(
  nome: string | null,
  familiaInformada: FamiliaRecurso,
): { familiaSugerida: FamiliaRecurso; motivo: string } | null {
  if (!nome) return null;
  for (const d of DICIONARIO_SUSPEITAS) {
    if (d.regex.test(nome) && familiaInformada !== d.familia) {
      return { familiaSugerida: d.familia, motivo: d.motivo };
    }
  }
  return null;
}

interface IndicesAtividades {
  porUid: Map<string, number>;
  porId: Map<string, number>;
  porWbsNome: Map<string, number[]>;
  porNome: Map<string, number[]>;
}

function construirIndices(atividades: AtividadeImportadaPreview[]): IndicesAtividades {
  const porUid = new Map<string, number>();
  const porId = new Map<string, number>();
  const porWbsNome = new Map<string, number[]>();
  const porNome = new Map<string, number[]>();

  for (const a of atividades) {
    if (a.ignored) continue;
    if (a.uidTarefa) porUid.set(a.uidTarefa.trim(), a.linhaOriginal);
    if (a.idTarefa) porId.set(a.idTarefa.trim(), a.linhaOriginal);

    const nomeKey = chaveNomeFuncao(a.nome);
    if (nomeKey) {
      const arrNome = porNome.get(nomeKey) ?? [];
      arrNome.push(a.linhaOriginal);
      porNome.set(nomeKey, arrNome);

      if (a.codigo_wbs) {
        const k = `${a.codigo_wbs.trim()}|${nomeKey}`;
        const arr = porWbsNome.get(k) ?? [];
        arr.push(a.linhaOriginal);
        porWbsNome.set(k, arr);
      }
    }
  }
  return { porUid, porId, porWbsNome, porNome };
}

function resolverVinculo(
  aloc: Pick<AlocacaoPreview, "uidTarefa" | "idTarefa" | "wbsTarefa" | "nomeTarefa">,
  idx: IndicesAtividades,
): { linha: number | null; ambiguo: boolean } {
  if (aloc.uidTarefa && idx.porUid.has(aloc.uidTarefa.trim())) {
    return { linha: idx.porUid.get(aloc.uidTarefa.trim())!, ambiguo: false };
  }
  if (aloc.idTarefa && idx.porId.has(aloc.idTarefa.trim())) {
    return { linha: idx.porId.get(aloc.idTarefa.trim())!, ambiguo: false };
  }
  const nomeKey = chaveNomeFuncao(aloc.nomeTarefa);
  if (aloc.wbsTarefa && nomeKey) {
    const k = `${aloc.wbsTarefa.trim()}|${nomeKey}`;
    const hits = idx.porWbsNome.get(k);
    if (hits && hits.length === 1) return { linha: hits[0], ambiguo: false };
    if (hits && hits.length > 1) return { linha: null, ambiguo: true };
  }
  if (nomeKey) {
    const hits = idx.porNome.get(nomeKey);
    if (hits && hits.length === 1) return { linha: hits[0], ambiguo: false };
    if (hits && hits.length > 1) return { linha: null, ambiguo: true };
  }
  return { linha: null, ambiguo: false };
}

// ---------- Catálogo de Recursos (aba Recursos) ----------

interface IndicesCatalogo {
  porUid: Map<string, RecursoCatalogoPreview>;
  porId: Map<string, RecursoCatalogoPreview>;
  porNome: Map<string, RecursoCatalogoPreview>;
}

function indexarCatalogo(catalogo: RecursoCatalogoPreview[]): IndicesCatalogo {
  const porUid = new Map<string, RecursoCatalogoPreview>();
  const porId = new Map<string, RecursoCatalogoPreview>();
  const porNome = new Map<string, RecursoCatalogoPreview>();
  for (const r of catalogo) {
    if (r.uidRecurso) porUid.set(r.uidRecurso.trim(), r);
    if (r.idRecurso) porId.set(r.idRecurso.trim(), r);
    const k = chaveNomeFuncao(r.nomeRecurso);
    if (k && !porNome.has(k)) porNome.set(k, r);
  }
  return { porUid, porId, porNome };
}

export function processarCatalogoRecursos(
  linhas: Record<string, unknown>[],
  cabecalhos: string[],
): RecursoCatalogoPreview[] {
  const mapa: MapaCabecalhoRecurso = mapearCabecalhosRecursos(cabecalhos);
  const out: RecursoCatalogoPreview[] = [];

  linhas.forEach((row, i) => {
    const nomeRecurso = getStr(row, mapa.nome_recurso);
    if (!nomeRecurso) return;
    const grupoBruto = getStr(row, mapa.grupo);
    const familiaBruta = getStr(row, mapa.familia);
    out.push({
      linhaOriginal: i + 2,
      uidRecurso: getStr(row, mapa.uid_recurso),
      idRecurso: getStr(row, mapa.id_recurso),
      nomeRecurso,
      grupoBruto,
      grupo: classificarGrupo(grupoBruto),
      familiaBruta,
      familia: classificarFamilia(familiaBruta),
      unidadeMedida: getStr(row, mapa.unidade_medida),
      observacoes: getStr(row, mapa.observacoes),
    });
  });

  return out;
}

// ---------- Atribuições ----------

export interface ResultadoParseAlocacoes {
  alocacoes: AlocacaoPreview[];
  resumo: RecursosImportacaoResumo;
}

// 6I.2-C: EQ/MAT/SUB/ADM/ADM_CONTRATUAL passam a ser persistidos como operacionais.
const FAMILIAS_OPERACIONAIS_AMPLIADAS: FamiliaRecurso[] = [
  "MOD",
  "MOI",
  "EQ",
  "MAT",
  "SUB",
  "ADM",
  "ADM_CONTRATUAL",
];

function familiaEhOperacionalAmpliada(f: FamiliaRecurso): boolean {
  return FAMILIAS_OPERACIONAIS_AMPLIADAS.includes(f);
}

export function processarAlocacoes(
  linhas: Record<string, unknown>[],
  cabecalhos: string[],
  atividades: AtividadeImportadaPreview[],
  catalogo: RecursoCatalogoPreview[] = [],
): ResultadoParseAlocacoes {
  const mapa: MapaCabecalhoAlocacao = mapearCabecalhosAlocacoes(cabecalhos);
  const idx = construirIndices(atividades);
  const idxCat = indexarCatalogo(catalogo);
  const temCatalogo = catalogo.length > 0;

  const alocacoes: AlocacaoPreview[] = [];
  const ignoradasPorFamiliaDetalhe: Record<string, number> = {};
  const alocacoesSemAtividade: RecursosImportacaoResumo["alocacoesSemAtividade"] = [];
  const divergenciasFamilia: DivergenciaFamiliaItem[] = [];
  const suspeitasClassificacao: SuspeitaClassificacaoItem[] = [];
  const porFamiliaEfetiva: Record<string, number> = {};
  const diagnosticoPorFamilia: Record<string, number> = {};

  let detectadasMaoObra = 0;
  let ignoradasPorFamilia = 0;
  let semAtividade = 0;
  let ambiguos = 0;
  let diagnosticoTotal = 0;
  let diagnosticoHoras = 0;
  let faturamentoAtribuicoes = 0;
  let faturamentoHoras = 0;

  linhas.forEach((row, idxRow) => {
    const linhaOriginal = idxRow + 2;
    const uidTarefa = getStr(row, mapa.uid_tarefa);
    const idTarefa = getStr(row, mapa.id_tarefa);
    const wbsTarefa = getStr(row, mapa.wbs_tarefa);
    const nomeTarefa = getStr(row, mapa.nome_tarefa);
    const uidRecurso = getStr(row, mapa.uid_recurso);
    const idRecurso = getStr(row, mapa.id_recurso);
    const nomeRecurso = getStr(row, mapa.nome_recurso);
    const familiaBruta = getStr(row, mapa.familia);
    const grupoBruto = getStr(row, mapa.grupo);

    if (!nomeRecurso) return;

    // Resolve recurso no catálogo (UID → ID → nome). Catálogo vence.
    let recCat: RecursoCatalogoPreview | undefined;
    if (uidRecurso) recCat = idxCat.porUid.get(uidRecurso.trim());
    if (!recCat && idRecurso) recCat = idxCat.porId.get(idRecurso.trim());
    if (!recCat) recCat = idxCat.porNome.get(chaveNomeFuncao(nomeRecurso));

    const familiaDeclarada = classificarFamilia(familiaBruta);
    const grupoDeclarado = classificarGrupo(grupoBruto);

    const familiaEfetiva: FamiliaRecurso = recCat && recCat.familia !== "desconhecida"
      ? recCat.familia
      : familiaDeclarada;
    const grupoEfetivo: GrupoRecurso = recCat && recCat.grupo !== "desconhecido"
      ? recCat.grupo
      : grupoDeclarado;

    const divergenciaFamilia =
      recCat !== undefined &&
      recCat.familia !== "desconhecida" &&
      familiaDeclarada !== "desconhecida" &&
      recCat.familia !== familiaDeclarada;

    if (divergenciaFamilia) {
      divergenciasFamilia.push({
        linha: linhaOriginal,
        nomeRecurso,
        declarada: familiaDeclarada,
        efetiva: familiaEfetiva,
      });
    }

    const sus = detectarSuspeita(nomeRecurso, familiaEfetiva);
    if (sus) {
      suspeitasClassificacao.push({
        linha: linhaOriginal,
        nomeRecurso,
        familiaInformada: familiaEfetiva,
        familiaSugerida: sus.familiaSugerida,
        motivo: sus.motivo,
      });
    }

    const trabalhoRaw = mapa.trabalho_horas ? row[mapa.trabalho_horas] : null;
    const unidadesRaw = mapa.unidades ? row[mapa.unidades] : null;
    const trabalhoHoras = parseNumeroBR(trabalhoRaw).value;
    const unidades = parseNumeroBR(unidadesRaw).value;

    porFamiliaEfetiva[familiaEfetiva] = (porFamiliaEfetiva[familiaEfetiva] ?? 0) + 1;

    let natureza: NaturezaOperacional = "operacional";
    let motivoIgnorado: AlocacaoPreview["motivoIgnorado"] = null;

    // 1) FATURAMENTO sempre referência (não persistido)
    if (grupoEfetivo === "FATURAMENTO") {
      motivoIgnorado = "grupo_faturamento";
      natureza = "referencia";
      faturamentoAtribuicoes += 1;
      faturamentoHoras += trabalhoHoras ?? 0;
    }
    // 2) 6I.2-C — MOD/MOI/EQ/MAT/SUB/ADM/ADM_CONTRATUAL → operacional (segue fluxo)
    else if (familiaEhOperacionalAmpliada(familiaEfetiva)) {
      // segue para vínculo e (no caso MOD/MOI) resolução de função
    }
    // 3) SE / desconhecida → fora de escopo nesta fase
    else {
      motivoIgnorado = "familia_fora_escopo";
      ignoradasPorFamilia += 1;
      const chave = familiaEfetiva === "desconhecida" ? "OUTROS" : familiaEfetiva;
      ignoradasPorFamiliaDetalhe[chave] =
        (ignoradasPorFamiliaDetalhe[chave] ?? 0) + 1;
      // contabiliza também no diagnóstico para visibilidade
      diagnosticoTotal += 1;
      diagnosticoHoras += trabalhoHoras ?? 0;
      diagnosticoPorFamilia[familiaEfetiva] =
        (diagnosticoPorFamilia[familiaEfetiva] ?? 0) + 1;
    }


    const base: AlocacaoPreview = {
      linhaOriginal,
      uidTarefa,
      idTarefa,
      wbsTarefa,
      nomeTarefa,
      uidRecurso,
      idRecurso,
      nomeRecurso,
      grupoBruto,
      grupo: grupoEfetivo,
      familiaBruta,
      familiaDeclarada,
      familiaEfetiva,
      familia: familiaEfetiva,
      divergenciaFamilia,
      natureza,
      trabalhoHoras,
      unidades,
      vinculoAtividadeLinha: null,
      ambiguo: false,
      funcaoId: null,
      funcaoNomeResolvido: null,
      motivoIgnorado,
    };

    if (motivoIgnorado !== null) {
      alocacoes.push(base);
      return;
    }

    // Operacional (MOD/MOI/EQ/MAT/SUB/ADM/ADM_CONTRATUAL) — segue vínculo de atividade.
    if (familiaEfetiva === "MOD" || familiaEfetiva === "MOI") {
      detectadasMaoObra += 1;
    }
    const { linha, ambiguo } = resolverVinculo(base, idx);
    base.ambiguo = ambiguo;
    base.vinculoAtividadeLinha = linha;

    if (linha === null) {
      if (ambiguo) {
        ambiguos += 1;
        base.motivoIgnorado = "ambiguo";
      } else {
        semAtividade += 1;
        base.motivoIgnorado = "sem_atividade";
        alocacoesSemAtividade.push({ uidRecurso, nomeRecurso, uidTarefa, nomeTarefa });
      }
    }


    alocacoes.push(base);
  });

  // Contadores do catálogo
  const catalogoPorGrupo: Record<string, number> = {};
  const catalogoPorFamilia: Record<string, number> = {};
  let faturamentoRecursos = 0;
  for (const r of catalogo) {
    catalogoPorGrupo[r.grupo] = (catalogoPorGrupo[r.grupo] ?? 0) + 1;
    catalogoPorFamilia[r.familia] = (catalogoPorFamilia[r.familia] ?? 0) + 1;
    if (r.grupo === "FATURAMENTO") faturamentoRecursos += 1;
  }

  void temCatalogo; // (sinalizador para futura telemetria)

  const resumo: RecursosImportacaoResumo = {
    totalLinhasAba: linhas.length,
    detectadasMaoObra,
    ignoradasPorFamilia,
    semAtividade,
    ambiguos,
    semFuncao: 0,
    mapeados: 0,
    consolidacoes: 0,
    funcoesNaoMapeadas: [],
    alocacoesSemAtividade,
    ignoradasPorFamiliaDetalhe,
    catalogo: {
      total: catalogo.length,
      porGrupo: catalogoPorGrupo,
      porFamilia: catalogoPorFamilia,
    },
    porFamiliaEfetiva,
    diagnosticoNaoPersistido: {
      total: diagnosticoTotal,
      porFamilia: diagnosticoPorFamilia,
      horas: diagnosticoHoras,
    },
    faturamento: {
      atribuicoes: faturamentoAtribuicoes,
      recursosCatalogo: faturamentoRecursos,
      horas: faturamentoHoras,
    },
    divergenciasFamilia,
    suspeitasClassificacao,
  };

  return { alocacoes, resumo };
}

/**
 * Aplica resolução de funções (pós-consulta a bd_funcoes pelo orquestrador).
 * Apenas afeta MOD/MOI com vínculo. Não toca EQ/MAT/SUB/ADM/FATURAMENTO.
 */
export function aplicarResolucaoFuncoes(
  alocacoes: AlocacaoPreview[],
  resumo: RecursosImportacaoResumo,
  funcoesMap: Map<string, { id: string; nome_funcao: string }>,
): void {
  let mapeados = 0;
  let semFuncao = 0;
  const naoMapeadasMap = new Map<string, number>();

  for (const a of alocacoes) {
    if (a.familiaEfetiva !== "MOD" && a.familiaEfetiva !== "MOI") continue;
    if (a.motivoIgnorado === "sem_atividade" || a.motivoIgnorado === "ambiguo") continue;
    // segurança: nunca tocar diagnóstico/referência
    if (
      a.motivoIgnorado === "familia_nao_persistida_fase" ||
      a.motivoIgnorado === "grupo_faturamento" ||
      a.motivoIgnorado === "familia_fora_escopo"
    ) {
      continue;
    }

    const chave = chaveNomeFuncao(a.nomeRecurso);
    const f = chave ? funcoesMap.get(chave) : undefined;

    if (!f) {
      a.funcaoId = null;
      a.funcaoNomeResolvido = null;
      a.motivoIgnorado = "sem_funcao";
      semFuncao += 1;
      const chaveOriginal = a.nomeRecurso ?? "—";
      naoMapeadasMap.set(chaveOriginal, (naoMapeadasMap.get(chaveOriginal) ?? 0) + 1);
      continue;
    }

    a.funcaoId = f.id;
    a.funcaoNomeResolvido = f.nome_funcao;
    a.motivoIgnorado = null;
    mapeados += 1;
  }

  resumo.mapeados = mapeados;
  resumo.semFuncao = semFuncao;
  resumo.funcoesNaoMapeadas = Array.from(naoMapeadasMap.entries())
    .map(([nomeRecurso, ocorrencias]) => ({ nomeRecurso, ocorrencias }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);
}
