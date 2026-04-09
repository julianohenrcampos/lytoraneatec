import React from 'react';
import { usePermission } from '@/hooks/usePermission';

type Acao = 'visualizar' | 'criar' | 'editar' | 'excluir' | 'aprovar';

interface ActionGuardProps {
  permission: string;
  action: Acao;
  children: React.ReactNode;
  /** If true, renders children but disabled (default: hides completely) */
  disableOnly?: boolean;
  /** Fallback to render when access denied */
  fallback?: React.ReactNode;
}

/**
 * Wrapper component that controls visibility/interactivity based on granular permissions.
 * 
 * Usage:
 * <ActionGuard permission="gestao_rh_funcionarios_view" action="editar">
 *   <Button>Editar</Button>
 * </ActionGuard>
 */
const ActionGuard: React.FC<ActionGuardProps> = ({
  permission,
  action,
  children,
  disableOnly = false,
  fallback = null,
}) => {
  const { hasActionPermission, isLoading } = usePermission();

  if (isLoading) return null;

  const allowed = hasActionPermission(permission, action);

  if (!allowed) {
    if (disableOnly) {
      return (
        <div style={{ opacity: 0.5, pointerEvents: 'none' }}>
          {children}
        </div>
      );
    }
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

export default ActionGuard;
