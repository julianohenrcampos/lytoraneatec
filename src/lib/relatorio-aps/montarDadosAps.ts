/**
 * Helpers puros para transformar detalhes brutos (bd_registro_aplicacao_detalhes)
 * em estruturas do Relatório AP's. Reutilizados pelo hook em modo registro-único
 * (E1/E2) e pelo modo multi-registro/multi-trecho (E3.1).
 *
 * Fechamento "Nome Local da Rua": os detalhes enriquecidos passam a expor
 * `logradouroExibicao` (label "Mapa / Local"). Todas as labels visíveis
 * (linhas, pontos, fotos) usam esse campo — nunca `logradouro_nome`
 * diretamente. Coordenadas/geometria/geocode NÃO são alteradas.
 */
import { criarSignedUrlFotoManual } from "@/services/registro-aplicacao/uploadFotosManual";
import type { DetalheApsEnriquecido } from "@/types/relatorioApsDetalhe";
import {
  montarLegendaSugerida,
  RELATORIO_APS_PESO_DEFAULT,
  type RelatorioApsFotoDisponivel,
  type RelatorioApsLinha,
  type RelatorioApsPontoRua,
  type RelatorioApsPontoServico,
} from "@/types/relatorioAps";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DetalheRaw = Record<string, any>;

/** Extrai o label combinado quando o detalhe já foi enriquecido; senão cai no logradouro_nome. */
function labelDetalhe(d: DetalheRaw | DetalheApsEnriquecido): string {
  const enriquecido = (d as DetalheApsEnriquecido)?.logradouroExibicao;
  if (typeof enriquecido === "string" && enriquecido.length > 0) return enriquecido;
  return (d?.logradouro_nome as string | undefined) || "";
}

export function montarLinhasFromDetalhes(
  detalhes: Array<DetalheRaw | DetalheApsEnriquecido>,
  situacaoDefault: string,
  tipoAplicacaoPorRegistro?: Record<string, string | null | undefined>,
): RelatorioApsLinha[] {
  const linhas: RelatorioApsLinha[] = (detalhes || []).map((d) => {
    const tonelada = Number(d?.tonelada_aplicada ?? 0);
    const espessura =
      d?.espessura_aplicada != null
        ? Number(d.espessura_aplicada)
        : d?.espessura_calculada != null
          ? Number(d.espessura_calculada)
          : null;
    const registroId = d?.registro_aplicacao_id
      ? String(d.registro_aplicacao_id)
      : undefined;
    return {
      id: String(d.id),
      sequencia: Number(d?.sequencia_aplicacao ?? 0),
      logradouro: labelDetalhe(d),
      data: d?.data_aplicacao || "",
      trecho: String(d?.sequencia_aplicacao ?? ""),
      situacao: situacaoDefault,
      comprimento: d?.comprimento != null ? Number(d.comprimento) : null,
      larguraMedia: d?.largura_media != null ? Number(d.largura_media) : null,
      areaAplicada: Number(d?.area_aplicada ?? 0),
      espessura,
      pesoKgM2: RELATORIO_APS_PESO_DEFAULT,
      totalKg: tonelada * 1000,
      registroAplicacaoId: registroId,
      tipoAplicacao:
        registroId && tipoAplicacaoPorRegistro
          ? tipoAplicacaoPorRegistro[registroId] ?? null
          : null,
    };
  });
  const normData = (d: string): string => {
    if (!d) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
    const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(d);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    const dt = new Date(d);
    return Number.isFinite(dt.getTime()) ? dt.toISOString().slice(0, 10) : d;
  };
  linhas.sort((a, b) => {
    const da = normData(a.data);
    const db = normData(b.data);
    if (da !== db) return da < db ? -1 : 1;
    const la = (a.logradouro || "").localeCompare(b.logradouro || "", "pt-BR");
    if (la !== 0) return la;
    if (a.sequencia !== b.sequencia) return a.sequencia - b.sequencia;
    return a.id.localeCompare(b.id);
  });
  return linhas;
}

