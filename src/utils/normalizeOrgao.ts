/**
 * Normaliza texto removendo acentos, caracteres especiais e espaços duplicados.
 * Retorna em MAIÚSCULAS.
 */
export function normalizeText(value?: string | null): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

export interface AliasRecord {
  orgao_id: string;
  alias_nome: string;
  alias_normalizado: string;
  orgao?: {
    id: string;
    nome: string;
    sigla: string;
  } | null;
}

export interface OrgaoBasico {
  id: string;
  nome: string;
  sigla: string;
}

export interface NormalizedOrgaoMatch {
  orgaoId: string | null;
  orgaoSigla: string | null;
  orgaoNomeInterno: string | null;
  nomeApiOriginal: string;
  nomeApiNormalizado: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchingStrategy: 'exact_alias' | 'contains_alias' | 'contains_keyword' | 'manual_needed' | 'not_found';
}

const KEYWORD_MAP = [
  { sigla: 'SECID', keywords: ['SECRETARIA DE ESTADO DAS CIDADES', 'SECID'] },
  { sigla: 'INEA', keywords: ['INSTITUTO ESTADUAL DO AMBIENTE', 'INEA'] },
  { sigla: 'SEIOP', keywords: ['SECRETARIA DE ESTADO DE INFRAESTRUTURA E OBRAS PUBLICAS', 'SEIOP'] },
  { sigla: 'SEHIS', keywords: ['SECRETARIA DE ESTADO DE HABITACAO DE INTERESSE SOCIAL', 'SEHIS'] },
  { sigla: 'SEAS', keywords: ['SECRETARIA DE ESTADO DO AMBIENTE E SUSTENTABILIDADE', 'SEAS'] },
];

/**
 * Tenta encontrar um órgão interno que corresponda ao nome vindo da API.
 * Estratégias: exact_alias → contains_alias → contains_keyword → manual_needed
 */
export function findOrgaoMatch(
  apiName: string | null | undefined,
  aliases: AliasRecord[],
  orgaosBySigla: Map<string, OrgaoBasico>
): NormalizedOrgaoMatch {
  const original = apiName ?? '';
  const normalized = normalizeText(original);

  if (!normalized) {
    return {
      orgaoId: null, orgaoSigla: null, orgaoNomeInterno: null,
      nomeApiOriginal: original, nomeApiNormalizado: normalized,
      confidence: 'none', matchingStrategy: 'not_found',
    };
  }

  // 1. Match exato por alias normalizado
  const exactAlias = aliases.find(a => a.alias_normalizado === normalized);
  if (exactAlias?.orgao) {
    return {
      orgaoId: exactAlias.orgao.id, orgaoSigla: exactAlias.orgao.sigla,
      orgaoNomeInterno: exactAlias.orgao.nome,
      nomeApiOriginal: original, nomeApiNormalizado: normalized,
      confidence: 'high', matchingStrategy: 'exact_alias',
    };
  }

  // 2. Match por contains
  const containsAlias = aliases.find(a =>
    normalized.includes(a.alias_normalizado) || a.alias_normalizado.includes(normalized)
  );
  if (containsAlias?.orgao) {
    return {
      orgaoId: containsAlias.orgao.id, orgaoSigla: containsAlias.orgao.sigla,
      orgaoNomeInterno: containsAlias.orgao.nome,
      nomeApiOriginal: original, nomeApiNormalizado: normalized,
      confidence: 'medium', matchingStrategy: 'contains_alias',
    };
  }

  // 3. Fallback por keywords
  for (const item of KEYWORD_MAP) {
    const matched = item.keywords.some(keyword => normalized.includes(keyword));
    if (matched) {
      const orgao = orgaosBySigla.get(item.sigla);
      if (orgao) {
        return {
          orgaoId: orgao.id, orgaoSigla: orgao.sigla, orgaoNomeInterno: orgao.nome,
          nomeApiOriginal: original, nomeApiNormalizado: normalized,
          confidence: 'low', matchingStrategy: 'contains_keyword',
        };
      }
    }
  }

  return {
    orgaoId: null, orgaoSigla: null, orgaoNomeInterno: null,
    nomeApiOriginal: original, nomeApiNormalizado: normalized,
    confidence: 'none', matchingStrategy: 'manual_needed',
  };
}
