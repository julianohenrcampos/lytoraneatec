import { supabase } from "@/integrations/supabase/client";
import { PNCPContratacao, PNCPFilters, PNCPSyncLog, PNCPSyncResult, PNCPConfig, PNCPPerfilBusca } from "@/types/pncp";
// Interface para dados brutos do dashboard
export interface ContratacaoRaw {
  id: string;
  objeto: string;
  orgao_nome: string | null;
  uf: string | null;
  municipio_nome: string | null;
  valor_total_estimado: number | null;
  status_resultado: string | null;
  participando: boolean | null;
  descartada: boolean | null;
  updated_at: string | null;
  data_fim_propostas: string | null;
}

// Buscar todos os dados brutos para o dashboard (permite filtrar no frontend)
export const fetchTodasContratacoes = async (): Promise<ContratacaoRaw[]> => {
  const { data, error } = await supabase
    .from("bd_pncp_contratacoes")
    .select("id, objeto, orgao_nome, uf, municipio_nome, valor_total_estimado, status_resultado, participando, updated_at, data_fim_propostas")
    .order("data_fim_propostas", { ascending: true });

  if (error) {
    console.error("Erro ao buscar contratações:", error);
    throw error;
  }

  return (data || []) as ContratacaoRaw[];
};

export const fetchContratacoes = async (filters: PNCPFilters = {}): Promise<PNCPContratacao[]> => {
  let query = supabase
    .from("bd_pncp_contratacoes")
    .select(`
      *,
      bd_pncp_perfis_busca:perfil_busca_id (cor)
    `);

  // Ordenação dinâmica baseada no filtro (padrão: prazo)
  switch (filters.ordenacao) {
    case 'prazo':
    default:
      query = query.order("data_fim_propostas", { ascending: true });
      break;
    case 'valor':
      query = query.order("valor_total_estimado", { ascending: false, nullsFirst: false });
      break;
    case 'hoje':
    case 'recentes':
      query = query.order("updated_at", { ascending: false, nullsFirst: false });
      break;
  }

  // Filtro por prazo de propostas (até a data)
  if (filters.dataFim) {
    query = query.lte("data_fim_propostas", filters.dataFim);
  }

  // Filtro por UF
  if (filters.uf) {
    query = query.eq("uf", filters.uf);
  }

  // Filtro por órgão (busca parcial)
  if (filters.orgao) {
    query = query.ilike("orgao_nome", `%${filters.orgao}%`);
  }

  // Filtro por perfil de busca
  if (filters.perfilBuscaId) {
    query = query.eq("perfil_busca_id", filters.perfilBuscaId);
  }

  // Filtro para ocultar licitações encerradas (data_fim_propostas < hoje)
  if (filters.ocultarEncerradas) {
    const hoje = new Date().toISOString().split('T')[0];
    query = query.gte("data_fim_propostas", hoje);
  }

  // Filtro para mostrar apenas licitações sincronizadas hoje
  if (filters.sincronizadasHoje) {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    query = query.gte("updated_at", hoje.toISOString());
  }

  // Filtro por categoria de valor (Mega/Alto/Padrão)
  if (filters.categoriaValor && filters.categoriaValor.length > 0) {
    const conditions: string[] = [];
    
    if (filters.categoriaValor.includes('mega')) {
      conditions.push('valor_total_estimado.gte.10000000');
    }
    if (filters.categoriaValor.includes('alto')) {
      conditions.push('and(valor_total_estimado.gte.5000000,valor_total_estimado.lt.10000000)');
    }
    if (filters.categoriaValor.includes('padrao')) {
      conditions.push('valor_total_estimado.lt.5000000');
    }
    
    if (conditions.length > 0) {
      query = query.or(conditions.join(','));
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar contratações PNCP:", error);
    throw error;
  }

  // Map the joined data to include perfil_cor
  const mapped = (data || []).map((item: any) => ({
    ...item,
    perfil_cor: item.bd_pncp_perfis_busca?.cor || null,
    bd_pncp_perfis_busca: undefined
  }));

  return mapped as PNCPContratacao[];
};

export const syncContratacoes = async (salvarTodas: boolean = false): Promise<PNCPSyncResult> => {
  // Obter usuário atual para vincular a sincronização
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Usuário não autenticado para sincronização");
  }

  const { data, error } = await supabase.functions.invoke("pncp-sync", {
    method: "POST",
    body: { salvarTodas, user_id: user.id },
  });

  if (error) {
    console.error("Erro ao sincronizar contratações PNCP:", error);
    throw error;
  }

  return data as PNCPSyncResult;
};

