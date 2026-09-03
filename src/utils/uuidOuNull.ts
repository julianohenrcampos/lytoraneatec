/**
 * Normalização de identificadores UUID enviados às RPCs.
 *
 * Regra dura: nenhuma string vazia pode chegar ao PostgreSQL como uuid.
 *  - UUID opcional vazio/whitespace → null.
 *  - UUID opcional com texto não-UUID → erro de formulário (isUuid = false).
 *  - UUID obrigatório inválido → submit bloqueado (nunca convertido em null).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** true quando o valor é um UUID canônico (v1–v5). */
export const isUuid = (valor: unknown): valor is string =>
  typeof valor === "string" && UUID_RE.test(valor.trim());

/** UUID opcional: vazio/whitespace vira null; caso contrário devolve o valor aparado. */
export const uuidOuNull = (valor: string | null | undefined): string | null => {
  const normalizado = valor?.trim();
  return normalizado ? normalizado : null;
};

/** Texto/data opcional: vazio/whitespace vira null (datas, observações, motivos). */
export const textoOuNull = (valor: string | null | undefined): string | null => {
  const normalizado = valor?.trim();
  return normalizado ? normalizado : null;
};

/** Estado sanitizado de um parâmetro, para diagnóstico em console. */
export type EstadoParametro = "null" | "vazio" | "invalido" | "valido";

export const estadoParametroUuid = (valor: string | null | undefined): EstadoParametro => {
  if (valor === null || valor === undefined) return "null";
  if (!valor.trim()) return "vazio";
  return isUuid(valor) ? "valido" : "invalido";
};
