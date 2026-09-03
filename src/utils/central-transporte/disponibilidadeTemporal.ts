/**
 * CT-3B.1 — Rótulos temporais da disponibilidade operacional.
 *
 * Cada campo real da tabela tem rótulo próprio e NUNCA é escrito no lugar do
 * outro:
 *   - `data_inicio`        → vigência do status atual;
 *   - `previsao_liberacao` → previsão de liberação futura.
 *
 * IMPORTANTE (gap CT-2.3): `fn_ct_avaliar_disponibilidade` ignora `data_inicio`
 * no ramo DISPONIVEL. Portanto a apresentação temporal aqui é APENAS informativa
 * — não autoriza, não bloqueia e não substitui a avaliação do servidor.
 */

export type StatusDisponibilidadeTemporal =
  | "DISPONIVEL"
  | "ALOCADO"
  | "MANUTENCAO"
  | "INDISPONIVEL"
  | "SEM_STATUS"
  | "DESCONHECIDO";

/** Data de referência do negócio (America/Sao_Paulo), formato ISO yyyy-MM-dd. */
export const dataReferenciaOperacional = (agora: Date = new Date()): string =>
  agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

export interface RotuloDataInicio {
  label: string;
  /** true quando a vigência do status DISPONIVEL só começa no futuro. */
  vigenciaFutura: boolean;
}

export const LABEL_DISPONIVEL_DESDE = "Disponível desde";
export const LABEL_DISPONIVEL_A_PARTIR = "Disponível a partir de";
export const LABEL_VIGENTE_DESDE = "Status vigente desde";
export const LABEL_PREVISAO_LIBERACAO = "Previsão de liberação";

export const AVISO_VIGENCIA_FUTURA =
  "A vigência informada começa no futuro. Esta informação é apenas apresentada — a autorização de atendimento continua sendo decidida pelo servidor.";

/**
 * Rótulo contextual do campo `data_inicio`, conforme o status operacional.
 * Nunca renomeia nem reaproveita `previsao_liberacao`.
 */
export const rotuloDataInicio = (
  status: StatusDisponibilidadeTemporal | string | null | undefined,
  dataInicio: string | null | undefined,
  referencia: string = dataReferenciaOperacional(),
): RotuloDataInicio => {
  const s = String(status ?? "").toUpperCase();
  if (s !== "DISPONIVEL") return { label: LABEL_VIGENTE_DESDE, vigenciaFutura: false };
  const futura = !!dataInicio && dataInicio > referencia;
  return {
    label: futura ? LABEL_DISPONIVEL_A_PARTIR : LABEL_DISPONIVEL_DESDE,
    vigenciaFutura: futura,
  };
};

/** true apenas para DISPONIVEL cuja vigência ainda não começou. */
export const disponivelFuturamente = (
  status: StatusDisponibilidadeTemporal | string | null | undefined,
  dataInicio: string | null | undefined,
  referencia: string = dataReferenciaOperacional(),
): boolean => rotuloDataInicio(status, dataInicio, referencia).vigenciaFutura;

/** true para status não disponíveis que possuem previsão de liberação. */
export const liberacaoPrevista = (
  status: StatusDisponibilidadeTemporal | string | null | undefined,
  previsaoLiberacao: string | null | undefined,
): boolean => {
  const s = String(status ?? "").toUpperCase();
  return (
    !!previsaoLiberacao &&
    (s === "ALOCADO" || s === "MANUTENCAO" || s === "INDISPONIVEL")
  );
};
