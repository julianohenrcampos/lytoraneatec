/**
 * Extrai o primeiro nome de um nome completo.
 * Padrão visual "por: <Primeiro nome>" usado em Agendamento de Exames
 * e replicado no módulo de Chamados Internos.
 */
export function primeiroNome(nomeCompleto?: string | null): string {
  const t = (nomeCompleto ?? "").trim();
  if (!t) return "";
  return t.split(/\s+/)[0];
}
