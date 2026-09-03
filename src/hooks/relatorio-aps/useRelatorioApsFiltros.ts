/**
 * useRelatorioApsFiltros — E3.1 (revisado no fechamento "Nome Local da Rua").
 *
 * Somente leitura. Nenhuma escrita. Nenhuma alteração de banco.
 * Enriquecimento de detalhes com dados de `bd_registro_aplicacao_ruas`
 * em batch único (sem N+1), preservando `logradouro_nome` original e
 * expondo `logradouroExibicao` + `chaveRelatorioRua`.
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  buscarRuasAplicacaoPorRegistroIds,
  enriquecerDetalhes,
} from "@/services/relatorio-aps/relatorioApsRuasService";
import type {
  DetalheAps,
  DetalheApsEnriquecido,
} from "@/types/relatorioApsDetalhe";
import type { RuaOption } from "@/types/relatorioApsRuaOption";
import { normalizarTextoLogradouro } from "@/utils/registroAplicacao/normalizarTextoLogradouro";

export interface RelatorioApsFiltrosInput {
  centroCustoId: string;
  dataInicio: Date;
  dataFim: Date;
  /** Chave estável do combobox de rua. Vazio ou "__all__" = todas. */
  logradouroChave?: string;
}

export interface RegistroManualCabecalho {
  id: string;
  data_aplicacao: string | null;
  logradouro_aplicado: string | null;
  status_aplicacao: string | null;
  observacoes_gerais: string | null;
  centro_custo_id: string | null;
  atividade: string | null;
}

export interface GrupoRua {
  chave: string;
  logradouroExibicao: string;
  registroIds: string[];
  trechos: DetalheApsEnriquecido[];
}

export interface RelatorioApsFiltrosResult {
  registros: RegistroManualCabecalho[];
  detalhes: DetalheApsEnriquecido[];
  grupos: GrupoRua[];
  logradouros: RuaOption[];
  semDados: boolean;
}

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

export function useRelatorioApsFiltros() {
  const [resultado, setResultado] = useState<RelatorioApsFiltrosResult>({
    registros: [],
    detalhes: [],
    grupos: [],
    logradouros: [],
    semDados: true,
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [buscouAlgumaVez, setBuscouAlgumaVez] = useState(false);

  const buscar = useCallback(async (filtros: RelatorioApsFiltrosInput) => {
    setCarregando(true);
    setErro(null);
    try {
      const de = toIsoDate(filtros.dataInicio);
      const ate = toIsoDate(filtros.dataFim);
      console.log("[RELATORIO_APS][FILTROS_BUSCA]", {
        cc: filtros.centroCustoId,
        de,
        ate,
        chave: filtros.logradouroChave || null,
      });

      const { data: registros, error: eReg } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .select(
          "id, data_aplicacao, logradouro_aplicado, status_aplicacao, observacoes_gerais, centro_custo_id, atividade",
        )
        .eq("origem_registro", "manual")
        .eq("centro_custo_id", filtros.centroCustoId)
        .gte("data_aplicacao", de)
        .lte("data_aplicacao", ate)
        .order("data_aplicacao", { ascending: true });

      if (eReg) throw eReg;

      const regList = (registros || []) as RegistroManualCabecalho[];
      if (regList.length === 0) {
        setResultado({
          registros: [],
          detalhes: [],
          grupos: [],
          logradouros: [],
          semDados: true,
        });
        setBuscouAlgumaVez(true);
        return;
      }

      const ids = regList.map((r) => r.id);
      const { data: detalhes, error: eDet } = await supabase
        .from("bd_registro_aplicacao_detalhes")
        .select("*")
        .in("registro_aplicacao_id", ids)
        .order("sequencia_aplicacao", { ascending: true });
      if (eDet) throw eDet;

      // Batch único de ruas + enriquecimento tipado (sem mutar logradouro_nome).
      const ruasLocais = await buscarRuasAplicacaoPorRegistroIds(ids);
      const detalhesCrus = (detalhes || []) as unknown as DetalheAps[];
      let detList = enriquecerDetalhes(detalhesCrus, ruasLocais);

      // Filtro client-side por chave estável (opcional).
      const chaveFiltro = filtros.logradouroChave;
      if (chaveFiltro && chaveFiltro !== "__all__") {
        detList = detList.filter((d) => d.chaveRelatorioRua === chaveFiltro);
      }

      // Agrupamento por chave estável.
      const mapaGrupos = new Map<string, GrupoRua>();
      for (const d of detList) {
        const chave = d.chaveRelatorioRua;
        if (!mapaGrupos.has(chave)) {
          mapaGrupos.set(chave, {
            chave,
            logradouroExibicao: d.logradouroExibicao || "Sem logradouro",
            registroIds: [],
            trechos: [],
          });
        }
        const g = mapaGrupos.get(chave)!;
        g.trechos.push(d);
        if (!g.registroIds.includes(d.registro_aplicacao_id)) {
          g.registroIds.push(d.registro_aplicacao_id);
        }
      }
      const grupos = Array.from(mapaGrupos.values()).sort((a, b) =>
        a.logradouroExibicao.localeCompare(b.logradouroExibicao, "pt-BR"),
      );

      // Opções únicas por chave.
      const mapaOpts = new Map<string, RuaOption>();
      for (const d of detList) {
        if (mapaOpts.has(d.chaveRelatorioRua)) continue;
        const nome = d.logradouroExibicao || "Sem logradouro";
        const searchText = normalizarTextoLogradouro(
          `${d.logradouroMapa} ${d.logradouroLocal}`,
        );
        mapaOpts.set(d.chaveRelatorioRua, {
          chave: d.chaveRelatorioRua,
          nome,
          searchText,
          logradouroMapa: d.logradouroMapa,
          logradouroLocal: d.logradouroLocal,
        });
      }
      const logradouros = Array.from(mapaOpts.values()).sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      );

      console.log("[RELATORIO_APS][FILTROS_RESULT]", {
        registros: regList.length,
        detalhes: detList.length,
        grupos: grupos.length,
        logradouros: logradouros.length,
      });

      setResultado({
        registros: regList,
        detalhes: detList,
        grupos,
        logradouros,
        semDados: detList.length === 0,
      });
      setBuscouAlgumaVez(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao buscar registros";
      console.warn("[RELATORIO_APS][FILTROS_ERRO]", msg);
      setErro(msg);
      setResultado({
        registros: [],
        detalhes: [],
        grupos: [],
        logradouros: [],
        semDados: true,
      });
      setBuscouAlgumaVez(true);
    } finally {
      setCarregando(false);
    }
  }, []);

  const resetar = useCallback(() => {
    setResultado({
      registros: [],
      detalhes: [],
      grupos: [],
      logradouros: [],
      semDados: true,
    });
    setErro(null);
    setBuscouAlgumaVez(false);
  }, []);

  return { resultado, carregando, erro, buscouAlgumaVez, buscar, resetar };
}
