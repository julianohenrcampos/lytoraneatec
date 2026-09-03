/**
 * Parser tolerante do bloco [CONTEXTO_OPERACIONAL] gravado em
 * bd_registro_apontamento_aplicacao.observacoes_gerais pelo Wizard de
 * Registro Manual. Também extrai [OBSERVACOES_APONTADOR].
 *
 * Não usa eval. Tolerante a campo ausente, ordem qualquer e valores "-".
 */

export interface ContextoOperacionalParsed {
  equipeId?: string;
  equipe?: string;
  caminhaoId?: string;
  caminhaoFrota?: string;
  placa?: string;
  motoristaId?: string;
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
  if (v.toLowerCase() === "null" || v.toLowerCase() === "undefined") return undefined;
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
    // Formato novo: JSON single-line dentro do bloco
    let parsedJson: any = null;
    try {
      parsedJson = JSON.parse(ctx.trim());
    } catch {
      parsedJson = null;
    }
    if (parsedJson && typeof parsedJson === "object" && !Array.isArray(parsedJson)) {
      const assign = (key: keyof ContextoOperacionalParsed, raw: unknown) => {
        if (raw === null || raw === undefined) return;
        const v = stripEmpty(String(raw));
        if (v) (out as any)[key] = v;
      };
      assign("placa", parsedJson.placa);
      assign("equipeId", parsedJson.equipe_id);
      assign("equipe", parsedJson.equipe_nome ?? parsedJson.equipe);
      assign("caminhaoId", parsedJson.caminhao_id);
      assign("caminhaoFrota", parsedJson.frota ?? parsedJson.caminhaoFrota);
      assign("motoristaId", parsedJson.motorista_id);
      assign("motorista", parsedJson.motorista_nome ?? parsedJson.motorista);
      assign("totalCarga", parsedJson.total_carga_t ?? parsedJson.totalCarga);
      assign("temperaturaMassa", parsedJson.temperatura_massa ?? parsedJson.temperaturaMassa);
      assign("tipoTraco", parsedJson.tipo_traco ?? parsedJson.tipoTraco);
      assign("tipoPintura", parsedJson.tipo_pintura ?? parsedJson.tipoPintura);
      assign("condominio", parsedJson.condominio);
      assign("logradouro", parsedJson.logradouro);
      assign("bairro", parsedJson.bairro);
      assign("cidade", parsedJson.cidade);
      assign("uf", parsedJson.uf);
      assign("cep", parsedJson.cep);
      assign("latitude", parsedJson.latitude);
      assign("longitude", parsedJson.longitude);
      assign("origemLocalizacao", parsedJson.origem_localizacao ?? parsedJson.origemLocalizacao);
    } else {
      // Formato legado: "label: valor" linha-a-linha
      const lines = ctx.split(/\r?\n/);
      for (const line of lines) {
        const idx = line.indexOf(":");
        if (idx < 0) continue;
        const label = line.slice(0, idx).trim().toLowerCase();
        const value = line.slice(idx + 1);
        if (!label) continue;

        for (const [key, aliases] of LABEL_MAP) {
          if (aliases.includes(label)) {
            const cleaned = stripEmpty(value.replace(/\s+t$/i, "").replace(/\s+°?C$/i, ""));
            if (cleaned) (out as any)[key] = cleaned;
            break;
          }
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

// ============================================================================
// parseRuasAplicacao — bloco [RUAS_APLICACAO]{JSON}[/RUAS_APLICACAO]
// Persistência temporária em observacoes_gerais até a Fase B ter tabela real.
// ============================================================================

export interface BuracoRuaParsed {
  sequenciaRua: number;
  sequenciaAplicacao: number;
  bordo?: string | null;
  comprimento?: number | null;
  larguraMedia?: number | null;
  area: number;
  toneladaRateada?: number | null;
  espessura?: number | null;
  gps?: { latitude: number; longitude: number; accuracy?: number } | null;
  fotosCount?: number | null;
  observacao?: string | null;
  tipo_item?: string | null;
}

export interface RuaAplicacaoParsed {
  idLocal: string;
  chaveNorm: string;
  logradouro: string;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  sequenciaRua: number;
  areaRua: number;
  toneladaRua?: number | null;
  buracos: BuracoRuaParsed[];
}

const isNum = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

export function parseRuasAplicacao(
  observacoesGerais?: string | null
): RuaAplicacaoParsed[] | null {
  if (!observacoesGerais || typeof observacoesGerais !== "string") return null;
  const raw = extractBlock(observacoesGerais, "RUAS_APLICACAO");
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const ruas: RuaAplicacaoParsed[] = [];
  for (const r of parsed as any[]) {
    if (!r || typeof r !== "object") continue;
    if (typeof r.logradouro !== "string" || !r.logradouro.trim()) continue;
    const buracosSrc = Array.isArray(r.buracos) ? r.buracos : [];
    const buracos: BuracoRuaParsed[] = [];
    for (const b of buracosSrc) {
      if (!b || typeof b !== "object") continue;
      buracos.push({
        sequenciaRua: Number(b.sequenciaRua) || 0,
        sequenciaAplicacao: Number(b.sequenciaAplicacao) || 0,
        bordo: typeof b.bordo === "string" ? b.bordo : null,
        comprimento: isNum(Number(b.comprimento)) ? Number(b.comprimento) : null,
        larguraMedia: isNum(Number(b.larguraMedia)) ? Number(b.larguraMedia) : null,
        area: Number(b.area) || 0,
        toneladaRateada: isNum(Number(b.toneladaRateada))
          ? Number(b.toneladaRateada)
          : null,
        espessura: isNum(Number(b.espessura)) ? Number(b.espessura) : null,
        gps:
          b.gps && typeof b.gps === "object" && isNum(Number(b.gps.latitude)) && isNum(Number(b.gps.longitude))
            ? {
                latitude: Number(b.gps.latitude),
                longitude: Number(b.gps.longitude),
                accuracy: isNum(Number(b.gps.accuracy)) ? Number(b.gps.accuracy) : undefined,
              }
            : null,
        fotosCount: isNum(Number(b.fotosCount)) ? Number(b.fotosCount) : 0,
        observacao: typeof b.observacao === "string" ? b.observacao : null,
        tipo_item: typeof b.tipo_item === "string" ? b.tipo_item : null,
      });
    }
    ruas.push({
      idLocal: String(r.idLocal || ""),
      chaveNorm: String(r.chaveNorm || ""),
      logradouro: String(r.logradouro).trim(),
      bairro: typeof r.bairro === "string" ? r.bairro : null,
      cidade: typeof r.cidade === "string" ? r.cidade : null,
      uf: typeof r.uf === "string" ? r.uf : null,
      sequenciaRua: Number(r.sequenciaRua) || 0,
      areaRua: Number(r.areaRua) || buracos.reduce((s, x) => s + (x.area || 0), 0),
      toneladaRua: isNum(Number(r.toneladaRua)) ? Number(r.toneladaRua) : null,
      buracos,
    });
  }
  if (!ruas.length) return null;
  return ruas;
}

