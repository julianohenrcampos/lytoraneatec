
import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Função para detectar plataforma - Simplificada
const detectPlatform = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  
  if (/iphone|ipad|ipod/.test(userAgent)) return 'ios';
  if (/android/.test(userAgent)) return 'android';
  return 'desktop';
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
    // Detectar plataforma simplificada
    const detectedPlatform = detectPlatform();
    setPlatform(detectedPlatform);

    // Verificar se já está instalado
    const installed = checkIfInstalled();
    setIsInstalled(installed);

    console.log('🔍 PWA Debug - Inicialização:', {
      platform: detectedPlatform,
      installed,
      userAgent: navigator.userAgent,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      isSecureContext: window.isSecureContext,
      serviceWorkerSupported: 'serviceWorker' in navigator
    });

    // Para iOS, sempre mostrar opção de instalação se não instalado
    if (detectedPlatform === 'ios' && !installed) {
      console.log('📱 iOS detectado - habilitando instalação manual');
      setIsInstallable(true);
    }

    // Listener para o evento de instalação (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🎯 Evento beforeinstallprompt capturado!', e);
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
    };

    // Listener para quando o app é instalado
    const handleAppInstalled = () => {
      console.log('✅ App instalado com sucesso!');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    // Listener para mudanças no display mode
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleDisplayModeChange = (e: MediaQueryListEvent) => {
      console.log('🔄 Display mode mudou:', e.matches ? 'standalone' : 'browser');
      if (e.matches) {
        setIsInstalled(true);
        setIsInstallable(false);
      }
    };

    // Event listeners
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // Para Android, aguardar beforeinstallprompt ou forçar se necessário
    let timeoutId: NodeJS.Timeout;
    if (detectedPlatform === 'android' && !installed) {
      console.log('⏱️ Android: Aguardando evento beforeinstallprompt (3s timeout)...');
      timeoutId = setTimeout(() => {
        if (!deferredPrompt && !installed) {
          console.log('⚠️ Android: Evento não disparou. Forçando exibição do botão (fallback)');
          setIsInstallable(true);
        }
      }, 3000);
    }

    // NOVO: Para Desktop, forçar exibição após timeout se evento não disparar
    if (detectedPlatform === 'desktop' && !installed) {
      console.log('⏱️ Desktop: Aguardando evento beforeinstallprompt (2s timeout)...');
      timeoutId = setTimeout(() => {
        if (!deferredPrompt) {
          console.log('⚠️ Desktop: Evento não disparou. Forçando exibição do botão (fallback manual)');
          setIsInstallable(true);
        }
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [platform]);

  const installApp = async (): Promise<boolean | 'ios-manual' | 'desktop-manual'> => {
    console.log('🔄 Tentando instalar PWA...', {
      platform,
      hasDeferredPrompt: !!deferredPrompt,
      isInstallable,
      serviceWorkerReady: 'serviceWorker' in navigator && navigator.serviceWorker.controller
    });

    // Para iOS Safari, sempre mostrar instruções manuais
    if (platform === 'ios') {
      console.log('📱 iOS detectado - mostrando instruções manuais');
      return 'ios-manual';
    }

    // Se não tem prompt disponível, mostrar instruções manuais
    if (!deferredPrompt) {
      console.log('⚠️ Nenhum prompt de instalação disponível - usando fallback manual');
      if (platform === 'desktop') {
        return 'desktop-manual';
      }
      if (platform === 'android') {
        return 'ios-manual'; // Usar instruções genéricas
      }
      return false;
    }

    try {
      console.log('📲 Exibindo prompt de instalação nativo...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('👤 Escolha do usuário:', outcome);

      if (outcome === 'accepted') {
        console.log('✅ Usuário aceitou a instalação');
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      } else {
        console.log('❌ Usuário recusou a instalação');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao tentar instalar:', error);
      return false;
    }
  };

  const getInstallInstructions = () => {
    if (platform === 'ios') {
      return {
        title: 'Instalar no iOS',
        steps: [
          'Toque no botão "Compartilhar" (ícone de compartilhamento) no Safari',
          'Role para baixo e toque em "Adicionar à Tela de Início"',
          'Toque em "Adicionar" no canto superior direito para confirmar'
        ]
      };
    }
    
    if (platform === 'android') {
      return {
        title: 'Instalar no Android',
        steps: [
          'Toque no menu do navegador (três pontos verticais ⋮)',
          'Selecione "Adicionar à tela inicial" ou "Instalar app"',
          'Confirme tocando em "Adicionar" ou "Instalar"'
        ]
      };
    }

    return {
      title: 'Instalar LYTOTEC no Desktop',
      steps: [
        'Procure o ícone de instalação (⊕) na barra de endereço do navegador',
        'Ou clique no menu do navegador (⋮ três pontos verticais)',
        'Selecione "Instalar LYTOTEC" ou "Adicionar à área de trabalho"',
        'Confirme clicando em "Instalar"',
        'O app será adicionado ao seu computador como um aplicativo nativo'
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
