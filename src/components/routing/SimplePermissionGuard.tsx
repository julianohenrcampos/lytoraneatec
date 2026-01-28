import React, { useState, useEffect } from 'react';
import { useDynamicPermissions } from '@/hooks/useDynamicPermissions';
import { Navigate } from 'react-router-dom';

interface SimplePermissionGuardProps {
  children: React.ReactNode;
}

const SimplePermissionGuard: React.FC<SimplePermissionGuardProps> = ({ children }) => {
  const { canAccessDashboard, isLoading, isSuperAdmin, userRole, permissions } = useDynamicPermissions();
  
  // Flag para evitar redirecionamento durante revalidação de permissões
  const [wasEverApproved, setWasEverApproved] = useState(false);

  // Marcar como aprovado quando conseguir acesso
  useEffect(() => {
    if (canAccessDashboard || isSuperAdmin || permissions.length > 0) {
      setWasEverApproved(true);
    }
  }, [canAccessDashboard, isSuperAdmin, permissions]);

  console.log('🔐 [SimplePermissionGuard] Estado atual DINÂMICO:', { 
    canAccessDashboard, 
    isLoading, 
    isSuperAdmin, 
    userRole,
    wasEverApproved,
    permissionsCount: permissions.length
  });

  // Carregamento inicial (nunca teve acesso antes)
  if (isLoading && !wasEverApproved) {
    console.log('🔐 [SimplePermissionGuard] Carregamento inicial...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Verificando permissões dinâmicas...</span>
      </div>
    );
  }

  // Revalidando (já teve acesso antes) - mostrar loading mas NÃO redirecionar
  if (isLoading && wasEverApproved) {
    console.log('🔄 [SimplePermissionGuard] Revalidando - mantendo acesso anterior');
    return (
      <div className="relative">
        {/* Renderiza children normalmente */}
        {children}
        {/* Indicador sutil de revalidação */}
        <div className="fixed bottom-4 right-4 bg-muted/80 text-muted-foreground text-xs px-2 py-1 rounded-md flex items-center gap-2 z-50">
          <div className="animate-spin rounded-full h-3 w-3 border-b border-current"></div>
          Verificando...
        </div>
      </div>
    );
  }

  // Só bloquear se NUNCA teve acesso - isso evita perda de formulários
  if (!canAccessDashboard && !wasEverApproved) {
    console.log('🔄 [SimplePermissionGuard] Primeiro acesso negado - redirecionando para waiting-approval');
    return <Navigate to="/waiting-approval" replace />;
  }

  // Se já teve acesso antes, mas agora não tem, ainda assim permitir
  // (isso protege contra falhas temporárias de rede)
  if (!canAccessDashboard && wasEverApproved) {
    console.log('⚠️ [SimplePermissionGuard] Permissão perdida mas já foi aprovado - MANTENDO acesso');
  }

  console.log('✅ [SimplePermissionGuard] Acesso liberado via sistema dinâmico');
  return <>{children}</>;
};

export default SimplePermissionGuard;
