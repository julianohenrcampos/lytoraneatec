/**
 * D1 / F1 — Reconciliação operacional compartilhada de ativos.
 *
 * Fonte ÚNICA de normalização entre:
 *   - Disponibilidade Operacional
 *   - Central do Transporte (CT-1 / CT-2)
 *   - Detalhe de Caminhões e Equipamentos
 *
 * Regras invioláveis:
 *   - SEM_STATUS deriva EXCLUSIVAMENTE da ausência de linha operacional válida
 *     em bd_disponibilidade_equipamentos.
 *   - `situacao` (cadastral) e `status_disponibilidade` NUNCA produzem DISPONIVEL.
 *   - Nenhuma equivalência silenciosa entre unidades (T ≠ TON).
 *   - Ativo sem status ou sem Centro de Custo é CLASSIFICADO, nunca excluído.
 */

/* ------------------------------------------------------------------ */
/* Tipos                                                               */
/* ------------------------------------------------------------------ */

export type StatusOperacionalCanonico =
  | "DISPONIVEL"
  | "ALOCADO"
  | "MANUTENCAO"
  | "INDISPONIVEL"
  | "SEM_STATUS"
  | "DESCONHECIDO";

export type MatchTipoCapacidade = "EXATO" | "PARCIAL";

/** Linha canônica (subset) de bd_disponibilidade_equipamentos. */
export interface LinhaDisponibilidade {
  id: string;
  equipamento_id: string;
  status_operacional: string | null;
  centro_custo_id?: string | null;
  previsao_liberacao?: string | null;
  confiabilidade_previsao?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

/** Subset canônico de bd_caminhoes_equipamentos usado na reconciliação. */
export interface AtivoCanonicoInput {
  id: string;
  frota?: string | null;
  numero_frota?: string | null;
  placa?: string | null;
  situacao?: string | null;
  capacidade_valor?: number | null;
  capacidade_unidade?: string | null;
}

/** Projeção (JOIN / RPC) — NÃO faz parte da linha canônica da tabela. */
export interface ProjecaoCentroCusto {
  centroCustoAtualId: string | null;
  centroCustoAtualCodigo: string | null;
  centroCustoAtualNome: string | null;
}

export interface EstadoOperacionalAtivo {
  equipamentoId: string;
  statusOperacional: StatusOperacionalCanonico;
  possuiRegistroDisponibilidade: boolean;
  possuiCentroCustoAtual: boolean;
  /** ID preenchido porém sem cadastro correspondente no enriquecimento em lote. */
  referenciaCentroCustoNaoResolvida: boolean;
  centroCustoAtualId: string | null;
  centroCustoAtualCodigo: string | null;
  centroCustoAtualNome: string | null;
  jaNoCentroCustoDestino: boolean;
  situacaoCadastral: string | null;
  possuiConflitoCadastral: boolean;
  conflitoCadastralMotivo: string | null;
  previsaoLiberacao: string | null;
  confiabilidadePrevisao: string | null;
  capacidadeValor: number | null;
  capacidadeUnidade: string | null;
  bloqueioMotivo: string | null;
  textoBusca: string;
}

/* ------------------------------------------------------------------ */
/* Normalizações                                                       */
/* ------------------------------------------------------------------ */

/** Remove diacríticos, aplica trim e uppercase. */
export const canonTexto = (value: string | null | undefined): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();

/**
 * Unidade de capacidade: apenas trim + uppercase.
 * Sem equivalência silenciosa (T ≢ TON) — divergências reais devem ser
 * resolvidas por migração de dados auditada.
 */
export const normalizarUnidade = (u: string | null | undefined): string | null => {
  const v = String(u ?? "").trim().toUpperCase();
  return v || null;
};

/**
 * SEM_STATUS  = não existe linha operacional válida.
 * DESCONHECIDO = existe linha, mas o status não é reconhecido.
 * `situacao` e `status_disponibilidade` jamais entram aqui.
 */
export const normalizarStatusOperacional = (
  possuiLinha: boolean,
  status: string | null | undefined,
): StatusOperacionalCanonico => {
  if (!possuiLinha) return "SEM_STATUS";
  const s = canonTexto(status);
  if (s === "DISPONIVEL") return "DISPONIVEL";
  if (s === "ALOCADO") return "ALOCADO";
  if (s === "MANUTENCAO") return "MANUTENCAO";
  if (s === "INDISPONIVEL") return "INDISPONIVEL";
  return "DESCONHECIDO";
};

export const STATUS_OPERACIONAL_LABELS: Record<StatusOperacionalCanonico, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_STATUS: "SEM STATUS",
  DESCONHECIDO: "Status desconhecido",
};

