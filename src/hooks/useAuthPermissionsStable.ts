
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

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

        // Query para buscar o perfil com novo sistema
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select(`
            id, 
            nome_completo, 
            funcao_permissao,
            bd_funcoes_permissao:funcao_permissao (
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

        console.log('📋 STABLE - Perfil encontrado:', profile);

        // Sistema de permissões baseado no novo sistema unificado
        let userRole: string | null = null;
        let isSuperAdmin = false;
        let userPermissions: string[] = ['dashboard_view'];

        if (profile?.bd_funcoes_permissao) {
          const funcaoPermissao = profile.bd_funcoes_permissao as any;
          userRole = funcaoPermissao.nome_funcao;
          isSuperAdmin = funcaoPermissao.nome_funcao === 'SuperAdm';
          
          console.log('🔍 STABLE - Função encontrada:', userRole);
          
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
              'requisicoes_registro_cargas_view',
              'requisicoes_apontamento_equipe_view',
              'requisicoes_apontamento_caminhoes_view',
              'requisicoes_chamados_os_view',
              'requisicoes_gestao_os_view',
              'registro_aplicacao_view',
              'programacao_entrega_view',
              'admin_permissoes_view'
            ];
          } else {
            // Buscar permissões específicas da função
            if (funcaoPermissao.permissoes && funcaoPermissao.permissoes.length > 0) {
              try {
                const { data: permissoesList, error: permissoesError } = await supabase
                  .from('bd_permissoes')
                  .select('*')
                  .in('id', funcaoPermissao.permissoes);

                if (permissoesError) {
                  console.error('❌ STABLE - Erro ao buscar permissões:', permissoesError);
                } else {
                  userPermissions = [
                    'dashboard_view',
                    ...permissoesList.map(p => p.nome_permissao)
                  ];
                }
              } catch (error) {
                console.error('❌ STABLE - Erro na consulta de permissões:', error);
              }
            } else {
              console.log('⚠️ STABLE - Função sem permissões específicas atribuídas');
            }
          }
        } else {
          console.log('⚠️ STABLE - Nenhuma função encontrada, aplicando usuário básico');
          userRole = 'user';
        }

        // Remover duplicatas
        userPermissions = [...new Set(userPermissions)];

        console.log('✅ STABLE - RESULTADO FINAL:', {
          userId: user.id,
          userRole,
          isSuperAdmin,
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
