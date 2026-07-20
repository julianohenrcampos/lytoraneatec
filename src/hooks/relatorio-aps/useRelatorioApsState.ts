import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchRegistroAplicacaoById } from "@/services/registro-aplicacao/fetchRegistroAplicacao";
import { buscarAplicacoesPorRegistro } from "@/services/registro-aplicacao/aplicacaoPorRuaService";
import type {
  RelatorioApsCarimboCabecalho,
  RelatorioApsCarimboRow,
} from "@/types/relatorioApsCarimbo";
import {
  aplicarCarimboNoCabecalho,
  extrairCarimboDoRow,
  isCarimboDirty as calcCarimboDirty,
  limparCarimboDoCabecalho,
} from "@/lib/relatorio-aps/montarCabecalhoRelatorioAps";
import {
  montarFotosDisponiveisFromDetalhes,
  montarLinhasFromDetalhes,
  montarPontosRuaFromRuas,
  montarPontosServicoFromDetalhes,
} from "@/lib/relatorio-aps/montarDadosAps";
import {
  criarCabecalhoDefault,
  montarLegendaSugerida,
  RELATORIO_APS_MAX_FOTOS,
  type RelatorioApsCabecalhoEditavel,
  type RelatorioApsCoordenada,
  type RelatorioApsFotoDisponivel,
  type RelatorioApsFotoSelecionada,
  type RelatorioApsLinha,
  type RelatorioApsMapaState,
  type RelatorioApsPontoRua,
  type RelatorioApsState,
} from "@/types/relatorioAps";

const mapaVazio = (): RelatorioApsMapaState => ({
  pontosServico: [],
  pontosRua: [],
  linhaServico: [],
  areasAplicacao: [],
  areaEmEdicao: undefined,
  ajustesPontosServico: {},
  ajustesPontosRua: {},
  marcadoresManuais: [],
  selecaoMarcador: undefined,
  mostrarPontosRua: true,
  incluirPontosRuaNoPdf: true,
});

async function carregarPontosRua(registroIds: string[]): Promise<RelatorioApsPontoRua[]> {
  const ids = Array.from(new Set(registroIds.filter(Boolean)));
  if (ids.length === 0) return [];
  try {
    const { data, error } = await supabase
      .from("bd_registro_aplicacao_ruas")
      .select("id, ordem_rua, logradouro_nome, logradouro_nome_local, latitude, longitude")
      .in("registro_aplicacao_id", ids)
      .order("ordem_rua", { ascending: true });
    if (error) {
      console.warn("[RELATORIO_APS][RUAS_LOAD_FAIL]", error.message);
      return [];
    }
    return montarPontosRuaFromRuas((data as any[]) || []);
  } catch (e) {
    console.warn("[RELATORIO_APS][RUAS_LOAD_ERROR]", e);
    return [];
  }
}

export interface CarregarDeSelecaoOpts {
  /** Linhas de bd_registro_aplicacao_detalhes já buscadas pelo hook de filtros. */
  detalhes: Array<Record<string, any>>;
  /** Texto default para a coluna Situação. */
  situacaoDefault?: string;
  /** Sobrescreve campos do cabeçalho (Rua/Obs) — usados quando montado a partir de múltiplos registros. */
  cabecalhoOverride?: Partial<RelatorioApsCabecalhoEditavel>;
  /**
   * Quando true, PRESERVA os 5 campos administrativos (obra/empresa/cliente/bairro/revisao)
   * e o carimbo atualmente selecionado. Usado quando o CC permanece o mesmo entre remontagens
   * (evita "flash" com cabeçalho vazio).
   */
  preservarCabecalhoAdmin?: boolean;
  /**
   * Mapa registro_aplicacao_id → atividade original de `bd_registro_apontamento_aplicacao`.
   * Propagado para as linhas para permitir tradução do tipo de aplicação nos exportadores.
   */
  mapaAtividadePorRegistro?: Record<string, string | null | undefined>;
}

export interface CarimboAtualMeta {
  id: string;
  nome: string;
  centro_custo_id: string | null;
  padrao_centro_custo: boolean;
  updated_at: string;
}

