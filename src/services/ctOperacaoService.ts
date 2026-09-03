/**
 * CT-3E / CT-3F — Operação da viagem (checklist de saída, início, chegada,
 * recebimento e linha do tempo) via RPCs fail-closed.
 *
 * Nenhuma escrita direta em tabela: todas as transições são decididas no
 * servidor e são idempotentes por request_id.
 */
import { supabase } from "@/integrations/supabase/client";
import { mapOrdem } from "./ctMotoristaOrdensService";
import type {
  CtChecklistPersistido,
  CtChecklistSaidaPayload,
  CtRecebimentoPayload,
  CtRecebimentoPersistido,
  CtSituacaoLogistica,
  CtSolicitacaoTimeline,
  CtTimelineEvento,
  CtViagemOperacaoDetalhe,
} from "@/types/centralTransporteOperacao";

const BUCKET = "ct-checklists";

/* eslint-disable @typescript-eslint/no-explicit-any -- fronteira supabase.rpc (RPCs CT-3E/3F não tipadas) */
const rpc = async (fn: string, args: Record<string, unknown>): Promise<unknown> => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) throw error;
  return data;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const asRecord = (v: unknown): Record<string, unknown> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("CT3E_RESPOSTA_INVALIDA");
  return v as Record<string, unknown>;
};

const texto = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const inteiro = (v: unknown, fb = 0): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
};
const listaTexto = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const mapChecklist = (raw: unknown): CtChecklistPersistido => {
  const r = asRecord(raw);
  return {
    id: String(r.id),
    tipo: (texto(r.tipo) ?? "CARGA") as CtChecklistPersistido["tipo"],
    movimentacaoId: texto(r.movimentacao_id),
    checklistCodigo: texto(r.checklist_codigo) ?? "",
    checklistVersao: inteiro(r.checklist_versao, 1),
    status: (texto(r.status) ?? "RASCUNHO") as CtChecklistPersistido["status"],
    respostas: (r.respostas && typeof r.respostas === "object"
      ? r.respostas
      : {}) as CtChecklistPersistido["respostas"],
    realizadoEm: texto(r.realizado_em),
  };
};

const mapRecebimento = (raw: unknown): CtRecebimentoPersistido | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = asRecord(raw);
  if (!r.id) return null;
  return {
    id: String(r.id),
    status: texto(r.status) ?? "RASCUNHO",
    recebidoEm: texto(r.recebido_em),
    recebedorNome: texto(r.recebedor_nome),
    observacoes: texto(r.observacoes),
    itens: Array.isArray(r.itens)
      ? r.itens.map((i) => {
          const it = asRecord(i);
          return {
            movimentacaoId: String(it.movimentacao_id),
            equipamentoId: String(it.equipamento_id),
            resultado: (texto(it.resultado) ??
              "ACEITO") as CtRecebimentoPersistido["itens"][number]["resultado"],
            naoConformidadeTipo: texto(it.nao_conformidade_tipo),
            observacao: texto(it.observacao),
            fotos: listaTexto(it.fotos),
          };
        })
      : [],
  };
};

/* ------------------------------ leituras ------------------------------ */

export const fetchViagemOperacaoDetalhe = async (
  viagemId: string,
): Promise<CtViagemOperacaoDetalhe> => {
  const d = asRecord(await rpc("fn_ct_viagem_operacao_detalhe", { p_viagem_id: viagemId }));
  return {
    viagem: mapOrdem(d.viagem),
    paradaAtualId: texto(d.parada_atual_id),
    souMotorista: d.sou_motorista === true,
    checklistsPendentes: inteiro(d.checklists_pendentes),
    totalCargas: inteiro(d.total_cargas),
    podeRegistrarChecklist: d.pode_registrar_checklist === true,
    podeIniciar: d.pode_iniciar === true,
    podeRegistrarChegada: d.pode_registrar_chegada === true,
    podeReceber: d.pode_receber === true,
    checklists: Array.isArray(d.checklists) ? d.checklists.map(mapChecklist) : [],
    recebimento: mapRecebimento(d.recebimento),
  };
};

export const fetchOrdensOperacaoTodas = async (status: string | null = null) => {
  const d = asRecord(
    await rpc("fn_ct_operacao_ordens_listar", {
      p_status: status,
      p_data_inicio: null,
      p_data_fim: null,
    }),
  );
  return {
    hoje: texto(d.hoje),
    ordens: Array.isArray(d.ordens) ? d.ordens.map(mapOrdem) : [],
  };
};

/**
 * CT-3F — Recebimentos do usuário autenticado.
 * O servidor decide o escopo (funcionário vinculado / recebedor previsto / capacidade
 * no CC de destino) e separa as viagens em trânsito das que aguardam conferência.
 */
export const fetchRecebimentosPendentes = async () => {
  const d = asRecord(await rpc("fn_ct_recebimentos_pendentes_listar", {}));
  return {
    ordens: Array.isArray(d.ordens) ? d.ordens.map(mapOrdem) : [],
    aCaminho: Array.isArray(d.a_caminho) ? d.a_caminho.map(mapOrdem) : [],
    concluidos: Array.isArray(d.concluidos) ? d.concluidos.map(mapOrdem) : [],
  };
};


