/**
 * useRelatorioApsIndice — E3.2
 * Índice cruzado (Centro de Custo ↔ Rua/Logradouro) dos registros manuais
 * dentro do período informado. Popula os dois Combobox da aba
 * "Relatório AP's" e habilita filtro cruzado bidirecional.
 *
 * Somente leitura. Nenhuma escrita no Supabase.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export const stripDiacritics = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export const normalizarRua = (s: string | null | undefined): string =>
  stripDiacritics((s || "").trim().toLocaleLowerCase("pt-BR")).replace(/\s+/g, " ");

interface RegistroLite {
  id: string;
  centro_custo_id: string | null;
}
interface DetalheLite {
  registro_aplicacao_id: string;
  logradouro_nome: string | null;
}

export interface RuaOption {
  chave: string;
  nome: string;
}

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
        .select("registro_aplicacao_id, logradouro_nome")
        .in("registro_aplicacao_id", ids);
      if (e2) throw e2;
      const dets = (detalhes || []) as DetalheLite[];

      const nomePorChave = new Map<string, string>();
      const ccToRuas = new Map<string, Set<string>>();
      const ruaToCcs = new Map<string, Set<string>>();
      for (const d of dets) {
        const nome = (d.logradouro_nome || "").trim();
        if (!nome) continue;
        const chave = normalizarRua(nome);
        if (!nomePorChave.has(chave)) nomePorChave.set(chave, nome);
        const cc = regToCc.get(d.registro_aplicacao_id);
        if (!cc) continue;
        if (!ccToRuas.has(cc)) ccToRuas.set(cc, new Set());
        ccToRuas.get(cc)!.add(chave);
        if (!ruaToCcs.has(chave)) ruaToCcs.set(chave, new Set());
        ruaToCcs.get(chave)!.add(cc);
      }
      const opts: RuaOption[] = Array.from(nomePorChave.entries())
        .map(([chave, nome]) => ({ chave, nome }))
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
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
