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
  arquivo_path,
  tipo_documento,
  tipo_documento_descricao,
  notificacao_email_destino,
  sistema_afetado_codigo,
  sistema_afetado_descricao,
  sistema_afetado_observacao,
  alertas_gerados,
  lido,
  lido_em,
  lido_por,
  lido_por_nome
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
      if (filters.tipo_documento && filters.tipo_documento !== "todos") {
        q = q.eq("tipo_documento", filters.tipo_documento);
      }
      if (filters.setor_destino === "saude") {
        q = q.eq("tipo_documento", "atestado_medico");
      } else if (filters.setor_destino === "dp") {
        q = q.neq("tipo_documento", "atestado_medico");
      }
      if (filters.status_email && filters.status_email !== "todos") {
        q = q.eq("notificacao_email_status", filters.status_email);
      }
      if (filters.centro_custo && filters.centro_custo.trim()) {
        const cc = filters.centro_custo.trim().replace(/[%_]/g, "");
        q = q.ilike("centro_custo_snapshot", `%${cc}%`);
      }
      if (filters.sistema_afetado && filters.sistema_afetado !== "todos") {
        q = q.eq("sistema_afetado_codigo", filters.sistema_afetado);
      }
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
