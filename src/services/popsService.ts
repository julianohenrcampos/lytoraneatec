// Serviço do módulo POPs.
// Toda mutação passa por RPC (SECURITY DEFINER) ou Edge Function.
// O frontend nunca escreve direto em bd_pops / bd_pop_rascunhos nem no Storage.

import { supabase } from '@/integrations/supabase/client';
import type {
  Pop,
  PopComRascunho,
  PopPublicacaoResultado,
  PopRascunho,
  PopSetorOption,
  PopTipoIncremento,
} from '@/types/pops';
import { validarArquivoPop } from '@/utils/pops/versao';

/** Gate de disponibilidade: ativo geral OU homologação para SuperAdm. */
export async function popsModuloDisponivel(): Promise<boolean> {
  const { data, error } = await supabase.rpc('fn_pop_gate_homologacao');
  if (error) {
    console.error('[popsService] gate falhou', error.message);
    return false;
  }
  return data === true;
}

export async function listarSetores(): Promise<PopSetorOption[]> {
  const { data, error } = await supabase
    .from('bd_departamentos')
    .select('id, nome_departamento')
    .order('nome_departamento');
  if (error) throw error;
  return (data ?? []) as PopSetorOption[];
}

/** Biblioteca: somente POPs vigentes (RLS já restringe a status='ativo'). */
export async function listarPopsVigentes(): Promise<PopComRascunho[]> {
  const { data, error } = await supabase
    .from('bd_pops')
    .select('*, bd_departamentos:setor_id (nome_departamento)')
    .eq('status', 'ativo')
    .order('codigo');
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    ...(row as Pop),
    setor_nome: row.bd_departamentos?.nome_departamento ?? null,
    rascunho: null,
  }));
}

/** Gestão: todos os POPs visíveis pela RLS + a revisão em preparação de cada um. */
export async function listarPopsGestao(): Promise<PopComRascunho[]> {
  const [{ data: pops, error: popsErr }, { data: rascunhos, error: rascErr }] = await Promise.all([
    supabase
      .from('bd_pops')
      .select('*, bd_departamentos:setor_id (nome_departamento)')
      .order('codigo'),
    supabase.from('bd_pop_rascunhos').select('*'),
  ]);
  if (popsErr) throw popsErr;
  if (rascErr) throw rascErr;

  const porPop = new Map<string, PopRascunho>();
  (rascunhos ?? []).forEach((r: any) => porPop.set(r.pop_id, r as PopRascunho));

  return (pops ?? []).map((row: any) => ({
    ...(row as Pop),
    setor_nome: row.bd_departamentos?.nome_departamento ?? null,
    rascunho: porPop.get(row.id) ?? null,
  }));
}

export async function criarPop(input: {
  codigo: string;
  titulo: string;
  setor_id: string;
  categoria?: string | null;
  elaborado_por_id?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_pop_criar', {
    p_codigo: input.codigo,
    p_titulo: input.titulo,
    p_setor_id: input.setor_id,
    p_categoria: input.categoria ?? undefined,
    p_elaborado_por_id: input.elaborado_por_id ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function iniciarRevisao(input: {
  pop_id: string;
  tipo_incremento: Exclude<PopTipoIncremento, 'initial'>;
  motivo: string;
  elaborado_por_id?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_pop_iniciar_revisao', {
    p_pop_id: input.pop_id,
    p_tipo_incremento: input.tipo_incremento,
    p_motivo: input.motivo,
    p_elaborado_por_id: input.elaborado_por_id ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function atualizarRascunho(input: {
  pop_id: string;
  codigo?: string;
  titulo?: string;
  setor_id?: string;
  categoria?: string | null;
  motivo?: string;
  tipo_incremento?: PopTipoIncremento;
  elaborado_por_id?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc('fn_pop_atualizar_rascunho', {
    p_pop_id: input.pop_id,
    p_codigo: input.codigo ?? undefined,
    p_titulo: input.titulo ?? undefined,
    p_setor_id: input.setor_id ?? undefined,
    p_categoria: input.categoria ?? undefined,
    p_motivo: input.motivo ?? undefined,
    p_tipo_incremento: input.tipo_incremento ?? undefined,
    p_elaborado_por_id: input.elaborado_por_id ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

/** Upload do PDF: multipart para a Edge Function (service_role grava metadados). */
export async function enviarArquivoRascunho(popId: string, file: File): Promise<{
  arquivo_path: string;
  arquivo_sha256: string;
}> {
  const validacao = validarArquivoPop(file);
  if (validacao.ok === false) throw new Error(validacao.motivo);


  const form = new FormData();
  form.append('pop_id', popId);
  form.append('file', file);

  const { data, error } = await supabase.functions.invoke<any>('pop-upload-arquivo', {
    body: form,
  });
  if (error) throw new Error(data?.error ? `${error.message} (${data.error})` : error.message);
  if (!data?.ok) throw new Error(data?.detail || data?.error || 'Falha ao enviar o arquivo.');
  return { arquivo_path: data.arquivo_path, arquivo_sha256: data.arquivo_sha256 };
}

export async function publicarRascunho(popId: string): Promise<PopPublicacaoResultado> {
  const { data, error } = await supabase.rpc('fn_pop_publicar_rascunho', { p_pop_id: popId });
  if (error) throw error;
  return data as unknown as PopPublicacaoResultado;
}

/** Descarte transacional: RPC + remoção física do PDF temporário (Edge). */
export async function descartarRascunho(popId: string, motivo: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke<any>('pop-descartar-rascunho', {
    body: { pop_id: popId, motivo },
  });
  if (error) throw new Error(data?.detail || data?.error || error.message);
  if (!data?.ok) throw new Error(data?.detail || data?.error || 'Falha ao descartar a revisão.');
}

export async function tornarObsoleto(popId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('fn_pop_tornar_obsoleto', {
    p_pop_id: popId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function reativarPop(popId: string): Promise<void> {
  const { error } = await supabase.rpc('fn_pop_reativar', { p_pop_id: popId });
  if (error) throw error;
}

/** Exclusão definitiva (vigente + rascunho + PDFs no Storage) via Edge. */
export async function excluirPop(popId: string, motivo: string): Promise<void> {
  const texto = (motivo || '').trim();
  if (texto.length < 10) {
    throw new Error('Informe o motivo da exclusão com pelo menos 10 caracteres.');
  }
  const { data, error } = await supabase.functions.invoke<any>('pop-excluir', {
    body: { pop_id: popId, motivo: texto },
  });
  if (error) throw new Error(data?.detail || data?.error || error.message);
  if (!data?.ok) throw new Error(data?.detail || data?.error || 'Falha ao excluir o POP.');
}


/** Baixa o PDF como Blob via Edge (sem signed URL exposta ao cliente). */
export async function baixarArquivoPop(
  popId: string,
  origem: 'vigente' | 'rascunho' = 'vigente',
): Promise<Blob> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pop-arquivo-blob`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ pop_id: popId, origem }),
  });

  if (!resp.ok) {
    let detalhe = `HTTP ${resp.status}`;
    try {
      const j = await resp.json();
      detalhe = j?.error ? String(j.error) : detalhe;
    } catch {
      /* corpo não-JSON */
    }
    throw new Error(`Não foi possível abrir o documento (${detalhe}).`);
  }

  const blob = await resp.blob();
  if (blob.size < 1) throw new Error('Documento vazio.');
  return blob;
}
