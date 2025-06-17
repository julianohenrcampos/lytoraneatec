
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, installApp } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const isMobile = useIsMobile();

  if (!isInstallable || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setIsDismissed(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-4 bg-primary text-primary-foreground shadow-lg border-0 md:left-auto md:right-4 md:w-96">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Download className="h-6 w-6" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Instalar LYTEC</h3>
          <p className="text-xs opacity-90 mt-1">
            {isMobile 
              ? 'Adicione à tela inicial para acesso rápido'
              : 'Instale o app para melhor experiência'
            }
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstall}
            className="text-primary"
          >
            Instalar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-primary-foreground hover:bg-primary-foreground/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
};
