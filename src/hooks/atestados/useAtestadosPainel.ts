import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  AtestadoRow,
  AtestadosPainelFilters,
} from "@/types/atestadoMedico";

const SELECT_COLS = `
  id,
  protocolo,
  nome_snapshot,
  matricula_snapshot,
  centro_custo_snapshot,
  data_emissao,
  data_inicio_afastamento,
  dias_afastamento,
  enviado_em,
  dentro_prazo_24h,
  status,
  notificacao_email_status,
  notificacao_email_tentativas,
  declaracao_veracidade,
  declaracao_original_48h,
  declaracao_ciencia_nao_validacao,
  declaracoes_aceitas_em,
  observacao_saude,
  arquivo_path
`;

export function useAtestadosPainel(filters: AtestadosPainelFilters) {
  return useQuery({
    queryKey: ["atestados-painel", filters],
    queryFn: async (): Promise<AtestadoRow[]> => {
      let q = supabase
        .from("bd_atestados_medicos")
        .select(SELECT_COLS)
        .order("enviado_em", { ascending: false })
        .limit(500);

      if (filters.data_inicio) q = q.gte("enviado_em", `${filters.data_inicio}T00:00:00`);
      if (filters.data_fim) q = q.lte("enviado_em", `${filters.data_fim}T23:59:59`);
      if (filters.status && filters.status !== "todos") q = q.eq("status", filters.status);
      if (filters.prazo === "dentro") q = q.eq("dentro_prazo_24h", true);
      if (filters.prazo === "fora") q = q.eq("dentro_prazo_24h", false);
      if (filters.busca && filters.busca.trim()) {
        const b = filters.busca.trim().replace(/[%_]/g, "");
        q = q.or(
          `protocolo.ilike.%${b}%,matricula_snapshot.ilike.%${b}%,nome_snapshot.ilike.%${b}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AtestadoRow[];
    },
    staleTime: 30_000,
  });
}