export const SEM_CENTRO_CUSTO_LABEL = "Sem Centro de Custo confirmado";

/** ID de Centro de Custo preenchido, mas cadastro não localizado no enriquecimento. */
export const CENTRO_CUSTO_NAO_LOCALIZADO_LABEL = "Centro de Custo não localizado";

export const ALERTA_CONFLITO_CADASTRAL =
  "Situação cadastral e disponibilidade operacional precisam ser regularizadas.";

export const ALERTA_CONFLITO_ATENDIMENTO =
  "Conflito cadastral — confirme a condição operacional antes do atendimento.";

/**
 * Escolhe a linha operacional mais recente sem confiar na ordem do Supabase.
 * Critério: updated_at DESC NULLS LAST → created_at DESC NULLS LAST → id DESC.
 * (`id` é a PK real de bd_disponibilidade_equipamentos.)
 */
export const escolherRegistroOperacionalMaisRecente = <T extends LinhaDisponibilidade>(
  linhas: readonly T[],
): T | null => {
  if (!linhas || linhas.length === 0) return null;
  const cmpDescNullsLast = (a: string | null | undefined, b: string | null | undefined): number => {
    const va = a ?? "";
    const vb = b ?? "";
    if (va === vb) return 0;
    if (!va) return 1; // NULLS LAST
    if (!vb) return -1;
    return vb.localeCompare(va); // DESC
  };
  return [...linhas].sort((a, b) => {
    const u = cmpDescNullsLast(a.updated_at, b.updated_at);
    if (u !== 0) return u;
    const c = cmpDescNullsLast(a.created_at, b.created_at);
    if (c !== 0) return c;
    return String(b.id ?? "").localeCompare(String(a.id ?? "")); // id DESC
  })[0];
};

/** Indexa linhas por equipamento aplicando o desempate canônico. */
export const indexarDisponibilidadePorEquipamento = <T extends LinhaDisponibilidade>(
  linhas: readonly T[],
): Map<string, T> => {
  const buckets = new Map<string, T[]>();
  for (const l of linhas ?? []) {
    if (!l?.equipamento_id) continue;
    const arr = buckets.get(l.equipamento_id);
    if (arr) arr.push(l);
    else buckets.set(l.equipamento_id, [l]);
  }
  const out = new Map<string, T>();
  for (const [equipId, arr] of buckets) {
    const escolhido = escolherRegistroOperacionalMaisRecente(arr);
    if (escolhido) out.set(equipId, escolhido);
  }
  return out;
};

/* ------------------------------------------------------------------ */
/* Conflito cadastral                                                  */
/* ------------------------------------------------------------------ */

/**
 * Divergência entre situação cadastral e disponibilidade operacional.
 * NUNCA infere status operacional a partir da situação — apenas sinaliza.
 */