/**
 * Estado em memória do Relatório de AP's.
 * Somente leitura no Supabase. Nenhuma escrita. Nada persistido.
 *
 * Dois modos de alimentação:
 *  - `registroAplicacaoId` no useEffect (compat E1/E2 — Dialog por linha).
 *  - `carregarDeSelecao(...)` a partir de detalhes pré-carregados (E3.1 — nova aba).
 */
export function useRelatorioApsState(registroAplicacaoId: string | null) {
  const [state, setState] = useState<RelatorioApsState>({
    registroId: registroAplicacaoId,
    carregando: false,
    erro: null,
    cabecalho: criarCabecalhoDefault(),
    linhas: [],
    fotosDisponiveis: [],
    fotosSelecionadas: [],
    mapa: mapaVazio(),
  });

  // ============ Carimbo do Relatório AP's (persistência dos 5 campos) ============
  const [carimboAtual, setCarimboAtual] = useState<CarimboAtualMeta | null>(null);
  const [carimboSnapshot, setCarimboSnapshot] =
    useState<RelatorioApsCarimboCabecalho | null>(null);

  const aplicarCarimbo = useCallback((row: RelatorioApsCarimboRow) => {
    const snap = extrairCarimboDoRow(row);
    setCarimboAtual({
      id: row.id,
      nome: row.nome,
      centro_custo_id: row.centro_custo_id,
      padrao_centro_custo: row.padrao_centro_custo,
      updated_at: row.updated_at,
    });
    setCarimboSnapshot(snap);
    setState((prev) => ({
      ...prev,
      cabecalho: aplicarCarimboNoCabecalho(prev.cabecalho, snap),
    }));
  }, []);

  const restaurarCarimbo = useCallback(() => {
    setState((prev) =>
      carimboSnapshot
        ? { ...prev, cabecalho: aplicarCarimboNoCabecalho(prev.cabecalho, carimboSnapshot) }
        : prev,
    );
  }, [carimboSnapshot]);

  const limparCabecalhoAdmin = useCallback(() => {
    setState((prev) => ({
      ...prev,
      cabecalho: limparCarimboDoCabecalho(prev.cabecalho),
    }));
  }, []);

  const limparCarimboAtual = useCallback(() => {
    setCarimboAtual(null);
    setCarimboSnapshot(null);
  }, []);

  const atualizarSnapshotComRow = useCallback((row: RelatorioApsCarimboRow) => {
    setCarimboAtual({
      id: row.id,
      nome: row.nome,
      centro_custo_id: row.centro_custo_id,
      padrao_centro_custo: row.padrao_centro_custo,
      updated_at: row.updated_at,
    });
    setCarimboSnapshot(extrairCarimboDoRow(row));
  }, []);

  const carimboDirty = useMemo(
    () => calcCarimboDirty(state.cabecalho, carimboSnapshot),
    [state.cabecalho, carimboSnapshot],
  );

  const carregar = useCallback(async (id: string) => {
    setState((prev) => ({
      ...prev,
      carregando: true,
      erro: null,
      registroId: id,
      fotosDisponiveis: [],
      fotosSelecionadas: [],
      mapa: mapaVazio(),
    }));
    try {
      const [registro, detalhes] = await Promise.all([
        fetchRegistroAplicacaoById(id),
        buscarAplicacoesPorRegistro(id),
      ]);

      const situacaoDefault =
        (registro as any)?.status_aplicacao || (registro as any)?.status || "";

      const cabecalho: RelatorioApsCabecalhoEditavel = {
        ...criarCabecalhoDefault(),
        rua: (registro as any)?.logradouro_aplicado || "",
        observacoes: (registro as any)?.observacoes_gerais || "",
      };

      const linhas = montarLinhasFromDetalhes(detalhes || [], situacaoDefault);
      const pontosServico = montarPontosServicoFromDetalhes(detalhes || []);
      const pontosRua = await carregarPontosRua([id]);
      console.log("[RELATORIO_APS][MAPA_PONTOS_LOAD]", {
        pontosServico: pontosServico.length,
        pontosRua: pontosRua.length,
      });

      console.log("[RELATORIO_APS][FOTOS_LOAD_START]", {
        detalhes: (detalhes || []).length,
      });
      const fotosDisponiveis = await montarFotosDisponiveisFromDetalhes(detalhes || []);
      console.log("[RELATORIO_APS][FOTOS_SIGNED_URL_SUCCESS]", {
        total: fotosDisponiveis.length,
      });

      setState({
        registroId: id,
        carregando: false,
        erro: null,
        cabecalho,
        linhas,
        fotosDisponiveis,
        fotosSelecionadas: [],
        mapa: {
          ...mapaVazio(),
          pontosServico,
          pontosRua,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao carregar registro";
      setState((prev) => ({
        ...prev,
        carregando: false,
        erro: msg,
      }));
    }
  }, []);

  const carregarDeSelecao = useCallback(async (opts: CarregarDeSelecaoOpts) => {
    const {
      detalhes,
      situacaoDefault = "",
      cabecalhoOverride = {},
      preservarCabecalhoAdmin = false,
      mapaAtividadePorRegistro,
    } = opts;
    setState((prev) => ({
      ...prev,
      carregando: true,
      erro: null,
      registroId: null,
      fotosDisponiveis: [],
      fotosSelecionadas: [],
      mapa: mapaVazio(),
    }));
    if (!preservarCabecalhoAdmin) {
      setCarimboAtual(null);
      setCarimboSnapshot(null);
    }
    try {
      const linhas = montarLinhasFromDetalhes(detalhes, situacaoDefault, mapaAtividadePorRegistro);
      const pontosServico = montarPontosServicoFromDetalhes(detalhes);
      const registroIds = (detalhes || [])
        .map((d) => String(d?.registro_aplicacao_id ?? ""))
        .filter(Boolean);
      const pontosRua = await carregarPontosRua(registroIds);
      const fotosDisponiveis = await montarFotosDisponiveisFromDetalhes(detalhes);
      console.log("[RELATORIO_APS][MULTI_LOAD]", {
        detalhes: detalhes.length,
        linhas: linhas.length,
        pontos: pontosServico.length,
        pontosRua: pontosRua.length,
        fotos: fotosDisponiveis.length,
        preservarCabecalhoAdmin,
      });
      setState((prev) => {
        // Base: default OU cabeçalho atual (para preservar 5 campos + peso).
        const base = preservarCabecalhoAdmin
          ? prev.cabecalho
          : criarCabecalhoDefault();
        return {
          registroId: null,
          carregando: false,
          erro: null,
          cabecalho: { ...base, ...cabecalhoOverride },
          linhas,
          fotosDisponiveis,
          fotosSelecionadas: [],
          mapa: {
            ...mapaVazio(),
            pontosServico,
            pontosRua,
          },
        };
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao montar relatório";
      setState((prev) => ({ ...prev, carregando: false, erro: msg }));
    }
  }, []);

  const resetar = useCallback(() => {
    setState({
      registroId: null,
      carregando: false,
      erro: null,
      cabecalho: criarCabecalhoDefault(),
      linhas: [],
      fotosDisponiveis: [],
      fotosSelecionadas: [],
      mapa: mapaVazio(),
    });
  }, []);

  useEffect(() => {
    if (registroAplicacaoId) {
      carregar(registroAplicacaoId);
    } else {
      resetar();
    }
  }, [registroAplicacaoId, carregar, resetar]);

  const setCampoCabecalho = useCallback(
    <K extends keyof RelatorioApsCabecalhoEditavel>(
      campo: K,
      valor: RelatorioApsCabecalhoEditavel[K],
    ) => {
      setState((prev) => ({
        ...prev,
        cabecalho: { ...prev.cabecalho, [campo]: valor },
      }));
    },
    [],
  );

  const setCampoLinha = useCallback(
    <K extends keyof RelatorioApsLinha>(id: string, campo: K, valor: RelatorioApsLinha[K]) => {
      setState((prev) => ({
        ...prev,
        linhas: prev.linhas.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)),
      }));
    },
    [],
  );

  const selecionarFoto = useCallback((id: string) => {
    setState((prev) => {
      if (prev.fotosSelecionadas.length >= RELATORIO_APS_MAX_FOTOS) {
        console.warn("[RELATORIO_APS][FOTO_SELECT] bloqueado — limite atingido");
        return prev;
      }
      if (prev.fotosSelecionadas.some((f) => f.id === id)) {
        return prev;
      }
      const disp = prev.fotosDisponiveis.find((f) => f.id === id);
      if (!disp) return prev;
      const ordem = prev.fotosSelecionadas.length + 1;
      const novo: RelatorioApsFotoSelecionada = {
        id: disp.id,
        path: disp.path,
        signedUrl: disp.signedUrl,
        ordem,
        legenda: montarLegendaSugerida(ordem, disp.logradouro, disp.trecho, disp.sequencia),
      };
      console.log("[RELATORIO_APS][FOTO_SELECT]", { id, ordem });
      return { ...prev, fotosSelecionadas: [...prev.fotosSelecionadas, novo] };
    });
  }, []);

  const recomputarOrdens = (
    fotos: RelatorioApsFotoSelecionada[],
    disponiveis: RelatorioApsFotoDisponivel[],
  ): RelatorioApsFotoSelecionada[] =>
    fotos.map((f, idx) => {
      const ordem = idx + 1;
      const disp = disponiveis.find((d) => d.id === f.id);
      const legendaAntigaSugerida = disp
        ? montarLegendaSugerida(f.ordem, disp.logradouro, disp.trecho, disp.sequencia)
        : null;
      const foiEditada = legendaAntigaSugerida != null && f.legenda !== legendaAntigaSugerida;
      const legenda = foiEditada || !disp
        ? f.legenda
        : montarLegendaSugerida(ordem, disp.logradouro, disp.trecho, disp.sequencia);
      return { ...f, ordem, legenda };
    });

  const removerFotoSelecionada = useCallback((id: string) => {
    setState((prev) => {
      const restantes = prev.fotosSelecionadas.filter((f) => f.id !== id);
      if (restantes.length === prev.fotosSelecionadas.length) return prev;
      console.log("[RELATORIO_APS][FOTO_REMOVE]", { id });
      return {
        ...prev,
        fotosSelecionadas: recomputarOrdens(restantes, prev.fotosDisponiveis),
      };
    });
  }, []);

  const moverFotoSelecionada = useCallback(
    (id: string, direcao: "cima" | "baixo") => {
      setState((prev) => {
        const idx = prev.fotosSelecionadas.findIndex((f) => f.id === id);
        if (idx < 0) return prev;
        const alvo = direcao === "cima" ? idx - 1 : idx + 1;
        if (alvo < 0 || alvo >= prev.fotosSelecionadas.length) return prev;
        const arr = [...prev.fotosSelecionadas];
        [arr[idx], arr[alvo]] = [arr[alvo], arr[idx]];
        console.log("[RELATORIO_APS][FOTO_REORDER]", { id, direcao });
        return {
          ...prev,
          fotosSelecionadas: recomputarOrdens(arr, prev.fotosDisponiveis),
        };
      });
    },
    [],
  );

  const setLegendaFoto = useCallback((id: string, legenda: string) => {
    setState((prev) => ({
      ...prev,
      fotosSelecionadas: prev.fotosSelecionadas.map((f) =>
        f.id === id ? { ...f, legenda } : f,
      ),
    }));
  }, []);

  const mapaAdicionarPonto = useCallback((coord: RelatorioApsCoordenada) => {
    setState((prev) => {
      const nova = [...prev.mapa.linhaServico, coord];
      console.log("[RELATORIO_APS][MAPA_LINHA_ADD_POINT]", { index: nova.length - 1 });
      return { ...prev, mapa: { ...prev.mapa, linhaServico: nova } };
    });
  }, []);

  const mapaDesfazerUltimoPonto = useCallback(() => {
    setState((prev) => {
      if (prev.mapa.linhaServico.length === 0) return prev;
      console.log("[RELATORIO_APS][MAPA_LINHA_UNDO]");
      return {
        ...prev,
        mapa: { ...prev.mapa, linhaServico: prev.mapa.linhaServico.slice(0, -1) },
      };
    });
  }, []);

  const mapaLimparLinha = useCallback(() => {
    setState((prev) => {
      if (prev.mapa.linhaServico.length === 0) return prev;
      console.log("[RELATORIO_APS][MAPA_LINHA_CLEAR]");
      return { ...prev, mapa: { ...prev.mapa, linhaServico: [] } };
    });
  }, []);

  const mapaIniciarArea = useCallback(() => {
    setState((prev) => ({
      ...prev,
      mapa: { ...prev.mapa, areaEmEdicao: [] },
    }));
  }, []);

  const mapaAdicionarPontoArea = useCallback((coord: RelatorioApsCoordenada) => {
    setState((prev) => {
      const atual = prev.mapa.areaEmEdicao ?? [];
      const nova = [...atual, coord];
      console.log("[RELATORIO_APS][MAPA_AREA_ADD_POINT]", { index: nova.length - 1 });
      return { ...prev, mapa: { ...prev.mapa, areaEmEdicao: nova } };
    });
  }, []);

  const mapaDesfazerPontoArea = useCallback(() => {
    setState((prev) => {
      const atual = prev.mapa.areaEmEdicao;
      if (!atual || atual.length === 0) return prev;
      return { ...prev, mapa: { ...prev.mapa, areaEmEdicao: atual.slice(0, -1) } };
    });
  }, []);

  const mapaFecharArea = useCallback(() => {
    setState((prev) => {
      const atual = prev.mapa.areaEmEdicao;
      if (!atual || atual.length < 3) return prev;
      console.log("[RELATORIO_APS][MAPA_AREA_CLOSE]", { pts: atual.length });
      return {
        ...prev,
        mapa: {
          ...prev.mapa,
          areasAplicacao: [...prev.mapa.areasAplicacao, atual],
          areaEmEdicao: undefined,
        },
      };
    });
  }, []);

  const mapaCancelarArea = useCallback(() => {
    setState((prev) => {
      if (prev.mapa.areaEmEdicao === undefined) return prev;
      return { ...prev, mapa: { ...prev.mapa, areaEmEdicao: undefined } };
    });
  }, []);

  const mapaLimparAreas = useCallback(() => {
    setState((prev) => {
      if (prev.mapa.areasAplicacao.length === 0 && prev.mapa.areaEmEdicao === undefined) return prev;
      console.log("[RELATORIO_APS][MAPA_AREAS_CLEAR]");
      return {
        ...prev,
        mapa: { ...prev.mapa, areasAplicacao: [], areaEmEdicao: undefined },
      };
    });
  }, []);

  // ============ B.3.5-D.M7-B — ajustes/manuais (memória) ============

  const mapaSelecionarMarcador = useCallback(
    (tipo: "servico" | "rua" | "manual", id: string) => {
      setState((prev) => ({
        ...prev,
        mapa: { ...prev.mapa, selecaoMarcador: { tipo, id } },
      }));
    },
    [],
  );

  const mapaLimparSelecao = useCallback(() => {
    setState((prev) => {
      if (!prev.mapa.selecaoMarcador) return prev;
      return { ...prev, mapa: { ...prev.mapa, selecaoMarcador: undefined } };
    });
  }, []);

  const mapaAjustarPontoServico = useCallback(
    (detalheId: string, coord: RelatorioApsCoordenada) => {
      setState((prev) => ({
        ...prev,
        mapa: {
          ...prev.mapa,
          ajustesPontosServico: {
            ...prev.mapa.ajustesPontosServico,
            [detalheId]: { latitude: coord.latitude, longitude: coord.longitude },
          },
        },
      }));
    },
    [],
  );

  const mapaAjustarPontoRua = useCallback(
    (ruaId: string, coord: RelatorioApsCoordenada) => {
      setState((prev) => ({
        ...prev,
        mapa: {
          ...prev.mapa,
          ajustesPontosRua: {
            ...prev.mapa.ajustesPontosRua,
            [ruaId]: { latitude: coord.latitude, longitude: coord.longitude },
          },
        },
      }));
    },
    [],
  );

  const mapaAdicionarMarcadorManual = useCallback(
    (coord: RelatorioApsCoordenada) => {
      setState((prev) => {
        const maxServ = prev.mapa.pontosServico.reduce(
          (m, p) => Math.max(m, p.sequencia || 0),
          0,
        );
        const maxMan = prev.mapa.marcadoresManuais.reduce(
          (m, p) => Math.max(m, p.sequencia || 0),
          0,
        );
        const sequencia = Math.max(maxServ, maxMan) + 1;
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const novo = {
          id,
          sequencia,
          latitude: coord.latitude,
          longitude: coord.longitude,
        };
        console.log("[RELATORIO_APS][MAPA_MANUAL_ADD]", { id, sequencia });
        return {
          ...prev,
          mapa: {
            ...prev.mapa,
            marcadoresManuais: [...prev.mapa.marcadoresManuais, novo],
          },
        };
      });
    },
    [],
  );

  const mapaMoverMarcadorManual = useCallback(
    (id: string, coord: RelatorioApsCoordenada) => {
      setState((prev) => ({
        ...prev,
        mapa: {
          ...prev.mapa,
          marcadoresManuais: prev.mapa.marcadoresManuais.map((m) =>
            m.id === id
              ? { ...m, latitude: coord.latitude, longitude: coord.longitude }
              : m,
          ),
        },
      }));
    },
    [],
  );

  const mapaRemoverMarcadorManual = useCallback((id: string) => {
    setState((prev) => {
      const restantes = prev.mapa.marcadoresManuais.filter((m) => m.id !== id);
      if (restantes.length === prev.mapa.marcadoresManuais.length) return prev;
      const selecao =
        prev.mapa.selecaoMarcador?.tipo === "manual" &&
        prev.mapa.selecaoMarcador.id === id
          ? undefined
          : prev.mapa.selecaoMarcador;
      console.log("[RELATORIO_APS][MAPA_MANUAL_REMOVE]", { id });
      return {
        ...prev,
        mapa: { ...prev.mapa, marcadoresManuais: restantes, selecaoMarcador: selecao },
      };
    });
  }, []);

  const mapaResetarAjustes = useCallback(() => {
    setState((prev) => {
      const nada =
        Object.keys(prev.mapa.ajustesPontosServico).length === 0 &&
        Object.keys(prev.mapa.ajustesPontosRua).length === 0 &&
        prev.mapa.marcadoresManuais.length === 0 &&
        !prev.mapa.selecaoMarcador;
      if (nada) return prev;
      console.log("[RELATORIO_APS][MAPA_RESET_AJUSTES]");
      return {
        ...prev,
        mapa: {
          ...prev.mapa,
          ajustesPontosServico: {},
          ajustesPontosRua: {},
          marcadoresManuais: [],
          selecaoMarcador: undefined,
        },
      };
    });
  }, []);

  const mapaSetMostrarPontosRua = useCallback((v: boolean) => {
    setState((prev) => {
      if (prev.mapa.mostrarPontosRua === v) return prev;
      return { ...prev, mapa: { ...prev.mapa, mostrarPontosRua: v } };
    });
  }, []);

  const mapaSetIncluirPontosRuaNoPdf = useCallback((v: boolean) => {
    setState((prev) => {
      if (prev.mapa.incluirPontosRuaNoPdf === v) return prev;
      return { ...prev, mapa: { ...prev.mapa, incluirPontosRuaNoPdf: v } };
    });
  }, []);

  const recarregar = useCallback(() => {
    if (state.registroId) return carregar(state.registroId);
    return Promise.resolve();
  }, [state.registroId, carregar]);

  return {
    state,
    setCampoCabecalho,
    setCampoLinha,
    selecionarFoto,
    removerFotoSelecionada,
    moverFotoSelecionada,
    setLegendaFoto,
    mapaAdicionarPonto,
    mapaDesfazerUltimoPonto,
    mapaLimparLinha,
    mapaIniciarArea,
    mapaAdicionarPontoArea,
    mapaDesfazerPontoArea,
    mapaFecharArea,
    mapaCancelarArea,
    mapaLimparAreas,
    mapaSelecionarMarcador,
    mapaLimparSelecao,
    mapaAjustarPontoServico,
    mapaAjustarPontoRua,
    mapaAdicionarMarcadorManual,
    mapaMoverMarcadorManual,
    mapaRemoverMarcadorManual,
    mapaResetarAjustes,
    mapaSetMostrarPontosRua,
    mapaSetIncluirPontosRuaNoPdf,
    recarregar,
    carregarDeSelecao,
    resetar,
    // Carimbo
    carimboAtual,
    carimboSnapshot,
    carimboDirty,
    aplicarCarimbo,
    restaurarCarimbo,
    limparCabecalhoAdmin,
    limparCarimboAtual,
    atualizarSnapshotComRow,
  };
}

export type UseRelatorioApsStateReturn = ReturnType<typeof useRelatorioApsState>;
