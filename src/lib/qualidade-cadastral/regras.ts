/**
 * Catálogo de regras da Central de Qualidade Cadastral.
 * ---------------------------------------------------------------------------
 * Fonte única de metadados das regras (código, domínio, tipo, severidade,
 * campo, aplicabilidade e mensagem). O backend (vw_qc_pendencias) aplica as
 * mesmas condições; este catálogo é a camada testável/legível do frontend.
 *
 * Esta camada é 100% de LEITURA/DIAGNÓSTICO — nunca altera cadastros.
 */

export type QcDominio =
  | "CENTRO_CUSTO"
  | "FUNCIONARIO"
  | "VEICULO_EQUIPAMENTO"
  | "FUNCAO";

export type QcTipo =
  | "INCOMPLETO"
  | "INCONSISTENTE"
  | "POSSIVEL_DUPLICIDADE"
  | "DESATUALIZADO"
  | "SEM_RESPONSAVEL";

export type QcSeveridade = "CRITICA" | "ALTA" | "MEDIA" | "BAIXA";

export interface QcRegra {
  codigo: string;
  dominio: QcDominio;
  tipo: QcTipo;
  severidade: QcSeveridade;
  campo: string;
  mensagem: string;
  /** Quando a regra é avaliada (contexto de aplicabilidade). */
  aplicabilidade: string;
}

export const DOMINIO_LABEL: Record<QcDominio, string> = {
  CENTRO_CUSTO: "Centros de Custo",
  FUNCIONARIO: "Funcionários",
  VEICULO_EQUIPAMENTO: "Veículos e Equipamentos",
  FUNCAO: "Funções",
};

export const TIPO_LABEL: Record<QcTipo, string> = {
  INCOMPLETO: "Incompleto",
  INCONSISTENTE: "Inconsistente",
  POSSIVEL_DUPLICIDADE: "Possível duplicidade",
  DESATUALIZADO: "Desatualizado",
  SEM_RESPONSAVEL: "Sem responsável",
};

export const SEVERIDADE_LABEL: Record<QcSeveridade, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Média",
  BAIXA: "Baixa",
};

/** Peso de penalização no score (documentado em SCORE_FORMULA). */
export const PENALIDADE: Record<QcSeveridade, number> = {
  CRITICA: 40,
  ALTA: 20,
  MEDIA: 8,
  BAIXA: 3,
};

/**
 * Fórmula do Índice de Qualidade Cadastral:
 *   score(registro) = max(0, 100 - Σ penalidade(severidade das pendências))
 *   score(grupo)    = média aritmética do score dos registros do grupo
 * Registros sem pendência aplicável = 100.
 */
export const SCORE_FORMULA =
  "score = max(0, 100 − Σ penalidade); CRÍTICA 40, ALTA 20, MÉDIA 8, BAIXA 3; agregações usam a média dos registros.";

export const SEVERIDADE_ORDEM: QcSeveridade[] = ["CRITICA", "ALTA", "MEDIA", "BAIXA"];

const R = (
  codigo: string,
  dominio: QcDominio,
  tipo: QcTipo,
  severidade: QcSeveridade,
  campo: string,
  mensagem: string,
  aplicabilidade: string,
): QcRegra => ({ codigo, dominio, tipo, severidade, campo, mensagem, aplicabilidade });

