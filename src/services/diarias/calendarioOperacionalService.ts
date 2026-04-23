import { supabase } from '@/integrations/supabase/client';

export type EscopoRegraOperacional = 'global' | 'diretoria' | 'centro_custo';
export type TipoDiaOperacional = 'normal' | 'feriado_estrategico' | 'operacional' | 'compensado';
export type FiltroStatusRegra = 'ativas' | 'inativas' | 'todas';

export interface CalendarioOperacionalRegra {
  id: string;
  data: string;
  escopo_tipo: EscopoRegraOperacional;
  escopo_id: string | null;
  tipo_dia_operacional: TipoDiaOperacional;
  permite_remessa_matriculados: boolean;
  usa_diaria_exclusiva: boolean;
  exige_aprovacao_adicao: boolean;
  descricao: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CalendarioOperacionalResolvido {
  encontrada: boolean;
  disponivel: boolean;
  regra: CalendarioOperacionalRegra | null;
  permiteRemessaMatriculados: boolean;
  usaDiariaExclusiva: boolean;
  exigeAprovacaoAdicao: boolean;
  tipoDiaOperacional: TipoDiaOperacional | null;
  descricao: string | null;
}

export interface SalvarCalendarioOperacionalInput {
  id?: string;
  data: string;
  escopo_tipo: EscopoRegraOperacional;
  escopo_id?: string | null;
  tipo_dia_operacional: TipoDiaOperacional;
  permite_remessa_matriculados: boolean;
  usa_diaria_exclusiva: boolean;
  exige_aprovacao_adicao: boolean;
  descricao?: string | null;
  ativo?: boolean;
}

const TABLE_NAME = 'bd_diaria_calendario_operacional';
const CALENDARIO_SELECT = 'id, data, escopo_tipo, escopo_id, tipo_dia_operacional, permite_remessa_matriculados, usa_diaria_exclusiva, exige_aprovacao_adicao, descricao, ativo, created_at, updated_at';

function getCalendarioTable() {
  return (supabase as any).from(TABLE_NAME);
}

function aplicarFiltroEscopoId<T extends { is: (...args: any[]) => any; eq: (...args: any[]) => any }>(query: T, escopoId?: string | null): T {
  return escopoId == null
    ? query.is('escopo_id', null)
    : query.eq('escopo_id', escopoId);
}

function normalizarRegra(raw: any): CalendarioOperacionalRegra {
  const tipoDiaOperacional = raw.tipo_dia_operacional === 'ponte' ? 'operacional' : (raw.tipo_dia_operacional ?? 'normal');
  return {
    id: raw.id,
    data: raw.data,
    escopo_tipo: raw.escopo_tipo,
    escopo_id: raw.escopo_id ?? null,
    tipo_dia_operacional: tipoDiaOperacional,
    permite_remessa_matriculados: raw.permite_remessa_matriculados ?? raw.permite_remessa ?? false,
    usa_diaria_exclusiva: raw.usa_diaria_exclusiva ?? raw.diaria_exclusiva ?? false,
    exige_aprovacao_adicao: raw.exige_aprovacao_adicao ?? raw.exige_aprovacao ?? false,
    descricao: raw.descricao ?? raw.observacao ?? null,
    ativo: raw.ativo ?? true,
    created_at: raw.created_at,
    updated_at: raw.updated_at,
  };
}

export async function listarRegrasCalendarioOperacional(status: FiltroStatusRegra = 'ativas'): Promise<CalendarioOperacionalRegra[]> {
  try {
    let query = getCalendarioTable().select(CALENDARIO_SELECT).order('data', { ascending: false });

    if (status === 'ativas') query = query.eq('ativo', true);
    if (status === 'inativas') query = query.eq('ativo', false);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map(normalizarRegra);
  } catch (error) {
    console.warn('[calendarioOperacionalService] Recurso indisponível ao listar regras:', error);
    return [];
  }
}

export async function salvarRegraCalendarioOperacional(input: SalvarCalendarioOperacionalInput): Promise<CalendarioOperacionalRegra> {
  const payload = {
    data: input.data,
    escopo_tipo: input.escopo_tipo,
    escopo_id: input.escopo_id ?? null,
    tipo_dia_operacional: input.tipo_dia_operacional,
    permite_remessa_matriculados: input.permite_remessa_matriculados,
    usa_diaria_exclusiva: input.usa_diaria_exclusiva,
    exige_aprovacao_adicao: input.exige_aprovacao_adicao,
    descricao: input.descricao ?? null,
    ativo: input.ativo ?? true,
  };

  let targetId = input.id;
  if (!targetId) {
    const queryExistentes = aplicarFiltroEscopoId(
      getCalendarioTable()
      .select(CALENDARIO_SELECT)
      .eq('data', input.data)
      .eq('escopo_tipo', input.escopo_tipo)
      .order('updated_at', { ascending: false })
      .order('created_at', { ascending: false }),
      input.escopo_id ?? null,
    );

    const { data: existentes, error: buscaError } = await queryExistentes;

    if (buscaError) throw buscaError;
    const regraAtiva = (existentes || []).find((item: any) => item.ativo !== false);
    targetId = regraAtiva?.id;
  }

  const query = targetId
    ? getCalendarioTable().update(payload).eq('id', targetId)
    : getCalendarioTable().insert(payload);

  const { data, error } = await query.select(CALENDARIO_SELECT).single();
  if (error) throw error;
  return normalizarRegra(data);
}

export async function definirRegraCalendarioOperacionalAtiva(id: string, ativo: boolean): Promise<void> {
  const { error } = await getCalendarioTable().update({ ativo }).eq('id', id);
  if (error) throw error;
}

export async function inativarRegraCalendarioOperacionalEscopo(params: {
  data: string;
  escopo_tipo: EscopoRegraOperacional;
  escopo_id?: string | null;
}): Promise<void> {
  const query = aplicarFiltroEscopoId(
    getCalendarioTable()
    .select('id')
    .eq('data', params.data)
    .eq('escopo_tipo', params.escopo_tipo)
    .eq('ativo', true)
    .order('updated_at', { ascending: false })
    .order('created_at', { ascending: false }),
    params.escopo_id ?? null,
  );

  const { data, error } = await query;

  if (error) throw error;

  const ids = (data || []).map((item: any) => item.id);
  if (!ids.length) return;

  const { error: updateError } = await getCalendarioTable().update({ ativo: false }).in('id', ids);
  if (updateError) throw updateError;
}

export async function registrarLogOperacionalData(params: {
  data: string;
  acao: 'ativou' | 'desativou';
  descricao?: string | null;
}): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const userId = authData.user?.id;
  if (!userId) throw new Error('Usuário autenticado não encontrado para registrar log operacional.');

