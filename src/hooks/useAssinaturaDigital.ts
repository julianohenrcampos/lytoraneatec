import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface AssinaturaUsuario {
  id: string;
  usuario_id: string;
  nome_completo: string;
  cpf: string;
  cargo: string | null;
  assinatura_url: string; // path no storage
  assinatura_hash: string | null;
  ip_registro: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

async function generateSHA256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function useAssinaturaDigital() {
  const queryClient = useQueryClient();
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  const { data: assinatura, isLoading } = useQuery({
    queryKey: ['assinatura-digital-usuario'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('bd_assinaturas_usuarios')
        .select('*')
        .eq('usuario_id', user.id)
        .eq('ativo', true)
        .maybeSingle();

      if (error) throw error;
      return data as AssinaturaUsuario | null;
    },
  });

  // Generate signed URL for preview
  useEffect(() => {
    if (!assinatura?.assinatura_url) {
      setSignedUrl(null);
      return;
    }

    const getUrl = async () => {
      const { data } = await supabase.storage
        .from('assinaturas')
        .createSignedUrl(assinatura.assinatura_url, 3600);
      setSignedUrl(data?.signedUrl || null);
    };

    getUrl();
  }, [assinatura?.assinatura_url]);

  const salvarAssinaturaMutation = useMutation({
    mutationFn: async ({
      nome_completo,
      cpf,
      cargo,
      imageBlob,
    }: {
      nome_completo: string;
      cpf: string;
      cargo: string;
      imageBlob: Blob;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      const filePath = `${user.id}/assinatura.png`;

      // Upload to private bucket (upsert)
      const { error: uploadError } = await supabase.storage
        .from('assinaturas')
        .upload(filePath, imageBlob, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Generate hash from base64
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(imageBlob);
      });
      const hash = await generateSHA256(base64);

      // Upsert in table
      const { error: dbError } = await supabase
        .from('bd_assinaturas_usuarios')
        .upsert(
          {
            usuario_id: user.id,
            nome_completo,
            cpf,
            cargo,
            assinatura_url: filePath,
            assinatura_hash: hash,
            ip_registro: null,
            ativo: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'usuario_id' }
        );

      if (dbError) throw dbError;

      return filePath;
    },
    onSuccess: () => {
      toast.success('Assinatura digital salva com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['assinatura-digital-usuario'] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar assinatura: ${error.message}`);
    },
  });

  return {
    assinatura,
    isLoading,
    hasAssinatura: !!assinatura,
    signedUrl,
    salvarAssinatura: salvarAssinaturaMutation.mutateAsync,
    isSaving: salvarAssinaturaMutation.isPending,
  };
}
