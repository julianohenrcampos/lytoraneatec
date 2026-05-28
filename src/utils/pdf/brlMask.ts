/**
 * Máscara de input e parser BRL compartilhados.
 * - Use estas funções em inputs de moeda em formulários client-side.
 * - Para formatação de valores numéricos já parseados em PDFs/visualizações,
 *   prefira `value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })`
 *   ou `formatCurrency` de `src/utils/number.ts`.
 */

export const fmtBRLInput = (s: string): string => {
  const num = s.replace(/\D/g, '');
  if (!num) return '';
  return (Number(num) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

export const parseBRL = (s: string): number | null => {
  if (!s) return null;
  const n = Number(s.replace(/\D/g, '')) / 100;
  return Number.isFinite(n) ? n : null;
};
