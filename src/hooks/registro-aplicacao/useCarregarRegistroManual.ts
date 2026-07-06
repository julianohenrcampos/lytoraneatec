import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  parseContextoOperacional,
  parseRuasAplicacao,
} from "@/utils/registroAplicacao/parseContextoOperacional";

/**
 * B.3.5-D.M2 — Carrega Registro Manual salvo para edição.
 * Retorna um estado hidratável pelo NovoRegistroManualModal (mesmo shape de draft),
 * combinando header + detalhes + parse dos blocos [CONTEXTO_OPERACIONAL] e [RUAS_APLICACAO]
 * gravados em observacoes_gerais.
 *
 * Fotos: retornadas como storage paths por buraco (fotos_aplicacao text[]).
 * O modal usa essas paths para renderizar preview via signed URL e preservá-las no save.
 */

export interface RegistroManualEditable {
  registroId: string;
  ini: {
    centroCustoId: string;
    atividade: "tapa_buraco" | "pavimentacao_mecanizada" | "fresagem";
    data: string;
    horaChegada: string;
    equipeId: string;
    condominio: "sim" | "nao" | "";
  };
  carga: {
    caminhaoId: string;
    frota: string;
    placa: string;
    motoristaId: string;
    totalCargaT: string;
    temperaturaMassa: string;
    tipoTraco: string;
    tipoPintura: string;
  };
  obsFinal: string;
  ruas: Array<{
    idLocal: string;
    logradouro: string;
    bairro: string;
    cidade: string;
    uf: string;
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
    capturedAt: string | null;
    buracos: Array<{
      idLocal: string;
      detalheId: string;
      sequenciaAplicacao: number;
      sequenciaRua: number;
      bordo: string;
      comprimento: string;
      larguraMedia: string;
      toneladaAplicada: string;
      espessura: string;
      temperaturaAplicacao: string;
      tipo_item: string;
      observacao: string;
      areaCalculada: number;
      gps: {
        latitude: number;
        longitude: number;
        accuracy?: number;
      } | null;
      fotosPaths: string[];
    }>;
  }>;
}

interface HeaderRow {
  id: string;
  data_aplicacao: string | null;
  atividade: string | null;
  centro_custo_id: string | null;
  temperatura_chegada: number | null;
  temperatura_aplicacao: number | null;
  hora_chegada_local: string | null;
  observacoes_gerais: string | null;
}

interface DetalheRow {
  id: string;
  sequencia_aplicacao: number | null;
  tipo_item: string | null;
  bordo: string | null;
  comprimento: number | null;
  largura_media: number | null;
  area_aplicada: number | null;
  tonelada_aplicada: number | null;
  logradouro_nome: string | null;
  fotos_aplicacao: string[] | null;
}

