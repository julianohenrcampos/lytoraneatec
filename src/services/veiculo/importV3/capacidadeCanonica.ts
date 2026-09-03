// PR-3.3 Fase C — Normalização canônica de CAPACIDADE.
// Regra: unidade fora do mapa vira CAPACIDADE_UNIDADE_INVALIDA — não inventar unidade.
// Valores equivalentes ("28 t" == "28t" == "28 ton") comparam iguais.

export type CapacidadeUnidadeCanonica = 't' | 'un' | 'm3' | 'l' | 'kg' | 'cv' | 'hp' | 'kw';

/** Mapa alias → canônico. Chave minúscula, sem acentos. */
const ALIASES: Record<string, CapacidadeUnidadeCanonica> = {
  // Toneladas
  t: 't', ton: 't', tons: 't', tonelada: 't', toneladas: 't',
  // Unidades
  un: 'un', und: 'un', unid: 'un', unidade: 'un', unidades: 'un',
  // Metro cúbico
  m3: 'm3', 'm³': 'm3', mc: 'm3', metro3: 'm3',
  // Litros
  l: 'l', lt: 'l', lts: 'l', litro: 'l', litros: 'l',
  // Quilogramas
  kg: 'kg', quilo: 'kg', quilos: 'kg', kilograma: 'kg', kilogramas: 'kg',
  // Motor
  cv: 'cv',
  hp: 'hp',
  kw: 'kw',
};

export const UNIDADES_CANONICAS: readonly CapacidadeUnidadeCanonica[] =
  ['t', 'un', 'm3', 'l', 'kg', 'cv', 'hp', 'kw'] as const;

export interface CapacidadeCanonica {
  /** Número normalizado. Null quando não há valor válido. */
  valor: number | null;
  /** Unidade canônica. Null quando não há unidade reconhecível. */
  unidade: CapacidadeUnidadeCanonica | null;
  /** Representação textual canônica ("28 t", "1.3 m3", "" quando vazio). */
  texto: string;
  /** Código de erro estável quando entrada ambígua/inválida. */
  erro: 'CAPACIDADE_UNIDADE_INVALIDA' | 'CAPACIDADE_VALOR_INVALIDO' | null;
}

const CAP_VAZIA: CapacidadeCanonica = { valor: null, unidade: null, texto: '', erro: null };

function normalizaUnidadeRaw(u: string): CapacidadeUnidadeCanonica | null {
  const k = u.trim().toLowerCase().replace(/\.$/, '');
  if (!k) return null;
  return ALIASES[k] ?? null;
}

function parseNumeroBR(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  // aceita "1.234,56" e "1234.56"
  const semMilhar = s.replace(/\.(?=\d{3}(\D|$))/g, '');
  const norm = semMilhar.replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(norm)) return null;
  const n = Number(norm);
  return Number.isFinite(n) ? n : null;
}

function formataValor(n: number): string {
  // remove zeros à direita e ponto final desnecessário
  if (Number.isInteger(n)) return String(n);
  return String(n);
}

/**
 * Parseia entrada única de capacidade (do XLSX simplificado — coluna única `capacidade`).
 *   Aceita: "28 t", "28t", "28 ton", "1.3 m3", "1,3 m3", "", null.
 *   Também aceita entrada por par explícito {valor, unidade}.
 */
export function parseCapacidade(entrada: unknown): CapacidadeCanonica {
  if (entrada === null || entrada === undefined) return CAP_VAZIA;
  const s = String(entrada).trim();
  if (!s) return CAP_VAZIA;

  // Formato numérico puro (sem unidade) → valor sem unidade
  const nSolo = parseNumeroBR(s);
  if (nSolo !== null && !/[a-zA-Z³]/.test(s)) {
    return { valor: nSolo, unidade: null, texto: formataValor(nSolo), erro: null };
  }

  // Split valor + unidade (unidade começa por letra ou ³, pode conter dígitos ex.: "m3")
  const m = s.match(/^\s*([\d.,\s-]+)\s*([a-zA-Z³][a-zA-Z³0-9]*)\s*$/);
  if (!m) return { valor: null, unidade: null, texto: s, erro: 'CAPACIDADE_VALOR_INVALIDO' };
  const numStr = m[1].replace(/\s+/g, '');
  const uniStr = m[2];
  const valor = parseNumeroBR(numStr);
  if (valor === null) return { valor: null, unidade: null, texto: s, erro: 'CAPACIDADE_VALOR_INVALIDO' };
  const unidade = normalizaUnidadeRaw(uniStr);
  if (unidade === null) {
    return { valor, unidade: null, texto: s, erro: 'CAPACIDADE_UNIDADE_INVALIDA' };
  }
  return { valor, unidade, texto: `${formataValor(valor)} ${unidade}`, erro: null };
}

/** Ident. estável para diff (`null` quando vazio). */
export function chaveCapacidadeCanonica(entrada: unknown): string | null {
  const c = parseCapacidade(entrada);
  if (c.erro) return `__ERRO__:${c.erro}:${c.texto}`;
  if (c.valor === null && c.unidade === null) return null;
  return `${c.valor ?? ''}|${c.unidade ?? ''}`;
}
