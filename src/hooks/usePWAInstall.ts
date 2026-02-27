import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

type Platform = 'ios' | 'android' | 'desktop';

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

const isAlreadyInstalled = (): boolean => {
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  if ((navigator as any).standalone === true) return true;
  return false;
};

const COOLDOWN_KEY = 'pwa-dismissed-at';
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24h

const isInCooldown = (): boolean => {
  const dismissed = localStorage.getItem(COOLDOWN_KEY);
  if (!dismissed) return false;
  return Date.now() - parseInt(dismissed, 10) < COOLDOWN_MS;
};

export type InstallResult = 'accepted' | 'dismissed' | 'manual';

export const usePWAInstall = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [isInstalled, setIsInstalled] = useState(isAlreadyInstalled);
  const platform = detectPlatform();

  useEffect(() => {
    if (isInstalled || isInCooldown()) return;

    // iOS never fires beforeinstallprompt — show CTA for manual instructions
    if (platform === 'ios') {
      setCanInstall(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setCanInstall(true);
    };

    const onInstalled = () => {
      setIsInstalled(true);
      setCanInstall(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);

    const mq = window.matchMedia('(display-mode: standalone)');
    const onMqChange = (e: MediaQueryListEvent) => {
      if (e.matches) onInstalled();
    };
    mq.addEventListener('change', onMqChange);

    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      mq.removeEventListener('change', onMqChange);
    };
  }, [isInstalled, platform]);

  const install = useCallback(async (): Promise<InstallResult> => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setIsInstalled(true);
          setCanInstall(false);
          setDeferredPrompt(null);
          return 'accepted';
        }
        // dismissed — cooldown 24h
        localStorage.setItem(COOLDOWN_KEY, Date.now().toString());
        setCanInstall(false);
        return 'dismissed';
      } catch {
        // prompt already consumed
        setDeferredPrompt(null);
        return 'manual';
      }
    }
    return 'manual';
  }, [deferredPrompt]);

  return {
    canInstall: canInstall && !isInstalled,
    isInstalled,
    install,
    platform,
  };
};
