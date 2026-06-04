import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useAppVersionCheck } from '@/hooks/useAppVersionCheck';
import { cn } from '@/lib/utils';

/**
 * Botão discreto na navbar que aparece apenas quando há nova versão disponível.
 * Reutiliza integralmente o fluxo de useAppVersionCheck (SKIP_WAITING -> controllerchange -> reload único).
 */
export function AppUpdateButton() {
  const { updateAvailable, reload, dismiss } = useAppVersionCheck();
  const [isUpdating, setIsUpdating] = useState(false);

  if (!updateAvailable) return null;

  const handleClick = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    // reload() ativa o SW em waiting; controllerchange dispara reload único.
    // Se não houver SW em waiting, faz window.location.reload() direto.
    try {
      reload();
    } catch {
      setIsUpdating(false);
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              onClick={handleClick}
              disabled={isUpdating}
              className="gap-1.5"
              aria-label={isUpdating ? 'Atualizando aplicação' : 'Aplicar nova atualização'}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  isUpdating ? 'animate-spin' : 'animate-pulse'
                )}
              />
              <span className="hidden sm:inline">
                {isUpdating ? 'Atualizando...' : 'Nova atualização'}
              </span>
              <span className="sm:hidden">
                {isUpdating ? '...' : 'Atualizar'}
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Aplicar a nova versão do sistema
          </TooltipContent>
        </Tooltip>

        {!isUpdating && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={dismiss}
                aria-label="Adiar atualização"
                className="h-8 w-8"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Adiar por 30 minutos</TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

export default AppUpdateButton;
