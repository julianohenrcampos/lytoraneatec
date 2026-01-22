import { supabase } from '@/integrations/supabase/client';
import { SSODesvioFoto } from '@/types/ssoDesvios';
import { ssoDesvioStorageService } from './ssoDesvioStorageService';

export const ssoDesvioFotoService = {
  async list(registroId: string): Promise<SSODesvioFoto[]> {
    const { data, error } = await (supabase
      .from('bd_registro_desvios_fotos' as any) as any)
      .select('*')
      .eq('registro_id', registroId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    
    // Gerar URLs assinadas para cada foto
    const fotosComUrl = await Promise.all(
      (data || []).map(async (foto: any) => {
        const url = await ssoDesvioStorageService.getSignedUrl(foto.path);
        return { ...foto, url };
      })
    );
    
    return fotosComUrl as SSODesvioFoto[];
  },

  async create(registroId: string, path: string, legenda?: string): Promise<SSODesvioFoto> {
    const { data, error } = await (supabase
      .from('bd_registro_desvios_fotos' as any) as any)
      .insert({
        registro_id: registroId,
        path,
        legenda
      })
      .select()
      .single();

    if (error) throw error;
    return data as SSODesvioFoto;
  },

  async updateLegenda(fotoId: string, legenda: string): Promise<void> {
    const { error } = await (supabase
      .from('bd_registro_desvios_fotos' as any) as any)
      .update({ legenda })
      .eq('id', fotoId);

    if (error) throw error;
  },

  async delete(fotoId: string): Promise<void> {
    // Buscar o path da foto
    const { data: foto, error: fetchError } = await (supabase
      .from('bd_registro_desvios_fotos' as any) as any)
      .select('path')
      .eq('id', fotoId)
      .single();

    if (fetchError) throw fetchError;

    // Deletar do storage
    if (foto?.path) {
      await ssoDesvioStorageService.delete(foto.path);
    }

    // Deletar do banco
    const { error } = await (supabase
      .from('bd_registro_desvios_fotos' as any) as any)
      .delete()
      .eq('id', fotoId);

    if (error) throw error;
  },

  async uploadAndCreate(registroId: string, file: File, legenda?: string): Promise<SSODesvioFoto> {
    // Upload do arquivo
    const { path } = await ssoDesvioStorageService.upload(registroId, file);
    
    // Criar registro no banco
    const foto = await this.create(registroId, path, legenda);
    
    // Retornar com URL
    const url = await ssoDesvioStorageService.getSignedUrl(path);
    return { ...foto, url: url || undefined };
  }
};
