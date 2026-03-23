import { supabase } from '@/integrations/supabase/client';
import { loadImageAsBase64 } from '@/services/pdfService';
import type { AssinaturaAprovacao } from '@/types/diarias';

export async function fetchAssinaturasParaPDF(
  solicitacaoId: string
): Promise<AssinaturaAprovacao[]> {
  const { data, error } = await supabase
    .from('bd_assinaturas')
    .select('nome_usuario, cargo, cpf, assinatura_png, data_assinatura, hash_assinatura, ip, tipo_assinatura')
    .eq('solicitacao_id', solicitacaoId)
    .order('data_assinatura', { ascending: true });

  if (error || !data) {
    console.error('Erro ao buscar assinaturas para PDF:', error);
    return [];
  }

  const result: AssinaturaAprovacao[] = [];

  for (const row of data) {
    let assinatura_base64: string | null = null;

    if (row.assinatura_png) {
      try {
        const { data: signedData, error: signedError } = await supabase.storage
          .from('assinaturas')
          .createSignedUrl(row.assinatura_png, 300);

        if (!signedError && signedData?.signedUrl) {
          const base64 = await loadImageAsBase64(signedData.signedUrl);
          if (base64) assinatura_base64 = base64;
        }
      } catch (err) {
        console.error('Erro ao converter assinatura para base64:', err);
      }
    }

    result.push({
      nome_usuario: row.nome_usuario,
      cargo: row.cargo || null,
      cpf: row.cpf || null,
      assinatura_base64,
      data_assinatura: row.data_assinatura || null,
      hash_assinatura: row.hash_assinatura || null,
      ip: row.ip || null,
      tipo_assinatura: row.tipo_assinatura || null,
    });
  }

  return result;
}
