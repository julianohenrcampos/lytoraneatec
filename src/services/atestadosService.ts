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

/** Timeouts por etapa (ms) — sem eles a promise pode ficar pendurada para sempre. */
export const ATESTADO_TIMEOUTS = {
  uploadUrl: 20_000,
  upload: 120_000,
  submeter: 45_000,
};

function timeoutError() {
  const err: any = new Error("timeout");
  err.code = "timeout";
  return err;
}

async function fetchComTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } catch (e: any) {
    if (e?.name === "AbortError") throw timeoutError();
    const err: any = new Error("network_error");
    err.code = "network_error";
    throw err;
  } finally {
    clearTimeout(t);
  }
}

async function publicPost<T>(
  fnName: string,
  body: unknown,
  timeoutMs: number,
): Promise<T> {
  const res = await fetchComTimeout(
    fnUrl(fnName),
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
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
    err.retry_after_segundos = data?.retry_after_segundos;
    throw err;
  }
  return data as T;
}

export async function validarMatricula(input: {
  matricula: string;
  cpf_ultimos_4: string;
}): Promise<AtestadoValidarResponse> {
  return publicPost<AtestadoValidarResponse>(
    "atestado-validar-matricula",
    {
      matricula: input.matricula,
      cpf_ultimos_4: input.cpf_ultimos_4,
    },
    ATESTADO_TIMEOUTS.uploadUrl,
  );
}

export async function criarUploadUrl(input: {
  token_validacao: string;
  extensao: string;
}): Promise<AtestadoUploadUrlResponse> {
  return publicPost<AtestadoUploadUrlResponse>(
    "atestado-criar-upload-url",
    {
      token_validacao: input.token_validacao,
      extensao: input.extensao,
    },
    ATESTADO_TIMEOUTS.uploadUrl,
  );
}

export async function uploadArquivo(params: {
  bucket: string;
  arquivo_path: string;
  token: string;
  file: File;
}): Promise<void> {
  // Upload direto no endpoint de signed upload, com timeout — o helper
  // `uploadToSignedUrl` do supabase-js não aceita AbortSignal.
  const url =
    `${SUPABASE_URL}/storage/v1/object/upload/sign/${params.bucket}/${params.arquivo_path}` +
    `?token=${encodeURIComponent(params.token)}`;

  let res: Response;
  try {
    res = await fetchComTimeout(
      url,
      {
        method: "PUT",
        headers: {
          apikey: SUPABASE_ANON,
          "Content-Type": params.file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: params.file,
      },
      ATESTADO_TIMEOUTS.upload,
    );
  } catch (e: any) {
    if (e?.code === "timeout") throw e;
    const err: any = new Error("upload_failed");
    err.code = "upload_failed";
    throw err;
  }

  if (!res.ok) {
    const err: any = new Error("upload_failed");
    err.code = "upload_failed";
    err.status = res.status;
    throw err;
  }
}


export async function enviarAtestado(input: {
  token_validacao: string;
  arquivo_path: string;
  data_emissao: string;
  data_inicio_afastamento: string;
  dias_afastamento: number;
  tipo_documento: string;
  sistema_afetado_codigo?: string;
  sistema_afetado_observacao?: string;
}): Promise<AtestadoSubmeterResponse> {
  return publicPost<AtestadoSubmeterResponse>(
    "atestado-submeter",
    {
      token_validacao: input.token_validacao,
      arquivo_path: input.arquivo_path,
      data_emissao: input.data_emissao,
      data_inicio_afastamento: input.data_inicio_afastamento,
      dias_afastamento: input.dias_afastamento,
      tipo_documento: input.tipo_documento,
      sistema_afetado_codigo: input.sistema_afetado_codigo,
      sistema_afetado_observacao: input.sistema_afetado_observacao,
      declaracao_veracidade: true,
      declaracao_original_48h: true,
      declaracao_ciencia_nao_validacao: true,
    },
    ATESTADO_TIMEOUTS.submeter,
  );
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

/**
 * Baixa o arquivo do atestado como Blob binário via Edge dedicada.
 * A Edge devolve o binário com CORS próprio — signed_url nunca sai do servidor.
 */
export async function obterArquivoBlob(atestadoId: string): Promise<Blob> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) {
    throw Object.assign(new Error("unauthorized"), {
      status: 401,
      code: "unauthorized",
    });
  }

  const res = await fetch(fnUrl("atestado-arquivo-blob"), {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ atestado_id: atestadoId }),
  });

  if (!res.ok) {
    let code = `http_${res.status}`;
    try {
      const j = await res.json();
      if (j?.error) code = j.error;
    } catch {
      /* ignore */
    }
    throw Object.assign(new Error(code), { status: res.status, code });
  }

  return await res.blob();
}

