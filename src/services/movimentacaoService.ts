import { supabase } from "@/integrations/supabase/client";

export type StatusMovimentacao = "PLANEJADA" | "CHECKOUT" | "EM_TRANSPORTE" | "RECEBIMENTO" | "ENTREGUE" | "INCIDENTE" | "RECUSADA" | "FINALIZADA";

export interface Movimentacao {
  id: string;
  solicitacao_id: string;
  solicitacao_planejamento_id: string | null;
  equipamento_id: string | null;
  origem_tipo: string;
  origem_id: string | null;
  destino_tipo: string;
  destino_id: string | null;
  tipo_deslocamento: string | null;
  responsavel_transporte: string | null;
  tipo_atendimento: string | null;
  distancia_km: number | null;
  valor_km: number | null;
  custo_total: number | null;
  prazo_estimado_horas: number | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface MovimentacaoTransporte {
  id: string;
  movimentacao_id: string;
  tipo_transporte: string | null;
  caminhao_id: string | null;
  motorista_id: string | null;
  empresa_id: string | null;
  motorista_nome: string | null;
  motorista_cpf: string | null;
  placa: string | null;
  observacoes: string | null;
}

export interface MovimentacaoSaida {
  id: string;
  movimentacao_id: string;
  horimetro: number | null;
  combustivel: string | null;
  checklist_json: any;
  fotos_json: any;
  latitude: number | null;
  longitude: number | null;
  data_hora: string | null;
  responsavel_id: string | null;
}

export interface CriarMovimentacaoInput {
  solicitacao_id: string;
  solicitacao_planejamento_id?: string;
  equipamento_id?: string;
  origem_tipo: string;
  origem_id?: string;
  destino_tipo: string;
  destino_id?: string;
  tipo_deslocamento?: string;
  responsavel_transporte?: string;
  tipo_atendimento?: string;
  distancia_km?: number;
  valor_km?: number;
  custo_total?: number;
  prazo_estimado_horas?: number;
}

export interface CriarTransporteInput {
  movimentacao_id: string;
  tipo_transporte?: string;
  responsavel_transporte: string;
  caminhao_id?: string;
  motorista_id?: string;
  empresa_id?: string;
  motorista_nome?: string;
  motorista_cpf?: string;
  placa?: string;
  observacoes?: string;
}

export interface CriarCheckoutInput {
  movimentacao_id: string;
  horimetro?: number;
  combustivel?: string;
  checklist_json: any;
  fotos_json: any;
  latitude: number;
  longitude: number;
  responsavel_id: string;
}

export const criarMovimentacao = async (data: CriarMovimentacaoInput): Promise<string> => {
  const { data: result, error } = await supabase
    .from("bd_movimentacoes" as any)
    .insert({
      solicitacao_id: data.solicitacao_id,
      solicitacao_planejamento_id: data.solicitacao_planejamento_id || null,
      equipamento_id: data.equipamento_id || null,
      origem_tipo: data.origem_tipo,
      origem_id: data.origem_id || null,
      destino_tipo: data.destino_tipo,
      destino_id: data.destino_id || null,
      tipo_deslocamento: data.tipo_deslocamento || null,
      responsavel_transporte: data.responsavel_transporte || null,
      tipo_atendimento: data.tipo_atendimento || null,
      distancia_km: data.distancia_km || null,
      valor_km: data.valor_km || null,
      custo_total: data.custo_total || null,
      prazo_estimado_horas: data.prazo_estimado_horas || null,
      status: "PLANEJADA",
    } as any)
    .select("id")
    .single();

  if (error) throw error;
  return (result as any).id;
};

export const criarTransporteDetalhado = async (data: CriarTransporteInput) => {
  if (data.responsavel_transporte === "PROPRIO") {
    if (!data.caminhao_id || !data.motorista_id) {
      throw new Error("Transporte próprio exige caminhão e motorista.");
    }
  } else if (data.responsavel_transporte === "TERCEIRO") {
    if (!data.empresa_id || !data.motorista_nome || !data.motorista_cpf || !data.placa) {
      throw new Error("Transporte terceiro exige empresa, motorista, CPF e placa.");
    }
  }

  const { error } = await supabase
    .from("bd_movimentacao_transporte" as any)
    .insert({
      movimentacao_id: data.movimentacao_id,
      tipo_transporte: data.tipo_transporte || null,
      caminhao_id: data.caminhao_id || null,
      motorista_id: data.motorista_id || null,
      empresa_id: data.empresa_id || null,
      motorista_nome: data.motorista_nome || null,
      motorista_cpf: data.motorista_cpf || null,
      placa: data.placa || null,
      observacoes: data.observacoes || null,
    } as any);

  if (error) throw error;
};

export const registrarCheckoutSaida = async (data: CriarCheckoutInput) => {
  if (!data.fotos_json || (Array.isArray(data.fotos_json) && data.fotos_json.length === 0)) {
    throw new Error("Fotos obrigatórias para o checklist de saída.");
  }
  if (!data.latitude || !data.longitude) {
    throw new Error("Geolocalização obrigatória para o checklist de saída.");
  }

  const { error: insertErr } = await supabase
    .from("bd_movimentacao_saida" as any)
    .insert({
      movimentacao_id: data.movimentacao_id,
      horimetro: data.horimetro || null,
      combustivel: data.combustivel || null,
      checklist_json: data.checklist_json,
      fotos_json: data.fotos_json,
      latitude: data.latitude,
      longitude: data.longitude,
      responsavel_id: data.responsavel_id,
    } as any);

  if (insertErr) throw insertErr;

  const { error: updateErr } = await supabase
    .from("bd_movimentacoes" as any)
    .update({ status: "CHECKOUT" } as any)
    .eq("id", data.movimentacao_id);

  if (updateErr) throw updateErr;
};

export const fetchMovimentacoesBySolicitacao = async (solicitacaoId: string) => {
  const { data, error } = await supabase
    .from("bd_movimentacoes" as any)
    .select("*")
    .eq("solicitacao_id", solicitacaoId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const fetchMovimentacaoComDetalhes = async (movimentacaoId: string) => {
  const { data: mov, error: movErr } = await supabase
    .from("bd_movimentacoes" as any)
    .select("*")
    .eq("id", movimentacaoId)
    .single();

  if (movErr) throw movErr;

  const { data: transporte } = await supabase
    .from("bd_movimentacao_transporte" as any)
    .select("*")
    .eq("movimentacao_id", movimentacaoId)
    .maybeSingle();

  const { data: saida } = await supabase
    .from("bd_movimentacao_saida" as any)
    .select("*")
    .eq("movimentacao_id", movimentacaoId)
    .maybeSingle();

  return { movimentacao: mov, transporte, saida };
};

export const atualizarStatusMovimentacao = async (id: string, status: StatusMovimentacao) => {
  const { error } = await supabase
    .from("bd_movimentacoes" as any)
    .update({ status, updated_at: new Date().toISOString() } as any)
    .eq("id", id);

  if (error) throw error;
};

export const CHECKLIST_ITENS_PADRAO = [
  { key: "estado_geral", label: "Estado geral do equipamento" },
  { key: "pneus", label: "Pneus" },
  { key: "fluidos", label: "Fluidos" },
  { key: "documentacao", label: "Documentação" },
  { key: "acessorios", label: "Acessórios/Ferramentas" },
  { key: "avarias", label: "Avarias visíveis" },
];

export const COMBUSTIVEL_OPTIONS = [
  { value: "CHEIO", label: "Cheio" },
  { value: "3_4", label: "3/4" },
  { value: "1_2", label: "1/2" },
  { value: "1_4", label: "1/4" },
  { value: "RESERVA", label: "Reserva" },
];
