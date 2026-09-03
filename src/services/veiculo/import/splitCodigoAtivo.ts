// Regex OFICIAL da Rodada 1: prefixo alfabético 2-4 letras + número 1-6 dígitos.
// Rodada 2A.2: adiciona formato de exibição com padding mínimo de 3 dígitos.

const REGEX_CODIGO_ATIVO = /^([A-Z]{2,4})(\d{1,6})$/;

/**
 * Aplica o padrão oficial de 3 dígitos ao número da frota (Rodada 2A.2).
 * Preserva números com mais de 3 dígitos sem truncar.
 *   7    → 007
 *   24   → 024
 *   63   → 063
 *   171  → 171
 *   1234 → 1234
 */
export function formatarNumeroFrota(numeroCanonico: string): string {
  const s = String(numeroCanonico ?? '').trim();
  if (s === '') return '';
  const padLen = Math.max(3, s.length);
  return s.padStart(padLen, '0');
}

export interface SplitCodigoAtivoResult {
  original: string | null;
  prefixo: string | null;
  /** Número canônico sem zeros à esquerda (usado para chave/dedup). */
  numero: string | null;
  /** Número formatado com no mínimo 3 dígitos (usado para armazenamento e exibição). */
  numeroFormatado: string | null;
  /** Código canônico interno (prefixo + numero sem zeros). Chave para match/idempotência. */
  canonico: string | null;
  /** Código para exibição ao usuário (prefixo + numero formatado com padding 3). */
  canonicoExibicao: string | null;
  ok: boolean;
}

export function splitCodigoAtivo(raw: unknown): SplitCodigoAtivoResult {
  if (raw === null || raw === undefined) {
    return {
      original: null, prefixo: null, numero: null,
      numeroFormatado: null, canonico: null, canonicoExibicao: null, ok: false,
    };
  }
  const trimmed = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (!trimmed) {
    return {
      original: null, prefixo: null, numero: null,
      numeroFormatado: null, canonico: null, canonicoExibicao: null, ok: false,
    };
  }
  const m = REGEX_CODIGO_ATIVO.exec(trimmed);
  if (!m) {
    return {
      original: trimmed, prefixo: null, numero: null,
      numeroFormatado: null, canonico: null, canonicoExibicao: null, ok: false,
    };
  }
  const prefixo = m[1];
  const numero = m[2].replace(/^0+/, '') || '0';
  const numeroFormatado = formatarNumeroFrota(numero);
  return {
    original: trimmed,
    prefixo,
    numero,
    numeroFormatado,
    canonico: `${prefixo}${numero}`,
    canonicoExibicao: `${prefixo}${numeroFormatado}`,
    ok: true,
  };
}

export function isFimMarker(raw: unknown): boolean {
  if (raw === null || raw === undefined) return false;
  return String(raw).trim().toLowerCase() === 'fim';
}
