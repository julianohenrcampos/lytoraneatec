/**
 * CT-3B — Feature flags da Central do Transporte (fase 3).
 *
 * A página dedicada da solicitação entra desligada por padrão: enquanto a flag
 * estiver `false`, a Central mantém o fluxo do modal legado (CT-2).
 */
const truthy = (v: unknown): boolean =>
  String(v ?? "").trim().toLowerCase() === "true" || String(v ?? "").trim() === "1";

export const CT3B_SOLICITACAO_PAGE_ENABLED = truthy(
  import.meta.env?.VITE_CT3B_SOLICITACAO_PAGE_ENABLED,
);

export const isCt3bSolicitacaoPageEnabled = (): boolean => CT3B_SOLICITACAO_PAGE_ENABLED;
