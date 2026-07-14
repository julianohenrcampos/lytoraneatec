
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIA_IDS } from "@/constants/categorias";

export interface Caminhao {
  id: string;
  placa?: string;
  situacao?: string;
  frota?: string;
  numero_frota?: string;
  fabricante?: string;
  empresa_id?: string;
  nome_empresa?: string;
  categoria_ativo_id?: string | null;
  subcategoria_ativo_id?: string | null;
  nome_categoria?: string;
  nome_subcategoria?: string;
  imagem_url?: string | null;
  /** @deprecated Use fabricante instead */
  marca?: string;
}


export const fetchCaminhoes = async (): Promise<Caminhao[]> => {
  try {
    console.log("Iniciando fetchCaminhoes...");
    const { data, error } = await supabase
      .from('bd_caminhoes_equipamentos')
      .select(`
        id,
        placa,
        situacao,
        frota,
        numero_frota,
        fabricante,
        imagem_url,
        empresa_id,
        categoria_ativo_id,
        subcategoria_ativo_id,
        empresa:bd_empresas(id, nome_empresa),
        categoria:bd_categorias_ativos(nome_categoria),
        subcategoria:bd_subcategorias_ativos(nome_subcategoria)
      `)

      .order('placa', { ascending: true });

    if (error) {
      console.error('Erro ao buscar caminhões:', error);
      throw new Error('Falha ao buscar dados de caminhões');
    }

    const caminhoes = data?.map((item: any) => {
      let nomeEmpresa = null;
      
      if (item.empresa) {
        if (Array.isArray(item.empresa) && item.empresa.length > 0) {
          nomeEmpresa = item.empresa[0]?.nome_empresa || null;
        } else if (typeof item.empresa === 'object') {
          nomeEmpresa = item.empresa.nome_empresa || null;
        }
      }
      
      return {
        id: item.id,
        placa: item.placa,
        situacao: item.situacao,
        frota: item.frota,
        numero_frota: item.numero_frota,
        fabricante: item.fabricante,
        marca: item.fabricante,
        empresa_id: item.empresa_id,
        nome_empresa: nomeEmpresa,
        categoria_ativo_id: item.categoria_ativo_id ?? null,
        subcategoria_ativo_id: item.subcategoria_ativo_id ?? null,
        nome_categoria: item.categoria?.nome_categoria || null,
        nome_subcategoria: item.subcategoria?.nome_subcategoria || null,
        imagem_url: item.imagem_url ?? null,
      } as Caminhao;

    }) || [];

    console.log(`fetchCaminhoes: ${caminhoes.length || 0} caminhões encontrados`, caminhoes);
    return caminhoes;
  } catch (error) {
    console.error('Erro ao buscar caminhões:', error);
    throw new Error('Falha ao buscar dados de caminhões');
  }
};
