import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";
import {
  classifyItem,
  type InventoryVehicle,
  type ItemMatchResult,
} from "@/utils/solicitacaoMatching";

interface UseMatchingResult {
  isLoading: boolean;
  isError: boolean;
  results: ItemMatchResult[];
}

/**
 * Faz o matching visual (frontend) por subcategoria dos itens da solicitação
 * contra o inventário próprio.
 *
 * NÃO altera schema/RLS/trigger/RPC. Só sobrepõe visualmente o resultado
 * do backend (que hoje usa o tipo genérico do cabeçalho).
 */
export function useSolicitacaoMatching(solicitacao: SolicitacaoEquipamento | null): UseMatchingResult {
  const itens = solicitacao?.itens ?? [];
  const subcategoriaIds = Array.from(
    new Set(itens.map((i) => i.subcategoria_id).filter((v): v is string => !!v)),
  );

  const enabled = !!solicitacao && subcategoriaIds.length > 0;

  const query = useQuery({
    queryKey: ["solic-matching-inventario", subcategoriaIds.slice().sort().join(",")],
    enabled,
    queryFn: async () => {
      const { data: vehData, error: vehErr } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, frota, numero_frota, situacao, subcategoria_ativo_id, tipo_equipamento_id")
        .in("subcategoria_ativo_id", subcategoriaIds);
      if (vehErr) throw vehErr;

      const vehicles: InventoryVehicle[] = (vehData || []).map((v: any) => ({
        id: v.id,
        frota: v.frota ?? null,
        numero_frota: v.numero_frota ?? null,
        situacao: v.situacao ?? null,
        subcategoria_ativo_id: v.subcategoria_ativo_id ?? null,
        tipo_equipamento_id: v.tipo_equipamento_id ?? null,
      }));

      const dispByEquip = new Map<string, string | null>();
      const equipIds = vehicles.map((v) => v.id);
      if (equipIds.length > 0) {
        const { data: dispData } = await supabase
          .from("bd_disponibilidade_equipamentos")
          .select("equipamento_id, status_operacional, updated_at")
          .in("equipamento_id", equipIds);
        const sorted = (dispData || []).slice().sort((a: any, b: any) =>
          String(b.updated_at || "").localeCompare(String(a.updated_at || "")),
        );
        for (const row of sorted as any[]) {
          if (!dispByEquip.has(row.equipamento_id)) {
            dispByEquip.set(row.equipamento_id, row.status_operacional ?? null);
          }
        }
      }

      return { vehicles, dispByEquip };
    },
  });

  const vehicles = query.data?.vehicles ?? [];
  const dispByEquip = query.data?.dispByEquip ?? new Map<string, string | null>();
  const results: ItemMatchResult[] = solicitacao
    ? itens.map((it) => classifyItem(it, vehicles, dispByEquip))
    : [];

  return {
    isLoading: enabled && query.isLoading,
    isError: query.isError,
    results,
  };
}