  const { error } = await (supabase as any)
    .from('bd_log_operacional_datas')
    .insert({
      data: params.data,
      usuario_id: userId,
      acao: params.acao,
      descricao: params.descricao ?? null,
    });

  if (error) throw error;
}

export async function resolverRegraOperacional(params: {
  data: string;
  centroCustoId?: string | null;
  diretoriaId?: string | null;
}): Promise<CalendarioOperacionalResolvido> {
  try {
    const { data, error } = await getCalendarioTable()
      .select(CALENDARIO_SELECT)
      .eq('ativo', true)
      .eq('data', params.data)
      .in('escopo_tipo', ['global', 'diretoria', 'centro_custo']);

    if (error) throw error;

    const regras = (data || []).map(normalizarRegra);
    const regraCentro = params.centroCustoId
      ? regras.find((regra) => regra.escopo_tipo === 'centro_custo' && regra.escopo_id === params.centroCustoId)
      : undefined;
    const regraDiretoria = params.diretoriaId
      ? regras.find((regra) => regra.escopo_tipo === 'diretoria' && regra.escopo_id === params.diretoriaId)
      : undefined;
    const regraGlobal = regras.find((regra) => regra.escopo_tipo === 'global');

    const regra = regraCentro || regraDiretoria || regraGlobal || null;

    return {
      encontrada: !!regra,
      disponivel: true,
      regra,
      permiteRemessaMatriculados: regra?.permite_remessa_matriculados ?? false,
      usaDiariaExclusiva: regra?.usa_diaria_exclusiva ?? false,
      exigeAprovacaoAdicao: regra?.exige_aprovacao_adicao ?? false,
      tipoDiaOperacional: regra?.tipo_dia_operacional ?? null,
      descricao: regra?.descricao ?? null,
    };
  } catch (error) {
    console.warn('[calendarioOperacionalService] Recurso indisponível ao resolver regra:', error);
    return {
      encontrada: false,
      disponivel: false,
      regra: null,
      permiteRemessaMatriculados: false,
      usaDiariaExclusiva: false,
      exigeAprovacaoAdicao: false,
      tipoDiaOperacional: null,
      descricao: null,
    };
  }
}