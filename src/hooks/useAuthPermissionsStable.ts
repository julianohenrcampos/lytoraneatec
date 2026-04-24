
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { isSuperAdminFallbackEmail } from '@/config/superAdminEmails';

interface AuthPermissionsState {
  userId: string | null;
  isSuperAdmin: boolean;
  userRole: string | null;
  permissions: string[];
  isLoading: boolean;
}

export const useAuthPermissionsStable = (): AuthPermissionsState => {
  const [state, setState] = useState<AuthPermissionsState>({
    userId: null,
    isSuperAdmin: false,
    userRole: null,
    permissions: [],
    isLoading: true,
  });

  useEffect(() => {
    const loadUserPermissions = async () => {
      try {
        console.log('🔐 STABLE - Carregando permissões do usuário...');
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log("🔐 STABLE - Usuário não autenticado");
          setState({
            userId: null,
            isSuperAdmin: false,
            userRole: null,
            permissions: [],
            isLoading: false,
          });
          return;
        }

        console.log('🔐 STABLE - Usuário autenticado:', user.email);

        // Buscar perfil com SISTEMA HÍBRIDO
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select(`
            id,
            nome_completo,
            funcao_sistema,
            funcao_permissao,
            funcoes,
            bd_funcoes_permissao (
              id,
              nome_funcao,
              descricao,
              permissoes
            )
          `)
          .eq('id', user.id)
          .single();

        if (profileErr) {
          console.warn('⚠️ STABLE - Erro ao buscar perfil:', profileErr);
          // Fallback para usuário autenticado
          setState({
            userId: user.id,
            isSuperAdmin: false,
            userRole: 'user',
            permissions: ['dashboard_view'],
            isLoading: false,
          });
          return;
        }

        console.log('📋 STABLE - Perfil encontrado:', {
          id: profile.id,
          nome_completo: profile.nome_completo,
          funcao_sistema: profile.funcao_sistema,
          funcoes: profile.funcoes,
          funcao_permissao: profile.funcao_permissao,
          bd_funcoes_permissao: profile.bd_funcoes_permissao
        });

        // Verificação híbrida de SuperAdm por múltiplos critérios.
        let isSuperAdmin = false;
        let userRole = 'user';
        let functionName = 'user';

        // 1. Fallback por e-mail (lista centralizada em src/config/superAdminEmails.ts)
        if (isSuperAdminFallbackEmail(user.email)) {
          console.log('🚀 STABLE - SuperAdmin detectado por EMAIL!');
          isSuperAdmin = true;
          functionName = 'SuperAdm';
          userRole = 'SuperAdm';
        }
        // 2. Verificar array funcoes
        else if (profile.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.includes('SuperAdm')) {
          console.log('🚀 STABLE - SuperAdmin detectado por ARRAY funcoes!');
          isSuperAdmin = true;
          functionName = 'SuperAdm';
          userRole = 'SuperAdm';
        }
        // 3. Verificar funcao_permissao
        else if (profile.bd_funcoes_permissao && profile.bd_funcoes_permissao.nome_funcao === 'SuperAdm') {
          console.log('🚀 STABLE - SuperAdmin detectado por FUNCAO_PERMISSAO!');
          isSuperAdmin = true;
          functionName = 'SuperAdm';
          userRole = 'SuperAdm';
        }
        // 4. Verificar funcao_sistema (fallback)
        else if (profile.funcao_sistema === 'SuperAdm') {
          console.log('🚀 STABLE - SuperAdmin detectado por FUNCAO_SISTEMA!');
          isSuperAdmin = true;
          functionName = 'SuperAdm';
          userRole = 'SuperAdm';
        }
        // 5. Usar dados do sistema híbrido para outros casos
        else {
          // Se tem funcao_permissao, usar ela
          if (profile.bd_funcoes_permissao && profile.bd_funcoes_permissao.nome_funcao) {
            functionName = profile.bd_funcoes_permissao.nome_funcao;
            userRole = profile.bd_funcoes_permissao.nome_funcao;
            console.log('🔍 STABLE - Usando funcao_permissao:', functionName);
          }
          // Se tem funcoes array válido, usar o primeiro
          else if (profile.funcoes && Array.isArray(profile.funcoes) && profile.funcoes.length > 0 && profile.funcoes[0] !== 'user') {
            functionName = profile.funcoes[0];
            userRole = profile.funcoes[0];
            console.log('🔍 STABLE - Usando funcoes array:', functionName);
          }
          // Fallback para funcao_sistema
          else if (profile.funcao_sistema && profile.funcao_sistema !== 'Usuário') {
            functionName = profile.funcao_sistema;
            userRole = profile.funcao_sistema;
            console.log('🔍 STABLE - Usando funcao_sistema:', functionName);
          }
          
          console.log('⚠️ STABLE - Usuário não-SuperAdmin:', {
            functionName,
            userRole,
            isSuperAdmin: false
          });
        }

        // Determinar permissões
        let userPermissions: string[] = ['dashboard_view'];
        
        if (isSuperAdmin) {
          console.log('🚀 STABLE - SUPERADMIN CONFIRMADO - LIBERANDO TODOS OS ACESSOS!');
          
          // SuperAdmin = TODAS as permissões do sistema
          userPermissions = [
            'dashboard_view',
            'dashboard_rh_view',
            'dashboard_maquinas_view',
            'dashboard_cbuq_view',
            'gestao_rh_empresas_view',
            'gestao_rh_departamentos_view',
            'gestao_rh_centros_custo_view',
            'gestao_rh_funcoes_view',
            'gestao_rh_funcionarios_view',
            'gestao_rh_equipes_view',
            'gestao_maquinas_caminhoes_view',
            'gestao_maquinas_usinas_view',
            'gestao_maquinas_relatorio_medicao_view',
            'requisicoes_cadastro_view',
            'requisicoes_programacao_entrega_view',
            'requisicoes_registro_cargas_view',
            'requisicoes_registro_aplicacao_view',
            'requisicoes_apontamento_equipe_view',
            'requisicoes_apontamento_caminhoes_view',
            'requisicoes_chamados_os_view',
            'requisicoes_gestao_os_view',
            'admin_permissoes_view',
            'relatorio_aplicacao_view'
          ];
        } else {
          console.log('⚠️ STABLE - Usuário não-SuperAdmin, aplicando permissões básicas para:', userRole);
          userPermissions = ['dashboard_view'];
        }

        // Remover duplicatas
        userPermissions = [...new Set(userPermissions)];

        console.log('✅ STABLE - RESULTADO FINAL:', {
          userId: user.id,
          userRole,
          isSuperAdmin,
          functionName,
          permissionsCount: userPermissions.length,
          permissions: userPermissions
        });

        setState({
          userId: user.id,
          isSuperAdmin,
          userRole,
          permissions: userPermissions,
          isLoading: false,
        });

      } catch (error) {
        console.error('❌ STABLE - Erro ao carregar permissões:', error);
        
        // Fallback de emergência
        const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
        
        setState({
          userId: user?.id || null,
          isSuperAdmin: false,
          userRole: user ? 'user' : null,
          permissions: user ? ['dashboard_view'] : [],
          isLoading: false,
        });
      }
    };

    loadUserPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadUserPermissions();
    });

    return () => subscription.unsubscribe();
  }, []);

  return state;
};
