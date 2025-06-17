
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';

interface PWAInstallButtonProps {
  variant?: 'icon' | 'button';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ 
  variant = 'icon',
  className 
}) => {
  const { isInstallable, installApp } = usePWAInstall();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  if (!isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    console.log('🔄 Iniciando instalação do PWA...');
    
    const success = await installApp();
    
    if (success) {
      toast({
        title: "App instalado com sucesso!",
        description: isMobile 
          ? "O LYTOTEC foi adicionado à sua tela inicial"
          : "O LYTOTEC foi instalado no seu dispositivo",
      });
    } else {
      toast({
        title: "Instalação cancelada",
        description: "Você pode tentar instalar novamente a qualquer momento",
        variant: "default"
      });
    }
  };

  const tooltipText = isMobile 
    ? "Instalar app na tela inicial"
    : "Instalar LYTOTEC no dispositivo";

  if (variant === 'button') {
    return (
      <Button
        onClick={handleInstall}
        variant="outline"
        className={`flex items-center gap-2 ${className}`}
      >
        <Download className="h-4 w-4" />
        <span>Instalar App</span>
      </Button>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleInstall}
            className={className}
          >
            <Download className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
