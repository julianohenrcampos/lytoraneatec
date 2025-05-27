
import { supabase } from "@/integrations/supabase/client";

interface UserPermissionsResult {
  roles: string[];
  permissions: string[];
  permissionRoutes: string[];
  mainRoleId: string | null;
}

/**
 * Enhanced service for fetching user permissions with improved error handling and fallbacks
 */
export const getUserPermissions = async (userId: string): Promise<UserPermissionsResult> => {
  try {
    console.log("🔍 Fetching user permissions for:", userId);
    
    // Get user profile with enhanced error handling
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("funcoes, funcao_permissao")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.warn("⚠️ Profile fetch error:", profileError);
      // Return minimal fallback for authenticated users
      return {
        roles: ['user'],
        permissions: ['dashboard_view'],
        permissionRoutes: ['/dashboard', '/'],
        mainRoleId: null
      };
    }

    if (!profile) {
      console.warn("⚠️ No profile found for user:", userId);
      return {
        roles: ['user'],
        permissions: ['dashboard_view'],
        permissionRoutes: ['/dashboard', '/'],
        mainRoleId: null
      };
    }

    console.log("👤 User profile:", { 
      funcoes: profile.funcoes, 
      funcao_permissao: profile.funcao_permissao 
    });

    let roles: string[] = [];
    let permissions: string[] = [];
    let permissionRoutes: string[] = [];
    let mainRoleId: string | null = null;

    // Handle funcoes array (legacy role system)
    if (profile.funcoes && Array.isArray(profile.funcoes)) {
      roles = profile.funcoes.filter(Boolean); // Remove null/undefined values
      console.log("📋 Legacy roles from funcoes:", roles);
    }

    // Handle funcao_permissao (new permission system)
    if (profile.funcao_permissao) {
      try {
        console.log("🔄 Fetching role permissions for:", profile.funcao_permissao);
        
        const { data: rolePermissions, error: roleError } = await supabase
          .from("bd_funcoes_permissao")
          .select(`
            id,
            nome_funcao,
            permissoes
          `)
          .eq("id", profile.funcao_permissao)
          .single();

        if (roleError) {
          console.warn("⚠️ Role permissions fetch error:", roleError);
        } else if (rolePermissions) {
          mainRoleId = rolePermissions.id;
          
          // Add the role name to roles array if not already present
          if (rolePermissions.nome_funcao && !roles.includes(rolePermissions.nome_funcao)) {
            roles.push(rolePermissions.nome_funcao);
          }

          console.log("🎭 Main role:", rolePermissions.nome_funcao);
          
          // Fetch detailed permissions
          if (rolePermissions.permissoes && rolePermissions.permissoes.length > 0) {
            console.log("🔄 Fetching detailed permissions...");
            
            const { data: detailedPermissions, error: permError } = await supabase
              .from("bd_permissoes")
              .select("nome_permissao, rota")
              .in("id", rolePermissions.permissoes);

            if (permError) {
              console.warn("⚠️ Detailed permissions fetch error:", permError);
            } else if (detailedPermissions) {
              permissions = detailedPermissions
                .map(p => p.nome_permissao)
                .filter(Boolean);
              
              permissionRoutes = detailedPermissions
                .map(p => p.rota)
                .filter(Boolean);

              console.log("🔑 Fetched permissions:", permissions);
              console.log("🛣️ Permission routes:", permissionRoutes);
            }
          }
        }
      } catch (error) {
        console.error("❌ Error fetching role permissions:", error);
      }
    }

    // Apply role-based fallbacks if no specific permissions found
    if (permissions.length === 0 && roles.length > 0) {
      console.log("🔄 Applying role-based permission fallbacks");
      
      const rolePermissionFallbacks: Record<string, string[]> = {
        'AdmRH': ['dashboard_view', 'acesso_dashboard_rh'],
        'AdmEquipamentos': ['dashboard_view', 'gestao_maquinas_relatorio_medicao_view'],
        'AdmRequisicoes': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view'],
        'AdmLogistica': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view', 'gestao_maquinas_relatorio_medicao_view'],
        'AdmAdmin': ['dashboard_view', 'acesso_gestao_permissoes'],
        'Apontador': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view'],
        'Encarregado': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view', 'apontamento_equipe_view', 'gestao_maquinas_relatorio_medicao_view'],
        'Engenheiro Civil': ['dashboard_view', 'registro_aplicacao_view', 'programacao_entrega_view', 'registro_cargas_view']
      };

      const routeFallbacks: Record<string, string[]> = {
        'AdmRH': ['/dashboard', '/', '/gestao-rh/dashboard'],
        'AdmEquipamentos': ['/dashboard', '/', '/gestao-maquinas/relatorio-medicao'],
        'AdmRequisicoes': ['/dashboard', '/', '/requisicoes/registro-aplicacao', '/requisicoes/programacao-entrega'],
        'AdmLogistica': ['/dashboard', '/', '/requisicoes/registro-aplicacao', '/requisicoes/programacao-entrega', '/gestao-maquinas/relatorio-medicao'],
        'AdmAdmin': ['/dashboard', '/', '/admin/permissoes'],
        'Apontador': ['/dashboard', '/', '/requisicoes/registro-aplicacao', '/requisicoes/programacao-entrega'],
        'Encarregado': ['/dashboard', '/', '/requisicoes/registro-aplicacao', '/requisicoes/programacao-entrega', '/requisicoes/apontamento-equipe', '/gestao-maquinas/relatorio-medicao'],
        'Engenheiro Civil': ['/dashboard', '/', '/requisicoes/registro-aplicacao', '/requisicoes/programacao-entrega', '/requisicoes/registro-cargas']
      };

      roles.forEach(role => {
        const rolePerms = rolePermissionFallbacks[role] || [];
        const roleRoutes = routeFallbacks[role] || [];
        
        permissions = [...permissions, ...rolePerms];
        permissionRoutes = [...permissionRoutes, ...roleRoutes];
      });

      // Remove duplicates
      permissions = [...new Set(permissions)];
      permissionRoutes = [...new Set(permissionRoutes)];
      
      console.log("✅ Applied fallback permissions:", permissions);
      console.log("✅ Applied fallback routes:", permissionRoutes);
    }

    // Ensure basic dashboard access for all authenticated users
    if (!permissions.includes('dashboard_view')) {
      permissions.push('dashboard_view');
    }
    if (!permissionRoutes.includes('/dashboard')) {
      permissionRoutes.push('/dashboard');
    }
    if (!permissionRoutes.includes('/')) {
      permissionRoutes.push('/');
    }

    const result = {
      roles,
      permissions,
      permissionRoutes,
      mainRoleId
    };

    console.log("✅ Final user permissions result:", result);
    return result;

  } catch (error) {
    console.error("❌ Unexpected error fetching user permissions:", error);
    
    // Return minimal fallback permissions for authenticated users
    return {
      roles: ['user'],
      permissions: ['dashboard_view'],
      permissionRoutes: ['/dashboard', '/'],
      mainRoleId: null
    };
  }
};
