/**
 * Regras de formulário da disponibilidade operacional (CREATE × EDIT).
 *
 * Isolado da UI para ser testável de forma determinística. Nenhuma inferência
 * de status: ativo SEM_STATUS abre em CREATE, com status vazio.
 */
import { getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import { isUuid } from "@/utils/uuidOuNull";
import type {
  ConfiabilidadePrevisao,
  DisponibilidadeFormMode,
  RegistroDisponibilidadeAtual,
  StatusOperacionalEditavel,
} from "@/services/centralTransporteDisponibilidadeService";

export type { RegistroDisponibilidadeAtual };

export interface ValoresFormDisponibilidade {
  status: StatusOperacionalEditavel | null;
  centroCustoId: string;
  dataInicio: string;
  previsaoLiberacao: string;
  confiabilidade: ConfiabilidadePrevisao | "";
  motivoRisco: string;
  observacao: string;
}

export type CampoFormDisponibilidade = keyof ValoresFormDisponibilidade;

export type ErrosFormDisponibilidade = Partial<Record<CampoFormDisponibilidade, string>>;

/**
 * CREATE: status nulo e data de início na data local (America/Sao_Paulo).
 * EDIT: valores realmente gravados, preservando data_inicio.
 */
export const construirValoresIniciais = (
  modo: DisponibilidadeFormMode,
  registro: RegistroDisponibilidadeAtual | null,
): ValoresFormDisponibilidade => {
  if (modo === "EDIT" && registro) {
    return {
      status: registro.statusOperacional,
      centroCustoId: registro.centroCustoId ?? "",
      dataInicio: registro.dataInicio ?? "",
      previsaoLiberacao: registro.previsaoLiberacao ?? "",
      confiabilidade: registro.confiabilidadePrevisao ?? "",
      motivoRisco: registro.motivoRisco ?? "",
      observacao: registro.observacao ?? "",
    };
  }

  return {
    status: null,
    centroCustoId: "",
    dataInicio: getCurrentBrazilianDate(),
    previsaoLiberacao: "",
    confiabilidade: "",
    motivoRisco: "",
    observacao: "",
  };
};

/** Validação condicional por status. Devolve {} quando o formulário está válido. */
export const validarFormDisponibilidade = (
  valores: ValoresFormDisponibilidade,
  equipamentoId: string,
): ErrosFormDisponibilidade => {
  const erros: ErrosFormDisponibilidade = {};

  if (!isUuid(equipamentoId)) {
    erros.status = "Ativo inválido. Atualize a página e tente novamente.";
    return erros;
  }

  if (!valores.status) {
    erros.status = "Selecione o status operacional.";
    return erros;
  }

  if (valores.centroCustoId.trim() && !isUuid(valores.centroCustoId)) {
    erros.centroCustoId = "Centro de custo inválido.";
  }

  if (!valores.dataInicio.trim()) {
    erros.dataInicio = "Data de início é obrigatória.";
  }

  if (valores.status === "ALOCADO") {
    if (!valores.previsaoLiberacao.trim()) erros.previsaoLiberacao = "Previsão de liberação é obrigatória.";
    if (!valores.confiabilidade) erros.confiabilidade = "Confiabilidade é obrigatória.";
    if (!valores.motivoRisco.trim()) erros.motivoRisco = "Motivo/risco é obrigatório.";
  }

  if (valores.status === "MANUTENCAO" || valores.status === "INDISPONIVEL") {
    if (!valores.motivoRisco.trim()) erros.motivoRisco = "Motivo/risco é obrigatório.";
    if (valores.previsaoLiberacao.trim() && !valores.confiabilidade) {
      erros.confiabilidade = "Confiabilidade é obrigatória quando há previsão.";
    }
  }

  return erros;
};

export const formValido = (
  valores: ValoresFormDisponibilidade,
  equipamentoId: string,
): boolean => Object.keys(validarFormDisponibilidade(valores, equipamentoId)).length === 0;

/** DISPONIVEL não convive com previsão/confiabilidade — limpeza antes do envio. */
export const limparCamposIncompativeis = (
  valores: ValoresFormDisponibilidade,
): ValoresFormDisponibilidade =>
  valores.status === "DISPONIVEL"
    ? { ...valores, previsaoLiberacao: "", confiabilidade: "" }
    : valores;

export const TITULO_POR_MODO: Record<DisponibilidadeFormMode, string> = {
  CREATE: "Regularizar disponibilidade",
  EDIT: "Editar disponibilidade",
};

export const BOTAO_POR_MODO: Record<DisponibilidadeFormMode, string> = {
  CREATE: "Criar status operacional",
  EDIT: "Salvar alterações",
};

export const ACAO_LISTAGEM = {
  CREATE: "Regularizar disponibilidade",
  EDIT: "Editar disponibilidade",
} as const;

/** CREATE exige ausência comprovada de registro operacional. */
export const resolverModo = (
  possuiRegistro: boolean,
  registro: RegistroDisponibilidadeAtual | null,
): DisponibilidadeFormMode | "INDETERMINADO" => {
  if (!possuiRegistro && registro === null) return "CREATE";
  if (possuiRegistro && registro !== null) return "EDIT";
  return "INDETERMINADO";
};
