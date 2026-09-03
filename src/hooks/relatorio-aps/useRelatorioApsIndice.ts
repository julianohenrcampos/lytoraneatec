/**
 * useRelatorioApsIndice — E3.2 (revisado no fechamento "Nome Local da Rua").
 *
 * Índice cruzado (Centro de Custo ↔ Rua/Logradouro) dos registros manuais
 * no período. Usa a mesma identidade estável (chaveRelatorioRua) do
 * useRelatorioApsFiltros. Somente leitura, batch único por execução.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buscarRuasAplicacaoPorRegistroIds,
  enriquecerDetalhes,
} from "@/services/relatorio-aps/relatorioApsRuasService";
import type { DetalheAps } from "@/types/relatorioApsDetalhe";
import type { RuaOption } from "@/types/relatorioApsRuaOption";
import { normalizarTextoLogradouro } from "@/utils/registroAplicacao/normalizarTextoLogradouro";

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

interface RegistroLite {
  id: string;
  centro_custo_id: string | null;
}
interface DetalheLite {
  id: string;
  registro_aplicacao_id: string;
  rua_aplicacao_id: string | null;
  logradouro_nome: string | null;
}

export type { RuaOption };

export function useRelatorioApsIndice(dataInicio: Date, dataFim: Date) {
  const [ccIds, setCcIds] = useState<Set<string>>(new Set());
  const [ruas, setRuas] = useState<RuaOption[]>([]);
  const [mapCcToRuas, setMapCcToRuas] = useState<Map<string, Set<string>>>(new Map());
  const [mapRuaToCcs, setMapRuaToCcs] = useState<Map<string, Set<string>>>(new Map());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const de = toIsoDate(dataInicio);
  const ate = toIsoDate(dataFim);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const { data: registros, error: e1 } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .select("id, centro_custo_id")
        .eq("origem_registro", "manual")
        .gte("data_aplicacao", de)
        .lte("data_aplicacao", ate);
      if (e1) throw e1;
      const regs = (registros || []) as RegistroLite[];
      if (regs.length === 0) {
        setCcIds(new Set());
        setRuas([]);
        setMapCcToRuas(new Map());
        setMapRuaToCcs(new Map());
        return;
      }
      const regToCc = new Map<string, string>();
      const ccSet = new Set<string>();
      for (const r of regs) {
        if (r.centro_custo_id) {
          regToCc.set(r.id, r.centro_custo_id);
          ccSet.add(r.centro_custo_id);
        }
      }
      const ids = regs.map((r) => r.id);
      const { data: detalhes, error: e2 } = await supabase
        .from("bd_registro_aplicacao_detalhes")
        .select("id, registro_aplicacao_id, rua_aplicacao_id, logradouro_nome")
        .in("registro_aplicacao_id", ids);
      if (e2) throw e2;
      const ruasLocais = await buscarRuasAplicacaoPorRegistroIds(ids);

      // Enriquecimento tipado: usa DetalheAps parcial preenchido com campos
      // efetivamente lidos aqui — os demais campos ficam ausentes (unknown).
      const detsParaEnriq: DetalheAps[] = ((detalhes || []) as DetalheLite[]).map(
        (d) => ({
          id: d.id,
          registro_aplicacao_id: d.registro_aplicacao_id,
          rua_aplicacao_id: d.rua_aplicacao_id ?? null,
          sequencia_aplicacao: null,
          logradouro_nome: d.logradouro_nome,
          data_aplicacao: null,
          latitude: null,
          longitude: null,
          fotos_aplicacao: null,
        }),
      );
      const dets = enriquecerDetalhes(detsParaEnriq, ruasLocais);

      const opcoesPorChave = new Map<string, RuaOption>();
      const ccToRuas = new Map<string, Set<string>>();
      const ruaToCcs = new Map<string, Set<string>>();
      for (const d of dets) {
        if (!d.logradouroMapa && !d.logradouroLocal) continue;
        const chave = d.chaveRelatorioRua;
        if (!opcoesPorChave.has(chave)) {
          opcoesPorChave.set(chave, {
            chave,
            nome: d.logradouroExibicao || "Sem logradouro",
            searchText: normalizarTextoLogradouro(
              `${d.logradouroMapa} ${d.logradouroLocal}`,
            ),
            logradouroMapa: d.logradouroMapa,
            logradouroLocal: d.logradouroLocal,
          });
        }
        const cc = regToCc.get(d.registro_aplicacao_id);
        if (!cc) continue;
        if (!ccToRuas.has(cc)) ccToRuas.set(cc, new Set());
        ccToRuas.get(cc)!.add(chave);
        if (!ruaToCcs.has(chave)) ruaToCcs.set(chave, new Set());
        ruaToCcs.get(chave)!.add(cc);
      }
      const opts: RuaOption[] = Array.from(opcoesPorChave.values()).sort(
        (a, b) => a.nome.localeCompare(b.nome, "pt-BR"),
      );
      setCcIds(ccSet);
      setRuas(opts);
      setMapCcToRuas(ccToRuas);
      setMapRuaToCcs(ruaToCcs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao indexar registros";
      console.warn("[RELATORIO_APS][INDICE_ERRO]", msg);
      setErro(msg);
      setCcIds(new Set());
      setRuas([]);
      setMapCcToRuas(new Map());
      setMapRuaToCcs(new Map());
    } finally {
      setCarregando(false);
    }
  }, [de, ate]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ruasFiltradasPorCc = useCallback(
    (ccId: string | null): RuaOption[] => {
      if (!ccId) return ruas;
      const chaves = mapCcToRuas.get(ccId);
      if (!chaves) return [];
      return ruas.filter((r) => chaves.has(r.chave));
    },
    [ruas, mapCcToRuas],
  );

  const ccsFiltradosPorRua = useCallback(
    (ruaChave: string | null): Set<string> => {
      if (!ruaChave) return ccIds;
      return mapRuaToCcs.get(ruaChave) || new Set<string>();
    },
    [ccIds, mapRuaToCcs],
  );

  return useMemo(
    () => ({
      carregando,
      erro,
      ccIds,
      ruas,
      ruasFiltradasPorCc,
      ccsFiltradosPorRua,
      recarregar: carregar,
    }),
    [carregando, erro, ccIds, ruas, ruasFiltradasPorCc, ccsFiltradosPorRua, carregar],
  );
}
