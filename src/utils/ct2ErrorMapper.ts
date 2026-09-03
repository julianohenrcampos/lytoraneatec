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
  CT3C_CLIENT_REF_OBRIGATORIO:
    "Referência local da viagem ausente. Recarregue a página e refaça a viagem.",
  CT3C_MODALIDADE_INVALIDA: "Modalidade da viagem inválida — use rodante ou transportado.",
  CT3C_TIPO_TRANSPORTE_INVALIDO: "Tipo de transporte inválido — use próprio ou terceiro.",
  CT3C_MOTORISTA_INVALIDO: "Motorista não encontrado no cadastro.",
  CT3C_TRANSPORTADOR_INVALIDO: "Veículo transportador não encontrado no cadastro.",
  CT3C_TRANSPORTADOR_INDISPONIVEL: "O veículo transportador não está disponível.",
  CT3C_TRANSPORTADOR_E_CARGA:
    "O veículo transportador não pode ser carga da própria viagem.",
  CT3C_EMPRESA_INVALIDA: "Empresa transportadora não encontrada no cadastro.",
  CT3C_CC_INVALIDO: "Centro de custo de origem ou destino não encontrado.",
  CT3C_VIAGEM_INVALIDA:
    "Esta viagem não pertence ao rascunho atual. Recarregue a página para sincronizar.",

  /* CT-3 / CT-3D — endereços, rota e ordem do motorista */
  CT3_IDEMPOTENCY_KEY_REUSED: "Esta operação já foi registrada com parâmetros diferentes.",
  CT3D_COORDENADA_INCOMPLETA:
    "Informe latitude e longitude juntas ao ajustar o ponto no mapa.",
  CT3D_COORDENADA_INVALIDA: "Coordenada fora do intervalo válido.",
  CT3D_DISTANCIA_INVALIDA: "Distância da rota fora do intervalo aceitável.",
  CT3D_RECEBEDOR_INVALIDO: "Recebedor previsto não encontrado no cadastro.",

  /* CT-3E / CT-3F — operação da viagem */
  CT3E_ASSINATURA_NAO_CADASTRADA:
    "Sua assinatura digital ainda não está cadastrada. A conclusão será registrada como aceite eletrônico — se o bloqueio persistir, cadastre a assinatura no menu do usuário.",
  CT3E_USUARIO_SEM_NOME:
    "Seu perfil está sem nome completo. Complete o cadastro para registrar o aceite eletrônico desta etapa.",
  CT3E_VIAGEM_NAO_SELECIONADA: "Nenhuma viagem selecionada para esta operação.",
  CT3E_CARGA_INVALIDA: "A carga informada não pertence a esta viagem.",

  /* CT-4 — movimentação direta e viagem multiparadas */
  CT4_AUTH_REQUIRED: "Sessão expirada. Entre novamente para continuar.",
  CT4_REQUEST_ID_OBRIGATORIO:
    "Requisição inválida. Recarregue a página e repita a operação.",
  CT4_FORBIDDEN: "Você não tem permissão para planejar ou programar movimentações.",
  CT4_VIAGEM_NAO_ENCONTRADA:
    "Esta movimentação não existe mais. Recarregue a Central do Transporte.",
  CT4_STATUS_INVALIDO:
    "Somente movimentações em rascunho podem ser alteradas. Esta já foi programada.",
  CT4_PARADA_SEM_CENTRO_CUSTO: "Informe a obra/centro de custo de cada parada de entrega.",
  CT4_PARADA_SEM_EQUIPAMENTO: "Toda parada precisa de ao menos um ativo vinculado.",
  CT4_SEM_PARADAS: "Adicione ao menos uma parada de entrega antes de programar.",
  CT4_SEM_EQUIPAMENTOS: "Vincule ao menos um ativo a uma parada antes de programar.",
  CT4_ATIVO_SEM_PARADA:
    "Existem ativos da movimentação ainda sem parada de entrega definida.",
  CT4_MODALIDADE_OBRIGATORIA: "Informe a modalidade do deslocamento.",
  CT4_DATA_OBRIGATORIA: "Informe a data prevista de saída.",
  CT4_ORIGEM_OBRIGATORIA: "Informe o ponto de partida (origem da coleta).",
  CT4_TRANSPORTE_INCOMPLETO:
    "Dados de transporte incompletos — informe veículo/motorista (próprio) ou transportadora, placa e motorista previsto (terceiro).",
  CT4_DISPONIBILIDADE_SEM_REGISTRO:
    "Há ativo sem disponibilidade operacional cadastrada. Regularize em Saneamento da Frota antes de programar.",
  CT4_ATIVO_INDISPONIVEL:
    "Há ativo em manutenção ou indisponível, que não pode ser movimentado.",
  CT4_ATIVO_EM_MANUTENCAO:
    "Há ativo com ordem de serviço de manutenção aberta. Conclua a OS antes de movimentar.",
  CT4_ATIVO_COMPROMETIDO:
    "Um dos ativos recebeu outro compromisso enquanto o planejamento estava aberto. Atualize a movimentação e escolha outro ativo.",
  CT4_PARADA_NAO_ENCONTRADA: "Parada não encontrada nesta viagem.",
  CT4_PARADA_STATUS_INVALIDO: "Esta parada já foi registrada.",
  CT4_PARADA_FORA_DE_ORDEM: "Registre as paradas na ordem planejada da viagem.",
  CT4_MOTIVO_OBRIGATORIO: "Informe o motivo do cancelamento.",
  CT4_CANCELAMENTO_APOS_INICIO_NAO_PERMITIDO:
    "O transporte desta movimentação já foi iniciado e o planejamento não pode mais ser cancelado.",
  CT4_RESPOSTA_INVALIDA: "Resposta inesperada do servidor. Recarregue a página e tente novamente.",

  /* CT-5 — puxadas (transporte de material com N caminhões + N motoristas) */
  CT5_AUTH_REQUIRED: "Sessão expirada. Entre novamente para continuar.",
  CT5_REQUEST_ID_OBRIGATORIO:
    "Requisição inválida. Recarregue a página e repita a operação.",
  CT5_FORBIDDEN: "Você não tem permissão para planejar ou programar puxadas.",
  CT5_PUXADA_NAO_ENCONTRADA:
    "Esta puxada não existe mais. Recarregue a Central do Transporte.",
  CT5_STATUS_NAO_EDITAVEL:
    "O planejamento desta puxada não pode mais ser alterado (já iniciada, concluída ou cancelada).",
  CT5_STATUS_INVALIDO: "Somente puxadas em rascunho podem ser programadas.",
  CT5_DATA_OBRIGATORIA: "Informe a data da puxada.",
  CT5_CENTRO_CUSTO_OBRIGATORIO: "Informe o centro de custo da puxada.",
  CT5_CENTRO_CUSTO_INVALIDO: "Centro de custo inexistente. Selecione outro.",
  CT5_CENTRO_CUSTO_FORA_DO_ESCOPO:
    "Este centro de custo está fora do seu escopo de acesso.",
  CT5_USUARIO_SEM_PERFIL: "Seu perfil de usuário não foi encontrado. Procure o administrador.",
  CT5_ROTA_GEOMETRIA_INVALIDA: "Rota inválida — recalcule o trajeto no mapa.",
  CT5_ROTA_NAO_CALCULADA:
    "Calcule a rota entre coleta e descarga antes de programar a puxada.",
  CT5_COLETA_INCOMPLETA: "Confirme o ponto de coleta no mapa.",
  CT5_DESCARGA_INCOMPLETA: "Confirme o ponto de descarga no mapa.",
  CT5_SEM_CAMINHOES: "Adicione ao menos um caminhão com motorista.",
  CT5_CAMINHAO_INVALIDO: "Caminhão inexistente. Selecione outro no catálogo.",
  CT5_CAMINHAO_DUPLICADO_NA_PUXADA:
    "O mesmo caminhão não pode ser incluído duas vezes na puxada.",
  CT5_CAMINHAO_INDISPONIVEL:
    "Há caminhão indisponível para a data da puxada (manutenção, sem registro ou bloqueado).",
  CT5_CAMINHAO_COMPROMETIDO_PUXADA:
    "Um dos caminhões já está comprometido com outra puxada nesta data. Atualize o planejamento e escolha outro.",
  CT5_MOTORISTA_OBRIGATORIO: "Selecione o motorista de cada caminhão.",
  CT5_MOTORISTA_INATIVO: "Motorista sem cadastro ativo. Escolha outro motorista.",
  CT5_MOTIVO_OBRIGATORIO: "Informe o motivo do cancelamento (mínimo de 5 caracteres).",
  CT5_CANCELAMENTO_APOS_INICIO_NAO_PERMITIDO:
    "A operação desta puxada já foi iniciada e o planejamento não pode mais ser cancelado.",
  CT5_RESPOSTA_INVALIDA: "Resposta inesperada do servidor. Recarregue a página e tente novamente.",
};

