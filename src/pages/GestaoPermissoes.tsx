
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import PermissaoPage from "@/components/permissoes/PermissaoPage";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";

const GestaoPermissoes: React.FC = () => {
  // Only allow SuperAdm to access this page
  const { isLoading, isAuthorized } = usePermissionGuard();

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (!isAuthorized) {
    return null; // The hook will handle redirection
  }

  return (
    <MainLayout>
      <PermissaoPage />
    </MainLayout>
  );
};

export default GestaoPermissoes;
