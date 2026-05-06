/**
 * RBAC feature flags — build-time.
 *
 * Esta flag controla se os ramos de fallback legado dentro de
 * `src/hooks/usePermission.ts` continuam ativos (`true`) ou se ficam
 * inertes em modo deny-safe (`false`).
 *
 * IMPORTANTE — modo de configuração:
 *   - O valor é lido por `import.meta.env.VITE_RBAC_LEGACY_FALLBACK_ENABLED`
 *     no momento do BUILD do Vite. Mudar essa variável em produção exige
 *     **rebuild + redeploy do bundle**. Não há configuração runtime nesta
 *     fase por decisão explícita: nada de banco, RLS, RPC ou tabela de
 *     feature flag.
 *
 * Ramos cobertos pela flag (em `usePermission.ts`):
 *   - D1: detecção early de SuperAdm via `profiles.funcoes`
 *   - D2: role fallback via `profiles.funcoes`
 *   - D3: fallback de permissões via `bd_role_permissions`
 *   - D4: extras via `bd_funcoes_permissao` + `bd_permissoes`
 *   - E2: liberação de SuperAdm em modo degradado (depende de D1)
 *
 * Não cobertos (continuam ativos em qualquer modo):
 *   - Camada A (JWT app_metadata)
 *   - Camada B (snapshot offline validado)
 *   - Camada C (bypass administrativo via profiles.acesso_global / funcoes)
 *
 * Default: `true` (release B1 = comportamento funcional idêntico ao atual,
 * apenas com telemetria estruturada). O cutover (`false`) é executado
 * em uma release separada (B2) após análise dos eventos coletados em
 * `bd_permission_audit_logs`.
 */

const rawFlag = import.meta.env.VITE_RBAC_LEGACY_FALLBACK_ENABLED;

export const RBAC_LEGACY_FALLBACK_ENABLED: boolean =
  (rawFlag ?? 'true') !== 'false';

export function getRbacFlagsSnapshot() {
  return { RBAC_LEGACY_FALLBACK_ENABLED };
}