export const getLastSyncStatus = async (): Promise<PNCPSyncLog | null> => {
  // Obter usuário atual para filtrar logs
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn("Usuário não autenticado ao buscar status de sincronização");
    return null;
  }

  const { data, error } = await supabase
    .from("bd_pncp_sync_log")
    .select("*")
    .eq("user_id", user.id)
    .order("data_execucao", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar status de sincronização:", error);
    throw error;
  }

  return data as PNCPSyncLog | null;
};

export const getConfig = async (): Promise<PNCPConfig | null> => {
  const { data, error } = await supabase
    .from("bd_pncp_config_monitoramento")
    .select("*")
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar configurações PNCP:", error);
    throw error;
  }

  return data as PNCPConfig | null;
};

export const updateConfig = async (config: Partial<PNCPConfig>): Promise<void> => {
  // Buscar o ID da configuração ativa
  const { data: currentConfig } = await supabase
    .from("bd_pncp_config_monitoramento")
    .select("id")
    .eq("ativo", true)
    .maybeSingle();

  if (!currentConfig) {
    // Criar nova configuração se não existir
    const { error } = await supabase
      .from("bd_pncp_config_monitoramento")
      .insert({
        ...config,
        ativo: true,
      });

    if (error) {
      console.error("Erro ao criar configurações PNCP:", error);
      throw error;
    }
    return;
  }

  // Atualizar configuração existente
  const { error } = await supabase
    .from("bd_pncp_config_monitoramento")
    .update({
      ...config,
      updated_at: new Date().toISOString(),
    })
    .eq("id", currentConfig.id);

  if (error) {
    console.error("Erro ao atualizar configurações PNCP:", error);
    throw error;
  }
};

export const formatCurrency = (value: number | null): string => {
  if (value === null || value === undefined) return "N/A";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export const formatDate = (dateString: string | null): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleDateString("pt-BR");
};

export const formatDateTime = (dateString: string | null): string => {
  if (!dateString) return "N/A";
  return new Date(dateString).toLocaleString("pt-BR");
};

export const formatTime = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

// Verifica se a licitação foi capturada ou atualizada nas últimas 24 horas
export const isNovaLicitacao = (createdAt: string | undefined, updatedAt?: string | undefined): boolean => {
  // Usar a data mais recente entre created_at e updated_at
  const dataReferencia = updatedAt || createdAt;
  if (!dataReferencia) return false;
  
  const data = new Date(dataReferencia);
  const agora = new Date();
  const horasAtras = 24;
  const limite = new Date(agora.getTime() - horasAtras * 60 * 60 * 1000);
  return data > limite;
};

export const deleteContratacao = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir contratação:", error);
    throw error;
  }
};

export const deleteMultipleContratacoes = async (ids: string[]): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .delete()
    .in("id", ids);

  if (error) {
    console.error("Erro ao excluir contratações:", error);
    throw error;
  }
};

export const deleteAllContratacoes = async (): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

  if (error) {
    console.error("Erro ao excluir todas as contratações:", error);
    throw error;
  }
};

export const getEncerradasCount = async (): Promise<number> => {
  const hoje = new Date().toISOString().split('T')[0];
  
  const { count, error } = await supabase
    .from("bd_pncp_contratacoes")
    .select("*", { count: 'exact', head: true })
    .lt("data_fim_propostas", hoje);

  if (error) {
    console.error("Erro ao contar licitações encerradas:", error);
    throw error;
  }

  return count || 0;
};

