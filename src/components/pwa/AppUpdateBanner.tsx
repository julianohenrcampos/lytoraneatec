import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';

export function AppUpdateBanner() {
  const { updateAvailable, reload, dismiss } = useAppVersionCheck();

  if (!updateAvailable) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground"
    >
      <div className="flex items-center gap-2 min-w-0">
        <RefreshCw className="h-4 w-4 shrink-0 text-primary" />
        <span className="truncate">
          Nova versão do sistema disponível. Clique para atualizar.
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button size="sm" onClick={reload}>
          Atualizar agora
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={dismiss}
          aria-label="Adiar atualização"
          className="gap-1"
        >
          <X className="h-4 w-4" />
          <span className="hidden sm:inline">Depois</span>
        </Button>
      </div>
    </div>
  );
}

export default AppUpdateBanner;
