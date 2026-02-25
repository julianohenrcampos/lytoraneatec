import { useRegisterSW } from 'virtual:pwa-register/react';

export const usePWAUpdate = () => {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(registration) {
      console.log('PWA: Service Worker registrado com sucesso', registration);
      
      // Verificar updates periodicamente (a cada 5 minutos)
      if (registration) {
        setInterval(() => {
          registration.update();
        }, 300000);
      }
    },
    onRegisterError(error) {
      console.error('PWA: Erro ao registrar Service Worker:', error);
    },
    onNeedRefresh() {
      console.log('PWA: Nova versão disponível');
    },
    onOfflineReady() {
      console.log('PWA: Aplicativo pronto para uso offline');
    }
  });

  const applyUpdate = async () => {
    await updateServiceWorker(true);
  };

  return {
    updateAvailable: needRefresh,
    applyUpdate
  };
};
