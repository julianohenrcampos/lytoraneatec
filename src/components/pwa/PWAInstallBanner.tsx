
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, installApp, platform, getInstallInstructions } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Auto-dismiss após 30 segundos se não interagir
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDismissed(true);
    }, 30000);

    return () => clearTimeout(timer);
  }, []);

  if (!isInstallable || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    const result = await installApp();
    
    if (result === 'ios-manual') {
      setShowInstructions(true);
      const instructions = getInstallInstructions();
      toast({
        title: instructions.title,
        description: instructions.steps.join(' → '),
        duration: 8000,
      });
    } else if (result === 'desktop-manual') {
      // Tratar instruções manuais para desktop
      const instructions = getInstallInstructions();
      toast({
        title: instructions.title,
        description: (
          <div className="space-y-1">
            {instructions.steps.map((step, i) => (
              <p key={i} className="text-sm">{step}</p>
            ))}
          </div>
        ),
        duration: 12000,
      });
    } else if (result === true) {
      setIsDismissed(true);
      toast({
        title: "App Instalado!",
        description: "LYTEC foi instalado com sucesso",
      });
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    // Lembrar preferência por 24h
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  };

  const getPlatformIcon = () => {
    if (platform === 'ios' || platform === 'android') return Smartphone;
    return Monitor;
  };

  const PlatformIcon = getPlatformIcon();

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 p-3 bg-gradient-to-r from-primary to-primary/90 text-primary-foreground shadow-xl border-0 md:left-auto md:right-4 md:w-80 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="p-2 bg-white/20 rounded-lg">
            <PlatformIcon className="h-5 w-5" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">📱 Instalar LYTEC</h3>
          <p className="text-xs opacity-90 mt-0.5">
            {platform === 'ios' 
              ? 'Adicione à tela inicial'
              : platform === 'android'
              ? 'Instale como app nativo'
              : 'Acesso rápido no desktop'
            }
          </p>
        </div>
        
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleInstall}
            className="text-primary font-medium text-xs px-3"
          >
            <Download className="h-3 w-3 mr-1" />
            Instalar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleDismiss}
            className="text-primary-foreground hover:bg-white/20 p-1"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {showInstructions && platform === 'ios' && (
        <div className="mt-3 pt-3 border-t border-white/20">
          <p className="text-xs opacity-80">
            Safari: Compartilhar → Adicionar à Tela de Início
          </p>
        </div>
      )}
    </Card>
  );
};
