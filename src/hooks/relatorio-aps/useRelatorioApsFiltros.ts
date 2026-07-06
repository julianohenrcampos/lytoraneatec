/**
 * useRelatorioApsFiltros — E3.1
 * Busca registros manuais (bd_registro_apontamento_aplicacao com origem_registro='manual')
 * no período e centro de custo informados, junto de seus detalhes
 * (bd_registro_aplicacao_detalhes) e agrupa por logradouro.
 *
 * Somente leitura. Nenhum insert/update/delete. Nenhuma alteração de banco.
 */
import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RelatorioApsFiltrosInput {
  centroCustoId: string;
  dataInicio: Date;
  dataFim: Date;
  logradouro?: string;
}

export interface RegistroManualCabecalho {
  id: string;
  data_aplicacao: string | null;
  logradouro_aplicado: string | null;
  status_aplicacao: string | null;
  observacoes_gerais: string | null;
  centro_custo_id: string | null;
}

export interface DetalheAps extends Record<string, any> {
  id: string;
  registro_aplicacao_id: string;
  sequencia_aplicacao: number | null;
  logradouro_nome: string | null;
  data_aplicacao: string | null;
  latitude: number | null;
  longitude: number | null;
  fotos_aplicacao: string[] | null;
}

export interface GrupoRua {
  chave: string;
  logradouro: string;
  registroIds: string[];
  trechos: DetalheAps[];
}

export interface RelatorioApsFiltrosResult {
  registros: RegistroManualCabecalho[];
  detalhes: DetalheAps[];
  grupos: GrupoRua[];
  logradouros: string[];
  semDados: boolean;
}

const toIsoDate = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const normalizarChave = (s: string | null | undefined): string =>
  (s || "").trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

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
        logradouro: filtros.logradouro || null,
      });

      const { data: registros, error: eReg } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .select(
          "id, data_aplicacao, logradouro_aplicado, status_aplicacao, observacoes_gerais, centro_custo_id",
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

      let detList = (detalhes || []) as DetalheAps[];

      // Filtro client-side por logradouro (opcional)
      if (filtros.logradouro && filtros.logradouro !== "__all__") {
        const alvo = normalizarChave(filtros.logradouro);
        detList = detList.filter((d) => normalizarChave(d.logradouro_nome) === alvo);
      }

      // Agrupar por logradouro
      const mapaGrupos = new Map<string, GrupoRua>();
      for (const d of detList) {
        const chave = normalizarChave(d.logradouro_nome) || "__sem_logradouro__";
        if (!mapaGrupos.has(chave)) {
          mapaGrupos.set(chave, {
            chave,
            logradouro: (d.logradouro_nome || "Sem logradouro").trim(),
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
        a.logradouro.localeCompare(b.logradouro, "pt-BR"),
      );

      const logradouros = Array.from(
        new Set(
          (detalhes as DetalheAps[])
            .map((d) => (d.logradouro_nome || "").trim())
            .filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b, "pt-BR"));

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
