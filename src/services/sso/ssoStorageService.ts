import { supabase } from '@/integrations/supabase/client';

export const ssoStorageService = {
  // Upload de foto
  async uploadFoto(checklistId: string, file: File): Promise<{ path: string; url: string }> {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${checklistId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('sso-checklists')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    // Obter URL assinada (válida por 1 ano)
    const { data: urlData } = await supabase.storage
      .from('sso-checklists')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    return {
      path: filePath,
      url: urlData?.signedUrl || ''
    };
  },

  // Upload múltiplo
  async uploadMultiple(checklistId: string, files: File[]): Promise<{ path: string; url: string }[]> {
    const uploads = await Promise.all(
      files.map(file => this.uploadFoto(checklistId, file))
    );
    return uploads;
  },

  // Deletar foto
  async deleteFoto(path: string): Promise<void> {
    const { error } = await supabase.storage
      .from('sso-checklists')
      .remove([path]);

    if (error) throw error;
  },

  // Obter URL assinada
  async getSignedUrl(path: string, expiresIn: number = 60 * 60): Promise<string> {
    const { data, error } = await supabase.storage
      .from('sso-checklists')
      .createSignedUrl(path, expiresIn);

    if (error) throw error;
    return data?.signedUrl || '';
  }
};
