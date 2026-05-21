// =====================================================
// /dev/escopo-debug — Painel de validação do hook useEscopoOperacional
// Gated por: import.meta.env.DEV + usePermission().isSuperAdmin
// NÃO vai a produção. NÃO modifica dados.
// =====================================================

import React, { useEffect, useState } from 'react';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { usePermission } from '@/hooks/usePermission';
import { useEscopoOperacional } from '@/hooks/useEscopoOperacional';

const IS_DEV = import.meta.env.DEV;

const EscopoDebug: React.FC = () => {
  const { isLoading: permLoading, userEmail, userId } = usePermission();
  const escopo = useEscopoOperacional();
  const [codigoBusca, setCodigoBusca] = useState('L498');
  const [ccLookup, setCcLookup] = useState<{
    found: boolean;
    id?: string;
    nome?: string;
    inScope?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!codigoBusca) return;
    (async () => {
      const { data } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .ilike('codigo_centro_custo', codigoBusca.trim())
        .maybeSingle();
      if (!data) {
        setCcLookup({ found: false });
        return;
      }
      setCcLookup({
        found: true,
        id: data.id,
        nome: data.nome_centro_custo,
        inScope: escopo.isGlobal
          ? true
          : escopo.allowedCentroIds.includes(data.id),
      });
    })();
  }, [codigoBusca, escopo.isGlobal, escopo.allowedCentroIds]);

  if (!IS_DEV) {
    return (
      <MainLayout>
        <div className="p-6">Disponível apenas em modo DEV.</div>
      </MainLayout>
    );
  }
  if (permLoading) {
    return (
      <MainLayout>
        <div className="p-6">Carregando permissões…</div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-6 space-y-4 max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>🧪 Debug — Escopo do usuário logado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm font-mono">
            <div>
              <strong>Usuário:</strong> {userEmail} ({userId})
            </div>
            <div className="flex gap-2 items-center">
              <strong>userScope:</strong>{' '}
              <Badge
                variant={
                  escopo.userScope === 'global'
                    ? 'default'
                    : escopo.userScope === 'restrito'
                    ? 'secondary'
                    : 'destructive'
                }
              >
                {escopo.userScope}
              </Badge>
              <strong>isGlobal:</strong> {String(escopo.isGlobal)}{' '}
              <strong>source:</strong> {escopo.source ?? '-'}{' '}
              <strong>isLoading:</strong> {String(escopo.isLoading)}
            </div>
            <div>
              <strong>allowedCentroIds.length:</strong>{' '}
              {escopo.allowedCentroIds.length}
            </div>
            {escopo.debugInfo && (
              <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                {JSON.stringify(escopo.debugInfo, null, 2)}
              </pre>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>🔎 Lookup de Centro de Custo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={codigoBusca}
                onChange={(e) => setCodigoBusca(e.target.value)}
                placeholder="Código (ex.: L498)"
                className="max-w-xs"
              />
              <Button
                variant="outline"
                onClick={() => setCodigoBusca(codigoBusca.trim())}
              >
                Recarregar
              </Button>
            </div>
            {ccLookup && (
              <div className="text-sm font-mono">
                {!ccLookup.found ? (
                  <span className="text-destructive">CC não encontrado.</span>
                ) : (
                  <>
                    <div>
                      <strong>id:</strong> {ccLookup.id}
                    </div>
                    <div>
                      <strong>nome:</strong> {ccLookup.nome}
                    </div>
                    <div>
                      <strong>inScope:</strong>{' '}
                      <Badge
                        variant={ccLookup.inScope ? 'default' : 'destructive'}
                      >
                        {String(ccLookup.inScope)}
                      </Badge>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>📋 allowedCentroIds (primeiros 50)</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-2 rounded text-xs overflow-auto max-h-64">
              {JSON.stringify(escopo.allowedCentroIds.slice(0, 50), null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default EscopoDebug;
