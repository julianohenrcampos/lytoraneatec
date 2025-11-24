
import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Download, Smartphone, Monitor } from 'lucide-react';
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
  const { isInstallable, installApp, platform, getInstallInstructions } = usePWAInstall();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  if (!isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    console.log('🔄 Iniciando instalação do PWA...');
    
    const result = await installApp();
    
    if (result === 'ios-manual') {
      const instructions = getInstallInstructions();
      toast({
        title: instructions.title,
        description: (
          <div className="space-y-2">
            <p>Para instalar o LYTOTEC no seu iPhone/iPad:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              {instructions.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </div>
        ),
        duration: 10000,
      });
    } else if (result === 'desktop-manual') {
      const instructions = getInstallInstructions();
      toast({
        title: instructions.title,
        description: (
          <div className="space-y-2">
            <p className="font-medium">Para instalar o LYTOTEC como aplicativo:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              {instructions.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
            <p className="text-xs text-muted-foreground mt-2">
              💡 Funciona no Chrome e Edge
            </p>
          </div>
        ),
        duration: 12000,
      });
    } else if (result === true) {
      toast({
        title: "App instalado com sucesso!",
        description: isMobile 
          ? "O LYTOTEC foi adicionado à sua tela inicial"
          : "O LYTOTEC foi instalado no seu dispositivo",
      });
    } else if (result === false) {
      toast({
        title: "Instalação cancelada",
        description: "Você pode tentar instalar novamente a qualquer momento",
        variant: "default"
      });
    }
  };

  const getTooltipText = () => {
    if (platform === 'ios') {
      return "Adicionar à tela inicial do iOS";
    }
    if (platform === 'android') {
      return "Instalar app no Android";
    }
    return isMobile ? "Instalar app na tela inicial" : "Instalar LYTOTEC no dispositivo";
  };

  const getIcon = () => {
    if (platform === 'ios' || platform === 'android') {
      return <Smartphone className="h-4 w-4 sm:h-5 sm:w-5" />;
    }
    return <Download className="h-4 w-4 sm:h-5 sm:w-5" />;
  };

  if (variant === 'button') {
    return (
      <Button
        onClick={handleInstall}
        variant="outline"
        className={`flex items-center gap-2 ${className}`}
      >
        {getIcon()}
        <span>
          {platform === 'ios' ? 'Adicionar à Tela' : 'Instalar App'}
        </span>
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
            {getIcon()}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
