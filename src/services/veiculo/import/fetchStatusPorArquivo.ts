// Rodada 2A.5 — Recuperação de progresso de importação por SHA-256.
import { supabase } from '@/integrations/supabase/client';
import type { StatusPersistidoLinha } from './statusConsolidado';

export async function fetchStatusPorArquivo(arquivoSha256: string): Promise<StatusPersistidoLinha[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rpc = supabase.rpc.bind(supabase) as any;
  const { data, error } = await rpc('fn_importador_v2_status_arquivo', { p_arquivo_sha256: arquivoSha256 });
  if (error) throw error;
  if (!data) return [];
  return (data as Array<Record<string, unknown>>).map((r) => ({
    linha_excel: Number(r.linha_excel ?? 0),
    codigo_ativo_canonico: String(r.codigo_ativo_canonico ?? '').toUpperCase(),
    status: String(r.status ?? ''),
    equipamento_id: (r.equipamento_id as string | null) ?? null,
    execution_id: (r.execution_id as string | null) ?? null,
    mensagem: (r.mensagem as string | null) ?? null,
    numero_tentativas: Number(r.numero_tentativas ?? 1),
  }));
}
