
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthPermissions } from '@/hooks/useAuthPermissions';
import { Navigate } from 'react-router-dom';

interface AuthGuardProps {
  children: React.ReactNode;
}

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { userId, isLoading: authLoading } = useAuth();
  const { userRole, isLoading: permissionsLoading } = useAuthPermissions();

  // Aguardar carregamento da autenticação e permissões
  if (authLoading || permissionsLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  // Se não está autenticado, redirecionar para login
  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  // Se está autenticado mas não tem função de permissão, redirecionar para página de aprovação
  if (!userRole) {
    return <Navigate to="/waiting-approval" replace />;
  }

  // Se tem função de permissão, permitir acesso
  return <>{children}</>;
};

export default AuthGuard;
