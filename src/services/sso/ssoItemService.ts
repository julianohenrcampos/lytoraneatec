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

  // Criar vários itens já preenchidos em UMA única requisição.
  // Usado no salvamento do checklist: 36 POSTs em série viravam 36 chances
  // de a rede da obra derrubar o envio inteiro.
  async createMany(itens: Partial<SSOChecklistItem>[]) {
    if (itens.length === 0) return [];

    const { data, error } = await supabase
      .from('bd_sso_checklist_itens')
      .insert(itens as any)
      .select();

    if (error) throw error;
    return data as unknown as SSOChecklistItem[];
  },

  // Criar item individual
  async create(itemData: Partial<SSOChecklistItem>) {
    const { data, error } = await supabase
      .from('bd_sso_checklist_itens')
      .insert(itemData as any)
      .select()
      .single();

    if (error) throw error;
    return data as unknown as SSOChecklistItem;
  },

  // Atualizar vários itens em UMA única requisição, via upsert por id.
  // Cada linha precisa vir completa (o PostgREST monta um INSERT ... ON CONFLICT),
  // por isso o chamador envia também checklist_id, item_modelo_id, ordem, tema
  // e descricao — não apenas os campos editados.
  async updateMany(itens: Partial<SSOChecklistItem>[]) {
    if (itens.length === 0) return [];

    const { data, error } = await supabase
      .from('bd_sso_checklist_itens')
      .upsert(itens as any, { onConflict: 'id' })
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
