import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePermission } from '@/hooks/usePermission';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldX } from 'lucide-react';

interface SecureRouteGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  fallbackRoute?: string;
}

const SecureRouteGuard: React.FC<SecureRouteGuardProps> = ({ 
  children, 
  requiredPermission, 
  requiredPermissions,
  fallbackRoute = '/dashboard'
}) => {
  const location = useLocation();
  const { isSuperAdmin, permissions, isLoading, userId } = usePermission();
  
  // Estado para manter permissões válidas anteriores (evita perda durante revalidação)
  const [hasVerifiedOnce, setHasVerifiedOnce] = useState(false);
  const [lastValidPermissions, setLastValidPermissions] = useState<string[]>([]);
  const [lastValidSuperAdmin, setLastValidSuperAdmin] = useState(false);

  // Atualizar estado válido quando permissões carregam com sucesso
  useEffect(() => {
    if (!isLoading && permissions.length > 0) {
      setHasVerifiedOnce(true);
      setLastValidPermissions(permissions);
      setLastValidSuperAdmin(isSuperAdmin);
    }
  }, [isLoading, permissions, isSuperAdmin]);

  // Usar permissões efetivas (atuais ou últimas válidas)
  const effectivePermissions = permissions.length > 0 ? permissions : lastValidPermissions;
  const effectiveSuperAdmin = isSuperAdmin || lastValidSuperAdmin;

  console.log('🔒 [SECURE ROUTE] Verificando acesso:', {
    route: location.pathname,
    requiredPermission,
    requiredPermissions,
    userPermissions: permissions,
    effectivePermissions,
    isSuperAdmin,
    effectiveSuperAdmin,
    hasVerifiedOnce,
    isLoading
  });

  // Durante carregamento inicial
  if (isLoading && !hasVerifiedOnce) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Verificando permissões de acesso...</span>
      </div>
    );
  }

  // Durante revalidação (já verificou antes) - mostrar loading mas NÃO bloquear
  if (isLoading && hasVerifiedOnce) {
    console.log('🔄 [SECURE ROUTE] Revalidando - mantendo acesso anterior');
    // Continua renderizando children com permissões anteriores
  }

  // SuperAdmin sempre tem acesso (atual ou anterior válido)
  if (effectiveSuperAdmin) {
    console.log('✅ [SECURE ROUTE] SuperAdmin - Acesso liberado');
    return <>{children}</>;
  }

  // Verificar se não há usuário autenticado
  if (!userId && !hasVerifiedOnce) {
    console.log('🔄 [SECURE ROUTE] Usuário não autenticado - redirecionando para login');
    return <Navigate to="/login" replace />;
  }

  // Verificar permissão específica usando permissões efetivas
  if (requiredPermission && !effectivePermissions.includes(requiredPermission)) {
    // Só bloquear se nunca teve acesso OU se terminou de carregar sem permissão
    if (!hasVerifiedOnce || (!isLoading && permissions.length > 0)) {
      console.log('❌ [SECURE ROUTE] Permissão negada:', requiredPermission);
      return (
        <div className="flex items-center justify-center min-h-screen p-4">
          <Alert className="max-w-md">
            <ShieldX className="h-4 w-4" />
            <AlertDescription>
              Você não tem permissão para acessar esta página.
              <br />
              <small className="text-muted-foreground">
                Permissão necessária: {requiredPermission}
              </small>
            </AlertDescription>
          </Alert>
        </div>
      );
    }
  }

  // Verificar múltiplas permissões (pelo menos uma) usando permissões efetivas
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasAnyPermission = requiredPermissions.some(perm => effectivePermissions.includes(perm));
    if (!hasAnyPermission) {
      // Só bloquear se nunca teve acesso OU se terminou de carregar sem permissão
      if (!hasVerifiedOnce || (!isLoading && permissions.length > 0)) {
        console.log('❌ [SECURE ROUTE] Nenhuma permissão necessária encontrada:', requiredPermissions);
        return (
          <div className="flex items-center justify-center min-h-screen p-4">
            <Alert className="max-w-md">
              <ShieldX className="h-4 w-4" />
              <AlertDescription>
                Você não tem permissão para acessar esta página.
                <br />
                <small className="text-muted-foreground">
                  Permissões necessárias: {requiredPermissions.join(' ou ')}
                </small>
              </AlertDescription>
            </Alert>
          </div>
        );
      }
    }
  }

  console.log('✅ [SECURE ROUTE] Acesso liberado para:', location.pathname);
  return <>{children}</>;
};

export default SecureRouteGuard;
