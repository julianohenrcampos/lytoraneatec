import { supabase } from "@/integrations/supabase/client";
import { UserPermissions } from "./permissaoTypes";

/**
 * Service para gerenciar permissões baseado no sistema unificado funcao_permissao
 */
export class UnifiedPermissionsService {
  private static instance: UnifiedPermissionsService;
  private cache: Map<string, UserPermissions> = new Map();
  private cacheTimeout: Map<string, number> = new Map();
  private readonly CACHE_DURATION = 60000; // 1 minuto

  public static getInstance(): UnifiedPermissionsService {
    if (!UnifiedPermissionsService.instance) {
      UnifiedPermissionsService.instance = new UnifiedPermissionsService();
    }
    return UnifiedPermissionsService.instance;
  }

  /**
   * Buscar permissões do usuário baseado no sistema unificado
   */
  async getUserPermissions(userId: string): Promise<UserPermissions> {
    // Verificar cache
    const cached = this.cache.get(userId);
    const cacheTime = this.cacheTimeout.get(userId);
    
    if (cached && cacheTime && Date.now() - cacheTime < this.CACHE_DURATION) {
      console.log('📦 [UnifiedPermissions] Cache hit for user:', userId);
      return cached;
    }

    try {
      console.log('🔍 [UnifiedPermissions] Fetching permissions for user:', userId);
      
      // Buscar perfil do usuário com função de permissão
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          id,
          email,
          nome_completo,
          funcao_permissao,
          bd_funcoes_permissao:funcao_permissao (
            id,
            nome_funcao,
            descricao,
            permissoes
          )
        `)
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('❌ [UnifiedPermissions] Error fetching profile:', profileError);
        throw profileError;
      }

      if (!profile?.bd_funcoes_permissao) {
        console.warn('⚠️ [UnifiedPermissions] User has no function assigned:', userId);
        return {
          userId,
          userRole: 'user',
          permissions: ['dashboard_view'],
        permissionRoutes: ['/'],
          isLoading: false,
          isSuperAdmin: false,
          functionName: 'user'
        };
      }

      const funcaoPermissao = profile.bd_funcoes_permissao as any;
      const isSuperAdmin = funcaoPermissao.nome_funcao === 'SuperAdm';
      
      let permissions: string[] = ['dashboard_view'];
      let permissionRoutes: string[] = ['/'];

      if (isSuperAdmin) {
        // SuperAdmin tem todas as permissões
        permissions = [
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
          'acesso_dashboard_rh',
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
          'registro_aplicacao_view',
          'programacao_entrega_view',
          'admin_permissoes_view',
          'relatorio_aplicacao_view'
        ];
      permissionRoutes = [
          '/',
          '/admin/empresas',
          '/admin/departamentos',
          '/admin/centros-custo',
          '/admin/funcoes',
          '/admin/funcionarios',
          '/admin/equipes',
          '/admin/caminhoes',
          '/admin/usinas',
          '/admin/relatorio-medicao',
          '/requisicoes/cadastro',
          '/requisicoes/programacao-entrega',
          '/requisicoes/registro-cargas',
          '/requisicoes/registro-aplicacao',
          '/requisicoes/apontamento-equipe',
          '/requisicoes/apontamento-caminhoes',
          '/requisicoes/chamados-os',
          '/requisicoes/gestao-os',
          '/admin/permissoes',
          '/relatorio-aplicacao'
        ];
      } else {
        // Buscar permissões específicas da função
        if (funcaoPermissao.permissoes && funcaoPermissao.permissoes.length > 0) {
          const { data: permissoesList, error: permissoesError } = await supabase
            .from('bd_permissoes')
            .select('*')
            .in('id', funcaoPermissao.permissoes);

          if (permissoesError) {
            console.error('❌ [UnifiedPermissions] Error fetching permissions:', permissoesError);
          } else {
            permissions = [
              'dashboard_view',
              ...permissoesList.map(p => p.nome_permissao)
            ];
            permissionRoutes = [
              '/',
              ...permissoesList.filter(p => p.rota).map(p => p.rota!)
            ];
          }
        }
      }

      // Remover duplicatas
      permissions = [...new Set(permissions)];
      permissionRoutes = [...new Set(permissionRoutes)];

      const result: UserPermissions = {
        userId,
        userRole: funcaoPermissao.nome_funcao,
        permissions,
        permissionRoutes,
        isLoading: false,
        isSuperAdmin,
        functionName: funcaoPermissao.nome_funcao
      };

      // Salvar no cache
      this.cache.set(userId, result);
      this.cacheTimeout.set(userId, Date.now());

      console.log('✅ [UnifiedPermissions] Permissions loaded successfully:', result);
      return result;

    } catch (error) {
      console.error('❌ [UnifiedPermissions] Error fetching permissions:', error);
      
      // Fallback para usuário básico
      const fallback: UserPermissions = {
        userId,
        userRole: 'user',
        permissions: ['dashboard_view'],
        permissionRoutes: ['/'],
        isLoading: false,
        isSuperAdmin: false,
        functionName: 'user'
      };

      return fallback;
    }
  }

  /**
   * Verificar se usuário tem permissão específica
   */
  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    
    if (userPermissions.isSuperAdmin) {
      return true;
    }

    return userPermissions.permissions.includes(permission);
  }

  /**
   * Verificar se usuário tem alguma das permissões especificadas
   */
  async hasAnyPermission(userId: string, permissions: string[]): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    
    if (userPermissions.isSuperAdmin) {
      return true;
    }

    return permissions.some(permission => 
      userPermissions.permissions.includes(permission)
    );
  }

  /**
   * Limpar cache do usuário
   */
  clearUserCache(userId: string): void {
    this.cache.delete(userId);
    this.cacheTimeout.delete(userId);
  }

  /**
   * Limpar todo o cache
   */
  clearAllCache(): void {
    this.cache.clear();
    this.cacheTimeout.clear();
  }
}

export const unifiedPermissionsService = UnifiedPermissionsService.getInstance();