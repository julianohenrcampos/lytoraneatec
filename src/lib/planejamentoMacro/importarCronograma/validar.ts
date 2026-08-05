// Fase 6F — Validação de linhas + número BR + bloqueios.

import {
  ehLinhaResumo,
  mapearCabecalhos,
  normalizarTextoCcParaComparacao,
  type MapaCabecalho,
} from "./mapearColunas";
import { normalizarDataIso } from "./normalizarData";
import {
  LIMITE_LINHAS_IMPORTACAO,
  type AtividadeImportadaPreview,
  type CentroCustoSelecionado,
  type ResultadoParse,
} from "./tipos";

/** Converte número em formato BR: "1.500,50" → 1500.50 */
export function parseNumeroBR(raw: unknown): { value: number | null; warning?: string } {
  if (raw === null || raw === undefined || raw === "") return { value: null };
  if (typeof raw === "number") return Number.isFinite(raw) ? { value: raw } : { value: null };

  const s = String(raw).trim().replace(/\s+/g, "");
  if (!s) return { value: null };

  let normalized: string;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");

  if (temVirgula && temPonto) {
    // assume '.' milhar, ',' decimal
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    normalized = s.replace(",", ".");
  } else {
    normalized = s;
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) {
    return { value: null, warning: `Não foi possível interpretar número "${raw}"` };
  }
  return { value: n };
}

function getStr(row: Record<string, unknown>, key: string | undefined): string | null {
  if (!key) return null;
  const v = row[key];
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s || null;
}

function normalizarPrioridade(raw: string | null): {
  value: "baixa" | "media" | "alta";
  warning?: string;
} {
  if (!raw) return { value: "media" };
  const v = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (["baixa", "low"].includes(v)) return { value: "baixa" };
  if (["media", "medium", "normal"].includes(v)) return { value: "media" };
  if (["alta", "high"].includes(v)) return { value: "alta" };
  return { value: "media", warning: `Prioridade desconhecida "${raw}", usando "media"` };
}

export interface ConstruirPreviewInput {
  formato: import("./tipos").FormatoArquivoImportacao;
  origem: import("@/types/planejamentoMacro").OrigemPlanejamento;
  nomeArquivo: string;
  linhas: Record<string, unknown>[];
  cabecalhos: string[];
  cc: CentroCustoSelecionado;
}

