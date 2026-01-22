import { supabase } from '@/integrations/supabase/client';
import { SSODesvio, SSODesvioFormData, SSODesvioFilters } from '@/types/ssoDesvios';

// Sanitiza campos opcionais, convertendo strings vazias em null para evitar erros de tipo no PostgreSQL
const sanitizeFormData = (formData: Partial<SSODesvioFormData>) => {
  return {
    ...formData,
    // Converter strings vazias em null para campos de data
    prazo_correcao: formData.prazo_correcao || null,
    // Outros campos opcionais que podem vir vazios
    encarregado_mestre: formData.encarregado_mestre || null,
    tipo_outros: formData.tipo_outros || null,
    adequacao_imediata: formData.adequacao_imediata || null,
    responsavel_acao: formData.responsavel_acao || null,
  };
};

export const ssoDesvioService = {
  async list(filters: SSODesvioFilters = {}): Promise<SSODesvio[]> {
    let query = (supabase
      .from('bd_registro_desvios_sso' as any) as any)
      .select(`
        *,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo),
        profiles:criado_por(id, nome_completo, email)
      `)
      .order('data_registro', { ascending: false });

    if (filters.obra_id) {
      query = query.eq('obra_id', filters.obra_id);
    }
    if (filters.data_registro) {
      query = query.eq('data_registro', filters.data_registro);
    }
    if (filters.data_inicio) {
      query = query.gte('data_registro', filters.data_inicio);
    }
    if (filters.data_fim) {
      query = query.lte('data_registro', filters.data_fim);
    }
    if (filters.classificacao_desvio) {
      query = query.eq('classificacao_desvio', filters.classificacao_desvio);
    }
    if (filters.status_acao) {
      query = query.eq('status_acao', filters.status_acao);
    }
    if (filters.tecnico_seguranca) {
      query = query.ilike('tecnico_seguranca', `%${filters.tecnico_seguranca}%`);
    }
    if (filters.tipo_desvio) {
      query = query.contains('tipos_desvio', [filters.tipo_desvio]);
    }

    const { data, error } = await query;

    if (error) throw error;
    return (data || []) as SSODesvio[];
  },

  async getById(id: string): Promise<SSODesvio | null> {
    const { data, error } = await (supabase
      .from('bd_registro_desvios_sso' as any) as any)
      .select(`
        *,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo),
        profiles:criado_por(id, nome_completo, email),
        bd_registro_desvios_fotos(id, path, url, legenda, created_at)
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    return data as SSODesvio;
  },

  async create(formData: SSODesvioFormData): Promise<SSODesvio> {
    const { data: userData } = await supabase.auth.getUser();
    
    const sanitizedData = sanitizeFormData(formData);
    
    const insertData = {
      ...sanitizedData,
      criado_por: userData?.user?.id,
      numero_relatorio: '' // Será gerado pelo trigger
    };

    const { data, error } = await (supabase
      .from('bd_registro_desvios_sso' as any) as any)
      .insert(insertData)
      .select(`
        *,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo)
      `)
      .single();

    if (error) throw error;
    return data as SSODesvio;
  },

  async update(id: string, formData: Partial<SSODesvioFormData>): Promise<SSODesvio> {
    const sanitizedData = sanitizeFormData(formData);
    
    const { data, error } = await (supabase
      .from('bd_registro_desvios_sso' as any) as any)
      .update(sanitizedData)
      .eq('id', id)
      .select(`
        *,
        bd_centros_custo(id, nome_centro_custo, codigo_centro_custo)
      `)
      .single();

    if (error) throw error;
    return data as SSODesvio;
  },

  async delete(id: string): Promise<void> {
    // Primeiro verificar se existe
    const { data: existing, error: fetchError } = await (supabase
      .from('bd_registro_desvios_sso' as any) as any)
      .select('id, status_acao')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!existing) throw new Error('Registro de desvio não encontrado');

    // Deletar fotos associadas primeiro
    await (supabase
      .from('bd_registro_desvios_fotos' as any) as any)
      .delete()
      .eq('registro_id', id);

    // Deletar o registro
    const { error } = await (supabase
      .from('bd_registro_desvios_sso' as any) as any)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};
