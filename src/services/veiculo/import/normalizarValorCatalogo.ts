// Rodada 1.1 — Normalização única para comparação de catálogos.
// Zero mutations. Puramente funcional.

export function normalizar(v: string | null | undefined): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toUpperCase()
    .replace(/[.,\-/;:]+/g, ' ') // pontuação → espaço (só p/ comparação)
    .replace(/\s+/g, ' ')
    .trim();
}

const PLACEHOLDERS_NORMALIZADOS = new Set(
  [
    '',
    '-',
    '0',
    'N/A',
    'NA',
    'S/N',
    'NÃO ENCONTRADO',
    'NAO ENCONTRADO',
    'NÃO INFORMADO',
    'NAO INFORMADO',
    'SEM INFORMACAO',
    'SEM INFORMAÇÃO',
  ].map((p) => normalizar(p)),
);

export interface ValorCatalogo {
  valor: string | null; // trimmed original (preservado para exibição)
  normalizado: string; // sempre calculado
  placeholder: boolean; // true se valor deve ser tratado como ausência
}

export function toValorCatalogo(v: string | null | undefined): ValorCatalogo {
  const trimmed = v === null || v === undefined ? '' : String(v).trim();
  const normalizado = normalizar(trimmed);
  const isEmpty = trimmed === '';
  const isPlaceholder = isEmpty || PLACEHOLDERS_NORMALIZADOS.has(normalizado);
  return {
    valor: isEmpty ? null : trimmed,
    normalizado,
    placeholder: isPlaceholder,
  };
}

export function isPlaceholderValor(v: string | null | undefined): boolean {
  return toValorCatalogo(v).placeholder;
}
