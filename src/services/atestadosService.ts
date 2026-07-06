// Fase 2-A — Serviço frontend para Atestados Médicos.
// Todas as chamadas públicas usam fetch com header `apikey` (anon key).
// Nada de PII em console.log.

import { supabase } from "@/integrations/supabase/client";
import type {
  AtestadoSubmeterResponse,
  AtestadoUploadUrlResponse,
  AtestadoValidarResponse,
} from "@/types/atestadoMedico";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function fnUrl(name: string) {
  return `${SUPABASE_URL}/functions/v1/${name}`;
}

async function publicPost<T>(fnName: string, body: unknown): Promise<T> {
  const res = await fetch(fnUrl(fnName), {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${SUPABASE_ANON}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || data?.ok === false || data?.error) {
    const err: any = new Error(data?.error || `http_${res.status}`);
    err.status = res.status;
    err.code = data?.error || `http_${res.status}`;
    err.detail = data?.detail;
    throw err;
  }
  return data as T;
}

export async function validarMatricula(input: {
  matricula: string;
  cpf_ultimos_4: string;
}): Promise<AtestadoValidarResponse> {
  return publicPost<AtestadoValidarResponse>("atestado-validar-matricula", {
    matricula: input.matricula,
    cpf_ultimos_4: input.cpf_ultimos_4,
  });
}

export async function criarUploadUrl(input: {
  token_validacao: string;
  extensao: string;
}): Promise<AtestadoUploadUrlResponse> {
  return publicPost<AtestadoUploadUrlResponse>("atestado-criar-upload-url", {
    token_validacao: input.token_validacao,
    extensao: input.extensao,
  });
}

export async function uploadArquivo(params: {
  bucket: string;
  arquivo_path: string;
  token: string;
  file: File;
}): Promise<void> {
  const { error } = await supabase.storage
    .from(params.bucket)
    .uploadToSignedUrl(params.arquivo_path, params.token, params.file, {
      contentType: params.file.type || undefined,
      upsert: false,
    });
  if (error) {
    const err: any = new Error("upload_failed");
    err.code = "upload_failed";
    throw err;
  }
}

export async function enviarAtestado(input: {
  token_validacao: string;
  arquivo_path: string;
  data_emissao: string;
  data_inicio_afastamento: string;
  dias_afastamento: number;
}): Promise<AtestadoSubmeterResponse> {
  return publicPost<AtestadoSubmeterResponse>("atestado-submeter", {
    token_validacao: input.token_validacao,
    arquivo_path: input.arquivo_path,
    data_emissao: input.data_emissao,
    data_inicio_afastamento: input.data_inicio_afastamento,
    dias_afastamento: input.dias_afastamento,
    declaracao_veracidade: true,
    declaracao_original_48h: true,
    declaracao_ciencia_nao_validacao: true,
  });
}

/**
 * Abre arquivo do painel interno. Chama a Edge autenticada `atestado-arquivo-signed-url`.
 * Contrato real: body { atestado_id }.
 */
export async function obterArquivoAssinado(atestadoId: string): Promise<{
  signed_url: string;
  expires_at?: string | number;
}> {
  const { data, error } = await supabase.functions.invoke<any>(
    "atestado-arquivo-signed-url",
    { body: { atestado_id: atestadoId } }
  );
  if (error) {
    const err: any = new Error("signed_url_failed");
    err.code = (error as any)?.status
      ? `http_${(error as any).status}`
      : "signed_url_failed";
    err.status = (error as any)?.status;
    throw err;
  }
  if (!data?.signed_url) {
    const err: any = new Error("signed_url_missing");
    err.code = "signed_url_missing";
    throw err;
  }
  return { signed_url: data.signed_url, expires_at: data.expires_at };
}
