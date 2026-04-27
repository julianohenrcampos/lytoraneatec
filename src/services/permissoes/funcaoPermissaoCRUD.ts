/**
 * @deprecated Este módulo opera sobre a tabela legada `bd_funcoes_permissao`.
 * A fonte oficial é `bd_user_roles` + `bd_role_permission_actions` (RBAC novo),
 * consumida via `usePermission`. Mantido apenas para suportar usuários ainda
 * vinculados ao fallback legado. Não criar novos usos.
 */
import { supabase } from "@/integrations/supabase/client";
import { 
  FuncaoPermissao, 
  FuncaoPermissaoFormData
} from "@/types/permissao";

// Role Permissions CRUD operations (LEGACY)
export const fetchFuncoesPermissao = async (filters: { nome_funcao?: string }) => {
  let query = supabase.from("bd_funcoes_permissao").select("*");

  if (filters.nome_funcao) {
    query = query.ilike("nome_funcao", `%${filters.nome_funcao}%`);
  }

  const { data, error } = await query.order("nome_funcao");

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao[];
};

export const getFuncaoPermissaoById = async (id: string) => {
  const { data, error } = await supabase
    .from("bd_funcoes_permissao")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao;
};

export const createFuncaoPermissao = async (funcaoPermissao: FuncaoPermissaoFormData) => {
  const { data, error } = await supabase
    .from("bd_funcoes_permissao")
    .insert(funcaoPermissao)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao;
};

export const updateFuncaoPermissao = async (id: string, funcaoPermissao: FuncaoPermissaoFormData) => {
  const { data, error } = await supabase
    .from("bd_funcoes_permissao")
    .update(funcaoPermissao)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as FuncaoPermissao;
};

export const deleteFuncaoPermissao = async (id: string) => {
  const { error } = await supabase
    .from("bd_funcoes_permissao")
    .delete()
    .eq("id", id);

  if (error) {
    throw error;
  }

  return true;
};
