// =====================================================
// useFuncionariosBuscaAtivos
// Busca server-side de funcionários ativos via RPC
// get_funcionarios_ativos_global (SECURITY DEFINER).
// Suporta:
//  - p_search (filtro server-side por nome/cpf/matrícula)
//  - p_limit  (cap absoluto de retorno)
//  - p_centro_custo (priorização — CC do solicitante vem primeiro)
//  - p_ids    (resgate específico, ex.: aprovador / órfãos)
// Padroniza o shape via mapRpcRow + mapFuncionarioRecord.
// =====================================================

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mapRpcRow,
  mapFuncionarioRecord,
  type FuncionarioOption,
} from "./_funcionarioMappers";

export interface UseFuncionariosBuscaAtivosParams {
  /** Termo de busca livre (debounce interno de 250ms). */
  search?: string;
  /** CC para priorização (não filtro): funcionários do CC vêm primeiro. */
  centroCustoId?: string | null;
  /** Cap de retorno (default 50, máximo recomendado 500). */
  limit?: number;
  /** Resgate por IDs específicos (aprovador, órfãos, etc.). */
  ids?: string[];
  /** Habilita/desabilita a query. */
  enabled?: boolean;
}

export interface UseFuncionariosBuscaAtivosResult {
  funcionarios: FuncionarioOption[];
  isFetching: boolean;
  isLoading: boolean;
}

const DEFAULT_LIMIT = 50;
const DEBOUNCE_MS = 250;

function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export function useFuncionariosBuscaAtivos(
  params: UseFuncionariosBuscaAtivosParams = {}
): UseFuncionariosBuscaAtivosResult {
  const {
    search = "",
    centroCustoId = null,
    limit = DEFAULT_LIMIT,
    ids,
    enabled = true,
  } = params;

  const debouncedSearch = useDebouncedValue(search.trim(), DEBOUNCE_MS);
  const idsKey = ids && ids.length > 0 ? [...ids].sort().join(",") : "";

  const query = useQuery<FuncionarioOption[]>({
    queryKey: [
      "funcionarios-busca-ativos",
      debouncedSearch,
      centroCustoId,
      limit,
      idsKey,
    ],
    queryFn: async () => {
      const rpcParams: Record<string, unknown> = {
        p_search: debouncedSearch || null,
        p_limit: limit,
        p_centro_custo: centroCustoId || null,
      };
      if (ids && ids.length > 0) {
        rpcParams.p_ids = ids;
      }

      const { data, error } = await supabase.rpc(
        "get_funcionarios_ativos_global" as any,
        rpcParams as any
      );

      if (error) {
        console.error("[useFuncionariosBuscaAtivos] erro RPC", error);
        throw error;
      }

      const mapped = (data || [])
        .map(mapRpcRow)
        .map(mapFuncionarioRecord)
        .map((f) => ({
          ...f,
          fora_centro_custo_solicitacao:
            !!centroCustoId &&
            !!f.centro_custo_id &&
            f.centro_custo_id !== centroCustoId,
        }));

      console.info("[useFuncionariosBuscaAtivos]", {
        search: debouncedSearch,
        centroCustoId,
        limit,
        idsCount: ids?.length ?? 0,
        retornados: mapped.length,
      });

      return mapped;
    },
    enabled,
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keepPreviousData (TanStack v5)
  });

  return {
    funcionarios: query.data ?? [],
    isFetching: query.isFetching,
    isLoading: query.isLoading,
  };
}

/**
 * Helper imperativo para chamadas pontuais (ex.: "Adicionar por CC")
 * sem manter assinatura reativa em React state.
 */
export async function fetchFuncionariosAtivos(
  queryClient: ReturnType<typeof useQueryClient>,
  params: UseFuncionariosBuscaAtivosParams
): Promise<FuncionarioOption[]> {
  const {
    search = "",
    centroCustoId = null,
    limit = DEFAULT_LIMIT,
    ids,
  } = params;

  const idsKey = ids && ids.length > 0 ? [...ids].sort().join(",") : "";

  return queryClient.fetchQuery<FuncionarioOption[]>({
    queryKey: [
      "funcionarios-busca-ativos",
      search.trim(),
      centroCustoId,
      limit,
      idsKey,
    ],
    queryFn: async () => {
      const rpcParams: Record<string, unknown> = {
        p_search: search.trim() || null,
        p_limit: limit,
        p_centro_custo: centroCustoId || null,
      };
      if (ids && ids.length > 0) rpcParams.p_ids = ids;

      const { data, error } = await supabase.rpc(
        "get_funcionarios_ativos_global" as any,
        rpcParams as any
      );
      if (error) throw error;

      return (data || [])
        .map(mapRpcRow)
        .map(mapFuncionarioRecord)
        .map((f) => ({
          ...f,
          fora_centro_custo_solicitacao:
            !!centroCustoId &&
            !!f.centro_custo_id &&
            f.centro_custo_id !== centroCustoId,
        }));
    },
    staleTime: 30_000,
  });
}
