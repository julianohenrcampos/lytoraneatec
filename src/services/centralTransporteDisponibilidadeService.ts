/**
 * CT-2 / G1 — Escrita ÚNICA da disponibilidade operacional.
 *
 * Todos os fluxos de UI (Disponibilidade Operacional, Central do Transporte e
 * detalhe de Caminhões e Equipamentos) gravam EXCLUSIVAMENTE via a RPC
 * transacional `fn_ct_disponibilidade_upsert`, cuja assinatura viva é:
 *
 *   p_equipamento_id        uuid       (obrigatório)
 *   p_status_operacional    text       (obrigatório)
 *   p_previsao_liberacao    date       (default null)
 *   p_centro_custo_id       uuid       (default null)
 *   p_confiabilidade        text       (default null)
 *   p_data_inicio           date       (default null)
 *   p_motivo_risco          text       (default null)
 *   p_observacao            text       (default null)
 *   p_justificativa_excecao text       (default null)  ← CT-2.5
 *
 * A RPC valida capability (`gestao_maquinas_central_transporte_view` + action
 * `editar`), escopo do equipamento, advisory lock por ativo, a TRAVA CT-2.5
 * (ativo com compromisso vigente/futuro na Central só é editado com
 * justificativa de exceção ≥ 20 caracteres) e faz o upsert pelo EQUIPAMENTO —
 * não existe parâmetro de identificador da linha. Por isso a UI jamais envia
 * `id`, `disponibilidade_id`, `request_id`, `created_by` ou `updated_by`, e
 * nunca executa insert/update direto em bd_disponibilidade_equipamentos.

 */
import { supabase } from "@/integrations/supabase/client";
import type { StatusOperacionalCanonico } from "@/lib/ativos/reconciliacaoOperacional";
import { estadoParametroUuid, isUuid, textoOuNull, uuidOuNull } from "@/utils/uuidOuNull";

export type StatusOperacionalEditavel = Extract<
  StatusOperacionalCanonico,
  "DISPONIVEL" | "ALOCADO" | "MANUTENCAO" | "INDISPONIVEL"
>;

/**
 * Cadastros manuais: INDISPONIVEL é status LEGADO (0 registros vivos) e deixou de
 * ser oferecido — manutenção vem da Ordem de Serviço e alocação de ALOCADO.
 * A leitura/compatibilidade histórica do valor permanece intacta (enum e tipos).
 */
export const STATUS_OPERACIONAIS_EDITAVEIS: readonly StatusOperacionalEditavel[] = [
  "DISPONIVEL",
  "ALOCADO",
  "MANUTENCAO",
];

export type ConfiabilidadePrevisao = "ALTA" | "MEDIA" | "BAIXA";

/** Registro operacional realmente gravado para um ativo. */
export interface RegistroDisponibilidadeAtual {
  statusOperacional: StatusOperacionalEditavel;
  centroCustoId: string | null;
  dataInicio: string | null;
  previsaoLiberacao: string | null;
  confiabilidadePrevisao: ConfiabilidadePrevisao | null;
  motivoRisco: string | null;
  observacao: string | null;
}

/** Modo exclusivo da interface — jamais integra o payload da RPC. */
export type DisponibilidadeFormMode = "CREATE" | "EDIT";

export interface RegularizarDisponibilidadeParams {
  equipamentoId: string;
  statusOperacional: StatusOperacionalEditavel;
  previsaoLiberacao?: string | null;
  centroCustoId?: string | null;
  confiabilidade?: ConfiabilidadePrevisao | null;
  dataInicio?: string | null;
  motivoRisco?: string | null;
  observacao?: string | null;
  /**
   * CT-2.5 — justificativa de exceção exigida quando o ativo possui
   * compromisso vigente/futuro na Central. Mínimo de 20 caracteres validado
   * também no servidor.
   */
  justificativaExcecao?: string | null;
  /** Somente para diagnóstico sanitizado em console. */
  modo?: DisponibilidadeFormMode;
}

export interface RegularizarDisponibilidadeResult {
  ok: true;
  criou: boolean;
  disponibilidade_id: string;
  equipamento_id: string;
  status_operacional: StatusOperacionalEditavel;
  /** true quando a gravação usou a exceção CT-2.5. */
  excecao_registrada?: boolean;
}

