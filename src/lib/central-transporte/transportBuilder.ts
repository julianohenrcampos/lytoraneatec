/**
 * CT-6 — Camada PURA do Transport Builder (Etapa 2 — Transporte).
 *
 * Nada aqui toca rede, React ou banco: são apenas leituras derivadas do
 * rascunho `CtViagemRascunho[]` já existente e dos ativos autoritativos
 * devolvidos por `fn_ct_mobilizacao_estado`.
 *
 * REGRAS ESTRUTURAIS
 *  - nenhum campo novo, nenhuma modalidade nova: RODANTE / TRANSPORTADO;
 *  - a data do planejamento é UMA: `dataProgramada` (a `dataPrevistaSaida`
 *    continua no contrato e é derivada dela, sem segundo input visível);
 *  - origem é o CC atual do ativo: origens divergentes NÃO são agrupáveis,
 *    porque a viagem persistida tem um único `origemCentroCustoId`;
 *  - ativo cujo CC atual já é o CC destino não exige viagem (atendimento local).
 */
import type {
  CtAtivoMobilizavel,
  CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";

/** Limite de UX desta fase para carga embarcada por transportador. */
export const CT_BUILDER_MAX_CARGA = 3;

/* ------------------------------------------------------------------ */
/* Identificadores de drag-and-drop (dnd-kit)                          */
/* ------------------------------------------------------------------ */

export type CtDragTipo = "ATIVO" | "MOTORISTA" | "VEICULO" | "RECEBEDOR";

const DRAG_TIPOS: CtDragTipo[] = ["ATIVO", "MOTORISTA", "VEICULO", "RECEBEDOR"];

export const dragId = (tipo: CtDragTipo, id: string): string => `${tipo}:${id}`;

export const parseDragId = (
  raw: string | number | null | undefined,
): { tipo: CtDragTipo; id: string } | null => {
  if (typeof raw !== "string") return null;
  const [tipo, ...resto] = raw.split(":");
  if (!DRAG_TIPOS.includes(tipo as CtDragTipo)) return null;
  const id = resto.join(":");
  return id ? { tipo: tipo as CtDragTipo, id } : null;
};

export type CtDropAlvo =
  | { tipo: "CANVAS" }
  | { tipo: "VIAGEM"; chaveLocal: string }
  | { tipo: "CARGA"; chaveLocal: string }
  | { tipo: "MOTORISTA_SLOT"; chaveLocal: string }
  | { tipo: "TRANSPORTADOR_SLOT"; chaveLocal: string }
  | { tipo: "RECEBEDOR_SLOT"; chaveLocal: string };

export const dropId = (alvo: CtDropAlvo): string =>
  alvo.tipo === "CANVAS" ? "DROP:CANVAS" : `DROP:${alvo.tipo}:${alvo.chaveLocal}`;

export const parseDropId = (raw: string | number | null | undefined): CtDropAlvo | null => {
  if (typeof raw !== "string" || !raw.startsWith("DROP:")) return null;
  const [, tipo, ...resto] = raw.split(":");
  if (tipo === "CANVAS") return { tipo: "CANVAS" };
  const chaveLocal = resto.join(":");
  if (!chaveLocal) return null;
  if (tipo === "VIAGEM") return { tipo: "VIAGEM", chaveLocal };
  if (tipo === "CARGA") return { tipo: "CARGA", chaveLocal };
  if (tipo === "MOTORISTA_SLOT") return { tipo: "MOTORISTA_SLOT", chaveLocal };
  if (tipo === "TRANSPORTADOR_SLOT") return { tipo: "TRANSPORTADOR_SLOT", chaveLocal };
  if (tipo === "RECEBEDOR_SLOT") return { tipo: "RECEBEDOR_SLOT", chaveLocal };
  return null;
};

/**
 * Compatibilidade explícita entre recurso arrastado e alvo do drop.
 * Motorista NUNCA entra na carga nem no slot de recebedor; recebedor NUNCA
 * vira motorista; ativo NUNCA vira pessoa/transportador.
 */
export const dropAceita = (tipo: CtDragTipo, alvo: CtDropAlvo): boolean => {
  switch (tipo) {
    case "ATIVO":
      return alvo.tipo === "CANVAS" || alvo.tipo === "VIAGEM" || alvo.tipo === "CARGA";
    case "MOTORISTA":
      return alvo.tipo === "MOTORISTA_SLOT" || alvo.tipo === "VIAGEM";
    case "RECEBEDOR":
      return alvo.tipo === "RECEBEDOR_SLOT";
    case "VEICULO":
      return (
        alvo.tipo === "TRANSPORTADOR_SLOT" || alvo.tipo === "VIAGEM" || alvo.tipo === "CANVAS"
      );
    default:
      return false;
  }
};



/* ------------------------------------------------------------------ */
/* Estado dos ativos                                                   */
/* ------------------------------------------------------------------ */

export type CtAtivoBuilderEstado =
  | "JA_NO_DESTINO"
  | "SEM_PLANEJAMENTO"
  | "EM_VIAGEM_NAO_SALVA"
  | "SALVO"
  | "PROGRAMADO";

export const CT_ATIVO_ESTADO_LABEL: Record<CtAtivoBuilderEstado, string> = {
  JA_NO_DESTINO: "Já no destino",
  SEM_PLANEJAMENTO: "Sem planejamento",
  EM_VIAGEM_NAO_SALVA: "Em viagem (não salva)",
  SALVO: "Salvo em rascunho",
  PROGRAMADO: "Programado",
};

/** O ativo já está fisicamente no CC destino da solicitação? */
export const jaNoDestino = (
  a: CtAtivoMobilizavel,
  destinoCentroCustoId: string | null | undefined,
): boolean =>
  !!destinoCentroCustoId &&
  !!a.centroCustoAtualId &&
  a.centroCustoAtualId === destinoCentroCustoId;

/* ------------------------------------------------------------------ */
/* Origem do agrupamento                                               */
/* ------------------------------------------------------------------ */

export interface CtOrigemAgrupamento {
  /** Único CC de origem quando todos os ativos compartilham a mesma origem. */
  centroCustoId: string | null;
  /** Quantidade de origens distintas presentes na carga. */
  quantidade: number;
  /** true quando há mais de uma origem — agrupamento inválido no backend atual. */
  divergente: boolean;
}

export const origemDoAgrupamento = (
  viagem: CtViagemRascunho,
  ativos: CtAtivoMobilizavel[],
): CtOrigemAgrupamento => {
  const porAtendimento = new Map(ativos.map((a) => [a.atendimentoId, a]));
  const origens = new Set<string>();
  for (const at of viagem.atendimentoIds) {
    const cc = porAtendimento.get(at)?.centroCustoAtualId;
    if (cc) origens.add(cc);
  }
  const lista = [...origens];
  return {
    centroCustoId: lista.length === 1 ? lista[0] : viagem.origemCentroCustoId,
    quantidade: lista.length,
    divergente: lista.length > 1,
  };
};

/* ------------------------------------------------------------------ */
/* Validação visual do card                                            */
/* ------------------------------------------------------------------ */

export type CtCardEstado = "INCOMPLETO" | "PRONTO" | "CONFLITO";

export interface CtCardVeredito {
  estado: CtCardEstado;
  /** Mensagem curta exibida no rodapé do card. */
  mensagem: string;
  pendencias: string[];
}

/**
 * Veredito visual do card. NÃO substitui `validarProgramacao` (autoridade da
 * programação): apenas antecipa, em linguagem operacional, o que falta.
 */
export const vereditoCard = (
  viagem: CtViagemRascunho,
  ativos: CtAtivoMobilizavel[],
  problemasServidor: string[] = [],
): CtCardVeredito => {
  const pendencias: string[] = [];
  const origem = origemDoAgrupamento(viagem, ativos);

  if (origem.divergente) {
    return {
      estado: "CONFLITO",
      mensagem: "Os ativos possuem origens diferentes e precisam de viagens separadas.",
      pendencias: ["Origens divergentes no mesmo agrupamento."],
    };
  }

  if (viagem.atendimentoIds.length === 0) pendencias.push("Nenhum ativo na viagem.");
  if (!viagem.modalidade) pendencias.push("Modalidade não definida.");
  if (viagem.modalidade === "RODANTE" && viagem.atendimentoIds.length > 1) {
    return {
      estado: "CONFLITO",
      mensagem: "Uma viagem rodante transporta exatamente um ativo.",
      pendencias: ["Mais de um ativo em viagem rodante."],
    };
  }
  if (viagem.modalidade === "TRANSPORTADO") {
    if (viagem.tipoTransporte === "TERCEIRO") {
      if (!viagem.empresaTransportadoraId) pendencias.push("Transportadora não informada.");
      if (!viagem.placaTransportador.trim()) pendencias.push("Placa do transportador não informada.");
      if (!viagem.motoristaId && !viagem.motoristaNome.trim()) {
        pendencias.push("Motorista não informado.");
      }
    } else {
      if (!viagem.veiculoTransportadorId) pendencias.push("Transportador não informado.");
      if (!viagem.motoristaId) pendencias.push("Motorista não informado.");
    }
    if (viagem.atendimentoIds.length > CT_BUILDER_MAX_CARGA) {
      pendencias.push(`Carga acima de ${CT_BUILDER_MAX_CARGA} ativos neste card.`);
    }
  }
  if (viagem.modalidade === "RODANTE" && !viagem.motoristaId) {
    pendencias.push("Motorista não informado.");
  }
  if (!viagem.dataProgramada) pendencias.push("Data da mobilização não informada.");
  if (!viagem.destinoCentroCustoId) pendencias.push("Destino não informado.");
  // O recebedor é da VIAGEM (um por viagem, inclusive na carga embarcada).
  if (!viagem.recebedorPrevistoFuncionarioId && !viagem.recebedorPrevistoNome.trim()) {
    pendencias.push("Recebedor da viagem não informado.");
  }
  if (
    viagem.destinoDescargaLatitude === null ||
    viagem.destinoDescargaLongitude === null
  ) {
    pendencias.push("Confirme o endereço de entrega.");
  }


  if (problemasServidor.length > 0) {
    return {
      estado: "CONFLITO",
      mensagem: problemasServidor[0],
      pendencias: [...pendencias, ...problemasServidor],
    };
  }

  if (pendencias.length > 0) {
    return { estado: "INCOMPLETO", mensagem: pendencias[0], pendencias };
  }

  return { estado: "PRONTO", mensagem: "Pronto para revisão", pendencias: [] };
};

/* ------------------------------------------------------------------ */
/* Recursos (motorista / transportador)                                */
/* ------------------------------------------------------------------ */

export type CtRecursoEstado = "LIVRE" | "EM_USO" | "CONFLITO";

/**
 * Estado REAL derivado do próprio rascunho: não existe motor de disponibilidade
 * de motorista neste módulo, portanto nada é inventado aqui.
 */
export const estadoMotorista = (
  motoristaId: string,
  viagens: CtViagemRascunho[],
): CtRecursoEstado => {
  const usos = viagens.filter((v) => v.motoristaId === motoristaId);
  if (usos.length > 1) return "CONFLITO";
  return usos.length === 1 ? "EM_USO" : "LIVRE";
};

export const estadoVeiculo = (
  veiculoId: string,
  viagens: CtViagemRascunho[],
  ativos: CtAtivoMobilizavel[],
): CtRecursoEstado => {
  const cargaIds = new Set(
    viagens.flatMap((v) =>
      v.atendimentoIds
        .map((at) => ativos.find((a) => a.atendimentoId === at)?.equipamentoId)
        .filter((x): x is string => !!x),
    ),
  );
  if (cargaIds.has(veiculoId)) return "CONFLITO";
  const usos = viagens.filter((v) => v.veiculoTransportadorId === veiculoId);
  return usos.length > 0 ? "EM_USO" : "LIVRE";
};

/** A data de saída prevista acompanha a data única do planejamento. */
export const patchDataUnica = (dataProgramada: string): Partial<CtViagemRascunho> => ({
  dataProgramada,
  dataPrevistaSaida: dataProgramada,
});
