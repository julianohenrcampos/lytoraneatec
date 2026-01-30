
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Download, X, Smartphone, Monitor } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';

export const PWAInstallBanner: React.FC = () => {
  const { isInstallable, installApp, platform, getInstallInstructions } = usePWAInstall();
  const [isDismissed, setIsDismissed] = useState(() => {
    // Verificar se foi dismissado nas últimas 24h
    const dismissedTime = localStorage.getItem('pwa-install-dismissed');
    if (dismissedTime) {
      const hoursPassed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      return hoursPassed < 24;
    }
    // Verificar se já foi instalado anteriormente
    return localStorage.getItem('pwa-installed') === 'true';
  });
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showDesktopInstructions, setShowDesktopInstructions] = useState(false);
  const isMobile = useIsMobile();
  const { toast } = useToast();

  // Auto-dismiss após 5 minutos se não interagir
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsDismissed(true);
    }, 300000); // 5 minutos

    return () => clearTimeout(timer);
  }, []);

  if (!isInstallable || isDismissed) {
    return null;
  }

  const handleInstall = async () => {
    const result = await installApp();
    
    if (result === 'ios-manual') {
      setShowIOSInstructions(true);
    } else if (result === 'desktop-manual') {
      setShowDesktopInstructions(true);
    } else if (result === 'already-installed') {
      toast({
        title: "App já instalado! ✅",
        description: "O LYTOTEC já está instalado neste dispositivo. Procure-o nos seus aplicativos.",
        duration: 5000
      });
      setIsDismissed(true);
    } else if (result === true) {
      setIsDismissed(true);
      localStorage.setItem('pwa-installed', 'true');
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
    <>
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
              {platform === 'ios' ? 'Ver Instruções' : 'Instalar'}
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
      </Card>

      {/* Modal de Instruções iOS */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Instalar LYTEC no iPhone
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowIOSInstructions(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="text-2xl flex-shrink-0">1️⃣</div>
                <div>
                  <p className="font-medium">Toque em Compartilhar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    O ícone <span className="text-lg">⬆️</span> na parte inferior do Safari
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="text-2xl flex-shrink-0">2️⃣</div>
                <div>
                  <p className="font-medium">Adicionar à Tela de Início</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Role e toque em "Adicionar à Tela de Início"
                  </p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                <div className="text-2xl flex-shrink-0">3️⃣</div>
                <div>
                  <p className="font-medium">Confirmar</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Toque em "Adicionar" para finalizar
                  </p>
                </div>
              </div>
            </div>
            
            <Button 
              onClick={() => setShowIOSInstructions(false)} 
              className="w-full"
            >
              Entendi!
            </Button>
          </Card>
        </div>
      )}

      {/* Modal de Instruções Desktop/Android */}
      {showDesktopInstructions && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <Card className="max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                {platform === 'desktop' ? <Monitor className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                Instalar LYTEC
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDesktopInstructions(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-3">
              {platform === 'desktop' ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Para instalar o app no seu computador:
                  </p>
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="text-2xl flex-shrink-0">🔍</div>
                    <p className="text-sm">
                      Procure o ícone <strong className="text-base">⊕</strong> ou <strong className="text-base">📥</strong> na barra de endereço do navegador
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="text-2xl flex-shrink-0">⋮</div>
                    <p className="text-sm">
                      Ou clique no menu do navegador (3 pontos) e selecione "Instalar LYTEC"
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Para instalar o app no Android:
                  </p>
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="text-2xl flex-shrink-0">⋮</div>
                    <p className="text-sm">
                      Toque no menu do navegador (3 pontos verticais)
                    </p>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <div className="text-2xl flex-shrink-0">📥</div>
                    <p className="text-sm">
                      Selecione <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>
                    </p>
                  </div>
                </>
              )}
            </div>
            
            <Button 
              onClick={() => setShowDesktopInstructions(false)} 
              className="w-full"
            >
              Entendi!
            </Button>
          </Card>
        </div>
      )}
    </>
  );
};