export const REGRAS: QcRegra[] = [
  // ---------------- Centros de Custo (somente CC ativos) ----------------
  R("CC001", "CENTRO_CUSTO", "INCOMPLETO", "ALTA", "departamento_id", "Centro de custo ativo sem departamento", "CC ativo"),
  R("CC002", "CENTRO_CUSTO", "INCOMPLETO", "MEDIA", "diretoria_id", "Centro de custo sem diretoria", "CC ativo"),
  R("CC003", "CENTRO_CUSTO", "INCOMPLETO", "ALTA", "adm_sede_funcionario_id", "Centro de custo sem ADM SEDE", "CC ativo"),
  R("CC004", "CENTRO_CUSTO", "INCOMPLETO", "MEDIA", "adm_obra_funcionario_id", "Centro de custo sem ADM OBRA", "CC ativo"),
  R("CC005", "CENTRO_CUSTO", "INCOMPLETO", "ALTA", "aprovador_diarias_id", "Centro de custo sem aprovador de diárias", "CC ativo"),
  R("CC006", "CENTRO_CUSTO", "INCOMPLETO", "MEDIA", "endereco", "Endereço insuficiente (cidade/estado)", "CC ativo"),
  R("CC007", "CENTRO_CUSTO", "INCOMPLETO", "BAIXA", "latitude", "Endereço informado sem geocodificação", "CC ativo com cidade preenchida"),
  R("CC008", "CENTRO_CUSTO", "INCONSISTENTE", "ALTA", "responsaveis", "Responsável vinculado a funcionário inativo", "CC ativo com responsável definido"),
  R("CC009", "CENTRO_CUSTO", "INCOMPLETO", "BAIXA", "planejador_responsavel_id", "Centro de custo sem planejador responsável", "CC ativo"),
  R("CC010", "CENTRO_CUSTO", "INCOMPLETO", "MEDIA", "engenheiro_responsavel_id", "Centro de custo sem engenheiro responsável", "CC ativo"),
  R("CC011", "CENTRO_CUSTO", "POSSIVEL_DUPLICIDADE", "MEDIA", "nome_centro_custo", "Possível duplicidade — nome ou CNPJ equivalente a outro centro de custo", "CC ativo"),
  R("CC012", "CENTRO_CUSTO", "DESATUALIZADO", "BAIXA", "updated_at", "Cadastro sem atualização há mais de 365 dias", "CC ativo"),

  // ---------------- Funcionários (somente não inativos) ----------------
  R("FU001", "FUNCIONARIO", "INCOMPLETO", "ALTA", "matricula", "Funcionário ativo sem matrícula", "Funcionário não inativo"),
  R("FU002", "FUNCIONARIO", "INCOMPLETO", "CRITICA", "centro_custo_id", "Funcionário ativo sem centro de custo", "Funcionário não inativo"),
  R("FU003", "FUNCIONARIO", "INCOMPLETO", "CRITICA", "funcao_id", "Funcionário ativo sem função", "Funcionário não inativo"),
  R("FU004", "FUNCIONARIO", "INCOMPLETO", "ALTA", "departamento_id", "Funcionário ativo sem departamento", "Funcionário não inativo"),
  R("FU005", "FUNCIONARIO", "INCOMPLETO", "ALTA", "empresa_id", "Funcionário ativo sem empresa", "Funcionário não inativo"),
  R("FU006", "FUNCIONARIO", "INCOMPLETO", "ALTA", "data_admissao", "Funcionário ativo sem data de admissão", "Funcionário não inativo"),
  R("FU007", "FUNCIONARIO", "INCONSISTENTE", "ALTA", "centro_custo_id", "Vínculo com centro de custo inexistente ou inativo", "Funcionário com CC preenchido"),
  R("FU008", "FUNCIONARIO", "INCONSISTENTE", "ALTA", "funcao_id", "Vínculo com função inexistente ou inativa", "Funcionário com função preenchida"),
  R("FU009", "FUNCIONARIO", "INCOMPLETO", "CRITICA", "cpf", "Funcionário ativo sem CPF", "Funcionário não inativo"),
  R("FU010", "FUNCIONARIO", "INCOMPLETO", "BAIXA", "dados_bancarios", "Dados bancários incompletos", "Funcionário não inativo (valores não exibidos)"),
  R("FU011", "FUNCIONARIO", "INCOMPLETO", "BAIXA", "email", "Funcionário ativo sem e-mail", "Funcionário não inativo"),
  R("FU012", "FUNCIONARIO", "INCOMPLETO", "MEDIA", "endereco", "Endereço incompleto (cidade/estado)", "Funcionário não inativo"),
  R("FU013", "FUNCIONARIO", "POSSIVEL_DUPLICIDADE", "MEDIA", "matricula", "Possível duplicidade — matrícula ou nome+nascimento repetidos", "Funcionário não inativo"),
  R("FU014", "FUNCIONARIO", "INCOMPLETO", "BAIXA", "tipo_escala", "Funcionário ativo sem tipo de escala", "Funcionário não inativo"),

  // ---------------- Veículos e Equipamentos ----------------
  R("VE001", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "CRITICA", "categoria_ativo_id", "Ativo sem categoria", "Ativo não inativo"),
  R("VE002", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "ALTA", "subcategoria_ativo_id", "Ativo sem subcategoria", "Ativo não inativo"),
  R("VE003", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "ALTA", "frota_id", "Ativo sem frota", "Ativo não inativo"),
  R("VE004", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "MEDIA", "numero_frota", "Ativo sem número de frota", "Ativo não inativo"),
  R("VE005", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "CRITICA", "placa", "Veículo sem placa", "Somente ativos classificados como veículo rodoviário"),
  R("VE006", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "ALTA", "chassi", "Veículo sem chassi", "Somente veículos"),
  R("VE007", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "ALTA", "renavam", "Veículo sem RENAVAM", "Somente veículos"),
  R("VE008", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "ALTA", "empresa_locadora_id", "Ativo locado sem empresa locadora", "Somente ativos locados"),
  R("VE009", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "MEDIA", "empresa_id", "Ativo próprio sem empresa proprietária", "Somente ativos próprios"),
  R("VE010", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "MEDIA", "departamento_id", "Ativo sem departamento", "Ativo não inativo"),
  R("VE011", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "CRITICA", "centro_custo_atual_id", "Ativo operando sem centro de custo atual", "Situação Operando ou Em Manutenção"),
  R("VE012", "VEICULO_EQUIPAMENTO", "INCONSISTENTE", "ALTA", "centro_custo_atual_id", "Ativo alocado a centro de custo inexistente ou inativo", "Ativo com CC atual preenchido"),
  R("VE013", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "MEDIA", "fabricante_id", "Ativo sem fabricante", "Ativo não inativo"),
  R("VE014", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "BAIXA", "modelo", "Ativo sem modelo", "Ativo não inativo"),
  R("VE015", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "BAIXA", "ano_fabricacao", "Ativo sem ano de fabricação", "Ativo não inativo"),
  R("VE016", "VEICULO_EQUIPAMENTO", "DESATUALIZADO", "MEDIA", "centro_custo_atualizado_em", "Alocação sem atualização há mais de 90 dias", "Data autoritativa: centro_custo_atualizado_em (fallback updated_at)"),
  R("VE017", "VEICULO_EQUIPAMENTO", "DESATUALIZADO", "BAIXA", "updated_at", "Cadastro sem atualização há mais de 180 dias", "Ativo não inativo"),
  R("VE018", "VEICULO_EQUIPAMENTO", "INCONSISTENTE", "ALTA", "situacao", "Situação do cadastro divergente da disponibilidade operacional", "Disponibilidade operacional em MANUTENCAO"),
  R("VE019", "VEICULO_EQUIPAMENTO", "POSSIVEL_DUPLICIDADE", "MEDIA", "frota", "Possível duplicidade — frota e número de frota repetidos", "Ativo não inativo"),
  R("VE020", "VEICULO_EQUIPAMENTO", "INCOMPLETO", "MEDIA", "numero_serie", "Equipamento sem número de série", "Somente ativos que não são veículos rodoviários"),

  // ---------------- Funções ----------------
  R("FN001", "FUNCAO", "INCOMPLETO", "MEDIA", "salario_base", "Função ativa sem salário base", "Função ativa"),
  R("FN002", "FUNCAO", "INCOMPLETO", "MEDIA", "valor_diaria", "Função ativa sem valor de diária", "Função ativa"),
  R("FN003", "FUNCAO", "INCOMPLETO", "BAIXA", "valor_refeicao", "Função ativa sem valor de refeição", "Função ativa"),
  R("FN004", "FUNCAO", "INCOMPLETO", "BAIXA", "descricao", "Função sem descrição", "Todas as funções"),
  R("FN005", "FUNCAO", "INCONSISTENTE", "ALTA", "situacao", "Função inativa com funcionários ativos vinculados", "Função inativa"),
  R("FN006", "FUNCAO", "POSSIVEL_DUPLICIDADE", "MEDIA", "nome_funcao", "Possível redundância de nomenclatura com outra função", "Todas as funções"),
];

