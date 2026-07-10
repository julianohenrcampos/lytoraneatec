// =====================================================
// usePlanejamentoScopeCentrosCusto
// Hook oficial de escopo de Centros de Custo do
// Planejamento Macro. Consome a RPC endurecida:
//   public.fn_planejamento_scope_centros_custo(uuid DEFAULT auth.uid())
//
// - SuperAdm: não chama a RPC; retorna isGlobal=true.
// - Usuário comum: RPC com p_user_id = auth do próprio usuário.
// - Fail-closed em qualquer erro (inclui 42501 forbidden).
// - Sem consulta cliente a profiles/bd_centros_custo.
// - Sem fn_diaria_scope_centros_custo.
// =====================================================

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";

export interface PlanejamentoScopeResult {
  isGlobal: boolean;
  allowedCentroIds: string[];
  isLoading: boolean;
  error: Error | null;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RpcRow =
  | string
  | {
      fn_planejamento_scope_centros_custo?: string | null;
      centro_custo_id?: string | null;
      id?: string | null;
    };

function normalizeRpcData(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  const valid: string[] = [];
  for (const row of data as RpcRow[]) {
    let candidate: string | null | undefined;
    if (typeof row === "string") {
      candidate = row;
    } else if (row && typeof row === "object") {
      candidate =
        row.fn_planejamento_scope_centros_custo ??
        row.centro_custo_id ??
        row.id ??
        null;
    }
    if (typeof candidate === "string" && UUID_REGEX.test(candidate)) {
      valid.push(candidate);
    }
  }
  return [...new Set(valid)].sort();
}

export function usePlanejamentoScopeCentrosCusto(): PlanejamentoScopeResult {
  const { user, isLoading: authLoading } = useAuth();
  const { isSuperAdmin, isLoading: permLoading } = usePermission();

  const userId = user?.id ?? null;

  const query = useQuery<string[], Error>({
    queryKey: ["planejamento-scope-cc", userId],
    enabled: !authLoading && !permLoading && !!userId && !isSuperAdmin,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      const shouldRetry = failureCount < 1;
      if (!shouldRetry) {
        const rpcError = error as {
          code?: string;
          message?: string;
          details?: string;
          hint?: string;
        };
        console.error("[PLANEJAMENTO][SCOPE_RPC_ERROR]", {
          userId,
          code: rpcError?.code,
          message: rpcError?.message,
          details: rpcError?.details,
          hint: rpcError?.hint,
        });
      }
      return shouldRetry;
    },
    queryFn: async () => {
      if (!userId) {
        throw new Error("Usuário autenticado não identificado");
      }
      const { data, error } = await supabase.rpc(
        "fn_planejamento_scope_centros_custo",
        { p_user_id: userId },
      );
      if (error) {
        throw error;
      }
      return normalizeRpcData(data);
    },
  });

  return useMemo<PlanejamentoScopeResult>(() => {
    if (authLoading || permLoading) {
      return {
        isGlobal: false,
        allowedCentroIds: [],
        isLoading: true,
        error: null,
      };
    }
    if (isSuperAdmin) {
      return {
        isGlobal: true,
        allowedCentroIds: [],
        isLoading: false,
        error: null,
      };
    }
    if (!userId) {
      return {
        isGlobal: false,
        allowedCentroIds: [],
        isLoading: false,
        error: new Error("Usuário autenticado não identificado"),
      };
    }
    return {
      isGlobal: false,
      allowedCentroIds: query.data ?? [],
      isLoading: query.isLoading,
      error: query.error instanceof Error ? query.error : null,
    };
  }, [
    authLoading,
    permLoading,
    isSuperAdmin,
    userId,
    query.data,
    query.isLoading,
    query.error,
  ]);
}
