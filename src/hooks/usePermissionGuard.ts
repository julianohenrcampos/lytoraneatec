
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { useAuth } from "@/hooks/useAuth";

export const usePermissionGuard = (requiredPermission?: string, requiredRoute?: string) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { isAuthenticated, isLoading: authLoading, authError } = useAuth();
  const { canAccessRoute } = useRouteAccess();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        setIsLoading(true);
        
        // Se houver erro de autenticação, redirecionar para o login
        if (authError) {
          console.error("Auth error detected:", authError);
          toast({
            title: "Erro de autenticação",
            description: "Por favor, faça login novamente",
            variant: "destructive"
          });
          navigate("/login");
          return;
        }
        
        // Verifica se o usuário está autenticado
        const { data: sessionData } = await supabase.auth.getSession();
        
        if (!sessionData.session) {
          console.log("Redirecionando para login - usuário não autenticado");
          navigate("/login");
          return;
        }
        
        // Se nenhuma permissão específica ou rota for necessária, apenas verifica autenticação
        if (!requiredPermission && !requiredRoute) {
          console.log("Sem permissão ou rota específica necessária, autorizando");
          setIsAuthorized(true);
          setIsLoading(false);
          return;
        }
        
        // Se há uma rota específica necessária, verifica acesso
        if (requiredRoute) {
          const hasAccess = canAccessRoute(requiredRoute);
          setIsAuthorized(hasAccess);
          
          console.log("Permission Guard Check for route:", {
            requiredRoute,
            hasAccess
          });
          
          if (!hasAccess) {
            console.log("Acesso negado à rota:", requiredRoute);
            toast({
              title: "Acesso restrito",
              description: "Você não tem permissão para acessar esta página",
              variant: "destructive"
            });
            navigate("/dashboard");
          }
        }
        
      } catch (error: any) {
        console.error("Permission check error:", error);
        toast({
          title: "Erro ao verificar permissões",
          description: error.message || "Ocorreu um erro ao verificar suas permissões",
          variant: "destructive"
        });
        setIsAuthorized(false);
        navigate("/login");
      } finally {
        setIsLoading(false);
      }
    };
    
    // Apenas executa a verificação se o carregamento da autenticação estiver completo
    if (!authLoading) {
      checkAuth();
    }
  }, [navigate, requiredPermission, requiredRoute, toast, canAccessRoute, authLoading, authError, isAuthenticated]);
  
  return { isLoading: isLoading || authLoading, isAuthorized };
};