/**
 * CT-3D.4 — todos os prefixos de domínio da Central. Um código reconhecido
 * significa transação ABORTADA (determinística), nunca resultado incerto.
 */
const CT2_CODE_RE =
  /\b(CT2_[A-Z0-9_]+|CT25_[A-Z0-9_]+|CT3_[A-Z0-9_]+|CT3C_[A-Z0-9_]+|CT3D_[A-Z0-9_]+|CT3E_[A-Z0-9_]+|CT4_[A-Z0-9_]+|CT5_[A-Z0-9_]+)\b/;


/**
 * SQLSTATEs que provam aborto da transação no servidor: erro de regra de
 * negócio (RAISE), violação de constraint, permissão ou identificador inválido.
 * Nenhum deles pode ser tratado como "incerto".
 */
const SQLSTATES_DETERMINISTICOS = new Set([
  "P0001",
  "22P02",
  "23502",
  "23503",
  "23505",
  "23514",
  "42501",
  "42703",
  "42883",
  "55000",
  "40001",
  "55P03",
]);



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
  const sqlstateBruto = readField(err, "code").trim();

  if (code) {
    // Erro determinístico do servidor: a transação abortou.
    const catalogada = CT2_MESSAGES[code];
    if (!catalogada) {
      // Código de domínio não catalogado — pode inclusive vir do DETAIL de uma
      // violação de constraint (23514/23505). Nunca devolver mensagem opaca.
      const hint = readField(err, "hint").trim();
      console.warn("[CT2][CODIGO_NAO_CATALOGADO]", code, sqlstateBruto || "sem-sqlstate");
      return {
        code,
        message:
          hint ||
          "A operação foi rejeitada pelo servidor e nada foi gravado " +
            `(${code}). Tente novamente; se persistir, informe este código ao suporte.`,
        isUncertain: false,
      };
    }
    return {
      code,
      message:
        code === "CT2_ATIVO_AINDA_NAO_DISPONIVEL"
          ? [catalogada, detalheVigencia(err)].filter(Boolean).join(" ")
          : catalogada,
      isUncertain: false,
    };
  }


  // CT-3D.4 — SQLSTATE determinístico: a transação abortou no servidor, mesmo
  // que o código de domínio não esteja catalogado. Nunca é resultado incerto.
  const sqlstate = readField(err, "code").trim();
  if (SQLSTATES_DETERMINISTICOS.has(sqlstate)) {
    const hint = readField(err, "hint").trim();
    return {
      code: sqlstate,
      message:
        hint ||
        (sqlstate === "22P02"
          ? MENSAGEM_IDENTIFICADOR_INVALIDO
          : sqlstate === "55000"
            ? "O servidor rejeitou o estado interno da operação e nada foi gravado. Tente novamente; se persistir, recarregue a página."
            : "A operação foi rejeitada pelo servidor e nada foi gravado. Ajuste os dados e tente novamente."),
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
