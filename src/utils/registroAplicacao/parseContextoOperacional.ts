/**
 * Parser tolerante do bloco [CONTEXTO_OPERACIONAL] gravado em
 * bd_registro_apontamento_aplicacao.observacoes_gerais pelo Wizard de
 * Registro Manual. Também extrai [OBSERVACOES_APONTADOR].
 *
 * Não usa eval. Tolerante a campo ausente, ordem qualquer e valores "-".
 */

export interface ContextoOperacionalParsed {
  equipe?: string;
  caminhaoFrota?: string;
  placa?: string;
  motorista?: string;
  totalCarga?: string;
  temperaturaMassa?: string;
  tipoTraco?: string;
  tipoPintura?: string;
  logradouro?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  latitude?: string;
  longitude?: string;
  origemLocalizacao?: string;
  condominio?: string;
  imagensAnexadas?: string;
  observacoesApontador?: string;
}

// Mapa: chave do objeto → variações de rótulo aceitas (case-insensitive)
const LABEL_MAP: Array<[keyof ContextoOperacionalParsed, string[]]> = [
  ["equipe", ["equipe"]],
  ["caminhaoFrota", ["caminhão/frota", "caminhao/frota", "caminhão", "caminhao", "frota"]],
  ["placa", ["placa"]],
  ["motorista", ["motorista"]],
  ["totalCarga", ["total carga", "total de carga"]],
  ["temperaturaMassa", ["temperatura massa", "temperatura da massa"]],
  ["tipoTraco", ["tipo de traço", "tipo de traco", "tipo traço", "tipo traco"]],
  ["tipoPintura", ["tipo de pintura", "tipo pintura"]],
  ["logradouro", ["logradouro"]],
  ["bairro", ["bairro"]],
  ["cidade", ["cidade"]],
  ["uf", ["uf"]],
  ["cep", ["cep"]],
  ["latitude", ["latitude"]],
  ["longitude", ["longitude"]],
  ["origemLocalizacao", ["origem localização", "origem localizacao"]],
  ["condominio", ["condomínio", "condominio"]],
  ["imagensAnexadas", ["imagens anexadas"]],
];

const stripEmpty = (raw: string): string | undefined => {
  const v = raw.trim();
  if (!v) return undefined;
  if (v === "-" || v === "—" || v.toLowerCase() === "n/a") return undefined;
  return v;
};

const extractBlock = (text: string, tag: string): string | null => {
  const re = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[/${tag}\\]`, "i");
  const m = text.match(re);
  return m ? m[1] : null;
};

export function parseContextoOperacional(
  observacoesGerais?: string | null
): ContextoOperacionalParsed {
  const out: ContextoOperacionalParsed = {};
  if (!observacoesGerais || typeof observacoesGerais !== "string") return out;

  const ctx = extractBlock(observacoesGerais, "CONTEXTO_OPERACIONAL");
  if (ctx) {
    const lines = ctx.split(/\r?\n/);
    for (const line of lines) {
      const idx = line.indexOf(":");
      if (idx < 0) continue;
      const label = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1);
      if (!label) continue;

      for (const [key, aliases] of LABEL_MAP) {
        if (aliases.includes(label)) {
          // remove unidade solta no fim (t, °C) apenas quando redundante
          const cleaned = stripEmpty(value.replace(/\s+t$/i, "").replace(/\s+°?C$/i, ""));
          if (cleaned) (out as any)[key] = cleaned;
          break;
        }
      }
    }
  }

  const obs = extractBlock(observacoesGerais, "OBSERVACOES_APONTADOR");
  if (obs) {
    const trimmed = obs.trim();
    if (trimmed) out.observacoesApontador = trimmed;
  }

  return out;
}