export function montarPontosServicoFromDetalhes(
  detalhes: Array<DetalheRaw | DetalheApsEnriquecido>,
): RelatorioApsPontoServico[] {
  const pontos: RelatorioApsPontoServico[] = [];
  for (const d of detalhes || []) {
    const lat = Number(d?.latitude);
    const lng = Number(d?.longitude);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0)
    ) {
      pontos.push({
        detalheId: String(d.id),
        sequencia: Number(d?.sequencia_aplicacao ?? 0),
        latitude: lat,
        longitude: lng,
        logradouro: labelDetalhe(d),
      });
    }
  }
  pontos.sort((a, b) => a.sequencia - b.sequencia);
  return pontos;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RuaRaw = Record<string, any>;

/**
 * Extrai pontos de ruas (bd_registro_aplicacao_ruas) com lat/lng válidos.
 * O label usa o combinado "Mapa / Local" quando disponível.
 */
export function montarPontosRuaFromRuas(ruas: RuaRaw[]): RelatorioApsPontoRua[] {
  const pontos: RelatorioApsPontoRua[] = [];
  for (const r of ruas || []) {
    const lat = Number(r?.latitude);
    const lng = Number(r?.longitude);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0)
    ) {
      const mapa = String(r?.logradouro_nome || "").trim();
      const local = String(r?.logradouro_nome_local || "").trim();
      const label =
        mapa && local && mapa.toLowerCase() !== local.toLowerCase()
          ? `${mapa} / ${local}`
          : mapa || local || "";
      pontos.push({
        ruaId: String(r.id),
        ordem: Number(r?.ordem_rua ?? 0),
        latitude: lat,
        longitude: lng,
        logradouro: label,
      });
    }
  }
  pontos.sort((a, b) => a.ordem - b.ordem);
  return pontos;
}

/**
 * Assina cada foto de cada detalhe. Reaproveita signed URLs já criadas
 * quando o mesmo path aparecer em mais de um detalhe (evita chamadas duplicadas).
 */
export async function montarFotosDisponiveisFromDetalhes(
  detalhes: Array<DetalheRaw | DetalheApsEnriquecido>,
  cachePreExistente?: Map<string, string>,
): Promise<RelatorioApsFotoDisponivel[]> {
  const cache = cachePreExistente || new Map<string, string>();
  const pares: Array<{ detalhe: DetalheRaw | DetalheApsEnriquecido; path: string }> = [];
  for (const d of detalhes || []) {
    const paths: string[] = Array.isArray(d?.fotos_aplicacao) ? d.fotos_aplicacao : [];
    for (const p of paths) {
      if (typeof p === "string" && p) pares.push({ detalhe: d, path: p });
    }
  }
  if (pares.length === 0) return [];

  const paresParaAssinar = pares.filter((p) => !cache.has(p.path));
  const uniquePaths = Array.from(new Set(paresParaAssinar.map((p) => p.path)));

  const results = await Promise.allSettled(
    uniquePaths.map((path) => criarSignedUrlFotoManual(path, 3600)),
  );
  results.forEach((r, i) => {
    const path = uniquePaths[i];
    if (r.status === "fulfilled" && r.value.ok && r.value.url) {
      cache.set(path, r.value.url);
    } else {
      const msg =
        r.status === "fulfilled" ? r.value.error : (r.reason as Error)?.message;
      console.warn("[RELATORIO_APS][FOTOS_SIGNED_URL_FAIL]", { path, error: msg });
    }
  });

  const fotos: RelatorioApsFotoDisponivel[] = [];
  for (const par of pares) {
    const url = cache.get(par.path);
    if (!url) continue;
    const detalhe = par.detalhe;
    const sequencia = Number(detalhe?.sequencia_aplicacao ?? 0);
    const logradouro = labelDetalhe(detalhe);
    const trecho = String(sequencia || "");
    fotos.push({
      id: `${detalhe.id}::${par.path}`,
      path: par.path,
      signedUrl: url,
      detalheId: String(detalhe.id),
      sequencia,
      logradouro,
      trecho,
      legendaSugerida: montarLegendaSugerida(1, logradouro, trecho, sequencia),
    });
  }
  fotos.sort((a, b) => a.sequencia - b.sequencia || a.path.localeCompare(b.path));
  return fotos;
}
