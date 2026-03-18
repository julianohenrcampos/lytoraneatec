import { supabase } from '@/integrations/supabase/client';

/**
 * Migra automaticamente um usuário do modelo antigo para o novo RBAC.
 * Usa a função SECURITY DEFINER `rbac_auto_migrate_user` para bypassar RLS.
 * 
 * - Verifica se já foi migrado (bd_user_roles)
 * - Se não, busca profiles.funcoes e migra cada função + permissões
 * 
 * NUNCA bloqueia o usuário — falhas são silenciosas.
 */
export const autoMigrateUser = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 [RBAC-MIGRATION] Iniciando migração automática para usuário:', userId);

    const { data, error } = await supabase.rpc('rbac_auto_migrate_user', {
      p_user_id: userId,
    });

    if (error) {
      console.warn('⚠️ [RBAC-MIGRATION] Erro na migração via RPC:', error);
      return;
    }

    const result = data as any;

    if (result?.status === 'already_migrated') {
      console.log('✅ [RBAC-MIGRATION] Usuário já migrado, ignorando.');
    } else if (result?.status === 'no_funcoes') {
      console.log('📋 [RBAC-MIGRATION] Usuário sem funcoes[] - nada a migrar.');
    } else if (result?.status === 'migrated') {
      console.log(`✅ [RBAC-MIGRATION] Migração concluída: ${result.migrated} roles migradas:`, result.roles);
    } else {
      console.log('📋 [RBAC-MIGRATION] Resultado:', result);
    }
  } catch (err) {
    console.warn('⚠️ [RBAC-MIGRATION] Erro geral em autoMigrateUser:', err);
  }
};
