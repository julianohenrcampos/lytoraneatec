import { supabase } from '@/integrations/supabase/client';
import { SSODashboardData } from '@/types/sso';

export const ssoDashboardService = {
  /**
   * Buscar dados completos do dashboard
   */
  async getDashboardData(filters?: {
    obra_id?: string;
    data_inicio?: string;
    data_fim?: string;
    resultado_avaliacao?: string;
  }): Promise<SSODashboardData> {
    let query = supabase
      .from('bd_sso_checklists')
      .select(`
        *,
        bd_sso_checklist_itens(*)
      `);

    // Aplicar filtros
    if (filters?.obra_id) {
      query = query.eq('obra_id', filters.obra_id);
    }
    if (filters?.data_inicio) {
      query = query.gte('data_inspecao', filters.data_inicio);
    }
    if (filters?.data_fim) {
      query = query.lte('data_inspecao', filters.data_fim);
    }
    if (filters?.resultado_avaliacao) {
      query = query.eq('resultado_avaliacao', filters.resultado_avaliacao);
    }

    const { data: checklists, error } = await query;

    if (error) throw error;

    // Calcular estatísticas
    const total_checklists = checklists?.length || 0;
    
    const nota_media = total_checklists > 0
      ? checklists.reduce((sum, c) => sum + (c.nota_real || 0), 0) / total_checklists
      : 0;

    const conformidade_geral = total_checklists > 0
      ? checklists.reduce((sum, c) => {
          const total = c.total_aplicaveis || 0;
          return total > 0 ? sum + ((c.total_conformes || 0) / total * 100) : sum;
        }, 0) / total_checklists
      : 0;

    // Distribuição de resultados
    const distribuicao_resultados = {
      critico: checklists?.filter(c => c.resultado_avaliacao === 'Crítico').length || 0,
      em_atencao: checklists?.filter(c => c.resultado_avaliacao === 'Em Atenção').length || 0,
      satisfatorio: checklists?.filter(c => c.resultado_avaliacao === 'Satisfatório').length || 0,
      excelente: checklists?.filter(c => c.resultado_avaliacao === 'Excelente').length || 0,
    };

    // Conformidade por tema
    const temasMap = new Map<string, { conformes: number; total: number }>();
    
    checklists?.forEach(checklist => {
      checklist.bd_sso_checklist_itens?.forEach((item: any) => {
        if (item.avaliacao !== 'NA') {
          const tema = item.tema;
          const current = temasMap.get(tema) || { conformes: 0, total: 0 };
          
          temasMap.set(tema, {
            conformes: current.conformes + (item.avaliacao === 'Conforme' ? 1 : 0),
            total: current.total + 1
          });
        }
      });
    });

    const conformidade_por_tema = Array.from(temasMap.entries())
      .map(([tema, stats]) => ({
        tema,
        conformidade: stats.total > 0 ? (stats.conformes / stats.total) * 100 : 0,
        total_avaliacoes: stats.total
      }))
      .sort((a, b) => a.conformidade - b.conformidade);

    // Evolução temporal
    const evolucaoMap = new Map<string, { soma: number; count: number; obra: string }>();
    
    checklists?.forEach(checklist => {
      const data = checklist.data_inspecao;
      const current = evolucaoMap.get(data) || { soma: 0, count: 0, obra: '' };
      
      evolucaoMap.set(data, {
        soma: current.soma + (checklist.nota_real || 0),
        count: current.count + 1,
        obra: checklist.obra_id
      });
    });

    const evolucao_temporal = Array.from(evolucaoMap.entries())
      .map(([data, stats]) => ({
        data,
        nota_media: stats.count > 0 ? stats.soma / stats.count : 0,
        obra: stats.obra
      }))
      .sort((a, b) => a.data.localeCompare(b.data));

    // Top não conformidades
    const ncMap = new Map<string, { 
      tema: string; 
      descricao: string; 
      total: number; 
      nc: number; 
      ultima_inspecao: string;
      qtd_fotos: number;
    }>();

    checklists?.forEach(checklist => {
      checklist.bd_sso_checklist_itens?.forEach((item: any) => {
        const key = `${item.tema}-${item.descricao}`;
        const current = ncMap.get(key) || {
          tema: item.tema,
          descricao: item.descricao,
          total: 0,
          nc: 0,
          ultima_inspecao: checklist.data_inspecao,
          qtd_fotos: 0
        };

        ncMap.set(key, {
          ...current,
          total: current.total + (item.avaliacao !== 'NA' ? 1 : 0),
          nc: current.nc + (item.avaliacao === 'Não Conforme' ? 1 : 0),
          ultima_inspecao: checklist.data_inspecao > current.ultima_inspecao 
            ? checklist.data_inspecao 
            : current.ultima_inspecao,
          qtd_fotos: current.qtd_fotos + (Array.isArray(item.fotos) ? item.fotos.length : 0)
        });
      });
    });

    const top_nao_conformidades = Array.from(ncMap.values())
      .filter(item => item.nc > 0)
      .map(item => ({
        ...item,
        percentual_nc: item.total > 0 ? (item.nc / item.total) * 100 : 0,
        ocorrencias: item.nc
      }))
      .sort((a, b) => b.percentual_nc - a.percentual_nc)
      .slice(0, 10);

    return {
      total_checklists,
      nota_media: Math.round(nota_media * 100) / 100,
      conformidade_geral: Math.round(conformidade_geral * 100) / 100,
      distribuicao_resultados,
      conformidade_por_tema,
      evolucao_temporal,
      top_nao_conformidades
    };
  },

  /**
   * Buscar status das obras (avaliadas vs pendentes)
   */
  async getObrasStatus() {
    // Total de obras ativas
    const { count: totalObras } = await supabase
      .from('bd_centros_custo')
      .select('*', { count: 'exact', head: true })
      .eq('situacao', 'Ativo');

    // Obras com checklist
    const { data: obrasAvaliadas } = await supabase
      .from('bd_sso_checklists')
      .select('obra_id');

    const obrasAvaliadasIds = new Set(obrasAvaliadas?.map(c => c.obra_id));
    const totalAvaliadas = obrasAvaliadasIds.size;

    // Obras pendentes
    const { data: obrasPendentes } = await supabase
      .from('bd_centros_custo')
      .select('id, nome_centro_custo, codigo_centro_custo')
      .eq('situacao', 'Ativo')
      .not('id', 'in', `(${Array.from(obrasAvaliadasIds).join(',')})`);

    return {
      total: totalObras || 0,
      avaliadas: totalAvaliadas,
      pendentes: obrasPendentes || [],
      percentual_avaliado: totalObras ? (totalAvaliadas / totalObras) * 100 : 0
    };
  }
};
