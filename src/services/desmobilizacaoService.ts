import { supabase } from "@/integrations/supabase/client";

export type DesmobilizacaoStatus =
  | "PENDENTE_APROVACAO"
  | "APROVADA"
  | "REPROVADA"
  | "CANCELADA"
  | "CONCLUIDA";

export const DESMOBILIZACAO_STATUS_LABELS: Record<DesmobilizacaoStatus, string> = {
  PENDENTE_APROVACAO: "Pendente Aprovação",
  APROVADA: "Aprovada",
  REPROVADA: "Reprovada",
  CANCELADA: "Cancelada",
  CONCLUIDA: "Concluída",
};

export interface SolicitacaoDesmobilizacao {
  id: string;
  equipamento_id: string;
  centro_custo_origem_id: string;
  engenheiro_responsavel_id: string;
  engenheiro_solicitante_id: string;
  solicitante_id: string;
  data_retirada: string;
  hora_retirada: string | null;
  observacoes: string | null;
  status: DesmobilizacaoStatus;
  exige_aprovacao: boolean;
  previsao_liberacao_anterior: string | null;
  previsao_aplicada: boolean;
  motivo_recusa: string | null;
  motivo_cancelamento: string | null;
  created_at: string;
  // enriquecimento (joins resolvidos em memória)
  equipamento_label?: string;
  centro_custo_origem_label?: string;
  centro_custo_atual_id?: string | null;
  solicitante_nome?: string;
  engenheiro_responsavel_nome?: string;
  engenheiro_solicitante_nome?: string;
  saiu_do_cc_origem?: boolean;
}

export interface SolicitarDesmobilizacaoInput {
  equipamentoId: string;
  engenheiroResponsavelId: string;
  engenheiroSolicitanteId: string;
  dataRetirada: string;
  horaRetirada?: string | null;
  observacoes?: string | null;
}

const rpc = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) {
    console.error(`[desmobilizacao][${fn}]`, error);
    const hint = (error as any)?.hint as string | undefined;
    throw new Error(hint || error.message || "Falha ao processar a desmobilização.");
  }
  return data as T;
};

export const solicitarDesmobilizacao = (input: SolicitarDesmobilizacaoInput) =>
  rpc<{ id: string; status: DesmobilizacaoStatus; exige_aprovacao: boolean; previsao_aplicada: boolean }>(
    "fn_desmobilizacao_solicitar",
    {
      p_equipamento_id: input.equipamentoId,
      p_engenheiro_responsavel_id: input.engenheiroResponsavelId,
      p_engenheiro_solicitante_id: input.engenheiroSolicitanteId,
      p_data_retirada: input.dataRetirada,
      p_hora_retirada: input.horaRetirada || null,
      p_observacoes: input.observacoes || null,
    }
  );

export const decidirDesmobilizacao = (id: string, decisao: "APROVAR" | "REPROVAR", motivo?: string | null) =>
  rpc<{ id: string; status: DesmobilizacaoStatus }>("fn_desmobilizacao_decidir", {
    p_id: id,
    p_decisao: decisao,
    p_motivo: motivo || null,
  });

export const cancelarDesmobilizacao = (id: string, motivo?: string | null) =>
  rpc<{ id: string; status: DesmobilizacaoStatus; previsao_revertida: boolean; divergencia_concorrente?: boolean }>(
    "fn_desmobilizacao_cancelar",
    { p_id: id, p_motivo: motivo || null }
  );

export const concluirDesmobilizacao = (id: string) =>
  rpc<{ id: string; status: DesmobilizacaoStatus }>("fn_desmobilizacao_concluir", { p_id: id });

/** Leitura (RLS aplica o escopo). Nenhuma mutação direta é feita pelo cliente. */
export const fetchDesmobilizacoes = async (): Promise<SolicitacaoDesmobilizacao[]> => {
  const { data, error } = await (supabase as any)
    .from("bd_solicitacoes_desmobilizacao")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  if (error) {
    console.error("[desmobilizacao][fetch]", error);
    throw error;
  }

  const rows = (data ?? []) as SolicitacaoDesmobilizacao[];
  if (rows.length === 0) return [];

  const equipIds = Array.from(new Set(rows.map((r) => r.equipamento_id)));
  const ccIds = Array.from(new Set(rows.map((r) => r.centro_custo_origem_id)));
  const profIds = Array.from(
    new Set(rows.flatMap((r) => [r.solicitante_id, r.engenheiro_responsavel_id, r.engenheiro_solicitante_id]))
  );

  const [equipRes, ccRes, profRes] = await Promise.all([
    supabase
      .from("bd_caminhoes_equipamentos")
      .select("id, frota, numero_frota, placa, centro_custo_atual_id")
      .in("id", equipIds),
    supabase.from("bd_centros_custo").select("id, codigo_centro_custo, nome_centro_custo").in("id", ccIds),
    supabase.from("profiles").select("id, nome_completo").in("id", profIds),
  ]);

  const equipMap = new Map((equipRes.data ?? []).map((e: any) => [e.id, e]));
  const ccMap = new Map((ccRes.data ?? []).map((c: any) => [c.id, c]));
  const profMap = new Map((profRes.data ?? []).map((p: any) => [p.id, p.nome_completo as string]));

  return rows.map((r) => {
    const e: any = equipMap.get(r.equipamento_id);
    const cc: any = ccMap.get(r.centro_custo_origem_id);
    const frota = [e?.frota, e?.numero_frota].filter(Boolean).join(" ");
    return {
      ...r,
      equipamento_label: e ? `${frota ? `${frota} - ` : ""}${e.placa || "s/ placa"}` : "Ativo não identificado",
      centro_custo_origem_label: cc
        ? `${cc.codigo_centro_custo} - ${cc.nome_centro_custo}`
        : "CC não identificado",
      centro_custo_atual_id: e?.centro_custo_atual_id ?? null,
      saiu_do_cc_origem: !!e && e.centro_custo_atual_id !== r.centro_custo_origem_id,
      solicitante_nome: profMap.get(r.solicitante_id) || "-",
      engenheiro_responsavel_nome: profMap.get(r.engenheiro_responsavel_id) || "-",
      engenheiro_solicitante_nome: profMap.get(r.engenheiro_solicitante_id) || "-",
    };
  });
};
