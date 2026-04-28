/**
 * Logger padronizado do módulo Ponto Eletrônico.
 * Formato: [PONTO][MODULO][EVENTO]
 *
 * Usa SEMPRE console.error porque o esbuild de produção
 * (vite.config.ts) remove console.log/info/debug/warn.
 * console.error é preservado e visível em campo (auditoria/debug).
 */

export type PontoLogNivel = "info" | "warn" | "error";
export type PontoLogModulo =
  | "BIOMETRIA"
  | "GPS"
  | "FACEAPI"
  | "CAMERA"
  | "EDGE"
  | "CONFIRMACAO";

export function pontoLog(
  modulo: PontoLogModulo,
  evento: string,
  nivel: PontoLogNivel = "info",
  payload?: unknown,
): void {
  const tag = `[PONTO][${modulo}][${evento}]`;
  if (nivel === "error") {
    // eslint-disable-next-line no-console
    console.error(tag, payload ?? "");
  } else if (nivel === "warn") {
    // eslint-disable-next-line no-console
    console.error(tag, "[warn]", payload ?? "");
  } else {
    // eslint-disable-next-line no-console
    console.error(tag, "[info]", payload ?? "");
  }
}
