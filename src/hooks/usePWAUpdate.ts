
import { useState, useEffect } from 'react';
import { useToast } from './use-toast';

export const usePWAUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Registrar o service worker
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('PWA: Service Worker registrado');
          setRegistration(reg);

          // Verificar por updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              console.log('PWA: Nova versão encontrada');
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  setUpdateAvailable(true);
                  
                  // Mostrar toast de atualização disponível (sem JSX no hook)
                  toast({
                    title: "Atualização disponível",
                    description: "Uma nova versão está disponível. Clique em 'Atualizar' para aplicar as mudanças.",
                    duration: 10000,
                  });
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('PWA: Erro ao registrar Service Worker:', error);
        });
    }
  }, [toast]);

  const applyUpdate = () => {
    if (registration && registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      window.location.reload();
    }
  };

  return {
    updateAvailable,
    applyUpdate
  };
};