/** Payload literal da RPC — exatamente estas 9 chaves, nada além. */
export interface ArgsDisponibilidadeUpsert {
  p_equipamento_id: string;
  p_status_operacional: StatusOperacionalEditavel;
  p_previsao_liberacao: string | null;
  p_centro_custo_id: string | null;
  p_confiabilidade: ConfiabilidadePrevisao | null;
  p_data_inicio: string | null;
  p_motivo_risco: string | null;
  p_observacao: string | null;
  p_justificativa_excecao: string | null;
}

/** Erro determinístico de validação local — nada é enviado ao banco. */
export class IdentificadorInvalidoError extends Error {
  readonly parametro: string;

  constructor(parametro: string) {
    super(`IDENTIFICADOR_INVALIDO:${parametro}`);
    this.name = "IdentificadorInvalidoError";
    this.parametro = parametro;
  }
}

/**
 * Monta o payload tipado da RPC.
 *  - equipamento inválido/vazio ⇒ IdentificadorInvalidoError (submit bloqueado);
 *  - centro de custo vazio ⇒ null; texto não-UUID ⇒ IdentificadorInvalidoError;
 *  - datas/textos vazios ⇒ null (a RPC limpa o campo por atribuição direta).
 */
export const montarArgsDisponibilidadeUpsert = (
  p: RegularizarDisponibilidadeParams,
): ArgsDisponibilidadeUpsert => {
  const equipamento = uuidOuNull(p.equipamentoId);
  if (!equipamento || !isUuid(equipamento)) {
    throw new IdentificadorInvalidoError("p_equipamento_id");
  }

  const centroCusto = uuidOuNull(p.centroCustoId);
  if (centroCusto !== null && !isUuid(centroCusto)) {
    throw new IdentificadorInvalidoError("p_centro_custo_id");
  }

  const disponivel = p.statusOperacional === "DISPONIVEL";

  return {
    p_equipamento_id: equipamento,
    p_status_operacional: p.statusOperacional,
    // DISPONIVEL não convive com previsão/confiabilidade: NULL limpa na RPC.
    p_previsao_liberacao: disponivel ? null : textoOuNull(p.previsaoLiberacao),
    p_centro_custo_id: centroCusto,
    p_confiabilidade: disponivel ? null : (p.confiabilidade ?? null) || null,
    p_data_inicio: textoOuNull(p.dataInicio),
    p_motivo_risco: textoOuNull(p.motivoRisco),
    p_observacao: textoOuNull(p.observacao),
    p_justificativa_excecao: textoOuNull(p.justificativaExcecao),
  };
};


/** Diagnóstico sanitizado: nome do parâmetro, estado e modo. Sem UUID/SQL/PII. */
export const diagnosticoSanitizado = (
  p: RegularizarDisponibilidadeParams,
): Record<string, string> => ({
  modo: p.modo ?? "DESCONHECIDO",
  p_equipamento_id: estadoParametroUuid(p.equipamentoId),
  p_centro_custo_id: estadoParametroUuid(p.centroCustoId),
  p_status_operacional: p.statusOperacional ? "valido" : "vazio",
});

export const regularizarDisponibilidade = async (
  p: RegularizarDisponibilidadeParams,
): Promise<RegularizarDisponibilidadeResult> => {
  let args: ArgsDisponibilidadeUpsert;
  try {
    args = montarArgsDisponibilidadeUpsert(p);
  } catch (e) {
    console.warn("[DISPONIBILIDADE][PAYLOAD_INVALIDO]", diagnosticoSanitizado(p));
    throw e;
  }

  /* eslint-disable-next-line @typescript-eslint/no-explicit-any -- fronteira supabase.rpc */
  const { data, error } = await (supabase as any).rpc("fn_ct_disponibilidade_upsert", args);
  if (error) {
    console.warn("[DISPONIBILIDADE][RPC_ERRO]", diagnosticoSanitizado(p));
    throw error;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("CT2_RESPOSTA_INVALIDA");
  }
  return data as RegularizarDisponibilidadeResult;
};