export const deleteEncerradas = async (): Promise<number> => {
  const hoje = new Date().toISOString().split('T')[0];
  
  // Primeiro conta quantas serão excluídas
  const { count } = await supabase
    .from("bd_pncp_contratacoes")
    .select("*", { count: 'exact', head: true })
    .lt("data_fim_propostas", hoje);
  
  // Depois exclui
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .delete()
    .lt("data_fim_propostas", hoje);

  if (error) {
    console.error("Erro ao excluir licitações encerradas:", error);
    throw error;
  }

  return count || 0;
};

// Buscar lista de órgãos únicos para o filtro
export const getOrgaosUnicos = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from("bd_pncp_contratacoes")
    .select("orgao_nome")
    .not("orgao_nome", "is", null)
    .order("orgao_nome");

  if (error) {
    console.error("Erro ao buscar órgãos:", error);
    throw error;
  }

  const unicos = [...new Set(data?.map(d => d.orgao_nome) || [])];
  return unicos.filter((v): v is string => Boolean(v));
};

// Toggle participando status
export const toggleParticipando = async (id: string, participando: boolean): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .update({ 
      participando,
      data_marcacao_participando: participando ? new Date().toISOString() : null,
      // Se marcar participando, desmarcar descartada
      descartada: participando ? false : undefined
    })
    .eq("id", id);
  
  if (error) {
    console.error("Erro ao atualizar participando:", error);
    throw error;
  }
};

// Toggle descartada status
export const toggleDescartada = async (id: string, descartada: boolean): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .update({ 
      descartada,
      // Se descartar, desmarcar participando
      participando: descartada ? false : undefined,
      data_marcacao_participando: descartada ? null : undefined
    })
    .eq("id", id);
  
  if (error) {
    console.error("Erro ao atualizar descartada:", error);
    throw error;
  }
};

// Estatísticas completas para o dashboard
export interface EstatisticasCompletas {
  totalMonitoradas: number;
  valorTotalMonitoradas: number;
  totalParticipando: number;
  valorTotalParticipando: number;
  totalGanhou: number;
  valorGanhou: number;
  totalPerdeu: number;
  valorPerdeu: number;
  totalAguardando: number;
  valorAguardando: number;
  taxaSucesso: number;
  valorPorUF: Record<string, number>;
  valorPorCidade: Record<string, number>;
}

