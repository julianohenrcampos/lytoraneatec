
import { getUserPermissions } from "@/services/permissaoService";
import { supabase } from "@/integrations/supabase/client";
import { ProfileType } from "@/types/permissao";

// This utility is for diagnosing permission issues
export const diagnosePermissions = async () => {
  try {
    console.group("🔍 Permission Diagnostics");
    
    // Check if user is authenticated
    const { data: sessionData } = await supabase.auth.getSession();
    
    if (!sessionData.session) {
      console.log("❌ User not authenticated");
      console.groupEnd();
      return;
    }
    
    const userId = sessionData.session.user.id;
    console.log("✅ User authenticated", userId);
    
    // Check user profile
    const { data: userData, error: userError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    
    if (userError) {
      console.error("❌ Error fetching user profile:", userError);
      console.groupEnd();
      return;
    }
    
    const profile = userData as unknown as ProfileType;
    
    console.log("👤 User profile:", profile);
    console.log("🔑 User roles array:", profile.funcoes || []);
    console.log("🔑 User main role ID:", profile.funcao_permissao || "Not set");
    
    // Check if user is SuperAdm
    const isSuperAdmin = profile.funcoes?.includes("SuperAdm");
    console.log("👑 Is SuperAdmin:", isSuperAdmin ? "Yes" : "No");
    
    // Check main role
    if (profile.funcao_permissao) {
      const { data: mainRoleData, error: mainRoleError } = await supabase
        .from("bd_funcoes_permissao")
        .select("*")
        .eq("id", profile.funcao_permissao)
        .single();
      
      if (mainRoleError) {
        console.error("❌ Error fetching main role:", mainRoleError);
      } else {
        console.log("🔐 Main role configuration:", mainRoleData);
        
        // Check permission IDs from main role
        const permissionIds = mainRoleData?.permissoes || [];
        
        if (permissionIds.length > 0) {
          const { data: permissionsData } = await supabase
            .from("bd_permissoes")
            .select("*")
            .in("id", permissionIds);
          
          console.log("🔐 Main role permission details:", permissionsData);
        } else {
          console.log("⚠️ No permissions assigned to main role");
        }
      }
    } else {
      console.log("⚠️ User has no main role assigned");
    }
    
    if (!isSuperAdmin) {
      // Get user permissions
      try {
        const userPermissions = await getUserPermissions(userId);
        console.log("📋 User permissions:", userPermissions);
        
        // Check roles in funcoes_permissao table for the roles array
        if (profile.funcoes && profile.funcoes.length > 0) {
          const { data: rolesData } = await supabase
            .from("bd_funcoes_permissao")
            .select("*")
            .in("nome_funcao", profile.funcoes);
          
          console.log("🔐 User roles configuration:", rolesData);
          
          // Check permission mappings
          const rolePermissionIds = rolesData?.flatMap(r => r.permissoes || []) || [];
          
          if (rolePermissionIds.length > 0) {
            const { data: permissionsData } = await supabase
              .from("bd_permissoes")
              .select("*")
              .in("id", rolePermissionIds);
            
            console.log("🔐 Roles permission details:", permissionsData);
          } else {
            console.log("⚠️ No permissions assigned to user roles");
          }
        }
      } catch (error) {
        console.error("❌ Error fetching user permissions:", error);
      }
    }
    
    // Get all available permissions for reference
    const { data: allPermissions } = await supabase
      .from("bd_permissoes")
      .select("*")
      .order("nome_permissao");
    
    console.log("📚 All available permissions:", allPermissions);
    
    // Get all available roles for reference
    const { data: allRoles } = await supabase
      .from("bd_funcoes_permissao")
      .select("*")
      .order("nome_funcao");
    
    console.log("📚 All available roles:", allRoles);
    
  } catch (error) {
    console.error("❌ Error in permission diagnostics:", error);
  } finally {
    console.groupEnd();
  }
};
