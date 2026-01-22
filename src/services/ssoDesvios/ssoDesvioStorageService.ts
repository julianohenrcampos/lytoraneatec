import { supabase } from '@/integrations/supabase/client';
import { SSODesvioFoto } from '@/types/ssoDesvios';

const BUCKET_NAME = 'sso-desvios';

export const ssoDesvioStorageService = {
  async upload(registroId: string, file: File): Promise<{ path: string; url?: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${registroId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    return { path: filePath };
  },

  async uploadMultiple(registroId: string, files: File[]): Promise<{ path: string; url?: string }[]> {
    const uploads = await Promise.all(
      files.map(file => this.upload(registroId, file))
    );
    return uploads;
  },

  async getSignedUrl(path: string): Promise<string | null> {
    if (!path || !path.includes('/')) return null;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hora

    if (error) {
      console.error('Erro ao gerar URL assinada:', error);
      return null;
    }
    return data?.signedUrl || null;
  },

  async delete(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) throw error;
  },

  async deleteMultiple(paths: string[]): Promise<void> {
    if (paths.length === 0) return;
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove(paths);

    if (error) throw error;
  }
};
