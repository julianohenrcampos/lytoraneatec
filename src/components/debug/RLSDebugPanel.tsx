
import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRLSPermissions } from '@/hooks/useRLSPermissions';

export const RLSDebugPanel: React.FC = () => {
  const [debugData, setDebugData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const rlsPermissions = useRLSPermissions();

  const runRLSDebug = async () => {
    setIsLoading(true);
    try {
      console.log('🔍 Executando debug RLS...');
      
      // Chamar função de debug do Supabase
      const { data, error } = await supabase.rpc('debug_user_access');
      
      if (error) {
        console.error('Erro no debug RLS:', error);
        setDebugData({ error: error.message });
      } else {
        console.log('Debug RLS resultado:', data);
        setDebugData(data);
      }
    } catch (error: any) {
      console.error('Exceção no debug RLS:', error);
      setDebugData({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  if (process.env.NODE_ENV === 'production') {
    return null; // Não mostrar em produção
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          🔍 RLS Debug Panel
          <Button 
            onClick={runRLSDebug} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            {isLoading ? 'Carregando...' : 'Debug RLS'}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Estado atual do hook */}
        <div>
          <h4 className="font-medium mb-2">Estado do Hook RLS:</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <strong>User ID:</strong> {rlsPermissions.userId || 'Nenhum'}
            </div>
            <div>
              <strong>SuperAdmin:</strong> 
              <Badge variant={rlsPermissions.isSuperAdmin ? "default" : "secondary"}>
                {rlsPermissions.isSuperAdmin ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div>
              <strong>Role:</strong> {rlsPermissions.userRole || 'Nenhuma'}
            </div>
            <div>
              <strong>Loading:</strong> 
              <Badge variant={rlsPermissions.isLoading ? "destructive" : "default"}>
                {rlsPermissions.isLoading ? 'Sim' : 'Não'}
              </Badge>
            </div>
            <div className="col-span-2">
              <strong>Permissões:</strong> {rlsPermissions.permissions.join(', ') || 'Nenhuma'}
            </div>
            <div className="col-span-2">
              <strong>Equipes:</strong> {rlsPermissions.allowedTeams.join(', ') || 'Nenhuma'}
            </div>
          </div>
        </div>

        {/* Resultado do debug RLS */}
        {debugData && (
          <div>
            <h4 className="font-medium mb-2">Debug RLS Database:</h4>
            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-60">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </div>
        )}

        {/* Instruções de uso */}
        <div className="text-xs text-gray-600 space-y-1">
          <p><strong>Como usar:</strong></p>
          <p>• Clique em "Debug RLS" para executar a função debug_user_access() do banco</p>
          <p>• Compare os dados do hook com os dados do banco</p>
          <p>• Verifique se as permissões estão sendo aplicadas corretamente</p>
          <p>• Este painel só aparece em desenvolvimento</p>
        </div>
      </CardContent>
    </Card>
  );
};