export const getEstatisticasCompletas = async (): Promise<EstatisticasCompletas> => {
  // Buscar todas as contratações monitoradas
  const { data: todasContratacoes } = await supabase
    .from("bd_pncp_contratacoes")
    .select("valor_total_estimado, uf, municipio_nome, orgao_nome, participando, status_resultado");

  const totalMonitoradas = todasContratacoes?.length || 0;
  const valorTotalMonitoradas = todasContratacoes?.reduce(
    (sum, item) => sum + (item.valor_total_estimado || 0), 0
  ) || 0;

  // Filtrar participando
  const participando = todasContratacoes?.filter(item => item.participando) || [];
  const totalParticipando = participando.length;
  const valorTotalParticipando = participando.reduce(
    (sum, item) => sum + (item.valor_total_estimado || 0), 0
  );

  // Por status resultado
  const ganhou = participando.filter(item => item.status_resultado === 'ganhou');
  const perdeu = participando.filter(item => item.status_resultado === 'perdeu');
  const aguardando = participando.filter(item => item.status_resultado === 'aguardando' || !item.status_resultado);

  const totalGanhou = ganhou.length;
  const valorGanhou = ganhou.reduce((sum, item) => sum + (item.valor_total_estimado || 0), 0);
  const totalPerdeu = perdeu.length;
  const valorPerdeu = perdeu.reduce((sum, item) => sum + (item.valor_total_estimado || 0), 0);
  const totalAguardando = aguardando.length;
  const valorAguardando = aguardando.reduce((sum, item) => sum + (item.valor_total_estimado || 0), 0);

  // Taxa de sucesso (apenas sobre finalizados)
  const finalizados = totalGanhou + totalPerdeu;
  const taxaSucesso = finalizados > 0 ? (totalGanhou / finalizados) * 100 : 0;

  // Valor por UF (TODAS monitoradas)
  const valorPorUF = todasContratacoes?.reduce((acc, item) => {
    const uf = item.uf || "N/A";
    acc[uf] = (acc[uf] || 0) + (item.valor_total_estimado || 0);
    return acc;
  }, {} as Record<string, number>) || {};

  // Valor por Cidade (TODAS monitoradas)
  const valorPorCidade = todasContratacoes?.reduce((acc, item) => {
    let cidade = item.municipio_nome;
    
    // Fallback: extrair cidade do orgao_nome se municipio_nome estiver vazio
    if (!cidade && item.orgao_nome) {
      const orgao = item.orgao_nome.toUpperCase();
      
      // Padrão 1: "MUNICIPIO DE X" ou "PREFEITURA MUNICIPAL DE X"
      let match = orgao.match(/(?:MUNICIPIO|PREFEITURA MUNICIPAL) DE ([A-Z\s]+?)(?:\s*[-\/]|$)/);
      
      if (match) {
        cidade = match[1].trim();
      } else {
        // Padrão 2: "FUNDO MUNICIPAL DE SAUDE/SUS DO MUNICIPIO DE X"
        match = orgao.match(/MUNICIPIO DE ([A-Z\s]+?)(?:\s*[-\/]|$)/);
        if (match) {
          cidade = match[1].trim();
        }
      }
      
      // Formatar: Title Case
      if (cidade) {
        cidade = cidade
          .toLowerCase()
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }
    
    // Fallback: usar UF para órgãos estaduais/federais
    if (!cidade) {
      cidade = item.uf ? `Órgão ${item.uf}` : "Não identificado";
    }
    
    acc[cidade] = (acc[cidade] || 0) + (item.valor_total_estimado || 0);
    return acc;
  }, {} as Record<string, number>) || {};

  return {
    totalMonitoradas,
    valorTotalMonitoradas,
    totalParticipando,
    valorTotalParticipando,
    totalGanhou,
    valorGanhou,
    totalPerdeu,
    valorPerdeu,
    totalAguardando,
    valorAguardando,
    taxaSucesso,
    valorPorUF,
    valorPorCidade
  };
};

// Estatísticas mensais para gráfico de linhas
export interface EstatisticaMensal {
  mes: string;
  mesFormatado: string;
  ganhou: number;
  perdeu: number;
}

export const getEstatisticasMensais = async (): Promise<EstatisticaMensal[]> => {
  const { data } = await supabase
    .from("bd_pncp_contratacoes")
    .select("status_resultado, updated_at")
    .in("status_resultado", ["ganhou", "perdeu"]);

  if (!data || data.length === 0) {
    return [];
  }

  // Agrupar por mês
  const porMes: Record<string, { ganhou: number; perdeu: number }> = {};

  data.forEach((item) => {
    if (!item.updated_at) return;
    
    const date = new Date(item.updated_at);
    const mesKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!porMes[mesKey]) {
      porMes[mesKey] = { ganhou: 0, perdeu: 0 };
    }
    
    if (item.status_resultado === 'ganhou') {
      porMes[mesKey].ganhou++;
    } else if (item.status_resultado === 'perdeu') {
      porMes[mesKey].perdeu++;
    }
  });

  // Formatar nomes dos meses
  const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  // Ordenar e formatar
  return Object.entries(porMes)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12) // últimos 12 meses
    .map(([mes, valores]) => {
      const [ano, mesNum] = mes.split('-');
      const mesIndex = parseInt(mesNum) - 1;
      return {
        mes,
        mesFormatado: `${mesesNomes[mesIndex]}/${ano.slice(2)}`,
        ganhou: valores.ganhou,
        perdeu: valores.perdeu,
      };
    });
};

// Atualizar status resultado
export const updateStatusResultado = async (id: string, status: string): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_contratacoes")
    .update({ status_resultado: status })
    .eq("id", id);
  
  if (error) {
    console.error("Erro ao atualizar status resultado:", error);
    throw error;
  }
};

