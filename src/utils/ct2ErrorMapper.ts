/**
 * CT-2 / M4 — Normalizador de erros das RPCs da Central do Transporte.
 *
 * Regras:
 *  - Nenhum SQL bruto chega à UI.
 *  - Erros CT2_* devolvidos pelo servidor são DETERMINÍSTICOS (a transação
 *    abortou) e liberam a tentativa de idempotência.
 *  - Somente timeout / falha de rede / ausência de resposta determinística
 *    produzem resultado INCERTO, preservando o request_id.
 */

export interface Ct2NormalizedError {
  code: string | null;
  message: string;
  /** true quando não é possível afirmar que a transação não persistiu. */
  isUncertain: boolean;
}

const CT2_MESSAGES: Record<string, string> = {
  CT2_AUTH_REQUIRED: "Sessão expirada. Entre novamente para continuar.",
  CT2_PROFILE_NOT_FOUND: "Perfil de usuário inexistente. Procure o administrador.",
  CT2_FORBIDDEN: "Você não tem permissão para executar esta operação na Central do Transporte.",
  CT2_SCOPE_DENIED: "Este registro está fora do seu escopo de acesso.",
  CT2_PARAMETROS_INVALIDOS: "Dados obrigatórios ausentes na operação.",
  CT2_MODALIDADE_INVALIDA: "Modalidade inválida — use atendimento interno ou reserva futura.",
  CT2_STATUS_INVALIDO: "Status inválido para esta operação.",
  CT2_ITEM_NAO_ENCONTRADO: "O item da solicitação não foi encontrado.",
  CT2_ITEM_QUANTIDADE_INVALIDA: "A quantidade do item é inválida.",
  CT2_SOLICITACAO_NAO_ENCONTRADA: "A solicitação informada não existe.",
  CT2_EQUIPAMENTO_NAO_ENCONTRADO: "Equipamento não encontrado.",
  CT2_EQUIPAMENTO_INCOMPATIVEL: "O equipamento não é compatível com o item solicitado.",
  CT2_EQUIPAMENTO_EM_CONFLITO: "O equipamento já está comprometido no período informado.",
  CT2_DISPONIBILIDADE_BLOQUEADA: "O equipamento não está disponível para esta modalidade.",
  CT2_DISPONIBILIDADE_SEM_REGISTRO:
    "O ativo não possui disponibilidade operacional confirmada. Regularize o status antes de realizar o atendimento.",
  CT2_ATIVO_AINDA_NAO_DISPONIVEL:
    "O ativo só fica disponível a partir da data de vigência do status operacional — o período solicitado começa antes disso.",

  CT2_MATCH_PARCIAL_BLOQUEADO:
    "Compatibilidade parcial exige aprovação. Solicite a um usuário com permissão de aprovar.",
  CT2_JANELA_INDEFINIDA: "A solicitação não possui janela aprovada definida.",
  CT2_PERIODO_INVALIDO: "Período inválido — verifique as datas informadas.",
  CT2_PERIODO_FORA_JANELA:
    "O período informado está fora da janela aprovada. É necessária aprovação para prosseguir.",
  CT2_JUSTIFICATIVA_OBRIGATORIA: "Justificativa obrigatória (mínimo de 20 caracteres).",
  CT2_MOTIVO_OBRIGATORIO: "Motivo obrigatório (mínimo de 20 caracteres).",
  CT2_ATENDIMENTO_NAO_ENCONTRADO: "Atendimento não encontrado.",
  CT2_ATENDIMENTO_JA_ENCERRADO: "Este atendimento já foi encerrado.",
  CT2_SUBSTITUICAO_SEM_EFEITO: "O equipamento escolhido é o mesmo já atribuído.",
  CT2_IDEMPOTENCY_KEY_REUSED: "Esta operação já foi registrada com parâmetros diferentes.",
  CT2_IDEMPOTENCY_STATE_INCONSISTENT:
    "Estado inconsistente de idempotência. Recarregue a página e verifique o atendimento.",
  CT2_INVARIANTE_VIOLADA: "A operação violaria uma regra de integridade da Central do Transporte.",
  CT2_RESPOSTA_INVALIDA: "Resposta inesperada do servidor. Recarregue a página e tente novamente.",

  /* CT-2.5 — trava de edição da condição operacional */
  CT25_ATIVO_COMPROMETIDO:
    "Este ativo possui compromisso na Central do Transporte. Encerre o compromisso ou registre uma justificativa de exceção para editar a condição operacional.",
  CT25_JUSTIFICATIVA_INSUFICIENTE:
    "A justificativa de exceção precisa de ao menos 20 caracteres.",
  CT25_TRAVA_NAO_CONSULTADA:
    "Não foi possível confirmar se este ativo pode ser editado. Tente novamente antes de alterar a condição operacional.",

  /* CT-3C — mobilização */
  CT3C_PLANEJAMENTO_JA_PROGRAMADO:
    "Já existe uma programação vigente para esta solicitação. Cancele-a antes de criar um novo rascunho.",
  CT3C_PLANEJAMENTO_NAO_ENCONTRADO: "Planejamento de mobilização não encontrado.",
  CT3C_VERSAO_SUPERADA:
    "Esta versão do planejamento foi superada por outra mais recente. Recarregue a página.",
  CT3C_ATIVO_EM_MAIS_DE_UMA_VIAGEM: "Cada ativo reservado pode estar em apenas uma viagem.",
  CT3C_ATENDIMENTO_INVALIDO: "O atendimento informado não pertence a esta solicitação.",
  CT3C_ATENDIMENTO_NAO_MOBILIZAVEL:
    "Somente atendimentos reservados ou em transporte podem ser mobilizados.",
  CT3C_ATIVOS_SEM_VIAGEM: "Existem ativos reservados sem viagem atribuída.",
  CT3C_VIAGEM_INCOMPLETA:
    "Informe responsável, data de saída e data de entrega em todas as viagens.",
  CT3C_SEM_VIAGENS: "Crie ao menos uma viagem antes de programar a mobilização.",
};

