import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  uploadFotoRegistroManual,
  removerFotosRegistroManual,
} from "@/services/registro-aplicacao/uploadFotosManual";

// ============================================================================
// Contrato: public.fn_criar_registro_aplicacao_manual_v2(p_payload jsonb)
//   - cria cabeçalho em bd_registro_apontamento_aplicacao (origem_registro='manual')
//   - cria N linhas em bd_registro_aplicacao_ruas
//   - cria M linhas em bd_registro_aplicacao_detalhes com rua_aplicacao_id vinculado
//   - lista_entrega_id e registro_carga_id permanecem NULL
//
// B.3.5-B — Fotos NUNCA entram no p_payload. São enviadas ao bucket privado
// 'apontamentos' após a RPC, e os storage paths são persistidos em
// bd_registro_aplicacao_detalhes.fotos_aplicacao via UPDATE.
// ============================================================================

export interface GpsPayload {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  capturedAt?: string | null;
}

export interface BuracoPayloadV2 {
  idLocal?: string;
  tipo_item: string;
  sequencia_aplicacao: number;
  sequencia_rua: number;
  comprimento: number;
  largura_media: number;
  area_aplicada?: number | null;
  tonelada_aplicada: number;
  bordo?: string | null;
  temperatura_aplicacao?: number | null;
  observacao?: string | null;
  gps?: GpsPayload;
}

export interface RuaPayloadV2 {
  idLocal?: string;
  ordem_rua: number;
  logradouro: string;
  bairro: string;
  cidade?: string | null;
  uf?: string | null;
  gps?: GpsPayload;
  buracos: BuracoPayloadV2[];
}

export interface CabecalhoPayloadV2 {
  centro_custo_id: string;
  atividade: "tapa_buraco" | "pavimentacao_mecanizada" | "fresagem";
  data_aplicacao: string;
  hora_chegada_local?: string | null;
  hora_aplicacao?: string | null;
  hora_saida_caminhao?: string | null;
  temperatura_chegada?: number | null;
  temperatura_aplicacao?: number | null;
  total_carga_t: number;
  bordo?: string | null;
  observacoes_gerais?: string | null;
  anotacoes_apontador?: string | null;
  contexto_operacional?: Record<string, unknown> | null;
}

export interface PayloadCriarRegistroManualV2 {
  cabecalho: CabecalhoPayloadV2;
  ruas: RuaPayloadV2[];
}

export interface RegistroManualV2Response {
  ok: boolean;
  registro_aplicacao_id: string;
  numero_registro: string | null;
  ruas: Array<{
    idLocal?: string;
    rua_aplicacao_id: string;
    ordem_rua: number;
    chave_normalizada: string;
  }>;
  detalhes: Array<{
    idLocal?: string;
    detalhe_id: string;
    rua_aplicacao_id: string;
    sequencia_aplicacao: number;
    sequencia_rua: number;
  }>;
}

export interface CriarRegistroManualInput {
  payload: PayloadCriarRegistroManualV2;
  fotosPorBuracoIdLocal?: Record<string, File[]>;
}

interface FotosOutcome {
  totalArquivos: number;
  totalEnviadas: number;
  falhasUpload: number;
  falhasUpdate: number;
}