export const detectarConflitoCadastral = (
  situacao: string | null | undefined,
  statusOperacional: StatusOperacionalCanonico,
): { possuiConflitoCadastral: boolean; conflitoCadastralMotivo: string | null } => {
  const s = canonTexto(situacao);
  if (!s) return { possuiConflitoCadastral: false, conflitoCadastralMotivo: null };

  const label = String(situacao ?? "").trim();

  if (statusOperacional === "SEM_STATUS") {
    // Situação cadastral afirma uma condição sem lastro operacional.
    if (s === "EM MANUTENCAO" || s === "MANUTENCAO" || s === "INTEMPERIE") {
      return {
        possuiConflitoCadastral: true,
        conflitoCadastralMotivo: `Situação cadastral “${label}” sem registro de disponibilidade operacional.`,
      };
    }
    return { possuiConflitoCadastral: false, conflitoCadastralMotivo: null };
  }

  if (statusOperacional === "DESCONHECIDO") {
    return {
      possuiConflitoCadastral: true,
      conflitoCadastralMotivo: "Registro de disponibilidade com status não reconhecido.",
    };
  }

  const equivalente: Record<string, StatusOperacionalCanonico[]> = {
    "DISPONIVEL": ["DISPONIVEL"],
    "EM MANUTENCAO": ["MANUTENCAO"],
    "MANUTENCAO": ["MANUTENCAO"],
    "INTEMPERIE": ["INDISPONIVEL", "MANUTENCAO"],
    "OPERANDO": ["ALOCADO", "DISPONIVEL"],
    "ATIVO": ["ALOCADO", "DISPONIVEL"],
  };

  const esperados = equivalente[s];
  if (!esperados) return { possuiConflitoCadastral: false, conflitoCadastralMotivo: null };
  if (esperados.includes(statusOperacional)) {
    return { possuiConflitoCadastral: false, conflitoCadastralMotivo: null };
  }
  return {
    possuiConflitoCadastral: true,
    conflitoCadastralMotivo: `Situação cadastral “${label}” divergente da disponibilidade operacional ${STATUS_OPERACIONAL_LABELS[statusOperacional]}.`,
  };
};

/* ------------------------------------------------------------------ */
/* Capacidade                                                          */
/* ------------------------------------------------------------------ */

export const MOTIVO_UNIDADE_AUSENTE =
  "Capacidade numérica compatível, mas o ativo não possui unidade de capacidade cadastrada.";

export interface ResultadoCapacidade {
  matchTipo: MatchTipoCapacidade;
  matchMotivo: string | null;
  capacidadeValor: number | null;
  capacidadeUnidade: string | null;
  capacidadeSolicitadaValor: number | null;
  capacidadeSolicitadaUnidade: string | null;
}

/**
 * Matching estrito: valor igual E unidade igual (trim + uppercase).
 * Valor igual com unidade ausente no ativo ⇒ PARCIAL com motivo específico.
 */
export const avaliarCapacidade = (
  ativo: { capacidade_valor?: number | null; capacidade_unidade?: string | null },
  solicitado: { valor?: number | null; unidade?: string | null },
  fallback: { matchTipo: MatchTipoCapacidade; motivo?: string | null } = { matchTipo: "EXATO" },
): ResultadoCapacidade => {
  const capValor = ativo.capacidade_valor ?? null;
  const capUnid = normalizarUnidade(ativo.capacidade_unidade);
  const solValor = solicitado.valor ?? null;
  const solUnid = normalizarUnidade(solicitado.unidade);

  const base: ResultadoCapacidade = {
    matchTipo: fallback.matchTipo,
    matchMotivo: fallback.motivo ?? null,
    capacidadeValor: capValor,
    capacidadeUnidade: capUnid,
    capacidadeSolicitadaValor: solValor,
    capacidadeSolicitadaUnidade: solUnid,
  };

  if (solValor == null) return base;

  if (capValor == null) {
    return { ...base, matchTipo: "PARCIAL", matchMotivo: "Ativo sem capacidade cadastrada." };
  }
  if (capValor !== solValor) {
    return {
      ...base,
      matchTipo: "PARCIAL",
      matchMotivo: `Capacidade do ativo (${capValor}) difere da solicitada (${solValor}).`,
    };
  }
  if (solUnid && !capUnid) {
    return { ...base, matchTipo: "PARCIAL", matchMotivo: MOTIVO_UNIDADE_AUSENTE };
  }
  if (solUnid && capUnid && solUnid !== capUnid) {
    return {
      ...base,
      matchTipo: "PARCIAL",
      matchMotivo: `Unidade do ativo (${capUnid}) difere da solicitada (${solUnid}).`,
    };
  }
  return { ...base, matchTipo: fallback.matchTipo, matchMotivo: fallback.motivo ?? null };
};

