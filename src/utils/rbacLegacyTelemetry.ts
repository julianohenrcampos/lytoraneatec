/**
 * Fase 5A-1 — Telemetria de uso do legado RBAC.
 *
 * Helper único para registrar quando o sistema ainda toca em fallbacks
 * legados (profiles.funcoes, app_metadata.funcoes, bd_role_permissions,
 * SUPER_ADMIN_FALLBACK_EMAILS, etc).
 *
 * Garantias:
 *  - Nunca altera comportamento do caller.
 *  - Nunca lança exceção para o caller (todos os erros são engolidos).
 *  - Throttle por sessão: 1 evento por (event, user_id) por sessão de browser.
 *  - Sempre faz console.warn estruturado.
 *  - Insere em bd_permission_audit_logs (fire-and-forget) quando possível.
 *
 * NÃO altera:
 *  - schema, RLS, RPC, policies.
 *  - branches de fallback existentes.
 *  - resultado de qualquer hook/utilitário.
 */

import { supabase } from '@/integrations/supabase/client';

export type RbacLegacyEvent =
  | 'RBAC_LEGACY_APP_METADATA_FUNCOES_USED'
  | 'RBAC_LEGACY_PROFILES_FUNCOES_BYPASS_USED'
  | 'RBAC_LEGACY_PROFILES_FUNCOES_DEGRADED'
  | 'RBAC_LEGACY_PROFILES_FUNCOES_ROLE_FALLBACK'
  | 'RBAC_LEGACY_BD_ROLE_PERMISSIONS_READ'
  | 'RBAC_LEGACY_FUNCOES_PERMISSAO_READ'
  | 'RBAC_LEGACY_SUPERADMIN_EMAIL_FALLBACK_USED'
  | 'RBAC_LEGACY_SCOPE_FALLBACK_USED';

export interface RbacLegacyPayload {
  /** ID do usuário, quando conhecido. */
  userId?: string | null;
  /** Nome do hook/arquivo de origem (vai para a coluna `rota`). */
  hook?: string | null;
  /** Detalhes adicionais — ficam apenas no console.warn (sem PII sensível). */
  [key: string]: unknown;
}

const SESSION_PREFIX = 'rbac_legacy_logged_';

function buildSessionKey(event: RbacLegacyEvent, userId: string | null | undefined): string {
  return `${SESSION_PREFIX}${event}_${userId ?? 'anon'}`;
}

function alreadyLoggedThisSession(event: RbacLegacyEvent, userId: string | null | undefined): boolean {
  try {
    if (typeof sessionStorage === 'undefined') return false;
    return sessionStorage.getItem(buildSessionKey(event, userId)) === '1';
  } catch {
    return false;
  }
}

function markLoggedThisSession(event: RbacLegacyEvent, userId: string | null | undefined): void {
  try {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(buildSessionKey(event, userId), '1');
  } catch {
    /* ignore */
  }
}

/**
 * Registra uso real de um fallback legado de RBAC.
 * Fire-and-forget. Nunca lança.
 *
 * @param event Código do evento (ver RbacLegacyEvent).
 * @param payload Dados auxiliares — userId/hook são extraídos para o insert.
 */
export function logLegacyUsage(event: RbacLegacyEvent, payload: RbacLegacyPayload = {}): void {
  try {
    const userId = (payload.userId as string | null | undefined) ?? null;

    if (alreadyLoggedThisSession(event, userId)) return;
    markLoggedThisSession(event, userId);

    // 1) Log estruturado em console — sempre.
    try {
      // eslint-disable-next-line no-console
      console.warn('[RBAC-LEGACY]', event, payload);
    } catch {
      /* ignore */
    }

    // 2) Insert fire-and-forget em bd_permission_audit_logs.
    //    Tabela já existente, sem JSONB — usamos `origem` para o evento e
    //    `rota` para o hook/arquivo de origem.
    try {
      const insertRow: {
        user_id: string | null;
        origem: string;
        rota: string | null;
        permitido: boolean;
      } = {
        user_id: userId,
        origem: event,
        rota: (payload.hook as string | null | undefined) ?? null,
        permitido: true,
      };

      void supabase
        .from('bd_permission_audit_logs')
        .insert(insertRow as any)
        .then(
          () => {},
          () => {},
        );
    } catch {
      /* telemetria nunca quebra o app */
    }
  } catch {
    /* salvaguarda final — engolir QUALQUER erro */
  }
}
