/**
 * Lista centralizada de e-mails com privilégio SuperAdm garantido.
 *
 * Esta é uma camada de fallback do RBAC, utilizada apenas quando a verificação
 * via `bd_user_roles` / `profiles.funcoes` falha (ex.: erro de RLS, perfil
 * recém-criado ainda sem vínculo de função). A fonte de verdade continua sendo
 * o banco de dados.
 *
 * Para revogar acesso emergencial basta remover o e-mail desta lista. Para
 * ampliar a lista, adicionar o e-mail e versionar a alteração.
 */
export const SUPER_ADMIN_FALLBACK_EMAILS: ReadonlyArray<string> = [
  'julianohcampos@yahoo.com.br',
  'ramonvalentevalente@gmail.com',
];

/**
 * Verifica se um e-mail está na lista de fallback de SuperAdm.
 * Retorna `false` para valores nulos/indefinidos.
 */
export function isSuperAdminFallbackEmail(email?: string | null): boolean {
  if (!email) return false;
  return SUPER_ADMIN_FALLBACK_EMAILS.includes(email.toLowerCase().trim());
}