/* ------------------------------------------------------------------ */
/* Bloqueio operacional (apenas leitura — não altera gates das RPCs)   */
/* ------------------------------------------------------------------ */

export const derivarBloqueioOperacional = (
  status: StatusOperacionalCanonico,
  previsaoLiberacao: string | null,
): string | null => {
  if (status === "MANUTENCAO") return "Ativo em manutenção — atendimento bloqueado.";
  if (status === "INDISPONIVEL") return "Ativo indisponível — atendimento bloqueado.";
  if (status === "DESCONHECIDO") return "Status operacional não reconhecido — regularize o cadastro.";
  if (status === "ALOCADO" && !previsaoLiberacao) {
    return "Ativo alocado sem previsão de liberação — apenas reserva futura com previsão é permitida.";
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Busca                                                               */
/* ------------------------------------------------------------------ */

export const montarTextoBusca = (partes: readonly (string | null | undefined)[]): string =>
  partes.filter(Boolean).map((p) => canonTexto(p)).join(" | ");

export const casaBusca = (textoBusca: string, termo: string): boolean => {
  const t = canonTexto(termo);
  if (!t) return true;
  return t
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => textoBusca.includes(token));
};

/* ------------------------------------------------------------------ */
/* Ordenação                                                           */
/* ------------------------------------------------------------------ */

/**
 * Grupos de prioridade (D1 / item 9):
 *  1 DISPONIVEL + já no CC destino
 *  2 DISPONIVEL
 *  3 SEM_STATUS + já no CC destino
 *  4 SEM_STATUS
 *  5 ALOCADO com previsão
 *  6 ALOCADO sem previsão
 *  7 MANUTENCAO
 *  8 INDISPONIVEL
 *  9 DESCONHECIDO
 */
export const grupoOrdenacao = (e: {
  statusOperacional: StatusOperacionalCanonico;
  jaNoCentroCustoDestino: boolean;
  previsaoLiberacao: string | null;
}): number => {
  switch (e.statusOperacional) {
    case "DISPONIVEL":
      return e.jaNoCentroCustoDestino ? 1 : 2;
    case "SEM_STATUS":
      return e.jaNoCentroCustoDestino ? 3 : 4;
    case "ALOCADO":
      return e.previsaoLiberacao ? 5 : 6;
    case "MANUTENCAO":
      return 7;
    case "INDISPONIVEL":
      return 8;
    default:
      return 9;
  }
};

export interface ChaveOrdenacaoInput {
  statusOperacional: StatusOperacionalCanonico;
  jaNoCentroCustoDestino: boolean;
  previsaoLiberacao: string | null;
  matchTipo: MatchTipoCapacidade;
  possuiCentroCustoAtual: boolean;
  frota: string | null;
  numeroFrota: string | null;
  placa: string | null;
  equipamentoId: string;
}

/** Chave estável e comparável lexicograficamente, com desempate por equipamentoId. */
export const montarChaveOrdenacao = (e: ChaveOrdenacaoInput): string =>
  [
    String(grupoOrdenacao(e)),
    e.matchTipo === "EXATO" ? "0" : "1",
    e.possuiCentroCustoAtual ? "0" : "1",
    canonTexto(e.frota).padEnd(24, " "),
    canonTexto(e.numeroFrota).padStart(12, "0"),
    canonTexto(e.placa).padEnd(12, " "),
    e.equipamentoId,
  ].join("\u0001");

/** Ordenação estável final — aplicada SEMPRE após matching/reconciliação. */
export const ordenarPorChave = <T extends { chaveOrdenacao: string; equipamentoId: string }>(
  itens: readonly T[],
): T[] =>
  [...itens].sort((a, b) => {
    const c = a.chaveOrdenacao.localeCompare(b.chaveOrdenacao);
    if (c !== 0) return c;
    return a.equipamentoId.localeCompare(b.equipamentoId);
  });

/* ------------------------------------------------------------------ */
/* Reconciliação                                                       */
/* ------------------------------------------------------------------ */

export const reconciliarAtivo = (
  ativo: AtivoCanonicoInput,
  disponibilidade: LinhaDisponibilidade | null,
  projecaoCc: ProjecaoCentroCusto,
  opcoes: {
    centroCustoDestinoId?: string | null;
    empresaNome?: string | null;
    extrasBusca?: readonly (string | null | undefined)[];
  } = {},
): EstadoOperacionalAtivo => {
  const possuiRegistroDisponibilidade = !!disponibilidade;
  const statusOperacional = normalizarStatusOperacional(
    possuiRegistroDisponibilidade,
    disponibilidade?.status_operacional,
  );
  const possuiCentroCustoAtual = !!projecaoCc.centroCustoAtualId;
  const jaNoCentroCustoDestino =
    !!opcoes.centroCustoDestinoId &&
    !!projecaoCc.centroCustoAtualId &&
    projecaoCc.centroCustoAtualId === opcoes.centroCustoDestinoId;

  const conflito = detectarConflitoCadastral(ativo.situacao, statusOperacional);
  const previsaoLiberacao = disponibilidade?.previsao_liberacao ?? null;

  return {
    equipamentoId: ativo.id,
    statusOperacional,
    possuiRegistroDisponibilidade,
    possuiCentroCustoAtual,
    referenciaCentroCustoNaoResolvida:
      possuiCentroCustoAtual &&
      !projecaoCc.centroCustoAtualCodigo &&
      !projecaoCc.centroCustoAtualNome,
    centroCustoAtualId: projecaoCc.centroCustoAtualId,
    centroCustoAtualCodigo: projecaoCc.centroCustoAtualCodigo,
    centroCustoAtualNome: projecaoCc.centroCustoAtualNome,
    jaNoCentroCustoDestino,
    situacaoCadastral: ativo.situacao ?? null,
    possuiConflitoCadastral: conflito.possuiConflitoCadastral,
    conflitoCadastralMotivo: conflito.conflitoCadastralMotivo,
    previsaoLiberacao,
    confiabilidadePrevisao: disponibilidade?.confiabilidade_previsao ?? null,
    capacidadeValor: ativo.capacidade_valor ?? null,
    capacidadeUnidade: normalizarUnidade(ativo.capacidade_unidade),
    bloqueioMotivo: derivarBloqueioOperacional(statusOperacional, previsaoLiberacao),
    textoBusca: montarTextoBusca([
      ativo.frota,
      ativo.numero_frota,
      // Identificador concatenado (ex.: "LYC001") — como o usuário digita.
      [ativo.frota, ativo.numero_frota].filter(Boolean).join(""),
      ativo.placa,
      opcoes.empresaNome,
      projecaoCc.centroCustoAtualCodigo,
      projecaoCc.centroCustoAtualNome,
      ...(opcoes.extrasBusca ?? []),
    ]),
  };
};

/**
 * Rótulo de Centro de Custo — três estados distintos:
 * - código/nome resolvidos → "CÓDIGO — Nome";
 * - ID preenchido sem cadastro localizado → "Centro de Custo não localizado";
 * - ID ausente → "Sem Centro de Custo confirmado".
 */
export const rotuloCentroCusto = (e: {
  centroCustoAtualId?: string | null;
  centroCustoAtualCodigo: string | null;
  centroCustoAtualNome: string | null;
}): string => {
  const parts = [e.centroCustoAtualCodigo, e.centroCustoAtualNome].filter(Boolean);
  if (parts.length) return parts.join(" — ");
  if (e.centroCustoAtualId) return CENTRO_CUSTO_NAO_LOCALIZADO_LABEL;
  return SEM_CENTRO_CUSTO_LABEL;
};
