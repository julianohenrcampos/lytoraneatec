// Fase 6F / 6H.1.1 / 6I.2-B — Mapeamento de colunas (aliases case/acento-insensíveis).

export type CampoCanonico =
  | "codigo_wbs"
  | "uid_tarefa"
  | "id_tarefa"
  | "nome"
  | "descricao"
  | "frente_servico"
  | "data_inicio"
  | "data_fim"
  | "unidade"
  | "quantidade_prevista"
  | "producao_prevista"
  | "prioridade"
  | "tipo_linha"
  | "centro_custo";

export function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[._\-/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ALIASES: Record<CampoCanonico, string[]> = {
  codigo_wbs: ["codigo wbs", "wbs", "edt", "id", "task id", "codigo", "code"],
  uid_tarefa: [
    "uid tarefa",
    "task uid",
    "uid",
    "tarefa uid",
    "identificacao exclusiva da tarefa",
    "identificacao exclusiva",
    "id exclusiva",
  ],
  id_tarefa: ["id tarefa", "task id", "id da tarefa"],
  nome: [
    "nome",
    "atividade",
    "tarefa",
    "task",
    "task name",
    "name",
    "descricao da tarefa",
    "nome tarefa",
    "nome da tarefa",
  ],
  descricao: ["descricao", "description", "detalhes", "notes", "observacao"],
  frente_servico: [
    "frente",
    "frente servico",
    "frente de servico",
    "front",
    "frente de trabalho",
  ],
  data_inicio: [
    "data inicio",
    "inicio",
    "start",
    "start date",
    "data de inicio",
    "comeco",
  ],
  data_fim: [
    "data fim",
    "fim",
    "termino",
    "finish",
    "finish date",
    "end",
    "end date",
    "data termino",
  ],
  unidade: ["unidade", "un", "unit"],
  quantidade_prevista: [
    "quantidade prevista",
    "quantidade",
    "qtde",
    "qtd",
    "quantity",
    "qty",
  ],
  producao_prevista: [
    "producao prevista",
    "producao",
    "production",
    "produtividade prevista",
  ],
  prioridade: ["prioridade", "priority"],
  tipo_linha: ["tipo", "tipo linha", "summary", "resumo", "is summary"],
  centro_custo: [
    "centro de custo",
    "centro custo",
    "cc",
    "codigo do cc",
    "codigo cc",
    "obra",
    "codigo da obra",
    "projeto",
    "project",
  ],
};

export type MapaCabecalho = Partial<Record<CampoCanonico, string>>;

export function mapearCabecalhos(headers: string[]): MapaCabecalho {
  const mapa: MapaCabecalho = {};
  const headerNorms = headers.map((h) => ({ raw: h, norm: norm(h) }));

  (Object.keys(ALIASES) as CampoCanonico[]).forEach((campo) => {
    const cands = ALIASES[campo];
    for (const h of headerNorms) {
      if (cands.includes(h.norm)) {
        mapa[campo] = h.raw;
        return;
      }
    }
    for (const h of headerNorms) {
      if (cands.some((c) => h.norm.includes(c))) {
        mapa[campo] = h.raw;
        return;
      }
    }
  });

  return mapa;
}

export function ehLinhaResumo(row: Record<string, unknown>, mapa: MapaCabecalho): boolean {
  if (mapa.tipo_linha) {
    const v = String(row[mapa.tipo_linha] ?? "").trim().toLowerCase();
    if (["sim", "yes", "true", "1", "resumo", "summary"].includes(v)) return true;
  }
  return false;
}

export function normalizarTextoCcParaComparacao(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

// ---------- 6H.1.1 / 6I.2-B — Mapa de cabeçalhos da aba Atribuições ----------

export type CampoAlocacao =
  | "uid_tarefa"
  | "id_tarefa"
  | "wbs_tarefa"
  | "nome_tarefa"
  | "uid_recurso"
  | "id_recurso"
  | "nome_recurso"
  | "grupo"
  | "familia"
  | "trabalho_horas"
  | "unidades";

const ALIASES_ALOCACAO: Record<CampoAlocacao, string[]> = {
  uid_tarefa: [
    "uid tarefa",
    "tarefa uid",
    "task uid",
    "identificacao exclusiva da tarefa",
    "identificacao exclusiva",
  ],
  id_tarefa: ["id tarefa", "task id", "id da tarefa", "id exclusiva"],
  wbs_tarefa: ["wbs", "edt", "wbs tarefa", "codigo wbs"],
  nome_tarefa: ["nome tarefa", "nome da tarefa", "tarefa", "task name", "atividade"],
  uid_recurso: [
    "uid recurso",
    "recurso uid",
    "resource uid",
    "identificacao exclusiva do recurso",
  ],
  id_recurso: ["id recurso", "resource id", "id do recurso"],
  nome_recurso: [
    "nome recurso",
    "nome do recurso",
    "recurso",
    "resource name",
    "resource",
  ],
  grupo: ["grupo", "group", "classificacao", "natureza"],
  familia: ["familia", "tipo recurso", "tipo de recurso", "categoria"],
  trabalho_horas: ["trabalho h", "trabalho horas", "trabalho", "work", "horas", "h"],
  unidades: ["unidades", "units", "alocacao"],
};

export type MapaCabecalhoAlocacao = Partial<Record<CampoAlocacao, string>>;

export function mapearCabecalhosAlocacoes(headers: string[]): MapaCabecalhoAlocacao {
  const mapa: MapaCabecalhoAlocacao = {};
  const headerNorms = headers.map((h) => ({ raw: h, norm: norm(h) }));

  (Object.keys(ALIASES_ALOCACAO) as CampoAlocacao[]).forEach((campo) => {
    const cands = ALIASES_ALOCACAO[campo];
    for (const h of headerNorms) {
      if (cands.includes(h.norm)) {
        mapa[campo] = h.raw;
        return;
      }
    }
    for (const h of headerNorms) {
      if (cands.some((c) => h.norm.includes(c))) {
        mapa[campo] = h.raw;
        return;
      }
    }
  });

  return mapa;
}

// ---------- 6I.2-B — Mapa de cabeçalhos da aba Recursos (catálogo) ----------

export type CampoRecurso =
  | "uid_recurso"
  | "id_recurso"
  | "nome_recurso"
  | "grupo"
  | "familia"
  | "unidade_medida"
  | "observacoes";

const ALIASES_RECURSO: Record<CampoRecurso, string[]> = {
  uid_recurso: [
    "uid recurso",
    "recurso uid",
    "resource uid",
    "identificacao exclusiva do recurso",
    "identificacao exclusiva",
  ],
  id_recurso: ["id recurso", "resource id", "id do recurso", "id"],
  nome_recurso: [
    "nome recurso",
    "nome do recurso",
    "recurso",
    "resource name",
    "resource",
    "nome",
  ],
  grupo: ["grupo", "group", "classificacao", "natureza"],
  familia: ["familia", "tipo recurso", "tipo de recurso", "categoria"],
  unidade_medida: ["unidade", "unidade medida", "un", "unit", "uom"],
  observacoes: ["observacao", "observacoes", "notes", "obs"],
};

export type MapaCabecalhoRecurso = Partial<Record<CampoRecurso, string>>;

export function mapearCabecalhosRecursos(headers: string[]): MapaCabecalhoRecurso {
  const mapa: MapaCabecalhoRecurso = {};
  const headerNorms = headers.map((h) => ({ raw: h, norm: norm(h) }));

  (Object.keys(ALIASES_RECURSO) as CampoRecurso[]).forEach((campo) => {
    const cands = ALIASES_RECURSO[campo];
    for (const h of headerNorms) {
      if (cands.includes(h.norm)) {
        mapa[campo] = h.raw;
        return;
      }
    }
    for (const h of headerNorms) {
      if (cands.some((c) => h.norm.includes(c))) {
        mapa[campo] = h.raw;
        return;
      }
    }
  });

  return mapa;
}

/** Chave normalizada para casar Nome Recurso ↔ bd_funcoes.nome_funcao. */
export function chaveNomeFuncao(v: string | null | undefined): string {
  if (!v) return "";
  return v
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
