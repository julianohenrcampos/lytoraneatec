import { useCallback, useEffect, useState } from "react";
import { fetchRegistroAplicacaoById } from "@/services/registro-aplicacao/fetchRegistroAplicacao";
import { buscarAplicacoesPorRegistro } from "@/services/registro-aplicacao/aplicacaoPorRuaService";
import {
  montarFotosDisponiveisFromDetalhes,
  montarLinhasFromDetalhes,
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
  type RelatorioApsState,
} from "@/types/relatorioAps";

const mapaVazio = (): RelatorioApsMapaState => ({
  pontosServico: [],
  linhaServico: [],
  areasAplicacao: [],
  areaEmEdicao: undefined,
});

export interface CarregarDeSelecaoOpts {
  /** Linhas de bd_registro_aplicacao_detalhes já buscadas pelo hook de filtros. */
  detalhes: Array<Record<string, any>>;
  /** Texto default para a coluna Situação. */
  situacaoDefault?: string;
  /** Sobrescreve campos do cabeçalho (Rua/Obs) — usados quando montado a partir de múltiplos registros. */
  cabecalhoOverride?: Partial<RelatorioApsCabecalhoEditavel>;
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
      console.log("[RELATORIO_APS][MAPA_PONTOS_LOAD]", { count: pontosServico.length });

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
        mapa: { pontosServico, linhaServico: [], areasAplicacao: [], areaEmEdicao: undefined },
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
    const { detalhes, situacaoDefault = "", cabecalhoOverride = {} } = opts;
    setState((prev) => ({
      ...prev,
      carregando: true,
      erro: null,
      registroId: null,
      fotosDisponiveis: [],
      fotosSelecionadas: [],
      mapa: mapaVazio(),
    }));
    try {
      const linhas = montarLinhasFromDetalhes(detalhes, situacaoDefault);
      const pontosServico = montarPontosServicoFromDetalhes(detalhes);
      const fotosDisponiveis = await montarFotosDisponiveisFromDetalhes(detalhes);
      console.log("[RELATORIO_APS][MULTI_LOAD]", {
        detalhes: detalhes.length,
        linhas: linhas.length,
        pontos: pontosServico.length,
        fotos: fotosDisponiveis.length,
      });
      setState((prev) => ({
        registroId: null,
        carregando: false,
        erro: null,
        cabecalho: {
          ...criarCabecalhoDefault(),
          ...cabecalhoOverride,
        },
        linhas,
        fotosDisponiveis,
        fotosSelecionadas: [],
        mapa: { pontosServico, linhaServico: [], areasAplicacao: [], areaEmEdicao: undefined },
      }));
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
    recarregar,
    carregarDeSelecao,
    resetar,
  };
}

export type UseRelatorioApsStateReturn = ReturnType<typeof useRelatorioApsState>;
