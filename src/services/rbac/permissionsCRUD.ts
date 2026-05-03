import { supabase } from "@/integrations/supabase/client";
import { isModuloValido } from "@/components/permissoes/modulosCatalogo";

export interface RBACPermission {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  rota?: string | null;
  tipo: string;
  modulo?: string | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface RBACPermissionFormData {
  codigo: string;
  nome: string;
  descricao?: string;
  rota?: string;
  tipo?: string;
  modulo?: string;
}

export interface RBACPermissionFilter {
  codigo?: string;
  rota?: string;
}

// ===== Helpers =====

const normalizeCodigo = (raw: string): string =>
  (raw || "").trim().toLowerCase().replace(/\s+/g, "_");

const normalizeRota = (raw?: string | null): string | null => {
  if (!raw) return null;
  let r = raw.trim();
  if (!r) return null;
  if (!r.startsWith("/")) r = "/" + r;
  // Colapsar barras duplicadas, preservando o "/" inicial
  r = r.replace(/\/{2,}/g, "/");
  return r;
};

const normalizePayload = (input: RBACPermissionFormData) => ({
  codigo: normalizeCodigo(input.codigo),
  nome: (input.nome || input.codigo || "").trim(),
  descricao: input.descricao?.trim() ? input.descricao.trim() : null,
  rota: normalizeRota(input.rota),
  tipo: (input.tipo || "page").trim() || "page",
  modulo: input.modulo?.trim() ? input.modulo.trim() : null,
  ativo: true,
});

const mapSupabaseError = (error: any): Error => {
  const code = error?.code;
  const message = (error?.message || "").toString();
  if (code === "23505" || /duplicate key/i.test(message)) {
    return new Error("Já existe uma permissão com este código.");
  }
  if (code === "42501" || /permiss[aã]o/i.test(message)) {
    return new Error(
      "Sem permissão para alterar o catálogo (apenas SuperAdm autenticado)."
    );
  }
  return new Error(message || "Erro desconhecido ao salvar permissão.");
};

// Validação de sessão obrigatória antes de qualquer operação de catálogo
const ensureAuthenticated = async (): Promise<void> => {
  const { data: { session } } = await supabase.auth.getSession();
  console.log("[PERMISSOES][AUTH_SESSION]", {
    hasSession: !!session,
    userId: session?.user?.id,
    email: session?.user?.email,
  });
  if (!session || !session.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }
};

// ===== CRUD =====

export const fetchPermissions = async (filters: RBACPermissionFilter = {}): Promise<RBACPermission[]> => {
  let query = supabase.from("bd_permissions").select("*");

  if (filters.codigo) {
    query = query.ilike("codigo", `%${filters.codigo}%`);
  }

  if (filters.rota) {
    query = query.ilike("rota", `%${filters.rota}%`);
  }

  const { data, error } = await query.order("codigo");
  if (error) throw error;
  return data as RBACPermission[];
};

export const getPermissionById = async (id: string): Promise<RBACPermission> => {
  const { data, error } = await supabase
    .from("bd_permissions")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as RBACPermission;
};

export const createPermission = async (
  permission: RBACPermissionFormData
): Promise<RBACPermission> => {
  // 1. Validar sessão inline (sem helpers que possam disparar SELECT)
  const { data: sessionData } = await supabase.auth.getSession();
  const session = sessionData?.session;

  console.log("[PERMISSOES][AUTH_SESSION]", {
    hasSession: !!session,
    userId: session?.user?.id,
    email: session?.user?.email,
  });

  if (!session?.access_token) {
    throw new Error("Sessão expirada. Faça login novamente.");
  }

  // 2. Validar módulo contra catálogo (client-side)
  if (!isModuloValido(permission.modulo)) {
    throw new Error("Módulo inválido.");
  }

  // 3. Normalizar payload inline
  const payload = {
    codigo: String(permission.codigo ?? "").trim().toLowerCase().replace(/\s+/g, "_"),
    nome: String(permission.nome ?? "").trim(),
    descricao: permission.descricao ? String(permission.descricao).trim() : null,
    rota: permission.rota ? String(permission.rota).trim() : null,
    tipo: permission.tipo || "page",
    modulo: permission.modulo,
    ativo: true,
  };

  if (payload.rota && !payload.rota.startsWith("/")) {
    payload.rota = `/${payload.rota}`;
  }

  console.log("[PERMISSOES][CREATE_SUBMIT_DIRECT_INSERT]", payload);

  // 3. INSERT direto — duplicidade fica a cargo do UNIQUE em codigo (erro 23505)
  const { data, error } = await supabase
    .from("bd_permissions")
    .insert(payload)
    .select("id, codigo, nome, descricao, rota, tipo, modulo, ativo")
    .single();

  if (error) {
    console.error("[PERMISSOES][CREATE_ERROR_DIRECT_INSERT]", {
      payload,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
      error,
    });

    if (error.code === "23505") {
      throw new Error("Já existe uma permissão com este código.");
    }
    if (error.code === "42501") {
      throw new Error(
        "Sem permissão para alterar o catálogo de permissões. Confirme se sua sessão SuperAdm está ativa."
      );
    }
    throw new Error(error.message || "Erro ao criar permissão.");
  }

  console.log("[PERMISSOES][CREATE_SUCCESS_DIRECT_INSERT]", data);
  return data as RBACPermission;
};

export const updatePermission = async (
  id: string,
  permission: RBACPermissionFormData
): Promise<RBACPermission> => {
  await ensureAuthenticated();

  if (!isModuloValido(permission.modulo)) {
    throw new Error("Módulo inválido.");
  }

  const payload = normalizePayload(permission);
  console.log("[PERMISSOES][UPDATE_SUBMIT]", { id, payload });

  const { data, error } = await supabase
    .from("bd_permissions")
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[PERMISSOES][UPDATE_ERROR]", { id, payload, error });
    throw mapSupabaseError(error);
  }

  console.log("[PERMISSOES][UPDATE_SUCCESS]", data);
  return data as RBACPermission;
};

export const deletePermission = async (id: string): Promise<boolean> => {
  await ensureAuthenticated();

  // First remove from bd_role_permissions
  await supabase.from("bd_role_permissions").delete().eq("permission_id", id);
  const { error } = await supabase.from("bd_permissions").delete().eq("id", id);
  if (error) {
    console.error("[PERMISSOES][DELETE_ERROR]", { id, error });
    throw mapSupabaseError(error);
  }
  return true;
};
