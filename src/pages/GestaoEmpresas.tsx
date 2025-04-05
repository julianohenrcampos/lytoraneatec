
import React, { useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import EmpresaPage from "@/components/empresas/EmpresaPage";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";

const GestaoEmpresas: React.FC = () => {
  const { isLoading, isAuthorized } = usePermissionGuard(
    undefined, // No specific permission string
    "/gestao-rh/empresas" // Required route path
  );
  
  // Mostra estado de carregamento enquanto verifica permissões
  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <span className="text-lg">Carregando...</span>
        </div>
      </MainLayout>
    );
  }
  
  // Usuário tem permissão, renderiza a página
  // O hook usePermissionGuard já tratou do redirecionamento caso não tenha permissão
  if (isAuthorized) {
    return (
      <MainLayout>
        <EmpresaPage />
      </MainLayout>
    );
  }
  
  // Caso de fallback, não deveria chegar aqui por causa do usePermissionGuard
  return null;
};

export default GestaoEmpresas;
