
import React from 'react';
import { useSimplePermissions } from '@/hooks/useSimplePermissions';
import { Navigate } from 'react-router-dom';

interface SimplePermissionGuardProps {
  children: React.ReactNode;
}

const SimplePermissionGuard: React.FC<SimplePermissionGuardProps> = ({ children }) => {
  const { canAccessDashboard, isLoading, isSuperAdmin, userRole } = useSimplePermissions();

  console.log('🔐 [SimplePermissionGuard] Estado atual:', { 
    canAccessDashboard, 
    isLoading, 
    isSuperAdmin, 
    userRole 
  });

  if (isLoading) {
    console.log('🔐 [SimplePermissionGuard] Ainda carregando...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Verificando permissões...</span>
      </div>
    );
  }

  // Verificação mais permissiva - só bloquear se explicitamente não tem acesso
  if (!canAccessDashboard) {
    console.log('🔄 [SimplePermissionGuard] Acesso negado - redirecionando para waiting-approval');
    return <Navigate to="/waiting-approval" replace />;
  }

  console.log('✅ [SimplePermissionGuard] Acesso liberado');
  return <>{children}</>;
};

export default SimplePermissionGuard;
