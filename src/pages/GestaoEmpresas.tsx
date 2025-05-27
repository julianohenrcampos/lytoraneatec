
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import EmpresaPage from "@/components/empresas/EmpresaPage";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const GestaoEmpresas: React.FC = () => {
  const { isSuperAdmin } = useUserPermissions();
  const { isLoading, isAuthorized } = usePermissionGuard(
    undefined, // No specific permission string
    "/gestao-rh/empresas" // Required route path
  );
  
  // Exibir mensagem de depuração
  console.log("[GestaoEmpresas] Permission check:", { 
    isLoading, 
    isAuthorized, 
    isSuperAdmin 
  });
  
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
  
  // SuperAdmin ou usuários autorizados podem acessar a página
  if (isSuperAdmin || isAuthorized) {
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