export function construirPreview(input: ConstruirPreviewInput): ResultadoParse {
  const { formato, origem, nomeArquivo, linhas, cabecalhos, cc } = input;

  const globalErrors: string[] = [];
  const globalWarnings: string[] = [];

  if (!linhas.length) {
    return montarVazio(formato, origem, nomeArquivo, [
      "Nenhuma linha encontrada no arquivo.",
    ]);
  }

  if (linhas.length > LIMITE_LINHAS_IMPORTACAO) {
    return montarVazio(
      formato,
      origem,
      nomeArquivo,
      [
        "O arquivo possui mais de 5.000 linhas. Para esta primeira versão, divida o cronograma em arquivos menores ou solicite importação técnica assistida.",
      ],
      linhas.length,
      true
    );
  }

  const mapa: MapaCabecalho = mapearCabecalhos(cabecalhos);

  if (!mapa.nome) globalErrors.push('Coluna "Nome/Tarefa" não encontrada no arquivo.');
  if (!mapa.data_inicio) globalErrors.push('Coluna "Data Início" não encontrada.');
  if (!mapa.data_fim) globalErrors.push('Coluna "Data Fim" não encontrada.');

  // Validação de CC (apenas leitura; divergência bloqueia)
  const ccInfo = validarCentroCusto(linhas, mapa, cc);
  if (ccInfo.divergente) {
    globalErrors.push(
      "O arquivo parece pertencer a outro Centro de Custo. A importação foi bloqueada para evitar vínculo incorreto."
    );
  } else if (!ccInfo.presente) {
    globalWarnings.push(
      "O arquivo não possui coluna de Centro de Custo. As atividades serão vinculadas ao CC selecionado."
    );
  }

  const atividades: AtividadeImportadaPreview[] = [];
  let ordem = 0;
  let minIni: string | null = null;
  let maxFim: string | null = null;

  linhas.forEach((row, idx) => {
    const linhaOriginal = idx + 2; // header = 1

    const isSummary = ehLinhaResumo(row, mapa);
    const nome = getStr(row, mapa.nome);
    const dataIniRaw = mapa.data_inicio ? row[mapa.data_inicio] : null;
    const dataFimRaw = mapa.data_fim ? row[mapa.data_fim] : null;

    const ativ: AtividadeImportadaPreview = {
      linhaOriginal,
      codigo_wbs: getStr(row, mapa.codigo_wbs),
      uidTarefa: getStr(row, mapa.uid_tarefa),
      idTarefa: getStr(row, mapa.id_tarefa),
      nome: nome ?? "",
      descricao: getStr(row, mapa.descricao),
      frente_servico: getStr(row, mapa.frente_servico),
      data_inicio: normalizarDataIso(dataIniRaw),
      data_fim: normalizarDataIso(dataFimRaw),
      unidade: getStr(row, mapa.unidade),
      quantidade_prevista: null,
      producao_prevista: null,
      prioridade: "media",
      status: "planejada",
      ordem_execucao: 0,
      warnings: [],
      errors: [],
      ignored: false,
      is_critica: false,
      quantidade_origem: null,
    };

    if (isSummary) {
      ativ.ignored = true;
      ativ.warnings.push("Linha de resumo/summary ignorada.");
      atividades.push(ativ);
      return;
    }

    if (!nome) ativ.errors.push('Campo "Nome/Tarefa" é obrigatório.');
    if (!ativ.data_inicio) ativ.errors.push('Data de início inválida ou ausente.');
    if (!ativ.data_fim) ativ.errors.push('Data de fim inválida ou ausente.');
    if (ativ.data_inicio && ativ.data_fim && ativ.data_fim < ativ.data_inicio) {
      ativ.errors.push("Data de fim anterior à data de início.");
    }

    // números
    if (mapa.quantidade_prevista) {
      const r = parseNumeroBR(row[mapa.quantidade_prevista]);
      ativ.quantidade_prevista = r.value;
      if (r.warning) ativ.warnings.push(r.warning);
    }
    if (mapa.producao_prevista) {
      const r = parseNumeroBR(row[mapa.producao_prevista]);
      ativ.producao_prevista = r.value;
      if (r.warning) ativ.warnings.push(r.warning);
    }

    // Fase 1C — origem da quantidade/unidade (CSV/XLSX).
    if (ativ.quantidade_prevista != null || (ativ.unidade ?? "").trim() !== "") {
      ativ.quantidade_origem = "planilha";
    } else {
      ativ.quantidade_origem = "indefinido";
    }

    // prioridade
    const prio = normalizarPrioridade(getStr(row, mapa.prioridade));
    ativ.prioridade = prio.value;
    if (prio.warning) ativ.warnings.push(prio.warning);

    if (ativ.errors.length === 0) {
      ordem += 1;
      ativ.ordem_execucao = ordem;
      if (ativ.data_inicio && (!minIni || ativ.data_inicio < minIni)) minIni = ativ.data_inicio;
      if (ativ.data_fim && (!maxFim || ativ.data_fim > maxFim)) maxFim = ativ.data_fim;
    }

    atividades.push(ativ);
  });

  const validas = atividades.filter((a) => !a.ignored && a.errors.length === 0).length;
  const ignoradas = atividades.filter((a) => a.ignored).length;
  const comErro = atividades.filter((a) => !a.ignored && a.errors.length > 0).length;

  if (!validas && globalErrors.length === 0) {
    globalErrors.push("Nenhuma atividade válida foi identificada no arquivo.");
  }

  const bloqueado = globalErrors.length > 0;
  const motivoBloqueio = bloqueado ? globalErrors[0] : null;

  return {
    formato,
    origem,
    nomeArquivo,
    totalLinhas: linhas.length,
    atividades,
    cc: ccInfo,
    globalErrors,
    globalWarnings,
    bloqueado,
    motivoBloqueio,
    periodo: { inicio: minIni, fim: maxFim },
    resumo: { validas, ignoradas, comErro },
    alocacoes: [],
    recursosCatalogo: [],
    recursos: null,
  };
}

function validarCentroCusto(
  linhas: Record<string, unknown>[],
  mapa: MapaCabecalho,
  cc: CentroCustoSelecionado
): ResultadoParse["cc"] {
  if (!mapa.centro_custo) {
    return { presente: false, valorBruto: null, divergente: false };
  }
  const alvos = new Set(
    [cc.codigo_centro_custo, cc.nome_centro_custo]
      .filter(Boolean)
      .map((v) => normalizarTextoCcParaComparacao(v))
  );

  let primeiroValor: string | null = null;
  for (const row of linhas) {
    const v = row[mapa.centro_custo];
    if (v === null || v === undefined || String(v).trim() === "") continue;
    const raw = String(v).trim();
    if (!primeiroValor) primeiroValor = raw;
    const norm = normalizarTextoCcParaComparacao(raw);
    if (!alvos.has(norm)) {
      return { presente: true, valorBruto: raw, divergente: true };
    }
  }
  return { presente: true, valorBruto: primeiroValor, divergente: false };
}

function montarVazio(
  formato: import("./tipos").FormatoArquivoImportacao,
  origem: import("@/types/planejamentoMacro").OrigemPlanejamento,
  nomeArquivo: string,
  errors: string[],
  totalLinhas = 0,
  bloqueado = true
): ResultadoParse {
  return {
    formato,
    origem,
    nomeArquivo,
    totalLinhas,
    atividades: [],
    cc: { presente: false, valorBruto: null, divergente: false },
    globalErrors: errors,
    globalWarnings: [],
    bloqueado,
    motivoBloqueio: errors[0] ?? null,
    periodo: { inicio: null, fim: null },
    resumo: { validas: 0, ignoradas: 0, comErro: 0 },
    alocacoes: [],
    recursosCatalogo: [],
    recursos: null,
  };
}
