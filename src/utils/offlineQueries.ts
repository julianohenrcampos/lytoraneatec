
import { carregarDadosBaseParaOffline, verificarDadosOfflineDisponiveis } from './carregarDadosBaseParaOffline';

/**
 * Precarrega dados essenciais para uso offline
 * Chamado automaticamente na inicialização do app
 */
export const preloadEssentialData = async (): Promise<void> => {
  try {
    // Verificar se já temos dados offline válidos
    const temDadosValidos = verificarDadosOfflineDisponiveis();
    
    if (!temDadosValidos) {
      console.log('🔄 Dados offline não encontrados ou expirados, carregando...');
      const sucesso = await carregarDadosBaseParaOffline();
      
      if (sucesso) {
        console.log('✅ Dados offline carregados com sucesso');
      } else {
        console.warn('⚠️ Falha ao carregar dados offline');
      }
    } else {
      console.log('✅ Dados offline já disponíveis');
    }
  } catch (error) {
    console.error('❌ Erro ao precarregar dados essenciais:', error);
  }
};
