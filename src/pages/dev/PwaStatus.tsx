import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePermission } from '@/hooks/usePermission';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { APP_BUILD_ID } from '@/lib/version';
import {
  checkForServiceWorkerUpdate,
  clearAppCaches,
  getRegisteredServiceWorker,
  listAppCaches,
} from '@/lib/pwa/registerSW';
import { toast } from '@/hooks/use-toast';
import { RefreshCw, Trash2, RotateCw } from 'lucide-react';

type SWState = 'sem-suporte' | 'nao-registrado' | 'installing' | 'waiting' | 'active' | 'redundant';

function describeSW(reg: ServiceWorkerRegistration | null): SWState {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return 'sem-suporte';
  if (!reg) return 'nao-registrado';
  if (reg.installing) return 'installing';
  if (reg.waiting) return 'waiting';
  if (reg.active) return 'active';
  return 'redundant';
}

export default function PwaStatus() {
  usePageTitle('Diagnóstico PWA');
  const navigate = useNavigate();
  const { isSuperAdmin, isLoading: loading } = usePermission();

  const [swState, setSwState] = useState<SWState>('nao-registrado');
  const [scope, setScope] = useState<string>('-');
  const [manifestOk, setManifestOk] = useState<boolean | null>(null);
  const [cachesList, setCachesList] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const reg = await getRegisteredServiceWorker();
    setSwState(describeSW(reg));
    setScope(reg?.scope ?? '-');
    setCachesList(await listAppCaches());
    try {
      const res = await fetch('/manifest.webmanifest', { cache: 'no-store' });
      setManifestOk(res.ok);
    } catch {
      setManifestOk(false);
    }
  }, []);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate('/', { replace: true });
      return;
    }
    if (!loading && isSuperAdmin) void refresh();
  }, [loading, isSuperAdmin, navigate, refresh]);

  const handleCheckUpdate = async () => {
    setBusy(true);
    try {
      await checkForServiceWorkerUpdate();
      await refresh();
      toast({ title: 'Verificação concluída', description: 'Atualização do SW solicitada.' });
    } finally {
      setBusy(false);
    }
  };

  const handleClearCaches = async () => {
    setBusy(true);
    try {
      const n = await clearAppCaches();
      await refresh();
      toast({
        title: 'Caches limpos',
        description: `${n} cache(s) do app removido(s). IndexedDB e filas offline preservados.`,
      });
    } finally {
      setBusy(false);
    }
  };

  const handleReload = () => window.location.reload();

  if (loading) return <MainLayout><div className="p-6">Carregando...</div></MainLayout>;
  if (!isSuperAdmin) return null;

  return (
    <MainLayout>
      <div className="space-y-4 p-2 md:p-4">
        <Card>
          <CardHeader>
            <CardTitle>Service Worker</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Estado:</span> <Badge variant="outline">{swState}</Badge></div>
            <div><span className="text-muted-foreground">Scope:</span> <code>{scope}</code></div>
            <div><span className="text-muted-foreground">Build ID:</span> <code>{APP_BUILD_ID}</code></div>
            <div>
              <span className="text-muted-foreground">Manifest:</span>{' '}
              {manifestOk === null ? '...' : <Badge variant={manifestOk ? 'default' : 'destructive'}>{manifestOk ? 'OK' : 'Ausente'}</Badge>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caches do app ({cachesList.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {cachesList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum cache lyto-* registrado.</p>
            ) : (
              <ul className="text-sm font-mono space-y-1">
                {cachesList.map((c) => <li key={c}>{c}</li>)}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ações</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button onClick={handleCheckUpdate} disabled={busy} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Verificar atualização
            </Button>
            <Button onClick={handleClearCaches} disabled={busy} variant="outline">
              <Trash2 className="h-4 w-4 mr-2" /> Limpar cache do app
            </Button>
            <Button onClick={handleReload} disabled={busy}>
              <RotateCw className="h-4 w-4 mr-2" /> Recarregar aplicação
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          A limpeza de cache remove apenas entradas com prefixo <code>lyto-</code>. IndexedDB,
          localStorage e filas offline (apontamentos, ponto) são preservados.
        </p>
      </div>
    </MainLayout>
  );
}
