
import React from "react";
import MainLayout from "@/components/layout/MainLayout";
import PermissaoPage from "@/components/permissoes/PermissaoPage";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { usePageTitle } from "@/contexts/PageTitleContext";

const GestaoPermissoes: React.FC = () => {
  usePageTitle("Gestão de Permissões");
  // Only allow SuperAdm to access this page
  const { canAccess, isLoading } = usePermissionGuard({
    requiredPermission: "admin_permissoes_view"
  });

  if (isLoading) {
    return <div>Carregando...</div>;
  }

  if (!canAccess) {
    return null; // The hook will handle redirection
  }

  return (
    <MainLayout>
      <PermissaoPage />
    </MainLayout>
  );
};

export default GestaoPermissoes;