function genId() {
  return `local-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function normStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

async function fetchRegistroEditable(
  registroId: string
): Promise<RegistroManualEditable | null> {
  const [{ data: header, error: hErr }, { data: detalhes, error: dErr }] =
    await Promise.all([
      supabase
        .from("bd_registro_apontamento_aplicacao")
        .select(
          "id, data_aplicacao, atividade, centro_custo_id, temperatura_chegada, temperatura_aplicacao, hora_chegada_local, observacoes_gerais"
        )
        .eq("id", registroId)
        .maybeSingle(),
      supabase
        .from("bd_registro_aplicacao_detalhes")
        .select(
          "id, sequencia_aplicacao, tipo_item, bordo, comprimento, largura_media, area_aplicada, tonelada_aplicada, logradouro_nome, fotos_aplicacao"
        )
        .eq("registro_aplicacao_id", registroId)
        .order("sequencia_aplicacao", { ascending: true }),
    ]);

  if (hErr) throw hErr;
  if (dErr) throw dErr;
  if (!header) return null;

  const h = header as HeaderRow;
  const rows = (detalhes || []) as DetalheRow[];

  const ctx = parseContextoOperacional(h.observacoes_gerais);
  const ruasParsed = parseRuasAplicacao(h.observacoes_gerais) || [];

  // Mapa logradouro_nome (uppercase) → RuaParsed
  const ruaParsedByLogr = new Map<string, (typeof ruasParsed)[number]>();
  for (const r of ruasParsed) {
    ruaParsedByLogr.set(r.logradouro.trim().toUpperCase(), r);
  }

  // Agrupa detalhes por logradouro_nome preservando ordem de aparição
  const grupos = new Map<string, DetalheRow[]>();
  for (const d of rows) {
    const key = normStr(d.logradouro_nome).toUpperCase() || "(SEM LOGRADOURO)";
    if (!grupos.has(key)) grupos.set(key, []);
    grupos.get(key)!.push(d);
  }

  const ruas: RegistroManualEditable["ruas"] = [];
  let seqRuaFallback = 0;
  for (const [keyUpper, buracosRows] of grupos.entries()) {
    seqRuaFallback += 1;
    const parsed = ruaParsedByLogr.get(keyUpper);
    const logradouro =
      parsed?.logradouro || normStr(buracosRows[0]?.logradouro_nome) || "";
    const bairro = normStr(parsed?.bairro);
    const cidade = normStr(parsed?.cidade);
    const uf = normStr(parsed?.uf);
    // Primeiro buraco parseado com gps define GPS da rua (aproximação)
    const gpsRua = parsed?.buracos?.find((b) => b.gps)?.gps || null;

    ruas.push({
      idLocal: genId(),
      logradouro,
      bairro,
      cidade,
      uf,
      latitude: gpsRua?.latitude ?? null,
      longitude: gpsRua?.longitude ?? null,
      accuracy: gpsRua?.accuracy ?? null,
      capturedAt: null,
      buracos: buracosRows.map((b, i) => {
        const seqRua = i + 1;
        const parsedB = parsed?.buracos?.find(
          (pb) => pb.sequenciaAplicacao === b.sequencia_aplicacao
        );
        return {
          idLocal: genId(),
          detalheId: b.id,
          sequenciaAplicacao: b.sequencia_aplicacao ?? 0,
          sequenciaRua: seqRua,
          bordo: b.bordo || "",
          comprimento: b.comprimento != null ? String(b.comprimento) : "",
          larguraMedia: b.largura_media != null ? String(b.largura_media) : "",
          toneladaAplicada:
            b.tonelada_aplicada != null ? String(b.tonelada_aplicada) : "",
          espessura:
            parsedB?.espessura != null ? String(parsedB.espessura) : "",
          temperaturaAplicacao: "",
          tipo_item: b.tipo_item || "buraco",
          observacao: parsedB?.observacao || "",
          areaCalculada: Number(b.area_aplicada || parsedB?.area || 0),
          gps: parsedB?.gps
            ? {
                latitude: parsedB.gps.latitude,
                longitude: parsedB.gps.longitude,
                accuracy: parsedB.gps.accuracy,
              }
            : null,
          fotosPaths: Array.isArray(b.fotos_aplicacao)
            ? b.fotos_aplicacao.filter((x) => typeof x === "string")
            : [],
        };
      }),
    });
  }

  const atividadeVal =
    (h.atividade as RegistroManualEditable["ini"]["atividade"]) ||
    "tapa_buraco";
  const condominioVal =
    ctx.condominio?.toLowerCase() === "sim"
      ? "sim"
      : ctx.condominio?.toLowerCase() === "nao" ||
        ctx.condominio?.toLowerCase() === "não"
      ? "nao"
      : "";

  return {
    registroId: h.id,
    ini: {
      centroCustoId: h.centro_custo_id || "",
      atividade: atividadeVal,
      data: h.data_aplicacao || "",
      horaChegada: h.hora_chegada_local || "",
      equipeId: "",
      condominio: condominioVal,
    },
    carga: {
      caminhaoId: "",
      frota: ctx.caminhaoFrota || "",
      placa: ctx.placa || "",
      motoristaId: "",
      totalCargaT: ctx.totalCarga || "",
      temperaturaMassa: ctx.temperaturaMassa || "",
      tipoTraco: ctx.tipoTraco || "",
      tipoPintura: ctx.tipoPintura || "",
    },
    obsFinal: ctx.observacoesApontador || "",
    ruas,
  };
}

export function useCarregarRegistroManual(
  registroId: string | null | undefined
) {
  return useQuery({
    queryKey: ["registroManualEditable", registroId],
    enabled: !!registroId,
    staleTime: 0,
    retry: 0,
    queryFn: () => fetchRegistroEditable(registroId!),
  });
}
