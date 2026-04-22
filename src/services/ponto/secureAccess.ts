import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PontoReportContext = "pessoal" | "gestao" | "rh";

const VIEW_BY_CONTEXT: Record<PontoReportContext, string> = {
  pessoal: "vw_ponto_batidas_pessoal",
  gestao: "vw_ponto_batidas_gestao",
  rh: "vw_ponto_batidas_rh",
};

export function getPontoBatidasViewForContext(context: PontoReportContext) {
  return VIEW_BY_CONTEXT[context];
}

export async function getCurrentPontoReportContext(): Promise<PontoReportContext> {
  const [canViewRh, canViewGestao] = await Promise.all([
    supabase.rpc("fn_ponto_can_view_rh"),
    supabase.rpc("fn_ponto_can_view_gestao"),
  ]);

  if (canViewRh.data === true) return "rh";
  if (canViewGestao.data === true) return "gestao";
  return "pessoal";
}

export async function auditPontoAccess(params: {
  context: PontoReportContext;
  tipoAcesso: "consulta" | "exportacao_pdf" | "exportacao_excel";
  recurso: string;
  filtros?: Json;
  quantidadeRegistros?: number;
  origem?: string;
  funcionarioId?: string | null;
  detalhes?: Json;
}) {
  const { error } = await supabase.rpc("fn_auditar_relatorio_ponto", {
    _contexto: params.context,
    _tipo_acesso: params.tipoAcesso,
    _recurso: params.recurso,
    _filtros: params.filtros ?? {},
    _quantidade_registros: params.quantidadeRegistros ?? null,
    _origem: params.origem ?? null,
    _detalhes: params.detalhes ?? {},
    _funcionario_id: params.funcionarioId ?? null,
  });

  if (error) {
    console.warn("[PONTO][AUDITORIA] Falha ao registrar auditoria:", error.message);
  }
}

export function canSeeSensitivePontoData(context: PontoReportContext) {
  return context === "rh";
}

export function sanitizePontoFilters(filters: {
  funcionarioId?: string | null;
  ccIds?: string[];
  dataInicio?: string;
  dataFim?: string;
}) {
  return {
    funcionario_id: filters.funcionarioId ?? null,
    centro_custo_ids: filters.ccIds ?? [],
    data_inicio: filters.dataInicio ?? null,
    data_fim: filters.dataFim ?? null,
  };
}