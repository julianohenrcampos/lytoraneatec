import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface SimpleAuthGuardProps {
  children: React.ReactNode;
}

/**
 * Guard simplificado: confia no estado consolidado de useAuth.
 * - isLoading: spinner
 * - autenticado ou modo recovery: renderiza children
 * - caso contrário: redireciona para /login
 */
const SimpleAuthGuard: React.FC<SimpleAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, isPasswordRecovery } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando...</span>
      </div>
    );
  }

  if (isAuthenticated || isPasswordRecovery) {
    return <>{children}</>;
  }

  return <Navigate to="/login" replace />;
};

export default SimpleAuthGuard;
