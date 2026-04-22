import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from './usePermission';
import { fetchManageablePermissionProfiles } from '@/services/rbac/permissionAdminSecure';

interface ProfileSecurityContext {
  hasGlobalAccess: boolean;
  isDepartmentalAdmin: boolean;
  departamentoId: string | null;
  departamentoNome: string | null;
  shouldFilterByDepartment: boolean;
  isLoading: boolean;
}

/**
 * Hook para determinar o contexto de segurança do usuário logado
 * para visualização de perfis na Gestão de Permissões.
 * 
 * - SuperAdm/AdmRH veem todos os usuários
 * - AdmSSO/TecSSO/AdmLogistica/AdmEquipamentos veem apenas seu departamento
 */
export const useProfileSecurity = (): ProfileSecurityContext => {
  const { userId, isSuperAdmin, permissions, isLoading: isAuthLoading } = usePermission();
  const [departamentoId, setDepartamentoId] = useState<string | null>(null);
  const [departamentoNome, setDepartamentoNome] = useState<string | null>(null);
  const [isLoadingDepartamento, setIsLoadingDepartamento] = useState(true);

  const [profileScope, setProfileScope] = useState<{ acesso_global?: boolean; primary_role?: string | null; departamento_id?: string | null; departamento_nome?: string | null } | null>(null);

  // SuperAdm e admins válidos com acesso global continuam vendo todos os usuários
  const hasGlobalAccess = isSuperAdmin || !!profileScope?.acesso_global || profileScope?.primary_role === 'AdmRH' || profileScope?.primary_role === 'Administrador';

  // Admins operacionais continuam restritos ao departamento quando aplicável
  const departmentalRoles = ['AdmSSO', 'TecSSO', 'AdmLogistica', 'AdmEquipamentos', 'AdmOBRA', 'AdmSede'];
  const isDepartmentalAdmin = departmentalRoles.includes(profileScope?.primary_role || '');

  useEffect(() => {
    const fetchDepartamento = async () => {
      if (!userId) {
        setIsLoadingDepartamento(false);
        return;
      }

      try {
        try {
          const manageableProfiles = await fetchManageablePermissionProfiles();
          const currentManagedProfile = manageableProfiles.find(profile => profile.id === userId);

          if (currentManagedProfile) {
            setProfileScope({
              acesso_global: currentManagedProfile.acesso_global,
              primary_role: (currentManagedProfile as any).primary_role || currentManagedProfile.funcao_sistema || currentManagedProfile.funcoes?.[0] || null,
              departamento_id: (currentManagedProfile as any).departamento_id || null,
              departamento_nome: (currentManagedProfile as any).departamento_nome || null,
            });
          }
        } catch (scopeError) {
          console.warn('⚠️ Não foi possível carregar escopo seguro de perfis:', scopeError);
        }

        // Buscar departamento do usuário logado através do funcionario_id
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('funcionario_id')
          .eq('id', userId)
          .single();

        if (profileError || !profile?.funcionario_id) {
          console.log('📋 Usuário não tem funcionario_id vinculado');
          setIsLoadingDepartamento(false);
          return;
        }

        // Buscar departamento do funcionário
        const { data: funcionario, error: funcError } = await supabase
          .from('bd_funcionarios')
          .select('departamento_id, bd_departamentos(id, nome_departamento)')
          .eq('id', profile.funcionario_id)
          .single();

        if (funcError) {
          console.error('❌ Erro ao buscar departamento:', funcError);
        } else if (funcionario?.departamento_id) {
          setDepartamentoId(funcionario.departamento_id);
          const dept = funcionario.bd_departamentos as { id: string; nome_departamento: string } | null;
          setDepartamentoNome(dept?.nome_departamento || null);
          console.log('✅ Departamento do usuário:', {
            id: funcionario.departamento_id,
            nome: dept?.nome_departamento
          });
        }
      } catch (error) {
        console.error('❌ Erro ao buscar departamento:', error);
      } finally {
        setIsLoadingDepartamento(false);
      }
    };

    fetchDepartamento();
  }, [userId]);

  // Deve filtrar por departamento se:
  // 1. É admin departamental E
  // 2. NÃO tem acesso global E
  // 3. TEM departamento definido
  const shouldFilterByDepartment = isDepartmentalAdmin && !hasGlobalAccess && !!departamentoId;

  return {
    hasGlobalAccess,
    isDepartmentalAdmin,
    departamentoId: profileScope?.departamento_id || departamentoId,
    departamentoNome: profileScope?.departamento_nome || departamentoNome,
    shouldFilterByDepartment: isDepartmentalAdmin && !hasGlobalAccess && !!(profileScope?.departamento_id || departamentoId),
    isLoading: isAuthLoading || isLoadingDepartamento
  };
};
