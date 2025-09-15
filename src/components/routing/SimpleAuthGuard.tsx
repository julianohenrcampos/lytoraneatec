
// src/components/routing/SimpleAuthGuard.tsx
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Navigate } from 'react-router-dom';

interface SimpleAuthGuardProps {
  children: React.ReactNode;
}

const SimpleAuthGuard: React.FC<SimpleAuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isLoading, userId, isPasswordRecovery } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando…</span>
      </div>
    );
  }

  if (!isAuthenticated || !userId) {
    if (isPasswordRecovery) return <>{children}</>;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

export default SimpleAuthGuard;
