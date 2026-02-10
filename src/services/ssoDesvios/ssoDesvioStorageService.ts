import { supabase } from '@/integrations/supabase/client';
import { SSODesvioFoto } from '@/types/ssoDesvios';

const BUCKET_NAME = 'sso-desvios';

const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onload = () => {
      const MAX_WIDTH = 1600;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height = (height * MAX_WIDTH) / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      ctx?.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            reject(new Error('Falha na compressão da imagem'));
          }
        },
        'image/jpeg',
        0.8
      );
    };

    img.onerror = () => reject(new Error('Falha ao carregar imagem'));
    img.src = URL.createObjectURL(file);
  });
};

export const ssoDesvioStorageService = {
  async upload(registroId: string, file: File): Promise<{ path: string; url?: string }> {
    const compressedFile = await compressImage(file);
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
    const filePath = `${registroId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filePath, compressedFile, {
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
