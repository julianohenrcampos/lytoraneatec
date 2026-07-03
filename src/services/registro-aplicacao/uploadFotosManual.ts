import { supabase } from "@/integrations/supabase/client";

// ============================================================================
// B.3.5-B — Persistência de fotos do Registro Manual
// Bucket privado: 'apontamentos'
// Path:  registro-manual/{registro_aplicacao_id}/{detalhe_id}/{ts}-{rand}.{ext}
// Autorização governada por public.fn_storage_can_upload / _can_access
// (ver migration B.3.5-C). Nunca gravar signed URL no banco. Nunca getPublicUrl.
// ============================================================================

const BUCKET = "apontamentos";
const PREFIX = "registro-manual";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB defensivo

const ALLOWED_EXTS = ["jpg", "jpeg", "png", "webp"] as const;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export interface UploadFotoResult {
  ok: boolean;
  path?: string;
  error?: string;
}

export function validarFotoManual(file: File): string | null {
  if (!file) return "Arquivo inválido.";
  const ext = extractExt(file.name);
  if (!ext || !ALLOWED_EXTS.includes(ext as (typeof ALLOWED_EXTS)[number])) {
    return `Extensão não permitida (.${ext || "?"}). Use jpg, jpeg, png ou webp.`;
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type as (typeof ALLOWED_TYPES)[number])) {
    return `Tipo MIME não permitido (${file.type}).`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Arquivo maior que ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)} MB.`;
  }
  return null;
}

function extractExt(name: string): string | null {
  const m = /\.([a-zA-Z0-9]+)$/.exec(name || "");
  return m ? m[1].toLowerCase() : null;
}

function randomToken(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function montarPathFotoManual(
  registroId: string,
  detalheId: string,
  file: File
): string {
  const ext = extractExt(file.name) || "jpg";
  const ts = Date.now();
  const rand = randomToken();
  return `${PREFIX}/${registroId}/${detalheId}/${ts}-${rand}.${ext}`;
}

export async function uploadFotoRegistroManual(
  registroId: string,
  detalheId: string,
  file: File
): Promise<UploadFotoResult> {
  const err = validarFotoManual(file);
  if (err) return { ok: false, error: err };

  const path = montarPathFotoManual(registroId, detalheId, file);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) {
    return { ok: false, error: error.message };
  }
  return { ok: true, path };
}

export async function criarSignedUrlFotoManual(
  path: string,
  expiresInSeconds = 3600
): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!path) return { ok: false, error: "path vazio" };
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data?.signedUrl) {
    return { ok: false, error: error?.message || "Sem signedUrl" };
  }
  return { ok: true, url: data.signedUrl };
}

/** Cleanup best-effort — usado quando upload OK mas UPDATE falhou. */
export async function removerFotosRegistroManual(paths: string[]): Promise<void> {
  if (!paths || paths.length === 0) return;
  try {
    await supabase.storage.from(BUCKET).remove(paths);
  } catch (e) {
    console.warn("[REGISTRO_MANUAL][FOTOS_CLEANUP_FAIL]", e);
  }
}
