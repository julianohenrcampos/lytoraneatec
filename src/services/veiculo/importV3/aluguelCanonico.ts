// PR-3.3 Fase C — Aluguel canônico.
// Aceita "R$ 1.234,56", "1.234,56", "1234.56". Persiste em `aluguel text`
// no formato "1234.56" (ponto decimal, sem separador de milhar, sem símbolo).

import { parseMoedaBR } from '@/utils/parseMoedaBR';

export interface AluguelCanonico {
  /** Número (2 casas) ou null. */
  valor: number | null;
  /** String canônica gravada em `aluguel text` ("1234.56") ou null. */
  texto: string | null;
  erro: 'ALUGUEL_INVALIDO' | null;
}

const ALUGUEL_VAZIO: AluguelCanonico = { valor: null, texto: null, erro: null };

export function parseAluguel(entrada: unknown): AluguelCanonico {
  if (entrada === null || entrada === undefined) return ALUGUEL_VAZIO;
  const raw = String(entrada).trim();
  if (!raw) return ALUGUEL_VAZIO;
  const canonicoStr = parseMoedaBR(raw);
  if (canonicoStr === null) {
    // se aparência clara de valor mas parser rejeitou → erro; se apenas ruído textual, tratar como vazio
    if (/\d/.test(raw)) return { valor: null, texto: null, erro: 'ALUGUEL_INVALIDO' };
    return ALUGUEL_VAZIO;
  }
  const valor = Number(canonicoStr);
  if (!Number.isFinite(valor)) return { valor: null, texto: null, erro: 'ALUGUEL_INVALIDO' };
  return { valor, texto: canonicoStr, erro: null };
}

/** Chave canônica para diff (null quando vazio, string estável quando presente). */
export function chaveAluguelCanonico(entrada: unknown): string | null {
  const a = parseAluguel(entrada);
  if (a.erro) return `__ERRO__:${a.erro}`;
  return a.texto;
}

/** Formatação de exibição PT-BR ("R$ 1.234,56"). */
export function formatarAluguelBR(entrada: unknown): string {
  const a = parseAluguel(entrada);
  if (!a.texto || a.valor === null) return '';
  return a.valor.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
