import { normalizeText } from './normalizeOrgao';

// ============================================================
// Dicionário de sinônimos técnicos
// ============================================================
export interface GrupoSinonimo {
  id: string;
  nome: string;
  palavras: string[];
}

export const DICIONARIO_SINONIMOS: GrupoSinonimo[] = [
  {
    id: 'pavimentacao',
    nome: 'Pavimentação',
    palavras: [
      'PAVIMENTACAO', 'ASFALTO', 'RECAPEAMENTO', 'VIAS', 'RODOVIA', 'RODOVIAS',
      'CONSTRUCAO DE ESTRUTURAS', 'CBUQ', 'CONCRETO ASFALTICO', 'TAPA BURACO',
      'PAVIMENTO', 'REVESTIMENTO ASFALTICO', 'MASSA ASFALTICA',
    ],
  },
  {
    id: 'drenagem',
    nome: 'Drenagem',
    palavras: [
      'DRENAGEM', 'CANALIZACAO', 'SANEAMENTO', 'HIDRAULICO', 'SERVICOS HIDRAULICOS',
      'CONTROLE DE INUNDACAO', 'REDE PLUVIAL', 'GALERIA', 'BUEIRO', 'MICRODRENAGEM',
      'MACRODRENAGEM', 'ESGOTAMENTO',
    ],
  },
  {
    id: 'infraestrutura',
    nome: 'Infraestrutura',
    palavras: [
      'INFRAESTRUTURA', 'OBRA PUBLICA', 'OBRAS PUBLICAS', 'ENGENHARIA CIVIL',
      'CONSTRUCAO CIVIL', 'URBANIZACAO', 'IMPLANTACAO VIARIA', 'REVITALIZACAO',
      'REQUALIFICACAO URBANA',
    ],
  },
  {
    id: 'terraplanagem',
    nome: 'Terraplanagem',
    palavras: [
      'TERRAPLANAGEM', 'MOVIMENTACAO DE TERRA', 'ESCAVACAO', 'COMPACTACAO',
      'ATERRO', 'CORTE E ATERRO', 'TERRAPLENAGEM',
    ],
  },
  {
    id: 'ambiental',
    nome: 'Ambiental',
    palavras: [
      'RECUPERACAO AMBIENTAL', 'MEIO AMBIENTE', 'SUSTENTABILIDADE',
      'REFLORESTAMENTO', 'AREA DEGRADADA', 'LICENCIAMENTO AMBIENTAL',
      'COMPENSACAO AMBIENTAL',
    ],
  },
];

// Siglas de órgãos estratégicos que concedem pontuação extra
const ORGAOS_ESTRATEGICOS = ['SECID', 'INEA', 'SEIOP', 'SEHIS', 'SEAS'];

// ============================================================
// Resultado do matching
// ============================================================
export interface SmartMatchResult {
  score: number;
  gruposEncontrados: string[];   // ids dos grupos
  gruposNomes: string[];         // nomes legíveis
  motivos: string[];             // motivos legíveis do score
  incluir: boolean;              // score >= 5 ou órgão estratégico
}

// ============================================================
// Lógica de matching inteligente
// ============================================================
export function calcularSmartMatch(
  textoObjeto: string,
  orgaoSigla: string | null,
  valorEstimado: number | null,
): SmartMatchResult {
  const normalizado = normalizeText(textoObjeto);
  let score = 0;
  const gruposEncontrados: string[] = [];
  const gruposNomes: string[] = [];
  const motivos: string[] = [];

  // 1. Verificar cada grupo de sinônimos
  for (const grupo of DICIONARIO_SINONIMOS) {
    const match = grupo.palavras.some((palavra) => normalizado.includes(palavra));
    if (match) {
      score += 5;
      gruposEncontrados.push(grupo.id);
      gruposNomes.push(grupo.nome);
      motivos.push(`+5 grupo "${grupo.nome}"`);
    }
  }

  // 2. Verificar órgão estratégico
  if (orgaoSigla && ORGAOS_ESTRATEGICOS.includes(orgaoSigla.toUpperCase())) {
    score += 10;
    motivos.push(`+10 órgão estratégico (${orgaoSigla})`);
  }

  // 3. Verificar valor
  const valor = valorEstimado ?? 0;
  if (valor >= 15_000_000) {
    score += 10;
    motivos.push('+10 valor muito alto (≥ R$ 15M)');
  } else if (valor >= 5_000_000) {
    score += 5;
    motivos.push('+5 valor alto (≥ R$ 5M)');
  }

  // 4. Critério de inclusão
  const isOrgaoEstrategico = !!(orgaoSigla && ORGAOS_ESTRATEGICOS.includes(orgaoSigla.toUpperCase()));
  const incluir = score >= 5 || isOrgaoEstrategico;

  return { score, gruposEncontrados, gruposNomes, motivos, incluir };
}

// ============================================================
// Badge helpers (para uso na UI)
// ============================================================
export function getScoreLabel(score: number): { label: string; variant: 'destructive' | 'default' | 'secondary' | 'outline' } {
  if (score >= 20) return { label: 'Muito Alta', variant: 'destructive' };
  if (score >= 15) return { label: 'Alta', variant: 'destructive' };
  if (score >= 10) return { label: 'Média', variant: 'default' };
  if (score >= 5)  return { label: 'Baixa', variant: 'secondary' };
  return { label: 'Mínima', variant: 'outline' };
}