export const REGRAS_POR_CODIGO: Record<string, QcRegra> = REGRAS.reduce(
  (acc, r) => {
    acc[r.codigo] = r;
    return acc;
  },
  {} as Record<string, QcRegra>,
);

export function getRegra(codigo: string): QcRegra | undefined {
  return REGRAS_POR_CODIGO[codigo];
}

/** Score de um registro a partir das severidades das pendências aplicáveis. */
export function calcularScore(severidades: QcSeveridade[]): number {
  const penal = severidades.reduce((s, sev) => s + (PENALIDADE[sev] ?? 0), 0);
  return Math.max(0, 100 - penal);
}

/** Média de scores (0–100) — usada nas agregações por domínio/CC/responsável. */
export function mediaScores(scores: number[]): number {
  if (scores.length === 0) return 100;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

export type FaixaAtualizacao = "ate_30" | "de_31_60" | "de_61_90" | "mais_90";

export function faixaAtualizacao(dias: number): FaixaAtualizacao {
  if (dias <= 30) return "ate_30";
  if (dias <= 60) return "de_31_60";
  if (dias <= 90) return "de_61_90";
  return "mais_90";
}

/** Dias completos sem atualização, considerando a data autoritativa informada. */
export function diasSemAtualizacao(
  dataAutoritativa: string | Date | null | undefined,
  agora: Date = new Date(),
): number | null {
  if (!dataAutoritativa) return null;
  const d = dataAutoritativa instanceof Date ? dataAutoritativa : new Date(dataAutoritativa);
  if (Number.isNaN(d.getTime())) return null;
  return Math.max(0, Math.floor((agora.getTime() - d.getTime()) / 86400000));
}

export interface ResponsavelResolvido {
  nome: string | null;
  papel: string | null;
  secundario: string | null;
  definido: boolean;
}

/**
 * Resolve o responsável usando SOMENTE vínculos reais do ERP, na ordem:
 * ADM OBRA → ADM SEDE → Engenheiro Responsável → Planejador Responsável.
 * Nunca infere pessoas por nome de função/cargo.
 */
export function resolverResponsavel(ctx: {
  admObraNome?: string | null;
  admSedeNome?: string | null;
  engenheiroNome?: string | null;
  planejadorNome?: string | null;
}): ResponsavelResolvido {
  if (ctx.admObraNome) {
    return { nome: ctx.admObraNome, papel: "ADM OBRA", secundario: ctx.admSedeNome ?? null, definido: true };
  }
  if (ctx.admSedeNome) {
    return { nome: ctx.admSedeNome, papel: "ADM SEDE", secundario: null, definido: true };
  }
  if (ctx.engenheiroNome) {
    return { nome: ctx.engenheiroNome, papel: "Engenheiro Responsável", secundario: null, definido: true };
  }
  if (ctx.planejadorNome) {
    return { nome: ctx.planejadorNome, papel: "Planejador Responsável", secundario: null, definido: true };
  }
  return { nome: null, papel: null, secundario: null, definido: false };
}

/** Normalização usada nas heurísticas de possível redundância de nomenclatura. */
export function normalizarNome(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/\s+/g, " ").trim();
}

/** Base de comparação de funções: remove sufixos de nível (I, II, 1, 2...). */
export function baseNomeFuncao(valor: string | null | undefined): string {
  return normalizarNome(valor).replace(/\s+(I{1,3}|IV|V|VI|\d+)$/i, "").trim();
}

/** Duplicidade exata (igualdade inequívoca após normalização). */
export function ehDuplicidadeExata(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarNome(a);
  const nb = normalizarNome(b);
  return na !== "" && na === nb;
}

/** Possível duplicidade: mesma base semântica, mas não igualdade exata. */
export function ehPossivelDuplicidade(a: string | null | undefined, b: string | null | undefined): boolean {
  if (ehDuplicidadeExata(a, b)) return false;
  const ba = baseNomeFuncao(a);
  const bb = baseNomeFuncao(b);
  return ba !== "" && ba === bb;
}