export const fetchSolicitacaoTimeline = async (
  solicitacaoId: string,
): Promise<CtSolicitacaoTimeline> => {
  const d = asRecord(await rpc("fn_ct_solicitacao_timeline", { p_solicitacao_id: solicitacaoId }));
  return {
    solicitacaoId,
    situacaoLogistica: (texto(d.situacao_logistica) ??
      "AGUARDANDO_SELECAO") as CtSituacaoLogistica,
    statusFluxo: texto(d.status_fluxo),
    eventos: Array.isArray(d.eventos)
      ? d.eventos.map((e): CtTimelineEvento => {
          const r = asRecord(e);
          return {
            tipo: (texto(r.tipo) ?? "MOBILIZACAO_PROGRAMADA") as CtTimelineEvento["tipo"],
            em: texto(r.em),
            viagem: texto(r.viagem),
            responsavel: texto(r.responsavel),
            equipamento: texto(r.equipamento),
            estado: (texto(r.estado) ?? "CONCLUIDO") as CtTimelineEvento["estado"],
            resultado: texto(r.resultado),
            observacao: texto(r.observacao),
          };
        })
      : [],
  };
};

/* ------------------------------ escritas ------------------------------ */

export const salvarChecklistSaida = async (
  viagemId: string,
  payload: CtChecklistSaidaPayload,
  requestId: string,
) => {
  const rpcName = "fn_ct_checklist_saida_salvar";
  let errorLogged = false;
  const args = {
    p_viagem_id: viagemId,
    p_request_id: requestId,
    p_payload: {
      tipo: payload.tipo,
      movimentacao_id: payload.movimentacaoId,
      checklist_codigo: payload.checklistCodigo,
      checklist_versao: payload.checklistVersao,
      status: payload.status,
      respostas: payload.respostas,
      latitude: payload.latitude,
      longitude: payload.longitude,
      assinatura_confirmada: payload.assinaturaConfirmada ? "true" : "false",
    },
  };

  if (import.meta.env.DEV) {
    console.info("[CT_CHECKLIST_SAVE_REQUEST]", {
      operation: "CHECKLIST_SAIDA",
      rpc: rpcName,
      requestId,
      payload: args,
    });
  }

  try {
    /* eslint-disable @typescript-eslint/no-explicit-any -- fronteira PostgREST para preservar HTTP status em DEV */
    const result = await (supabase as any).rpc(rpcName, args);
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const httpStatus = typeof result.status === "number" ? result.status : null;
    if (result.error) {
      if (import.meta.env.DEV) {
        console.error("[CT_CHECKLIST_SAVE_ERROR]", {
          operation: "CHECKLIST_SAIDA",
          rpc: rpcName,
          requestId,
          httpStatus,
          code: typeof result.error.code === "string" ? result.error.code : null,
          message: typeof result.error.message === "string" ? result.error.message : String(result.error),
          details: typeof result.error.details === "string" ? result.error.details : null,
          hint: typeof result.error.hint === "string" ? result.error.hint : null,
          response: result,
        });
        errorLogged = true;
      }
      throw result.error;
    }
    const response = asRecord(result.data);
    if (import.meta.env.DEV && !errorLogged) {
      console.info("[CT_CHECKLIST_SAVE_RESPONSE]", {
        operation: "CHECKLIST_SAIDA",
        rpc: rpcName,
        requestId,
        httpStatus,
        response,
      });
    }
    return response;
  } catch (error) {
    if (import.meta.env.DEV) {
      const raw = error && typeof error === "object" ? (error as Record<string, unknown>) : {};
      console.error("[CT_CHECKLIST_SAVE_ERROR]", {
        operation: "CHECKLIST_SAIDA",
        rpc: rpcName,
        requestId,
        httpStatus: null,
        code: typeof raw.code === "string" ? raw.code : null,
        message:
          typeof raw.message === "string"
            ? raw.message
            : error instanceof Error
              ? error.message
              : String(error),
        details: typeof raw.details === "string" ? raw.details : null,
        hint: typeof raw.hint === "string" ? raw.hint : null,
      });
    }
    throw error;
  }
};

export const iniciarViagem = async (viagemId: string, requestId: string) =>
  asRecord(await rpc("fn_ct_viagem_iniciar", { p_viagem_id: viagemId, p_request_id: requestId }));

export const registrarChegada = async (viagemId: string, requestId: string) =>
  asRecord(
    await rpc("fn_ct_viagem_registrar_chegada", {
      p_viagem_id: viagemId,
      p_request_id: requestId,
    }),
  );

export const finalizarRecebimento = async (
  viagemId: string,
  payload: CtRecebimentoPayload,
  requestId: string,
) =>
  asRecord(
    await rpc("fn_ct_recebimento_finalizar", {
      p_viagem_id: viagemId,
      p_request_id: requestId,
      p_payload: {
        parada_id: payload.paradaId ?? null,
        recebedor_nome: payload.recebedorNome,
        recebedor_documento: payload.recebedorDocumento,
        observacoes: payload.observacoes,
        latitude: payload.latitude,
        longitude: payload.longitude,
        fotos: payload.fotos,
        assinatura_confirmada: payload.assinaturaConfirmada ? "true" : "false",
        itens: payload.itens.map((i) => ({
          movimentacao_id: i.movimentacaoId,
          resultado: i.resultado,
          nao_conformidade_tipo: i.naoConformidadeTipo,
          observacao: i.observacao,
          fotos: i.fotos,
          respostas: i.respostas,
        })),
      },
    }),
  );

/* ------------------------------ storage ------------------------------ */

export const uploadFotoCt = async (
  viagemId: string,
  escopo: string,
  file: File,
): Promise<string> => {
  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${viagemId}/${escopo}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
  if (error) throw error;
  return path;
};

export const getSignedFotoCtUrl = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) return null;
  return data?.signedUrl ?? null;
};

/** Coordenadas do dispositivo; null quando o usuário nega ou o GPS falha. */
export const obterCoordenadas = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  });
