
import { useOfflineData } from '@/hooks/useOfflineData';
import { supabase } from '@/integrations/supabase/client';

// Wrapper para queries que precisam funcionar offline
export const useOfflineQuery = <T>(
  queryKey: string,
  query: () => Promise<T>,
  options: {
    enabled?: boolean;
    staleTime?: number;
  } = {}
) => {
  return useOfflineData({
    key: queryKey,
    fetcher: query,
    enabled: options.enabled,
    staleTime: options.staleTime
  });
};

// Queries comuns que funcionam offline
export const offlineQueries = {
  // Funcionários
  funcionarios: () => useOfflineQuery(
    'funcionarios',
    async () => {
      const { data, error } = await supabase
        .from('bd_funcionarios')
        .select('*')
        .eq('status', 'Ativo')
        .order('nome_completo');
      
      if (error) throw error;
      return data;
    },
    { staleTime: 10 * 60 * 1000 } // 10 minutos
  ),

  // Equipes
  equipes: () => useOfflineQuery(
    'equipes',
    async () => {
      const { data, error } = await supabase
        .from('bd_equipes')
        .select(`
          *,
          apontador:apontador_id(id, nome_completo),
          encarregado:encarregado_id(id, nome_completo)
        `)
        .order('nome_equipe');
      
      if (error) throw error;
      return data;
    },
    { staleTime: 15 * 60 * 1000 } // 15 minutos
  ),

  // Centros de Custo
  centrosCusto: () => useOfflineQuery(
    'centros-custo',
    async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('*')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      
      if (error) throw error;
      return data;
    },
    { staleTime: 30 * 60 * 1000 } // 30 minutos
  ),

  // Veículos/Equipamentos
  veiculos: () => useOfflineQuery(
    'veiculos',
    async () => {
      const { data, error } = await supabase
        .from('bd_caminhoes_equipamentos')
        .select('*')
        .order('frota');
      
      if (error) throw error;
      return data;
    },
    { staleTime: 20 * 60 * 1000 } // 20 minutos
  ),

  // Usinas
  usinas: () => useOfflineQuery(
    'usinas',
    async () => {
      const { data, error } = await supabase
        .from('bd_usinas')
        .select('*')
        .order('nome_usina');
      
      if (error) throw error;
      return data;
    },
    { staleTime: 60 * 60 * 1000 } // 1 hora
  ),

  // Perfil do usuário
  userProfile: (userId?: string) => useOfflineQuery(
    `user-profile-${userId}`,
    async () => {
      if (!userId) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    { 
      enabled: !!userId,
      staleTime: 5 * 60 * 1000 // 5 minutos
    }
  )
};

// Função para pré-carregar dados essenciais
export const preloadEssentialData = async () => {
  console.log('🔄 Pré-carregando dados essenciais...');
  
  const essentialQueries = [
    'funcionarios',
    'equipes', 
    'centros-custo',
    'veiculos',
    'usinas'
  ];

  // Executar queries em paralelo
  const promises = essentialQueries.map(async (key) => {
    try {
      // Simular chamada das queries
      switch (key) {
        case 'funcionarios':
          return supabase.from('bd_funcionarios').select('*').eq('status', 'Ativo');
        case 'equipes':
          return supabase.from('bd_equipes').select('*');
        case 'centros-custo':
          return supabase.from('bd_centros_custo').select('*').eq('situacao', 'Ativo');
        case 'veiculos':
          return supabase.from('bd_caminhoes_equipamentos').select('*');
        case 'usinas':
          return supabase.from('bd_usinas').select('*');
        default:
          return Promise.resolve({ data: [], error: null });
      }
    } catch (error) {
      console.warn(`Erro ao pré-carregar ${key}:`, error);
      return { data: [], error };
    }
  });

  try {
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Pré-carregamento concluído: ${successful}/${essentialQueries.length} queries`);
  } catch (error) {
    console.error('Erro no pré-carregamento:', error);
  }
};