async function persistirFotos(
  registroId: string,
  detalhes: RegistroManualV2Response["detalhes"],
  fotosPorBuracoIdLocal: Record<string, File[]> | undefined
): Promise<FotosOutcome> {
  const outcome: FotosOutcome = {
    totalArquivos: 0,
    totalEnviadas: 0,
    falhasUpload: 0,
    falhasUpdate: 0,
  };
  if (!fotosPorBuracoIdLocal) return outcome;

  const idLocalToDetalheId: Record<string, string> = {};
  for (const d of detalhes) {
    if (d.idLocal) idLocalToDetalheId[d.idLocal] = d.detalhe_id;
  }

  console.log("[REGISTRO_MANUAL][RPC_DETALHES_RETORNO]", {
    detalhes,
    idLocalToDetalheId,
  });

  const entradas = Object.entries(fotosPorBuracoIdLocal).filter(
    ([, files]) => Array.isArray(files) && files.length > 0
  );
  if (entradas.length === 0) return outcome;

  console.log("[REGISTRO_MANUAL][FOTOS_PAYLOAD_MAP]", {
    registro_aplicacao_id: registroId,
    keys: Object.keys(fotosPorBuracoIdLocal),
    totalFiles: entradas.reduce((s, [, f]) => s + f.length, 0),
    buracos_com_fotos: entradas.length,
    detalhes_retornados: detalhes.length,
  });

  for (const [idLocal, files] of entradas) {
    outcome.totalArquivos += files.length;
    const detalheId = idLocalToDetalheId[idLocal];
    if (!detalheId) {
      outcome.falhasUpload += files.length;
      console.warn("[REGISTRO_MANUAL][FOTOS_UPLOAD_FAIL]", {
        motivo: "idLocal sem detalhe_id correspondente",
        idLocal,
        idsDisponiveis: Object.keys(idLocalToDetalheId),
      });
      continue;
    }

    const pathsOk: string[] = [];
    for (const file of files) {
      console.log("[REGISTRO_MANUAL][FOTOS_UPLOAD_START]", {
        idLocal,
        detalheId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      });
      const r = await uploadFotoRegistroManual(registroId, detalheId, file);
      if (r.ok && r.path) {
        pathsOk.push(r.path);
        console.log("[REGISTRO_MANUAL][FOTOS_UPLOAD_SUCCESS]", {
          idLocal,
          detalheId,
          path: r.path,
        });
      } else {
        outcome.falhasUpload += 1;
        console.error("[REGISTRO_MANUAL][FOTOS_UPLOAD_FAIL]", {
          idLocal,
          detalheId,
          fileName: file.name,
          erro: r.error,
        });
      }
    }

    if (pathsOk.length === 0) continue;

    console.log("[REGISTRO_MANUAL][FOTOS_UPDATE_START]", {
      detalheId,
      paths: pathsOk,
    });

    const { error: updErr, data: updData } = await supabase
      .from("bd_registro_aplicacao_detalhes")
      .update({ fotos_aplicacao: pathsOk })
      .eq("id", detalheId)
      .select("id");

    if (updErr) {
      outcome.falhasUpdate += 1;
      console.error("[REGISTRO_MANUAL][FOTOS_UPDATE_FAIL]", {
        detalheId,
        erro: updErr.message,
        details: (updErr as any).details,
        code: (updErr as any).code,
      });
      await removerFotosRegistroManual(pathsOk);
    } else if (!updData || updData.length === 0) {
      outcome.falhasUpdate += 1;
      console.error("[REGISTRO_MANUAL][FOTOS_UPDATE_FAIL]", {
        detalheId,
        motivo: "UPDATE afetou 0 linhas (RLS ou id inexistente)",
      });
      await removerFotosRegistroManual(pathsOk);
    } else {
      outcome.totalEnviadas += pathsOk.length;
      console.log("[REGISTRO_MANUAL][FOTOS_UPDATE_SUCCESS]", {
        detalheId,
        paths: pathsOk,
      });
    }
  }

  return outcome;
}

export function useCriarRegistroManual(opts?: {
  onSuccess?: (resp: RegistroManualV2Response) => void;
}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CriarRegistroManualInput
    ): Promise<{ resp: RegistroManualV2Response; fotos: FotosOutcome }> => {
      const { payload, fotosPorBuracoIdLocal } = input;

      const totalBuracos = payload.ruas.reduce((s, r) => s + r.buracos.length, 0);
      console.log("[REGISTRO_MANUAL][SUBMIT]", {
        ruas: payload.ruas.length,
        buracos: totalBuracos,
        total_carga_t: payload.cabecalho.total_carga_t,
        atividade: payload.cabecalho.atividade,
        centro_custo_id: payload.cabecalho.centro_custo_id,
        data_aplicacao: payload.cabecalho.data_aplicacao,
        buracos_com_fotos: fotosPorBuracoIdLocal
          ? Object.keys(fotosPorBuracoIdLocal).length
          : 0,
      });
      console.log("[REGISTRO_MANUAL][PAYLOAD_V2]", payload);

      // 1) Cria registro. p_payload é JSON PURO — File[] NUNCA entra aqui.
      const { data, error } = await supabase.rpc(
        "fn_criar_registro_aplicacao_manual_v2",
        { p_payload: payload as any }
      );
      if (error) {
        console.error("[REGISTRO_MANUAL][RPC_ERROR]", error);
        throw error;
      }
      const resp = data as unknown as RegistroManualV2Response;
      console.log("[REGISTRO_MANUAL][RPC_SUCCESS]", resp);

      // 2) Persiste fotos (after-hook). Nunca desfaz o registro em caso de erro.
      const fotos = await persistirFotos(
        resp.registro_aplicacao_id,
        resp.detalhes || [],
        fotosPorBuracoIdLocal
      );

      return { resp, fotos };
    },
    onSuccess: ({ resp, fotos }) => {
      const houveFalhaFotos =
        fotos.totalArquivos > 0 &&
        (fotos.falhasUpload > 0 || fotos.falhasUpdate > 0);

      if (houveFalhaFotos) {
        toast.warning("Registro salvo, mas algumas fotos não foram enviadas.");
      } else {
        toast.success("Registro manual salvo com sucesso.");
      }

      console.log("[REGISTRO_MANUAL][LIST_REFRESH]", {
        registro_aplicacao_id: resp?.registro_aplicacao_id,
        fotos,
      });
      qc.invalidateQueries({ queryKey: ["entregasStable"] });
      qc.invalidateQueries({ queryKey: ["registrosManuaisLista"] });
      opts?.onSuccess?.(resp);
    },
    onError: (error: any) => {
      const msg =
        error?.message ||
        error?.details ||
        "Falha ao salvar registro manual.";
      toast.error(msg);
    },
  });
}
