
import React, { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

interface RouteProtectionProps {
  children: React.ReactNode;
  fallbackRoute?: string;
}

const RouteProtection: React.FC<RouteProtectionProps> = ({ 
  children, 
  fallbackRoute = "/dashboard" 
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    // Verificar se a rota atual é válida
    const validRoutes = [
      "/",
      "/dashboard",
      "/dashboard1",
      "/gestao-rh/dashboard",
      "/gestao-rh/empresas",
      "/gestao-rh/departamentos",
      "/gestao-rh/centros-custo",
      "/gestao-rh/funcoes",
      "/gestao-rh/funcionarios",
      "/gestao-rh/equipes",
      "/gestao-maquinas/caminhoes-equipamentos",
      "/gestao-maquinas/usinas",
      "/gestao-maquinas/relatorio-medicao",
      "/requisicoes/cadastro",
      "/requisicoes/programacao-entrega",
      "/requisicoes/registro-cargas",
      "/requisicoes/registro-aplicacao",
      "/requisicoes/apontamento-equipe",
      "/requisicoes/apontamento-caminhoes",
      "/requisicoes/chamados-os",
      "/requisicoes/gestao-os",
      "/admin/permissoes",
      "/login",
      "/register",
      "/forgot-password",
      "/reset-password"
    ];

    const isValidRoute = validRoutes.includes(location.pathname);
    
    // Se a rota não for válida e não for uma rota de auth
    if (!isValidRoute && !location.pathname.includes('/auth/')) {
      console.warn(`Rota inválida detectada: ${location.pathname}, redirecionando para ${fallbackRoute}`);
      
      toast({
        title: "Redirecionamento",
        description: "Você foi redirecionado para uma página segura",
        variant: "default",
      });
      
      navigate(fallbackRoute, { replace: true });
    }
  }, [location.pathname, navigate, fallbackRoute, toast]);

  return <>{children}</>;
};

export default RouteProtection;
