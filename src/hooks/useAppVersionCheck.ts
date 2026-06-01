import { useCallback, useEffect, useRef, useState } from 'react';
import { APP_BUILD_ID } from '@/lib/version';
import {
  activateWaitingServiceWorker,
  hasWaitingServiceWorker,
  onServiceWorkerUpdate,
} from '@/lib/pwa/registerSW';

const DISMISS_KEY = 'lyto:update-dismissed-until';
const POLL_MS = 5 * 60 * 1000; // 5 min
const DISMISS_MS = 30 * 60 * 1000; // 30 min

function isSuppressedHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return (
    host.includes('id-preview--') ||
    host.includes('lovableproject.com') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

function isDismissed(): boolean {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const until = parseInt(raw, 10);
    if (!Number.isFinite(until)) return false;
    if (Date.now() < until) return true;
    sessionStorage.removeItem(DISMISS_KEY);
    return false;
  } catch {
    return false;
  }
}

export interface AppVersionCheck {
  updateAvailable: boolean;
  reload: () => void;
  dismiss: () => void;
}

export function useAppVersionCheck(): AppVersionCheck {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const dismissedTickRef = useRef(0);

  const enabled =
    typeof window !== 'undefined' &&
    !import.meta.env.DEV &&
    !isSuppressedHost() &&
    APP_BUILD_ID !== 'dev';

  const check = useCallback(async () => {
    if (!enabled) return;
    if (isDismissed()) {
      setUpdateAvailable(false);
      return;
    }
    try {
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'omit',
      });
      if (!res.ok) return;
      const data = (await res.json()) as { version?: string };
      if (data && typeof data.version === 'string' && data.version !== APP_BUILD_ID) {
        setUpdateAvailable(true);
      }
    } catch {
      // silencioso: rede caiu, não mostra banner
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void check();
    const interval = window.setInterval(() => void check(), POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Throttle simples: ao menos 30s entre checks por foco
        const now = Date.now();
        if (now - dismissedTickRef.current > 30_000) {
          dismissedTickRef.current = now;
          void check();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    // Sinal adicional: novo Service Worker em waiting
    if (hasWaitingServiceWorker()) setUpdateAvailable(true);
    const offSW = onServiceWorkerUpdate(() => {
      if (!isDismissed()) setUpdateAvailable(true);
    });

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      offSW();
    };
  }, [enabled, check]);

  const reload = useCallback(() => {
    try {
      sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      // ignore
    }
    // Se houver SW em waiting, ativa primeiro — controllerchange faz reload automático
    if (activateWaitingServiceWorker()) return;
    window.location.reload();
  }, []);

  const dismiss = useCallback(() => {
    try {
      sessionStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_MS));
    } catch {
      // ignore
    }
    setUpdateAvailable(false);
  }, []);

  return { updateAvailable, reload, dismiss };
}
