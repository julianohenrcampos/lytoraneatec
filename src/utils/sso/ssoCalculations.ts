import { SSOChecklistItem, ResultadoAvaliacao } from '@/types/sso';

export const ssoCalculations = {
  /**
   * Calcula nota normalizada por itens aplicáveis
   * Fórmula: nota_real = 100 * (conformes / aplicaveis)
   */
  calcularNota(itens: SSOChecklistItem[]): {
    nota_real: number | null;
    total_aplicaveis: number;
    total_conformes: number;
    total_na: number;
  } {
    const total_aplicaveis = itens.filter(item => item.avaliacao !== 'NA').length;
    const total_conformes = itens.filter(item => item.avaliacao === 'Conforme').length;
    const total_na = itens.filter(item => item.avaliacao === 'NA').length;
    
    if (total_aplicaveis === 0) {
      return {
        nota_real: null,
        total_aplicaveis,
        total_conformes,
        total_na
      };
    }
    
    const nota_real = Math.round((100 * total_conformes / total_aplicaveis) * 100) / 100;
    
    return {
      nota_real,
      total_aplicaveis,
      total_conformes,
      total_na
    };
  },

  /**
   * Determina classificação baseada na nota
   */
  classificarNota(nota: number | null): ResultadoAvaliacao | null {
    if (nota === null || nota === undefined) return null;
    
    if (nota < 50) return 'Crítico';
    if (nota >= 50 && nota <= 75) return 'Em Atenção';
    if (nota >= 76 && nota <= 90) return 'Satisfatório';
    return 'Excelente';
  },

  /**
   * Retorna cor do badge por classificação
   */
  getResultadoColor(resultado: ResultadoAvaliacao | null): string {
    switch (resultado) {
      case 'Crítico':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'Em Atenção':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Satisfatório':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Excelente':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  },

  /**
   * Calcula percentual de conformidade por tema
   */
  calcularConformidadePorTema(itens: SSOChecklistItem[]): {
    tema: string;
    conformidade: number;
    total_avaliacoes: number;
  }[] {
    const temas = [...new Set(itens.map(item => item.tema))];
    
    return temas.map(tema => {
      const itensTema = itens.filter(item => item.tema === tema && item.avaliacao !== 'NA');
      const conformes = itensTema.filter(item => item.avaliacao === 'Conforme').length;
      
      return {
        tema,
        conformidade: itensTema.length > 0 
          ? Math.round((conformes / itensTema.length) * 10000) / 100 
          : 0,
        total_avaliacoes: itensTema.length
      };
    }).sort((a, b) => a.conformidade - b.conformidade); // Ordem crescente (pior primeiro)
  }
};
