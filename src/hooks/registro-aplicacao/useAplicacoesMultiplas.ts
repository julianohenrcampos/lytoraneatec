
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoDetalhesFormValues } from "@/types/registroAplicacaoDetalhes";
import { 
  fetchAplicacaoDetalhes, 
  createAplicacaoDetalhe, 
  updateAplicacaoDetalhe,
  deleteAplicacaoDetalhe 
} from "@/services/registroAplicacaoDetalhesService";

export const useAplicacoesMultiplas = (
  registroAplicacaoId?: string,
  registroCargaId?: string,
  listaEntregaId?: string
) => {
  const [aplicacoes, setAplicacoes] = useState<RegistroAplicacaoDetalhes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAplicacao, setEditingAplicacao] = useState<RegistroAplicacaoDetalhes | null>(null);
  const { toast } = useToast();
  const loadingRef = useRef(false);
  const lastRegistroIdRef = useRef<string | undefined>();
  const cacheRef = useRef<Record<string, RegistroAplicacaoDetalhes[]>>({});

  // Carregar aplicações existentes com controle de race conditions
  const loadAplicacoes = useCallback(async (registroId: string) => {
    // Evitar carregamentos duplicados
    if (loadingRef.current || lastRegistroIdRef.current === registroId) {
      return;
    }

    // Verificar cache primeiro
    if (cacheRef.current[registroId]) {
      console.log("📋 Usando dados do cache para:", registroId);
      setAplicacoes(cacheRef.current[registroId]);
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    lastRegistroIdRef.current = registroId;
    
    console.log("🔄 Carregando aplicações para registro:", registroId);
    
    try {
      const data = await fetchAplicacaoDetalhes(registroId);
      
      console.log("✅ Aplicações carregadas:", {
        registroId,
        quantidade: data?.length || 0,
        isEmpty: !data || data.length === 0
      });
      
      const aplicacoesData = data || [];
      setAplicacoes(aplicacoesData);
      
      // Armazenar no cache
      cacheRef.current[registroId] = aplicacoesData;
      
    } catch (error) {
      console.error("❌ Erro ao carregar aplicações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as aplicações",
        variant: "destructive",
      });
      setAplicacoes([]);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [toast]);

  // Limpar cache quando necessário
  const clearCache = useCallback((registroId?: string) => {
    if (registroId) {
      delete cacheRef.current[registroId];
    } else {
      cacheRef.current = {};
    }
  }, []);

  // Forçar reload das aplicações
  const forceReloadAplicacoes = useCallback(() => {
    if (registroAplicacaoId) {
      console.log("🔄 Forçando reload das aplicações para:", registroAplicacaoId);
      clearCache(registroAplicacaoId);
      lastRegistroIdRef.current = undefined;
      loadAplicacoes(registroAplicacaoId);
    }
  }, [registroAplicacaoId, loadAplicacoes, clearCache]);

  // Adicionar nova aplicação
  const adicionarAplicacao = async (dadosAplicacao: RegistroAplicacaoDetalhesFormValues) => {
    if (!registroAplicacaoId || !registroCargaId || !listaEntregaId) {
      throw new Error("IDs necessários não fornecidos");
    }

    setIsLoading(true);
    try {
      const novaAplicacao = await createAplicacaoDetalhe(
        registroAplicacaoId,
        registroCargaId,
        listaEntregaId,
        dadosAplicacao
      );

      setAplicacoes(prev => [...prev, novaAplicacao]);
      clearCache(registroAplicacaoId);
      
      toast({
        title: "Sucesso",
        description: "Aplicação adicionada com sucesso",
      });

      return novaAplicacao;
    } catch (error) {
      console.error("Erro ao adicionar aplicação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível adicionar a aplicação",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Editar aplicação existente
  const editarAplicacao = async (aplicacaoId: string, dadosAtualizados: Partial<RegistroAplicacaoDetalhesFormValues>) => {
    setIsLoading(true);
    try {
      const aplicacaoAtualizada = await updateAplicacaoDetalhe(aplicacaoId, dadosAtualizados);
      
      setAplicacoes(prev => 
        prev.map(app => app.id === aplicacaoId ? aplicacaoAtualizada : app)
      );

      if (registroAplicacaoId) {
        clearCache(registroAplicacaoId);
      }

      toast({
        title: "Sucesso",
        description: "Aplicação atualizada com sucesso",
      });

      setEditingAplicacao(null);
      return aplicacaoAtualizada;
    } catch (error) {
      console.error("Erro ao atualizar aplicação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a aplicação",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Remover aplicação
  const removerAplicacao = async (aplicacaoId: string) => {
    setIsLoading(true);
    try {
      await deleteAplicacaoDetalhe(aplicacaoId);
      
      setAplicacoes(prev => prev.filter(app => app.id !== aplicacaoId));

      if (registroAplicacaoId) {
        clearCache(registroAplicacaoId);
      }

      toast({
        title: "Sucesso",
        description: "Aplicação removida com sucesso",
      });
    } catch (error) {
      console.error("Erro ao remover aplicação:", error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a aplicação",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Iniciar edição
  const iniciarEdicao = (aplicacao: RegistroAplicacaoDetalhes) => {
    setEditingAplicacao(aplicacao);
  };

  // Cancelar edição
  const cancelarEdicao = () => {
    setEditingAplicacao(null);
  };

  // Converter aplicação para formato de formulário
  const aplicacaoParaFormulario = (aplicacao: RegistroAplicacaoDetalhes): RegistroAplicacaoDetalhesFormValues => {
    return {
      logradouro_nome: aplicacao.logradouro_nome,
      area_aplicada: aplicacao.area_aplicada,
      tonelada_aplicada: aplicacao.tonelada_aplicada,
      espessura_aplicada: aplicacao.espessura_aplicada,
      comprimento: aplicacao.comprimento,
      largura_media: aplicacao.largura_media,
      bordo: aplicacao.bordo,
      temperatura_aplicacao: aplicacao.temperatura_aplicacao,
      condicoes_climaticas: aplicacao.condicoes_climaticas,
      densidade_compactacao: aplicacao.densidade_compactacao,
      numero_passadas: aplicacao.numero_passadas,
      equipamento_compactacao: aplicacao.equipamento_compactacao,
      observacoes_aplicacao: aplicacao.observacoes_aplicacao,
      hora_inicio_aplicacao: aplicacao.hora_inicio_aplicacao,
      hora_fim_aplicacao: aplicacao.hora_fim_aplicacao,
      estaca_inicial: aplicacao.estaca_inicial,
      estaca_final: aplicacao.estaca_final,
    };
  };

  // Calcular totais
  const totais = {
    totalAplicado: aplicacoes.reduce((sum, app) => sum + app.tonelada_aplicada, 0),
    areaTotal: aplicacoes.reduce((sum, app) => sum + app.area_aplicada, 0),
    numeroAplicacoes: aplicacoes.length,
    proximaSequencia: aplicacoes.length + 1,
  };

  // useEffect simplificado - carregar apenas quando o ID mudar
  useEffect(() => {
    if (registroAplicacaoId && registroAplicacaoId !== lastRegistroIdRef.current) {
      console.log("📥 useEffect disparado para novo registro:", registroAplicacaoId);
      loadAplicacoes(registroAplicacaoId);
    } else if (!registroAplicacaoId) {
      console.log("🧹 Limpando aplicações - nenhum registro ID");
      setAplicacoes([]);
      lastRegistroIdRef.current = undefined;
    }
  }, [registroAplicacaoId, loadAplicacoes]);

  // Cleanup quando componente desmonta
  useEffect(() => {
    return () => {
      loadingRef.current = false;
      lastRegistroIdRef.current = undefined;
    };
  }, []);

  return {
    aplicacoes,
    isLoading,
    editingAplicacao,
    totais,
    adicionarAplicacao,
    editarAplicacao,
    removerAplicacao,
    iniciarEdicao,
    cancelarEdicao,
    aplicacaoParaFormulario,
    forceReloadAplicacoes,
    clearCache
  };
};
