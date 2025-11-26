
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

    // Verificar se já está instalado ou foi instalado anteriormente
    const wasInstalledBefore = localStorage.getItem('pwa-installed') === 'true';
    const installed = checkIfInstalled() || wasInstalledBefore;
    setIsInstalled(installed);

    console.log('🔍 PWA Debug - Inicialização:', {
      platform: detectedPlatform,
      installed,
      userAgent: navigator.userAgent,
      standalone: window.matchMedia('(display-mode: standalone)').matches,
      isSecureContext: window.isSecureContext,
      serviceWorkerSupported: 'serviceWorker' in navigator,
      globalPromptAvailable: !!(window as any).deferredInstallPrompt
    });

    // NOVO: Verificar se o evento já foi capturado globalmente (index.html)
    if ((window as any).deferredInstallPrompt) {
      console.log('🎉 Prompt já capturado globalmente! Usando window.deferredInstallPrompt');
      setDeferredPrompt((window as any).deferredInstallPrompt);
      setIsInstallable(true);
    }

    // Para iOS, sempre mostrar opção de instalação se não instalado
    if (detectedPlatform === 'ios' && !installed) {
      console.log('📱 iOS detectado - habilitando instalação manual');
      setIsInstallable(true);
    }

    // Listener para o evento de instalação (Android/Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('🎯 Evento beforeinstallprompt capturado no React!', e);
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);
      setIsInstallable(true);
      (window as any).deferredInstallPrompt = promptEvent; // Sincronizar com global
    };

    // NOVO: Listener para evento customizado disparado pelo script global
    const handlePWAAvailable = () => {
      console.log('🎉 Evento customizado pwa-install-available recebido!');
      if ((window as any).deferredInstallPrompt) {
        setDeferredPrompt((window as any).deferredInstallPrompt);
        setIsInstallable(true);
      }
    };

    // Listener para quando o app é instalado
    const handleAppInstalled = () => {
      console.log('✅ App instalado com sucesso!');
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
      (window as any).deferredInstallPrompt = null;
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
    window.addEventListener('pwa-install-available', handlePWAAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    mediaQuery.addEventListener('change', handleDisplayModeChange);

    // Para Android, aguardar beforeinstallprompt ou forçar se necessário
    let timeoutId: NodeJS.Timeout;
    if (detectedPlatform === 'android' && !installed) {
      console.log('⏱️ Android: Aguardando evento beforeinstallprompt (3s timeout)...');
      timeoutId = setTimeout(() => {
        if (!deferredPrompt && !(window as any).deferredInstallPrompt && !installed) {
          console.log('⚠️ Android: Evento não disparou. Forçando exibição do botão (fallback)');
          setIsInstallable(true);
        }
      }, 3000);
    }

    // Para Desktop, forçar exibição após timeout se evento não disparar
    if (detectedPlatform === 'desktop' && !installed) {
      console.log('⏱️ Desktop: Aguardando evento beforeinstallprompt (2s timeout)...');
      timeoutId = setTimeout(() => {
        if (!deferredPrompt && !(window as any).deferredInstallPrompt) {
          console.log('⚠️ Desktop: Evento não disparou. Forçando exibição do botão (fallback manual)');
          setIsInstallable(true);
        }
      }, 2000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-install-available', handlePWAAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery.removeEventListener('change', handleDisplayModeChange);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [platform]);

  const installApp = async (): Promise<boolean | 'ios-manual' | 'desktop-manual' | 'already-installed'> => {
    // Verificar se já foi instalado anteriormente
    const wasInstalledBefore = localStorage.getItem('pwa-installed') === 'true';
    if (wasInstalledBefore) {
      console.log('✅ App já foi instalado anteriormente');
      return 'already-installed';
    }

    // Usar prompt global se disponível
    const promptToUse = deferredPrompt || (window as any).deferredInstallPrompt;
    
    console.log('🔍 PWA Install Debug:', {
      platform,
      hasDeferredPrompt: !!deferredPrompt,
      hasGlobalPrompt: !!(window as any).deferredInstallPrompt,
      promptType: typeof promptToUse,
      promptExists: !!promptToUse,
      hasPromptMethod: promptToUse && typeof promptToUse.prompt === 'function',
      isInstallable,
      serviceWorkerReady: 'serviceWorker' in navigator && navigator.serviceWorker.controller
    });

    // Para iOS Safari, sempre mostrar instruções manuais
    if (platform === 'ios') {
      console.log('📱 iOS detectado - mostrando instruções manuais');
      return 'ios-manual';
    }

    // Se não tem prompt disponível, mostrar instruções manuais
    if (!promptToUse || typeof promptToUse.prompt !== 'function') {
      console.log('⚠️ Prompt inválido ou não disponível - usando fallback manual');
      if (platform === 'desktop') {
        return 'desktop-manual';
      }
      if (platform === 'android') {
        return 'desktop-manual'; // Usar instruções de instalação manual
      }
      return false;
    }

    try {
      console.log('📲 Tentando chamar prompt.prompt()...');
      
      // Verificar se o prompt já foi usado anteriormente
      await promptToUse.prompt();
      
      console.log('⏳ Aguardando escolha do usuário...');
      const { outcome } = await promptToUse.userChoice;
      
      console.log('👤 Escolha do usuário:', outcome);

      if (outcome === 'accepted') {
        console.log('✅ Usuário aceitou a instalação');
        localStorage.setItem('pwa-installed', 'true');
        setIsInstallable(false);
        setIsInstalled(true);
        setDeferredPrompt(null);
        (window as any).deferredInstallPrompt = null;
        return true;
      } else {
        console.log('❌ Usuário recusou a instalação');
        return false;
      }
    } catch (error) {
      console.error('❌ Erro ao chamar prompt:', error);
      
      // Se o prompt já foi consumido, limpar e mostrar instruções manuais
      if (error instanceof Error && error.message.includes('The prompt() method may only be called once')) {
        console.log('⚠️ Prompt já foi consumido anteriormente - limpando e mostrando manual');
        (window as any).deferredInstallPrompt = null;
        setDeferredPrompt(null);
        return platform === 'desktop' ? 'desktop-manual' : 'desktop-manual';
      }
      
      // Fallback para instruções manuais em caso de erro
      console.log('⚠️ Fallback para instruções manuais devido a erro');
      return platform === 'desktop' ? 'desktop-manual' : 'desktop-manual';
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
