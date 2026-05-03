/**
 * Helpers frontend-only para comparação resiliente de nomes de roles/funções.
 *
 * Motivação: alguns registros em `bd_roles.nome` podem conter espaços nas bordas
 * (ex.: "Apontador ") e o catálogo é protegido por trigger
 * (`fn_validate_role_catalog_change`), impedindo normalização no banco sem
 * privilégios elevados.
 *
 * Estes utilitários NÃO alteram regras de negócio — apenas tornam comparações
 * por nome de role tolerantes a espaços nas bordas e a diferença de
 * maiúsculas/minúsculas.
 */

export function normalizeRoleName(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function hasRole(
  values: unknown[] | undefined | null,
  role: string,
): boolean {
  const expected = normalizeRoleName(role);
  if (!expected) return false;
  return Array.isArray(values) && values.some((v) => normalizeRoleName(v) === expected);
}

export function hasAnyRole(
  values: unknown[] | undefined | null,
  roles: string[],
): boolean {
  return roles.some((role) => hasRole(values, role));
}
