import { supabase } from "@/integrations/supabase/client";

/**
 * Integração Chamados Internos ⇄ Solicitação de Equipamento.
 * Toda a autoridade é do banco (RPCs SECURITY DEFINER). O frontend apenas apresenta.
 */

export interface AprovacaoEtapaSnapshot {
  ordem: number | null;
  nome: string | null;
  status: string | null;
  aprovador_id: string | null;
  aprovador_nome: string | null;
  aprovador_origem: string | null;
  data_aprovacao?: string | null;
  observacao?: string | null;
}

export interface ProcessoOperacionalChamado {
  tem_processo: boolean;
  protocolo?: string | null;
  dominio?: "SOLICITACAO_EQUIPAMENTO";
  solicitacao_id?: string;
  referencia_tecnica?: string;
  status_fluxo?: string | null;
  aprovacao_origem?: "CORPORATIVO" | "LEGADO_EQUIPAMENTOS";
  data_inicio?: string | null;
  prioridade?: string | null;
  itens?: Array<{ quantidade: number; descricao: string; tipo_item: string; com_operador: boolean }>;
  aprovacao?: {
    status?: string;
    origem?: string;
    total_etapas?: number;
    etapas_concluidas?: number;
    fluxo?: { id: string | null; nome: string | null; versao: number | null };
    etapa_atual?: AprovacaoEtapaSnapshot | null;
  };
  pode_planejar?: boolean;
  historico_etapas?: AprovacaoEtapaSnapshot[];
}

export async function getProcessoOperacionalChamado(chamadoId: string): Promise<ProcessoOperacionalChamado> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_processo_operacional" as never, {
    p_chamado_id: chamadoId,
  } as never);
  if (error) throw error;
  return (data ?? { tem_processo: false }) as unknown as ProcessoOperacionalChamado;
}

export interface PodeResolverOperacional {
  pode_resolver: boolean;
  motivo: string | null;
  solicitacao_id?: string;
  status_fluxo?: string;
}

export async function getPodeResolverOperacional(chamadoId: string): Promise<PodeResolverOperacional> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_pode_resolver_operacional" as never, {
    p_chamado_id: chamadoId,
  } as never);
  if (error) throw error;
  return (data ?? { pode_resolver: true, motivo: null }) as unknown as PodeResolverOperacional;
}

export interface AprovacaoPreview {
  motor_ativo: boolean;
  origem: "CORPORATIVO" | "LEGADO_EQUIPAMENTOS";
  status?: string;
  fluxo_id?: string;
  fluxo_nome?: string;
  primeira_etapa?: { ordem: number; nome: string; tipo_aprovador: string };
  aprovador_previsto?: { profile_id?: string | null; nome?: string | null; origem?: string | null } | null;
  resolvido: boolean;
  erro?: string | null;
}

export async function getAprovacaoPreview(
  centroCustoId: string,
  contexto: Record<string, unknown> = {},
): Promise<AprovacaoPreview> {
  const { data, error } = await supabase.rpc("fn_solic_equip_aprovacao_preview" as never, {
    p_centro_custo_id: centroCustoId,
    p_contexto: contexto,
  } as never);
  if (error) throw error;
  return data as unknown as AprovacaoPreview;
}

export interface AbrirSolicEquipIntegradoInput {
  centro_custo_id: string;
  categoria_id: string;
  solicitante_funcionario_id: string;
  titulo: string;
  descricao: string;
  solicitacao_id: string;
  tipo_equipamento_id: string | null;
  data_inicio: string;
  tempo_previsto_dias: number | null;
  regime_trabalho: string | null;
  com_operador: boolean;
  prioridade: string;
  justificativa: string;
  engenheiro_solicitante_id: string;
  apontador_responsavel_id: string;
  /** NULL = "Avaliar disponibilidade". */
  departamento_atendimento_preferencial_id?: string | null;
  itens: unknown[];
}

export interface AbrirSolicEquipIntegradoResult {
  chamado_id: string;
  protocolo: string;
  solicitacao_id: string;
  referencia_tecnica: string;
  aprovacao_origem: "CORPORATIVO" | "LEGADO_EQUIPAMENTOS";
  requer_aprovacao: boolean;
  status_aprovacao: string;
  aprovador_atual: AprovacaoEtapaSnapshot | null;
}

export async function abrirChamadoComSolicitacaoEquipamento(
  input: AbrirSolicEquipIntegradoInput,
): Promise<AbrirSolicEquipIntegradoResult> {
  const { data, error } = await supabase.rpc("fn_chamado_interno_abrir_solic_equipamento" as never, {
    p_centro_custo_id: input.centro_custo_id,
    p_categoria_id: input.categoria_id,
    p_solicitante_funcionario_id: input.solicitante_funcionario_id,
    p_titulo: input.titulo,
    p_descricao: input.descricao,
    p_solicitacao_id: input.solicitacao_id,
    p_tipo_equipamento_id: input.tipo_equipamento_id,
    p_data_inicio: input.data_inicio,
    p_tempo_previsto_dias: input.tempo_previsto_dias,
    p_regime_trabalho: input.regime_trabalho,
    p_com_operador: input.com_operador,
    p_prioridade: input.prioridade,
    p_justificativa: input.justificativa,
    p_engenheiro_solicitante_id: input.engenheiro_solicitante_id,
    p_apontador_responsavel_id: input.apontador_responsavel_id,
    p_itens: input.itens,
    p_departamento_atendimento_preferencial_id:
      input.departamento_atendimento_preferencial_id ?? null,
  } as never);
  if (error) throw error;
  return data as unknown as AbrirSolicEquipIntegradoResult;
}

export interface SolicEquipAprovacaoResumo {
  solicitacao_id: string;
  chamado_id: string | null;
  protocolo: string | null;
  aprovacao_origem: string;
  status_aprovacao: "AGUARDANDO" | "APROVADO" | "REJEITADO";
  etapa_atual_ordem: number | null;
  etapa_atual_nome: string | null;
  total_etapas: number | null;
  etapas_concluidas: number | null;
  aprovador_atual_id: string | null;
  aprovador_atual_nome: string | null;
  aprovador_atual_origem: string | null;
  fluxo_nome: string | null;
}

/** Resumo em lote — evita N+1 nas listagens. */
export async function getAprovacaoResumoLote(ids: string[]): Promise<SolicEquipAprovacaoResumo[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.rpc("fn_solic_equip_aprovacao_resumo" as never, {
    p_ids: ids,
  } as never);
  if (error) throw error;
  return (data ?? []) as unknown as SolicEquipAprovacaoResumo[];
}

/**
 * Capability efetiva do gate de piloto (autoridade no banco).
 * true quando o toggle global está ligado OU o usuário possui a permissão
 * `chamados_acoes_integradas_teste`. Fail-closed em qualquer erro.
 */
export async function getAcoesIntegradasDisponivel(): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_chamados_acoes_integradas_disponivel" as never, {} as never);
  if (error) return false;
  return data === true;
}

/** Capability efetiva do motor corporativo (global OU piloto). Apenas apresentação. */
export async function getMotorCorporativoDisponivel(): Promise<boolean> {
  const { data, error } = await supabase.rpc("fn_motor_aprovacao_corporativo_disponivel" as never, {} as never);
  if (error) return false;
  return data === true;
}
