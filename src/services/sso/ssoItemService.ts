import { supabase } from '@/integrations/supabase/client';
import { SSOChecklistItem, SSOItemModelo, AvaliacaoTipo } from '@/types/sso';

export const ssoItemService = {
  // Buscar modelo de itens (45 itens)
  async getModelo(): Promise<SSOItemModelo[]> {
    const { data, error } = await supabase
      .from('bd_sso_itens_modelo')
      .select('*')
      .order('ordem', { ascending: true });

    if (error) throw error;
    return data as SSOItemModelo[];
  },

  // Criar itens de checklist em lote
  async createBatch(checklistId: string, itensModelo: SSOItemModelo[]) {
    const itens = itensModelo.map(modelo => ({
      checklist_id: checklistId,
      item_modelo_id: modelo.id,
      avaliacao: 'NA' as AvaliacaoTipo,
      ordem: modelo.ordem,
      tema: modelo.tema,
      descricao: modelo.descricao,
      fotos: []
    }));

    const { data, error } = await supabase
      .from('bd_sso_checklist_itens')
      .insert(itens)
      .select();

    if (error) throw error;
    return data as unknown as SSOChecklistItem[];
  },

  // Atualizar item
  async update(id: string, updates: Partial<SSOChecklistItem>) {
    const { data, error } = await supabase
      .from('bd_sso_checklist_itens')
      .update(updates as any)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as SSOChecklistItem;
  },

  // Buscar itens de um checklist
  async getByChecklistId(checklistId: string): Promise<SSOChecklistItem[]> {
    const { data, error } = await supabase
      .from('bd_sso_checklist_itens')
      .select('*')
      .eq('checklist_id', checklistId)
      .order('ordem', { ascending: true });

    if (error) throw error;
    return data as unknown as SSOChecklistItem[];
  }
};
