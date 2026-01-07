
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";

export interface RhSecurityContext {
  departamentoId?: string;
  centroCustoId?: string;
  departamentoNome?: string;
  isLoading: boolean;
  canViewAllData: boolean;
  shouldFilterByDepartment: boolean;
}

export const useRhSecurity = (): RhSecurityContext => {
  const { userId, isSuperAdmin, isLoading: authLoading } = useAuthPermissions();
  const [securityContext, setSecurityContext] = useState<RhSecurityContext>({
    isLoading: true,
    canViewAllData: false,
    shouldFilterByDepartment: false,
  });

  useEffect(() => {
    const fetchUserSecurityContext = async () => {
      if (authLoading) return;

      try {
        setSecurityContext(prev => ({ ...prev, isLoading: true }));

        // SuperAdm SEMPRE tem acesso global - não filtrar por departamento
        if (isSuperAdmin) {
          console.log("🔐 SuperAdmin - acesso total sem filtro departamental");
          setSecurityContext({
            isLoading: false,
            canViewAllData: true,
            shouldFilterByDepartment: false,
          });
          return;
        }

        if (!userId && !isSuperAdmin) {
          console.log("🔐 No user ID - denying access");
          setSecurityContext({
            isLoading: false,
            canViewAllData: false,
            shouldFilterByDepartment: false,
          });
          return;
        }

        // Buscar dados do funcionário logado
        const { data: funcionario, error } = await supabase
          .from("bd_funcionarios")
          .select(`
            departamento_id,
            centro_custo_id,
            bd_departamentos!inner(nome_departamento)
          `)
          .eq("email", (await supabase.auth.getUser()).data.user?.email)
          .single();

        if (error || !funcionario) {
          console.log("🔐 User not found in funcionarios table - denying access");
          setSecurityContext({
            isLoading: false,
            canViewAllData: false,
            shouldFilterByDepartment: false,
          });
          return;
        }

        // Tratar o relacionamento bd_departamentos que pode vir como array ou objeto
        let departamentoNome = "Departamento não identificado";
        
        if (funcionario.bd_departamentos) {
          if (Array.isArray(funcionario.bd_departamentos)) {
            departamentoNome = funcionario.bd_departamentos[0]?.nome_departamento || departamentoNome;
          } else {
            departamentoNome = (funcionario.bd_departamentos as any).nome_departamento || departamentoNome;
          }
        }

        // Determinar se deve filtrar por departamento
        const shouldFilter = isSuperAdmin && !!funcionario.departamento_id;

        console.log("🔐 User security context:", {
          departamentoId: funcionario.departamento_id,
          centroCustoId: funcionario.centro_custo_id,
          departamentoNome,
          isSuperAdmin,
          shouldFilterByDepartment: shouldFilter
        });

        setSecurityContext({
          departamentoId: funcionario.departamento_id || undefined,
          centroCustoId: funcionario.centro_custo_id || undefined,
          departamentoNome,
          isLoading: false,
          canViewAllData: isSuperAdmin && !!funcionario.departamento_id, // SuperAdm Departamental tem acesso ao seu departamento
          shouldFilterByDepartment: shouldFilter,
        });

      } catch (error) {
        console.error("❌ Error fetching user security context:", error);
        setSecurityContext({
          isLoading: false,
          canViewAllData: false,
          shouldFilterByDepartment: false,
        });
      }
    };

    fetchUserSecurityContext();
  }, [userId, isSuperAdmin, authLoading]);

  return securityContext;
};
