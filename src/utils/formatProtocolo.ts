/**
 * Formata o UUID de uma solicitação como protocolo visual unificado.
 * Exemplo: SOL-A1B2C3D4
 */
export const formatProtocolo = (id?: string | null): string => {
  if (!id) return "—";
  const hash = id.split("-")[0] || id;
  return `SOL-${hash.toUpperCase()}`;
};
