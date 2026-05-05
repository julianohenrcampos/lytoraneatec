/**
 * Fase 5B-1 — Observabilidade de escritas legadas RBAC (frontend).
 *
 * Instrumenta operações INSERT/UPDATE/DELETE feitas pelo frontend nas tabelas
 * legadas:
 *   - bd_funcoes_permissao
 *   - bd_permissoes
 *   - bd_permissoes_acoes
 *
 * Comportamento:
 *  - console.warn estruturado (canal primário, sempre).
 *  - INSERT fire-and-forget em `bd_permission_audit_logs` (canal secundário).
 *  - Falha silenciosa: NUNCA bloqueia ou interfere na operação principal.
 *  - Sem PII: não registra email, CPF, nome, salário, banco, payload completo,
 *    arrays de permissões, descrições nem IDs de domínio.
 *
 * Esta função é chamada IMEDIATAMENTE ANTES da operação legada para que o
 * registro seja gerado mesmo que a operação falhe depois.
 */
import { supabase } from "@/integrations/supabase/client";

type LegacyTable = "bd_funcoes_permissao" | "bd_permissoes" | "bd_permissoes_acoes";
type LegacyOperation = "insert" | "update" | "delete";

const EVENT = "RBAC_LEGACY_FRONTEND_WRITE";

export function auditLegacyRbacWrite(params: {
  service: string;
  operation: LegacyOperation;
  table: LegacyTable;
}): void {
  const { service, operation, table } = params;
  const rota = `${service}:${operation}:${table}`;

  // Canal primário — console.warn estruturado (sempre roda)
  try {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        event: EVENT,
        service,
        operation,
        table,
        rota,
      }),
    );
  } catch {
    /* noop */
  }

  // Canal secundário — fire-and-forget em bd_permission_audit_logs
  try {
    void (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const actorId = userData?.user?.id ?? null;
        await supabase
          .from("bd_permission_audit_logs")
          .insert({
            user_id: actorId,
            origem: EVENT,
            rota,
            permitido: true,
          } as any);
      } catch {
        /* telemetria nunca quebra a operação */
      }
    })();
  } catch {
    /* noop */
  }
}
