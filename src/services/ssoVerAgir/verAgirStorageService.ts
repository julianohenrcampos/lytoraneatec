import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'sso-ver-agir';

// Compressão de imagem no frontend
const compressImage = async (file: File): Promise<File> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const objectUrl = URL.createObjectURL(file);

    const timeout = setTimeout(() => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Timeout ao comprimir imagem'));
    }, 10000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const maxWidth = 1600;
        const scale = Math.min(1, maxWidth / img.width);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob((blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            reject(new Error('Erro ao comprimir imagem'));
          }
        }, 'image/jpeg', 0.8);
      } catch (e) {
        URL.revokeObjectURL(objectUrl);
        reject(e);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Erro ao carregar imagem'));
    };
    img.src = objectUrl;
  });
};

// Validação de arquivo
const validateFile = (file: File): boolean => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Formato inválido. Use JPG, PNG ou WebP.');
  }

  if (file.size > maxSize) {
    throw new Error('Arquivo muito grande. Máximo 5MB.');
  }

  return true;
};

// Remover arquivos existentes com padrão de busca
const removeExistingFiles = async (id: string, prefix: string): Promise<void> => {
  const { data: existing } = await supabase.storage
    .from(BUCKET_NAME)
    .list(`ver-agir/${id}`, { search: prefix });

  if (existing?.length) {
    await supabase.storage
      .from(BUCKET_NAME)
      .remove(existing.map(f => `ver-agir/${id}/${f.name}`));
  }
};

export const verAgirStorageService = {
  async uploadFotoAntes(id: string, file: File): Promise<string> {
    validateFile(file);
    
    let fileToUpload: File;
    try {
      fileToUpload = await compressImage(file);
    } catch (e) {
      console.warn('Compressão falhou, usando arquivo original:', e);
      fileToUpload = file;
    }
    
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `ver-agir/${id}/antes.${ext}`;
    
    await removeExistingFiles(id, 'antes');
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileToUpload, { upsert: true });

    if (error) {
      console.error('Erro ao fazer upload da foto ANTES:', error);
      throw new Error(error.message);
    }

    return path;
  },

  async uploadFotoDepois(id: string, file: File): Promise<string> {
    validateFile(file);
    
    let fileToUpload: File;
    try {
      fileToUpload = await compressImage(file);
    } catch (e) {
      console.warn('Compressão falhou, usando arquivo original:', e);
      fileToUpload = file;
    }
    
    const ext = file.name.split('.').pop() || 'jpg';
    const path = `ver-agir/${id}/depois.${ext}`;
    
    await removeExistingFiles(id, 'depois');
    
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(path, fileToUpload, { upsert: true });

    if (error) {
      console.error('Erro ao fazer upload da foto DEPOIS:', error);
      throw new Error(error.message);
    }

    return path;
  },

  async getSignedUrl(path: string): Promise<string | null> {
    if (!path) return null;

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, 3600); // 1 hora de validade

    if (error) {
      console.error('Erro ao gerar URL assinada:', error);
      return null;
    }

    return data?.signedUrl || null;
  },

  async removeFoto(path: string): Promise<void> {
    if (!path) return;

    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.error('Erro ao remover foto:', error);
      throw new Error(error.message);
    }
  }
};
