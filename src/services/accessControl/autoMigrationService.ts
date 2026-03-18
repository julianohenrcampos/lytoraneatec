import { supabase } from '@/integrations/supabase/client';

/**
 * Busca role por nome em bd_roles; se não existir, cria.
 * Retorna o id da role.
 */
export const getOrCreateRole = async (nome: string): Promise<string | null> => {
  try {
    // Tentar buscar role existente
    const { data: existing, error: selectError } = await supabase
      .from('bd_roles')
      .select('id')
      .eq('nome', nome)
      .maybeSingle();

    if (selectError) {
      console.warn('⚠️ [RBAC-MIGRATION] Erro ao buscar role:', nome, selectError);
      return null;
    }

    if (existing) {
      return existing.id;
    }

    // Criar nova role
    const { data: created, error: insertError } = await supabase
      .from('bd_roles')
      .insert({ nome, descricao: `Role migrada automaticamente de profiles.funcoes` })
      .select('id')
      .single();

    if (insertError) {
      // Se erro de unicidade, buscar novamente (race condition)
      if (insertError.code === '23505') {
        const { data: retry } = await supabase
          .from('bd_roles')
          .select('id')
          .eq('nome', nome)
          .single();
        return retry?.id || null;
      }
      console.warn('⚠️ [RBAC-MIGRATION] Erro ao criar role:', nome, insertError);
      return null;
    }

    console.log('✅ [RBAC-MIGRATION] Role criada:', nome);
    return created.id;
  } catch (err) {
    console.warn('⚠️ [RBAC-MIGRATION] Erro em getOrCreateRole:', err);
    return null;
  }
};

/**
 * Vincula usuário a uma role em bd_user_roles (upsert - ignora duplicata).
 */
export const linkUserRole = async (userId: string, roleId: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('bd_user_roles')
      .upsert(
        { user_id: userId, role_id: roleId },
        { onConflict: 'user_id,role_id' }
      );

    if (error) {
      console.warn('⚠️ [RBAC-MIGRATION] Erro ao vincular user-role:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.warn('⚠️ [RBAC-MIGRATION] Erro em linkUserRole:', err);
    return false;
  }
};

/**
 * Migra permissões da estrutura antiga (bd_funcoes_permissao + bd_permissoes)
 * para a nova (bd_permissions + bd_role_permissions).
 */
export const migratePermissionsFromOldStructure = async (
  roleId: string,
  nomeFuncao: string
): Promise<void> => {
  try {
    // Buscar função na tabela antiga
    const { data: funcao, error: funcaoError } = await supabase
      .from('bd_funcoes_permissao')
      .select('permissoes')
      .eq('nome_funcao', nomeFuncao)
      .maybeSingle();

    if (funcaoError || !funcao?.permissoes || !Array.isArray(funcao.permissoes) || funcao.permissoes.length === 0) {
      console.log(`📋 [RBAC-MIGRATION] Sem permissões antigas para função: ${nomeFuncao}`);
      return;
    }

    // Buscar detalhes das permissões antigas
    const { data: permissoesAntigas, error: permError } = await supabase
      .from('bd_permissoes')
      .select('id, nome_permissao, descricao, rota')
      .in('id', funcao.permissoes);

    if (permError || !permissoesAntigas || permissoesAntigas.length === 0) {
      console.warn('⚠️ [RBAC-MIGRATION] Nenhuma permissão antiga encontrada para IDs:', funcao.permissoes);
      return;
    }

    console.log(`📋 [RBAC-MIGRATION] Migrando ${permissoesAntigas.length} permissões para role ${nomeFuncao}`);

    for (const perm of permissoesAntigas) {
      try {
        // Criar ou buscar permissão na tabela nova (bd_permissions)
        let permissionId: string | null = null;

        const { data: existingPerm } = await supabase
          .from('bd_permissions')
          .select('id')
          .eq('codigo', perm.nome_permissao)
          .maybeSingle();

        if (existingPerm) {
          permissionId = existingPerm.id;
        } else {
          const { data: newPerm, error: insertPermError } = await supabase
            .from('bd_permissions')
            .insert({
              codigo: perm.nome_permissao,
              nome: perm.nome_permissao,
              descricao: perm.descricao || null,
              rota: perm.rota || null,
              tipo: 'page',
            })
            .select('id')
            .single();

          if (insertPermError) {
            // Race condition - buscar novamente
            if (insertPermError.code === '23505') {
              const { data: retry } = await supabase
                .from('bd_permissions')
                .select('id')
                .eq('codigo', perm.nome_permissao)
                .single();
              permissionId = retry?.id || null;
            } else {
              console.warn('⚠️ [RBAC-MIGRATION] Erro ao criar permissão:', perm.nome_permissao, insertPermError);
              continue;
            }
          } else {
            permissionId = newPerm.id;
          }
        }

        if (!permissionId) continue;

        // Vincular role-permission
        await supabase
          .from('bd_role_permissions')
          .upsert(
            { role_id: roleId, permission_id: permissionId },
            { onConflict: 'role_id,permission_id' }
          );
      } catch (permErr) {
        console.warn('⚠️ [RBAC-MIGRATION] Erro ao migrar permissão individual:', perm.nome_permissao, permErr);
      }
    }

    console.log(`✅ [RBAC-MIGRATION] Permissões migradas para role ${nomeFuncao}`);
  } catch (err) {
    console.warn('⚠️ [RBAC-MIGRATION] Erro em migratePermissionsFromOldStructure:', err);
  }
};

/**
 * Migra automaticamente um usuário do modelo antigo para o novo RBAC.
 * - Verifica se já foi migrado (bd_user_roles)
 * - Se não, busca profiles.funcoes e migra cada função + permissões
 * 
 * NUNCA bloqueia o usuário — falhas são silenciosas.
 */
export const autoMigrateUser = async (userId: string): Promise<void> => {
  try {
    console.log('🔄 [RBAC-MIGRATION] Iniciando migração automática para usuário:', userId);

    // Verificar se já possui registros no novo modelo
    const { data: existingRoles, error: checkError } = await supabase
      .from('bd_user_roles')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (checkError) {
      console.warn('⚠️ [RBAC-MIGRATION] Erro ao verificar migração existente:', checkError);
      return;
    }

    if (existingRoles && existingRoles.length > 0) {
      console.log('✅ [RBAC-MIGRATION] Usuário já migrado, ignorando.');
      return;
    }

    // Buscar funcoes do profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('funcoes')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.funcoes || !Array.isArray(profile.funcoes) || profile.funcoes.length === 0) {
      console.log('📋 [RBAC-MIGRATION] Usuário sem funcoes[] - nada a migrar.');
      return;
    }

    console.log('📋 [RBAC-MIGRATION] Funções encontradas:', profile.funcoes);

    // Migrar cada função
    for (const funcaoNome of profile.funcoes) {
      if (!funcaoNome || typeof funcaoNome !== 'string') continue;

      const roleId = await getOrCreateRole(funcaoNome);
      if (!roleId) continue;

      await linkUserRole(userId, roleId);
      await migratePermissionsFromOldStructure(roleId, funcaoNome);
    }

    console.log('✅ [RBAC-MIGRATION] Migração automática concluída para usuário:', userId);
  } catch (err) {
    console.warn('⚠️ [RBAC-MIGRATION] Erro geral em autoMigrateUser:', err);
  }
};
