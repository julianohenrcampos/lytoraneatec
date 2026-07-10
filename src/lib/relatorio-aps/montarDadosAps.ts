/**
 * Helpers puros para transformar detalhes brutos (bd_registro_aplicacao_detalhes)
 * em estruturas do Relatório AP's. Reutilizados pelo hook em modo registro-único
 * (E1/E2) e pelo modo multi-registro/multi-trecho (E3.1).
 */
import { criarSignedUrlFotoManual } from "@/services/registro-aplicacao/uploadFotosManual";
import {
  montarLegendaSugerida,
  RELATORIO_APS_PESO_DEFAULT,
  type RelatorioApsFotoDisponivel,
  type RelatorioApsLinha,
  type RelatorioApsPontoRua,
  type RelatorioApsPontoServico,
} from "@/types/relatorioAps";

type DetalheRaw = Record<string, any>;

export function montarLinhasFromDetalhes(
  detalhes: DetalheRaw[],
  situacaoDefault: string,
): RelatorioApsLinha[] {
  const linhas: RelatorioApsLinha[] = (detalhes || []).map((d) => {
    const tonelada = Number(d?.tonelada_aplicada ?? 0);
    const espessura =
      d?.espessura_aplicada != null
        ? Number(d.espessura_aplicada)
        : d?.espessura_calculada != null
          ? Number(d.espessura_calculada)
          : null;
    return {
      id: String(d.id),
      sequencia: Number(d?.sequencia_aplicacao ?? 0),
      logradouro: d?.logradouro_nome || "",
      data: d?.data_aplicacao || "",
      trecho: String(d?.sequencia_aplicacao ?? ""),
      situacao: situacaoDefault,
      comprimento: d?.comprimento != null ? Number(d.comprimento) : null,
      larguraMedia: d?.largura_media != null ? Number(d.largura_media) : null,
      areaAplicada: Number(d?.area_aplicada ?? 0),
      espessura,
      pesoKgM2: RELATORIO_APS_PESO_DEFAULT,
      totalKg: tonelada * 1000,
    };
  });
  // B.3.5-D.M7-A parte 2: ordenação canônica compartilhada por tela/PDF/Excel.
  // 1) data ASC (normalizada), 2) logradouro ASC, 3) sequencia ASC, 4) id ASC.
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
  detalhes: DetalheRaw[],
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
        logradouro: d?.logradouro_nome || "",
      });
    }
  }
  pontos.sort((a, b) => a.sequencia - b.sequencia);
  return pontos;
}

type RuaRaw = Record<string, any>;

/** Extrai pontos de ruas (bd_registro_aplicacao_ruas) com lat/lng válidos. */
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
      pontos.push({
        ruaId: String(r.id),
        ordem: Number(r?.ordem_rua ?? 0),
        latitude: lat,
        longitude: lng,
        logradouro: r?.logradouro_nome || "",
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
  detalhes: DetalheRaw[],
  cachePreExistente?: Map<string, string>,
): Promise<RelatorioApsFotoDisponivel[]> {
  const cache = cachePreExistente || new Map<string, string>();
  const pares: Array<{ detalhe: DetalheRaw; path: string }> = [];
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
    const logradouro = detalhe?.logradouro_nome || "";
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