const CT2_CODE_RE = /\b(CT2_[A-Z_]+|CT25_[A-Z_]+|CT3C_[A-Z_]+)\b/;


const NETWORK_HINTS = [
  "failed to fetch",
  "networkerror",
  "network error",
  "load failed",
  "timeout",
  "timed out",
  "aborted",
  "the operation was aborted",
  "connection closed",
  "connection reset",
  "err_network",
  "err_internet_disconnected",
  "502",
  "503",
  "504",
];

const readField = (err: unknown, field: string): string => {
  if (err && typeof err === "object" && field in err) {
    const v = (err as Record<string, unknown>)[field];
    if (typeof v === "string") return v;
  }
  return "";
};

export const extractCt2Code = (err: unknown): string | null => {
  const haystack = [
    readField(err, "message"),
    readField(err, "details"),
    readField(err, "hint"),
    readField(err, "code"),
    typeof err === "string" ? err : "",
  ].join(" ");
  const m = CT2_CODE_RE.exec(haystack);
  return m ? m[1] : null;
};

/**
 * CT-2.3 — o servidor devolve DETAIL em JSON com a data de vigência
 * (`data_inicio`) e o início solicitado. Nunca expõe SQL bruto à UI.
 */
const detalheVigencia = (err: unknown): string | null => {
  const raw = [readField(err, "details"), readField(err, "hint")].find((v) => v.includes("{"));
  if (!raw) return null;
  try {
    const json = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as Record<
      string,
      unknown
    >;
    const inicio = typeof json.data_inicio === "string" ? json.data_inicio : null;
    const solicitado =
      typeof json.periodo_inicio === "string" ? json.periodo_inicio : null;
    if (!inicio) return null;
    return solicitado
      ? `Disponível a partir de ${inicio}; período solicitado inicia em ${solicitado}.`
      : `Disponível a partir de ${inicio}.`;
  } catch {
    return null;
  }
};

export const normalizeCt2Error = (err: unknown): Ct2NormalizedError => {
  const code = extractCt2Code(err);


  if (code) {
    // Erro determinístico do servidor: a transação abortou.
    const base = CT2_MESSAGES[code] || "Não foi possível concluir a operação.";
    return {
      code,
      message:
        code === "CT2_ATIVO_AINDA_NAO_DISPONIVEL"
          ? [base, detalheVigencia(err)].filter(Boolean).join(" ")
          : base,
      isUncertain: false,
    };
  }


  const raw = [readField(err, "message"), readField(err, "details"), typeof err === "string" ? err : ""]
    .join(" ")
    .toLowerCase();

  const looksNetwork = NETWORK_HINTS.some((h) => raw.includes(h)) || raw.trim() === "";

  if (looksNetwork) {
    return {
      code: null,
      message:
        "Não foi possível confirmar o resultado da operação (falha de comunicação). " +
        "A operação pode ter sido registrada. Tente novamente com a mesma solicitação — " +
        "o sistema reaproveita a chave de idempotência e não duplica o registro.",
      isUncertain: true,
    };
  }

  // Erro sem código CT2 e sem assinatura de rede: tratado como incerto por
  // precaução (pode indicar commit desconhecido).
  console.warn("[CT2][ERRO_NAO_CLASSIFICADO]", readField(err, "code") || "sem-code");
  return {
    code: null,
    message:
      "Não foi possível confirmar o resultado da operação. Verifique a lista de atendimentos antes de repetir.",
    isUncertain: true,
  };
};

/* ------------------------------------------------------------------ */
/* Identificador inválido (22P02) — nunca confundir com P0001/CT2_*    */
/* ------------------------------------------------------------------ */

export const MENSAGEM_IDENTIFICADOR_INVALIDO =
  "Não foi possível salvar porque um identificador obrigatório está inválido. " +
  "Atualize a página e tente novamente.";

/**
 * true SOMENTE para erro de sintaxe de identificador:
 *  - SQLSTATE 22P02; ou
 *  - mensagem contendo "invalid input syntax for type uuid".
 */
export const ehErroIdentificadorInvalido = (err: unknown): boolean => {
  if (readField(err, "code").trim() === "22P02") return true;
  const raw = [readField(err, "message"), readField(err, "details"), readField(err, "hint")]
    .join(" ")
    .toLowerCase();
  return raw.includes("invalid input syntax for type uuid");
};

/**
 * Normalizador do fluxo de disponibilidade: preserva os códigos de domínio
 * CT2_* (P0001) e só devolve a mensagem de identificador inválido em 22P02.
 */
export const normalizeDisponibilidadeError = (err: unknown): Ct2NormalizedError => {
  const code = extractCt2Code(err);
  if (code) return normalizeCt2Error(err);

  if (ehErroIdentificadorInvalido(err)) {
    return { code: "22P02", message: MENSAGEM_IDENTIFICADOR_INVALIDO, isUncertain: false };
  }

  return normalizeCt2Error(err);
};
