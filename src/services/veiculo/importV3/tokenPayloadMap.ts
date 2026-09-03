// PR-3.3 Fase C — Separação estrita entre TOKENS (lógicos, uppercase) e PAYLOAD
// (chaves físicas transportadas para as RPCs V3).
//
// TOKENS ficam em `campos_atualizar`. Nunca aceitar nomes físicos aqui.
// PAYLOAD é a allowlist de chaves realmente gravadas por token.
//
// PROPRIETARIO exige `proprietario_cadastro_tipo` ('EMPRESA' | 'LOCADORA')
// derivado de `_LISTAS.contexto`. A RPC usa esse campo para setar
// atomicamente empresa_id XOR empresa_locadora_id.

export const TOKENS_ALLOWLIST = [
  'SUBCATEGORIA',
  'LINHA_OPERACIONAL',
  'PROPRIETARIO',
  'FABRICANTE',
  'MODELO',
  'MOTOR',
  'ANO_FABRICACAO',
  'PLACA',
  'CHASSI',
  'NUMERO_SERIE',
  'RENAVAM',
  'COR',
  'TIPO_COMBUSTIVEL',
  'CAPACIDADE',
  'ALUGUEL',
  'DEPARTAMENTO',
  'OBSERVACOES',
  // FASE C4: CENTRO_CUSTO é token atômico. A RPC aplica via
  // fn_aplicar_centro_custo_atual_equipamento(..., 'IMPORTACAO', ...),
  // prioridade 20 (não sobrescreve APONTAMENTO_CE/CENTRAL_TRANSPORTE
  // sem forcar=true), em bloco atômico com os demais campos.
  'CENTRO_CUSTO',
] as const;

export type TokenV3 = (typeof TOKENS_ALLOWLIST)[number];

const TOKENS_SET: ReadonlySet<string> = new Set(TOKENS_ALLOWLIST);

/** Payload allowlist: chaves físicas que cada token pode gravar. Fonte única. */
export const TOKEN_TO_PAYLOAD: Record<TokenV3, readonly string[]> = {
  MODELO:            ['modelo'],
  DEPARTAMENTO:      ['departamento_id_erp', 'departamento_nome'],
  FABRICANTE:        ['fabricante_id_erp', 'fabricante_nome'],
  SUBCATEGORIA:      ['subcategoria_id_erp', 'subcategoria_nome'],
  LINHA_OPERACIONAL: ['linha_operacional_id_erp', 'linha_operacional_codigo'],
  PROPRIETARIO: [
    'proprietario_regime',
    'proprietario_cadastro_tipo',
    'proprietario_id_erp',
    'proprietario_nome',
  ],
  CAPACIDADE:        ['capacidade', 'capacidade_valor', 'capacidade_unidade'],
  ALUGUEL:           ['aluguel'],
  MOTOR:             ['motor'],
  COR:               ['cor'],
  PLACA:             ['placa'],
  CHASSI:            ['chassi'],
  NUMERO_SERIE:      ['numero_serie'],
  RENAVAM:           ['renavam'],
  TIPO_COMBUSTIVEL:  ['tipo_combustivel'],
  ANO_FABRICACAO:    ['ano_fabricacao'],
  OBSERVACOES:       ['observacoes'],
  CENTRO_CUSTO:      ['centro_custo_id_erp', 'centro_custo_codigo'],
};

/** Nomes físicos que NUNCA podem aparecer como token. */
export const NAO_TOKENS: ReadonlySet<string> = new Set([
  'modelo',
  'modelo_id',
  'departamento_id',
  'departamento_id_erp',
  'numero_serie',
  'frota_codigo',
  // 'centro_custo' saiu — agora é o token CENTRO_CUSTO.
]);

export interface ParseTokensV3Result {
  tokens: TokenV3[];
  payload_chaves: string[];
  erro: string | null;
}

/**
 * Normaliza e valida `campos_atualizar`:
 *   - split por `|`, trim;
 *   - tokens vazios são rejeitados;
 *   - uppercase é obrigatório para tokens (rejeita nomes minúsculos/físicos);
 *   - dedup mantendo a primeira ocorrência;
 *   - retorna também a lista consolidada de chaves físicas do payload.
 */
export function parseCamposAtualizarV3(csv: string | null | undefined): ParseTokensV3Result {
  const raw = String(csv ?? '').split('|').map((s) => s.trim());
  if (raw.every((s) => s === '')) return { tokens: [], payload_chaves: [], erro: 'campos_atualizar vazio' };
  if (raw.some((s) => s === '')) return { tokens: [], payload_chaves: [], erro: 'token vazio em campos_atualizar' };

  const seen = new Set<string>();
  const tokens: TokenV3[] = [];
  for (const t of raw) {
    // Aceita apenas MAIÚSCULAS. Minúsculas → rejeitar (com mensagem específica
    // se for nome físico conhecido).
    if (t !== t.toUpperCase()) {
      if (NAO_TOKENS.has(t)) {
        return {
          tokens: [], payload_chaves: [],
          erro: `token "${t}" é nome físico — use apenas TOKENS lógicos em MAIÚSCULAS (${TOKENS_ALLOWLIST.join(', ')})`,
        };
      }
      return {
        tokens: [], payload_chaves: [],
        erro: `token "${t}" precisa estar em MAIÚSCULAS`,
      };
    }
    if (!TOKENS_SET.has(t)) {
      return {
        tokens: [], payload_chaves: [],
        erro: `token "${t}" fora da allowlist (use ${TOKENS_ALLOWLIST.join(', ')})`,
      };
    }
    if (seen.has(t)) continue;
    seen.add(t);
    tokens.push(t as TokenV3);
  }

  const payload = new Set<string>();
  for (const t of tokens) for (const k of TOKEN_TO_PAYLOAD[t]) payload.add(k);
  return { tokens, payload_chaves: [...payload], erro: null };
}

/** Serializa tokens para `campos_atualizar` em ordem estável (allowlist). */
export function serializarTokensV3(tokens: readonly TokenV3[]): string {
  const set = new Set<string>(tokens);
  return TOKENS_ALLOWLIST.filter((t) => set.has(t)).join('|');
}
