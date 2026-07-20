/**
 * Enriquecimento tipado dos detalhes do Relatório AP's com dados de
 * `bd_registro_aplicacao_ruas`.
 *
 * - Batch único por execução (sem N+1). Filtro em memória a partir do
 *   conjunto de rua_aplicacao_id / registro_aplicacao_id vindos dos detalhes.
 * - NÃO muta `logradouro_nome`. Devolve `DetalheApsEnriquecido` com campos
 *   adicionais typed: ruaAplicacaoId, logradouroMapa, logradouroLocal,
 *   logradouroExibicao e chaveRelatorioRua.
 * - Detalhes sem `rua_aplicacao_id` (registros antigos) recebem fallback
 *   coerente baseado no próprio `logradouro_nome`.
 */
import { supabase } from "@/integrations/supabase/client";
import { formatarLogradouroExibicao } from "@/utils/registroAplicacao/formatarLogradouroExibicao";
import { criarChaveRelatorioRua } from "@/utils/registroAplicacao/criarChaveRelatorioRua";
import type {
  DetalheAps,
  DetalheApsEnriquecido,
} from "@/types/relatorioApsDetalhe";

export interface RuaAplicacaoRelatorioRow {
  id: string;
  registroAplicacaoId: string;
  ordemRua: number;
  chaveNormalizada: string;
  logradouroMapa: string;
  logradouroLocal: string;
}

interface RuaRaw {
  id: string;
  registro_aplicacao_id: string;
  ordem_rua: number | null;
  chave_normalizada: string | null;
  logradouro_nome: string | null;
  logradouro_nome_local: string | null;
}

export async function buscarRuasAplicacaoPorRegistroIds(
  registroIds: string[],
): Promise<RuaAplicacaoRelatorioRow[]> {
  const ids = Array.from(new Set(registroIds.filter(Boolean)));
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("bd_registro_aplicacao_ruas")
    .select(
      "id, registro_aplicacao_id, ordem_rua, chave_normalizada, logradouro_nome, logradouro_nome_local",
    )
    .in("registro_aplicacao_id", ids);
  if (error) {
    console.warn("[RELATORIO_APS][RUAS_LOAD_FAIL]", error.message);
    return [];
  }
  return ((data as RuaRaw[] | null) ?? []).map((r) => ({
    id: String(r.id),
    registroAplicacaoId: String(r.registro_aplicacao_id),
    ordemRua: Number(r.ordem_rua ?? 0),
    chaveNormalizada: (r.chave_normalizada ?? "").toString(),
    logradouroMapa: (r.logradouro_nome ?? "").toString(),
    logradouroLocal: (r.logradouro_nome_local ?? "").toString(),
  }));
}

/**
 * Enriquece detalhes sem mutar `logradouro_nome`. Retorna nova lista com
 * `DetalheApsEnriquecido[]`. Match por `rua_aplicacao_id`; fallback por
 * `registro_aplicacao_id + logradouro_nome` para detalhes onde a FK ficou
 * nula (compat retroativa).
 */
export function enriquecerDetalhes(
  detalhes: DetalheAps[],
  ruas: RuaAplicacaoRelatorioRow[],
): DetalheApsEnriquecido[] {
  const porId = new Map<string, RuaAplicacaoRelatorioRow>();
  const porRegistroLogr = new Map<string, RuaAplicacaoRelatorioRow>();
  for (const r of ruas) {
    porId.set(r.id, r);
    const kLogr = (r.logradouroMapa || "").trim().toUpperCase();
    if (kLogr) {
      const key = `${r.registroAplicacaoId}::${kLogr}`;
      if (!porRegistroLogr.has(key)) porRegistroLogr.set(key, r);
    }
  }
  return detalhes.map((detalhe): DetalheApsEnriquecido => {
    const ruaPorFk = detalhe.rua_aplicacao_id
      ? porId.get(detalhe.rua_aplicacao_id)
      : undefined;
    const fallbackKey = `${detalhe.registro_aplicacao_id}::${(detalhe.logradouro_nome || "").trim().toUpperCase()}`;
    const rua = ruaPorFk ?? porRegistroLogr.get(fallbackKey);

    const logradouroMapa =
      (rua?.logradouroMapa || detalhe.logradouro_nome || "").toString();
    const logradouroLocal = (rua?.logradouroLocal || "").toString();
    const logradouroExibicao = formatarLogradouroExibicao(
      logradouroMapa,
      logradouroLocal,
    );
    const chaveRelatorioRua = criarChaveRelatorioRua({
      chaveNormalizada: rua?.chaveNormalizada,
      logradouroMapa,
      logradouroLocal,
    });
    return {
      ...detalhe,
      ruaAplicacaoId: detalhe.rua_aplicacao_id ?? null,
      logradouroMapa,
      logradouroLocal,
      logradouroExibicao,
      chaveRelatorioRua,
    };
  });
}