// Buscar licitações que estamos participando
export const fetchContratacoesParticipando = async (): Promise<PNCPContratacao[]> => {
  const { data, error } = await supabase
    .from("bd_pncp_contratacoes")
    .select(`
      *,
      bd_pncp_perfis_busca:perfil_busca_id (cor)
    `)
    .eq("participando", true)
    .order("data_marcacao_participando", { ascending: false });
  
  if (error) {
    console.error("Erro ao buscar contratações participando:", error);
    throw error;
  }
  
  // Map the joined data to include perfil_cor
  const mapped = (data || []).map((item: any) => ({
    ...item,
    perfil_cor: item.bd_pncp_perfis_busca?.cor || null,
    bd_pncp_perfis_busca: undefined
  }));
  
  return mapped as PNCPContratacao[];
};

// =====================================================
// PERFIS DE BUSCA
// =====================================================

// Buscar todos os perfis de busca do usuário atual
export const fetchPerfisBusca = async (): Promise<PNCPPerfilBusca[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn("Usuário não autenticado ao buscar perfis");
    return [];
  }

  const { data, error } = await supabase
    .from("bd_pncp_perfis_busca")
    .select("*")
    .eq("user_id", user.id)
    .order("nome");

  if (error) {
    console.error("Erro ao buscar perfis de busca:", error);
    throw error;
  }

  return (data || []) as PNCPPerfilBusca[];
};

// Buscar perfis ativos do usuário atual
export const fetchPerfisAtivos = async (): Promise<PNCPPerfilBusca[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.warn("Usuário não autenticado ao buscar perfis ativos");
    return [];
  }

  const { data, error } = await supabase
    .from("bd_pncp_perfis_busca")
    .select("*")
    .eq("ativo", true)
    .eq("user_id", user.id)
    .order("nome");

  if (error) {
    console.error("Erro ao buscar perfis ativos:", error);
    throw error;
  }

  return (data || []) as PNCPPerfilBusca[];
};

// Criar novo perfil de busca
export const createPerfilBusca = async (perfil: Partial<PNCPPerfilBusca>): Promise<PNCPPerfilBusca> => {
  // Obter o usuário atual
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    throw new Error("Usuário não autenticado");
  }

  // Combinar palavras-chave: usar palavras_incluir OU palavras primarias/secundarias
  const palavrasChave = [
    ...(perfil.palavras_incluir || []),
    ...((perfil as any).palavras_primarias || []),
    ...((perfil as any).palavras_secundarias || [])
  ];

  const { data, error } = await supabase
    .from("bd_pncp_perfis_busca")
    .insert({
      nome: perfil.nome,
      descricao: perfil.descricao || null,
      palavras_incluir: palavrasChave,
      palavras_excluir: perfil.palavras_excluir || [],
      valor_minimo: perfil.valor_minimo || 0,
      valor_maximo: perfil.valor_maximo || null,
      ufs_ativas: perfil.ufs_ativas || [],
      modalidades_ativas: perfil.modalidades_ativas || [],
      ativo: perfil.ativo ?? true,
      cor: perfil.cor || '#3B82F6',
      user_id: user.id, // Vincular perfil ao usuário
    })
    .select()
    .single();

  if (error) {
    console.error("Erro ao criar perfil de busca:", error);
    throw error;
  }

  return data as PNCPPerfilBusca;
};

// Atualizar perfil de busca
export const updatePerfilBusca = async (id: string, perfil: Partial<PNCPPerfilBusca>): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_perfis_busca")
    .update({
      ...perfil,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    console.error("Erro ao atualizar perfil de busca:", error);
    throw error;
  }
};

// Excluir perfil de busca
export const deletePerfilBusca = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_perfis_busca")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Erro ao excluir perfil de busca:", error);
    throw error;
  }
};

// Toggle ativo do perfil
export const togglePerfilAtivo = async (id: string, ativo: boolean): Promise<void> => {
  const { error } = await supabase
    .from("bd_pncp_perfis_busca")
    .update({ ativo, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Erro ao toggle perfil ativo:", error);
    throw error;
  }
};
