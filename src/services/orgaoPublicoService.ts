import { supabase } from "@/integrations/supabase/client";

export interface OrgaoPublico {
  id: string;
  nome: string;
  sigla: string;
  esfera: string | null;
  area_atuacao: string | null;
  nivel_prioridade: number | null;
  perfil_contratacao: string | null;
  ticket_medio: number | null;
  frequencia_licitacoes: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgaoAlias {
  id: string;
  orgao_id: string;
  alias_nome: string;
  alias_normalizado: string;
  created_at: string;
}

export interface OrgaoPendente {
  id: string;
  nome_api_original: string;
  nome_api_normalizado: string;
  licitacao_id: string | null;
  licitacao_numero: string | null;
  origem: string | null;
  status: string | null;
  observacoes: string | null;
  created_at: string;
}

// Buscar todos os órgãos ativos
export const fetchOrgaosPublicos = async (): Promise<OrgaoPublico[]> => {
  const { data, error } = await supabase
    .from("bd_orgaos_publicos")
    .select("*")
    .eq("ativo", true)
    .order("nome");

  if (error) throw error;
  return (data || []) as OrgaoPublico[];
};

// Buscar aliases com join ao órgão
export const fetchOrgaosAlias = async () => {
  const { data, error } = await supabase
    .from("bd_orgaos_alias")
    .select(`
      id, orgao_id, alias_nome, alias_normalizado, created_at,
      orgao:bd_orgaos_publicos!bd_orgaos_alias_orgao_id_fkey (id, nome, sigla)
    `);

  if (error) throw error;
  return data || [];
};

// Buscar órgãos pendentes de classificação
export const fetchOrgaosPendentes = async (): Promise<OrgaoPendente[]> => {
  const { data, error } = await supabase
    .from("bd_licitacoes_orgaos_pendentes")
    .select("*")
    .eq("status", "pendente")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as OrgaoPendente[];
};

// Resolver órgão pendente: vincular e criar alias
export const resolverOrgaoPendente = async (
  pendenteId: string,
  orgaoId: string,
  aliasNome: string,
  aliasNormalizado: string
): Promise<void> => {
  // Criar alias
  const { error: aliasError } = await supabase
    .from("bd_orgaos_alias")
    .insert({ orgao_id: orgaoId, alias_nome: aliasNome, alias_normalizado: aliasNormalizado });

  if (aliasError) throw aliasError;

  // Marcar pendente como resolvido
  const { error: updateError } = await supabase
    .from("bd_licitacoes_orgaos_pendentes")
    .update({ status: "resolvido" })
    .eq("id", pendenteId);

  if (updateError) throw updateError;
};

// CRUD básico
export const createOrgao = async (orgao: { nome: string; sigla: string; [key: string]: any }): Promise<OrgaoPublico> => {
  const { data, error } = await supabase
    .from("bd_orgaos_publicos")
    .insert([orgao])
    .select()
    .single();

  if (error) throw error;
  return data as OrgaoPublico;
};

export const updateOrgao = async (id: string, updates: Partial<OrgaoPublico>): Promise<void> => {
  const { error } = await supabase
    .from("bd_orgaos_publicos")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
};

// Buscar métricas por órgão para dashboard
export const fetchOrgaoMetricas = async () => {
  const { data, error } = await supabase
    .from("bd_pncp_contratacoes")
    .select("orgao_id, orgao_sigla, orgao_nome, valor_total_estimado, participando, status_resultado");

  if (error) throw error;

  // Agregar métricas por orgao_sigla
  const metricas: Record<string, {
    sigla: string;
    nome: string;
    total: number;
    participadas: number;
    ganhas: number;
    perdidas: number;
    valorEstimado: number;
    valorGanho: number;
  }> = {};

  (data || []).forEach((item: any) => {
    const key = item.orgao_sigla || item.orgao_nome || 'Não classificado';
    if (!metricas[key]) {
      metricas[key] = {
        sigla: item.orgao_sigla || '',
        nome: item.orgao_nome || key,
        total: 0, participadas: 0, ganhas: 0, perdidas: 0,
        valorEstimado: 0, valorGanho: 0,
      };
    }
    metricas[key].total++;
    metricas[key].valorEstimado += item.valor_total_estimado || 0;
    if (item.participando) {
      metricas[key].participadas++;
      if (item.status_resultado === 'ganhou') {
        metricas[key].ganhas++;
        metricas[key].valorGanho += item.valor_total_estimado || 0;
      } else if (item.status_resultado === 'perdeu') {
        metricas[key].perdidas++;
      }
    }
  });

  return Object.values(metricas).sort((a, b) => b.total - a.total);
};
