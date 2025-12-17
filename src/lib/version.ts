// Versão do aplicativo - ATUALIZAR A CADA DEPLOY
export const APP_VERSION = '1.0.0';

// Data do build
export const BUILD_DATE = new Date().toISOString().split('T')[0];

// Função helper para obter versão formatada
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  fullVersion: `v${APP_VERSION}`,
});
