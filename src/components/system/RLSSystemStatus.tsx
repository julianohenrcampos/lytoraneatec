
import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, CheckCircle, AlertTriangle } from 'lucide-react';
import { useRLSPermissions } from '@/hooks/useRLSPermissions';

const RLSSystemStatus: React.FC = () => {
  const { isSuperAdmin, userRole, permissions, isLoading } = useRLSPermissions();

  if (isLoading) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 font-medium">
          🔐 Sistema RLS Dinâmico carregando permissões...
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {isSuperAdmin ? (
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 font-medium">
            ✅ <strong>Sistema RLS Ativo</strong> - SuperAdmin com acesso total ({permissions.length} permissões)
          </AlertDescription>
        </Alert>
      ) : (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 font-medium">
            🔒 <strong>Sistema RLS Restritivo</strong> - Função: {userRole} 
            <br />
            <small className="text-orange-600">
              Acesso limitado aos próprios registros ({permissions.length} permissões)
            </small>
          </AlertDescription>
        </Alert>
      )}
      
      <div className="text-xs text-muted-foreground bg-gray-50 p-2 rounded">
        <strong>RLS Status:</strong> Políticas dinâmicas ativas | 
        <strong> Usuário:</strong> {userRole} | 
        <strong> Permissões:</strong> {permissions.join(', ')}
      </div>
    </div>
  );
};

export default RLSSystemStatus;
