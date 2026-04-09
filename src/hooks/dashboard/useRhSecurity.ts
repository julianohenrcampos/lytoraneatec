
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePermission } from "@/hooks/usePermission";

export interface RhSecurityContext {
  departamentoId?: string;
  centroCustoId?: string;
  centroCustoIds?: string[];
  departamentoNome?: string;
  isLoading: boolean;
  canViewAllData: boolean;
  shouldFilterByDepartment: boolean;
  shouldFilterByCentroCusto: boolean;
}

export const useRhSecurity = (): RhSecurityContext => {
  const { userId, isSuperAdmin, isLoading: authLoading } = usePermission();
  const [securityContext, setSecurityContext] = useState<RhSecurityContext>({
    isLoading: true,
    canViewAllData: false,
    shouldFilterByDepartment: false,
    shouldFilterByCentroCusto: false,
  });

  useEffect(() => {
    const fetchUserSecurityContext = async () => {
      if (authLoading) return;

      try {
        setSecurityContext(prev => ({ ...prev, isLoading: true }));

        // SuperAdm SEMPRE tem acesso global
        if (isSuperAdmin) {
          console.log("🔐 SuperAdmin - acesso total sem filtro departamental");
          setSecurityContext({
            isLoading: false,
            canViewAllData: true,
            shouldFilterByDepartment: false,
            shouldFilterByCentroCusto: false,
          });
          return;
        }

        if (!userId && !isSuperAdmin) {
          console.log("🔐 No user ID - denying access");
          setSecurityContext({
            isLoading: false,
            canViewAllData: false,
            shouldFilterByDepartment: false,
            shouldFilterByCentroCusto: false,
          });
          return;
        }

        // Verificar funcoes do usuario
        const { data: profile } = await supabase
          .from("profiles")
          .select("funcoes")
          .eq("id", userId)
          .single();

        const funcoes = (profile?.funcoes as string[]) || [];
        const GLOBAL_ACCESS_ROLES = ['AdmRH', 'AdmSSO', 'AdmOBRA', 'TecEnferSSO', 'ConsultaExames', 'AdmtreinoSSO'];
        const hasGlobalRole = funcoes.some(f => GLOBAL_ACCESS_ROLES.includes(f));

        if (hasGlobalRole) {
          console.log("🔐 Papel com acesso global detectado:", funcoes.filter(f => GLOBAL_ACCESS_ROLES.includes(f)));
          setSecurityContext({
            isLoading: false,
            canViewAllData: true,
            shouldFilterByDepartment: false,
            shouldFilterByCentroCusto: false,
          });
          return;
        }

        // AdmSede: filtrar por centros de custo gerenciados
        if (funcoes.includes('AdmSede')) {
          console.log("🔐 AdmSede detectado - buscando CCs gerenciados");
          const { data: ccIds, error: ccError } = await supabase.rpc('get_admsede_centros_custo', {
            p_user_id: userId!,
          });

          if (!ccError && ccIds && (ccIds as string[]).length > 0) {
            console.log("🔐 AdmSede CCs:", ccIds);
            setSecurityContext({
              centroCustoIds: ccIds as string[],
              isLoading: false,
              canViewAllData: false,
              shouldFilterByDepartment: false,
              shouldFilterByCentroCusto: true,
            });
            return;
          }
        }

        // Buscar dados do funcionário logado para filtro departamental
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
            shouldFilterByCentroCusto: false,
          });
          return;
        }

        let departamentoNome = "Departamento não identificado";
        if (funcionario.bd_departamentos) {
          if (Array.isArray(funcionario.bd_departamentos)) {
            departamentoNome = funcionario.bd_departamentos[0]?.nome_departamento || departamentoNome;
          } else {
            departamentoNome = (funcionario.bd_departamentos as any).nome_departamento || departamentoNome;
          }
        }

        const shouldFilter = !isSuperAdmin && !!funcionario.departamento_id;

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
          canViewAllData: false,
          shouldFilterByDepartment: shouldFilter,
          shouldFilterByCentroCusto: false,
        });

      } catch (error) {
        console.error("❌ Error fetching user security context:", error);
        setSecurityContext({
          isLoading: false,
          canViewAllData: false,
          shouldFilterByDepartment: false,
          shouldFilterByCentroCusto: false,
        });
      }
    };

    fetchUserSecurityContext();
  }, [userId, isSuperAdmin, authLoading]);

  return securityContext;
};
