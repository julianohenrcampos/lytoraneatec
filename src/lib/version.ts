// Versão do aplicativo - ATUALIZAR A CADA DEPLOY
export const APP_VERSION = '1.0.0';

// Data do build
export const BUILD_DATE = new Date().toISOString().split('T')[0];

// Build ID injetado pelo Vite (define em vite.config.ts). Igual ao gravado em /version.json.
export const APP_BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev';

// Função helper para obter versão formatada
export const getVersionInfo = () => ({
  version: APP_VERSION,
  buildDate: BUILD_DATE,
  buildId: APP_BUILD_ID,
  fullVersion: `v${APP_VERSION}`,
});
