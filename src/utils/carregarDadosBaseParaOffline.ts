
import { supabase } from "@/integrations/supabase/client";

export interface DadosBaseOffline {
  veiculos: any[];
  funcionarios: any[];
  equipes: any[];
  usinas: any[];
  centrosCusto: any[];
  timestamp: number;
}

// Chaves do localStorage para cada tipo de dado
export const OFFLINE_KEYS = {
  veiculos: 'offline_veiculos',
  funcionarios: 'offline_funcionarios',
  equipes: 'offline_equipes',
  usinas: 'offline_usinas',
  centrosCusto: 'offline_centros_custo',
  timestamp: 'offline_data_timestamp'
};

/**
 * Carrega todos os dados essenciais do Supabase e salva no localStorage
 * para uso offline dos formulários
 */
export const carregarDadosBaseParaOffline = async (): Promise<boolean> => {
  try {
    console.log('🔄 Iniciando carregamento de dados base para offline...');
    
    // Carregar dados em paralelo para melhor performance
    const [veiculos, funcionarios, equipes, usinas, centrosCusto] = await Promise.all([
      // Veículos/Equipamentos
      supabase
        .from('bd_caminhoes_equipamentos')
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        }),
      
      // Funcionários
      supabase
        .from('bd_funcionarios')
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        }),
      
      // Equipes
      supabase
        .from('bd_equipes')
        .select(`
          *,
          encarregado:encarregado_id (id, nome_completo),
          apontador:apontador_id (id, nome_completo)
        `)
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        }),
      
      // Usinas
      supabase
        .from('bd_usinas')
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        }),
      
      // Centros de Custo
      supabase
        .from('bd_centros_custo')
        .select('*')
        .then(({ data, error }) => {
          if (error) throw error;
          return data || [];
        })
    ]);

    // Salvar cada conjunto de dados no localStorage
    const timestamp = Date.now();
    
    localStorage.setItem(OFFLINE_KEYS.veiculos, JSON.stringify(veiculos));
    localStorage.setItem(OFFLINE_KEYS.funcionarios, JSON.stringify(funcionarios));
    localStorage.setItem(OFFLINE_KEYS.equipes, JSON.stringify(equipes));
    localStorage.setItem(OFFLINE_KEYS.usinas, JSON.stringify(usinas));
    localStorage.setItem(OFFLINE_KEYS.centrosCusto, JSON.stringify(centrosCusto));
    localStorage.setItem(OFFLINE_KEYS.timestamp, timestamp.toString());

    console.log('✅ Dados base carregados para offline:', {
      veiculos: veiculos.length,
      funcionarios: funcionarios.length,
      equipes: equipes.length,
      usinas: usinas.length,
      centrosCusto: centrosCusto.length,
      timestamp: new Date(timestamp).toLocaleString()
    });

    return true;
  } catch (error) {
    console.error('❌ Erro ao carregar dados base para offline:', error);
    return false;
  }
};

/**
 * Obtém dados salvos offline do localStorage
 */
export const obterDadosOffline = <T = any>(tipo: keyof typeof OFFLINE_KEYS): T[] => {
  try {
    const key = OFFLINE_KEYS[tipo];
    const dados = localStorage.getItem(key);
    return dados ? JSON.parse(dados) : [];
  } catch (error) {
    console.error(`Erro ao obter dados offline de ${tipo}:`, error);
    return [];
  }
};

/**
 * Verifica se os dados offline estão disponíveis e não são muito antigos
 */
export const verificarDadosOfflineDisponiveis = (): boolean => {
  try {
    const timestamp = localStorage.getItem(OFFLINE_KEYS.timestamp);
    if (!timestamp) return false;
    
    const dataCarregamento = parseInt(timestamp);
    const agora = Date.now();
    const umDiaEmMs = 24 * 60 * 60 * 1000;
    
    // Considera dados válidos se foram carregados nas últimas 24 horas
    return (agora - dataCarregamento) < umDiaEmMs;
  } catch (error) {
    console.error('Erro ao verificar dados offline:', error);
    return false;
  }
};

/**
 * Limpa todos os dados offline do localStorage
 */
export const limparDadosOffline = (): void => {
  try {
    Object.values(OFFLINE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    console.log('🧹 Dados offline limpos');
  } catch (error) {
    console.error('Erro ao limpar dados offline:', error);
  }
};
