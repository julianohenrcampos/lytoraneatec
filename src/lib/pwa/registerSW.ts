/**
 * Registro defensivo do Service Worker do LYTOTEC.
 *
 * - Não registra em iframe (preview do Lovable) nem em hosts de preview/localhost.
 * - Em ambientes não suportados, garante que qualquer SW antigo seja desregistrado.
 * - Expõe utilitários para detectar nova versão e limpar caches do app
 *   (sem tocar em IndexedDB, localStorage ou filas offline).
 */

const APP_CACHE_PREFIX = 'lyto-';

let waitingRegistration: ServiceWorkerRegistration | null = null;
const updateListeners = new Set<() => void>();

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function isPreviewHost(): boolean {
  const host = window.location.hostname;
  return (
    host.includes('id-preview--') ||
    host.includes('lovableproject.com') ||
    host === 'localhost' ||
    host === '127.0.0.1'
  );
}

function isSWSupported(): boolean {
  return typeof window !== 'undefined' && 'serviceWorker' in navigator;
}

function notifyUpdate(reg: ServiceWorkerRegistration) {
  waitingRegistration = reg;
  updateListeners.forEach((fn) => {
    try { fn(); } catch { /* ignore */ }
  });
}

export function onServiceWorkerUpdate(listener: () => void): () => void {
  updateListeners.add(listener);
  if (waitingRegistration) listener();
  return () => updateListeners.delete(listener);
}

export function hasWaitingServiceWorker(): boolean {
  return !!waitingRegistration?.waiting;
}

/**
 * Ativa o SW em waiting (se houver). Retorna true se enviou SKIP_WAITING.
 */
export function activateWaitingServiceWorker(): boolean {
  const waiting = waitingRegistration?.waiting;
  if (!waiting) return false;
  try {
    waiting.postMessage({ type: 'SKIP_WAITING' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Limpa APENAS caches do app LYTOTEC (prefixo lyto-).
 * NÃO toca em IndexedDB, localStorage, sessionStorage nem filas offline.
 */
export async function clearAppCaches(): Promise<number> {
  if (typeof caches === 'undefined') return 0;
  const keys = await caches.keys();
  const targets = keys.filter((k) => k.startsWith(APP_CACHE_PREFIX));
  await Promise.all(targets.map((k) => caches.delete(k)));
  // Também pede ao SW (se ativo) para limpar do lado dele
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    reg?.active?.postMessage({ type: 'CLEAR_APP_CACHES' });
  } catch { /* ignore */ }
  return targets.length;
}

/**
 * Força verificação por nova versão do SW.
 */
export async function checkForServiceWorkerUpdate(): Promise<void> {
  if (!isSWSupported()) return;
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    await reg?.update();
  } catch { /* ignore */ }
}

export async function getRegisteredServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isSWSupported()) return null;
  try {
    return (await navigator.serviceWorker.getRegistration()) ?? null;
  } catch {
    return null;
  }
}

export async function listAppCaches(): Promise<string[]> {
  if (typeof caches === 'undefined') return [];
  const keys = await caches.keys();
  return keys.filter((k) => k.startsWith(APP_CACHE_PREFIX));
}

/**
 * Desregistra todo SW e limpa caches do app. Usado em iframes/preview.
 */
async function unregisterAllAndClear(): Promise<void> {
  if (isSWSupported()) {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => false)));
    } catch { /* ignore */ }
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith(APP_CACHE_PREFIX)).map((k) => caches.delete(k))
      );
    }
  } catch { /* ignore */ }
}

export function registerServiceWorker(): void {
  if (typeof window === 'undefined') return;

  // Em preview/iframe: nunca registra, e remove qualquer SW antigo
  if (isInIframe() || isPreviewHost()) {
    void unregisterAllAndClear();
    return;
  }

  if (!isSWSupported()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((reg) => {
        if (reg.waiting) notifyUpdate(reg);

        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              notifyUpdate(reg);
            }
          });
        });
      })
      .catch(() => { /* silencioso */ });

    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
