// Normalizadores de campos RH para evitar duplicidade visual em gráficos.
// Frontend-only: NÃO altera dados na base.

const stripAccents = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

const clean = (v?: string | null): string =>
  stripAccents((v ?? "").toString().trim().toLowerCase()).replace(/\s+/g, " ");

export function normalizeGenero(v?: string | null): string {
  const c = clean(v);
  if (!c) return "Não informado";
  if (["m", "masc", "masculino", "homem", "h"].includes(c)) return "Masculino";
  if (["f", "fem", "feminino", "mulher"].includes(c)) return "Feminino";
  return "Outro";
}

const ESCOLARIDADE_MAP: Record<string, string> = {
  "analfabeto": "Analfabeto",
  "fundamental incompleto": "Ensino Fundamental Incompleto",
  "ensino fundamental incompleto": "Ensino Fundamental Incompleto",
  "fundamental completo": "Ensino Fundamental Completo",
  "ensino fundamental completo": "Ensino Fundamental Completo",
  "medio incompleto": "Ensino Médio Incompleto",
  "ensino medio incompleto": "Ensino Médio Incompleto",
  "medio completo": "Ensino Médio Completo",
  "ensino medio completo": "Ensino Médio Completo",
  "tecnico": "Técnico",
  "tecnico completo": "Técnico",
  "ensino tecnico": "Técnico",
  "ensino tecnico completo": "Técnico",
  "superior incompleto": "Ensino Superior Incompleto",
  "ensino superior incompleto": "Ensino Superior Incompleto",
  "superior completo": "Ensino Superior Completo",
  "ensino superior completo": "Ensino Superior Completo",
  "pos graduacao": "Pós-graduação",
  "pos-graduacao": "Pós-graduação",
  "pos graduado": "Pós-graduação",
  "especializacao": "Pós-graduação",
  "mba": "Pós-graduação",
  "mestrado": "Mestrado",
  "doutorado": "Doutorado",
};

export function normalizeEscolaridade(v?: string | null): string {
  const c = clean(v);
  if (!c) return "Não informado";
  if (ESCOLARIDADE_MAP[c]) return ESCOLARIDADE_MAP[c];
  // Capitaliza fallback
  return c.replace(/\b\w/g, (l) => l.toUpperCase());
}
