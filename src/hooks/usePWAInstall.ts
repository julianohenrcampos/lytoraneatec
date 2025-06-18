
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Função para detectar se é dispositivo iOS
const isIOS = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
  const isIOSSafari = /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);
  return isIOSDevice || (isIOSSafari && 'standalone' in window.navigator);
};

// Função para detectar se é dispositivo Android
const isAndroid = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /android/.test(userAgent);
};

// Função para detectar Samsung Internet
const isSamsungInternet = () => {
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /samsungbrowser/.test(userAgent);
};

// Função para verificar se já está instalado
const checkIfInstalled = () => {
  // Verifica se está no modo standalone (instalado)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
  
  // Verifica se é iOS em modo standalone
  const isInWebAppiOS = (window.navigator as any).standalone === true;
  
  // Verifica se é Android instalado
  const isInWebAppAndroid = window.matchMedia('(display-mode: standalone)').matches;
  
  return isStandalone || isInWebAppiOS || isInWebAppAndroid;
};

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop' | 'unknown'>('unknown');

  useEffect(() => {
    // Detectar plataforma
    if (isIOS()) {
      setPlatform('ios');
    } else if (isAndroid()) {
      setPlatform('android');
    } else {
      setPlatform('desktop');
    }

    // Verificar se já está instalado
    const installed = checkIfInstalled();
    setIsInstalled(installed);

    console.log('PWA: Plataforma detectada:', platform);
    console.log('PWA: Já instalado:', installed);

    // Para iOS Safari, mostrar instruções manuais se não estiver instalado
    if (isIOS() && !installed) {
      const isInSafari = /safari/.test(window.navigator.userAgent.toLowerCase()) && 
                        !/chrome|crios|fxios/.test(window.navigator.userAgent.toLowerCase());
      
      if (isInSafari) {
        console.log('PWA: iOS Safari detectado - instalação manual disponível');
        setIsInstallable(true);
      }
    }

    // Listener para o evento de instalação (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      console.log('PWA: Install prompt disponível para plataforma:', platform);
    };

    // Listener para quando o app é instalado
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      console.log('PWA: App instalado com sucesso');
    };

    // Listener para mudanças no display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
        console.log('PWA: App executando em modo standalone');
      }
    };

    // Event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // Verificação adicional para Samsung Internet
    if (isSamsungInternet() && !installed) {
      console.log('PWA: Samsung Internet detectado');
      setIsInstallable(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
    };
  }, [platform]);

  const installApp = async () => {
    // Para iOS Safari, mostrar instruções manuais
    if (platform === 'ios' && !deferredPrompt) {
      console.log('PWA: Mostrando instruções para iOS');
      // Retornar true para mostrar toast com instruções
      return 'ios-manual';
    }

    // Para Android/Desktop com prompt disponível
    if (!deferredPrompt) {
      console.log('PWA: Nenhum prompt disponível');
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        console.log('PWA: Usuário aceitou a instalação');
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      } else {
        console.log('PWA: Usuário rejeitou a instalação');
        return false;
      }
    } catch (error) {
      console.error('PWA: Erro durante instalação:', error);
      return false;
    }
  };

  const getInstallInstructions = () => {
    if (platform === 'ios') {
      return {
        title: 'Instalar no iOS',
        steps: [
          'Toque no botão "Compartilhar" no Safari',
          'Role para baixo e toque em "Adicionar à Tela de Início"',
          'Toque em "Adicionar" para confirmar'
        ]
      };
    }
    
    if (platform === 'android') {
      return {
        title: 'Instalar no Android',
        steps: [
          'Toque no menu do navegador (⋮)',
          'Selecione "Adicionar à tela inicial" ou "Instalar app"',
          'Confirme a instalação'
        ]
      };
    }

    return {
      title: 'Instalar App',
      steps: [
        'Clique no ícone de instalação na barra de endereços',
        'Ou use o menu do navegador para "Instalar LYTOTEC"'
      ]
    };
  };

  return {
    isInstallable: isInstallable && !isInstalled,
    isInstalled,
    installApp,
    platform,
    getInstallInstructions
  };
};
