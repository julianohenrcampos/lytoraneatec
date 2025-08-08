
import { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoDetalhesFormValues } from "@/types/registroAplicacaoDetalhes";
import { 
  fetchAplicacaoDetalhes, 
  createAplicacaoDetalhe, 
  updateAplicacaoDetalhe,
  deleteAplicacaoDetalhe 
} from "@/services/registroAplicacaoDetalhesService";
import { forceUpdateDeliveryStatus } from "@/services/registro-aplicacao/statusIntegrityService";

export const useAplicacoesMultiplas = (
  registroAplicacaoId?: string,
  registroCargaId?: string,
  listaEntregaId?: string,
  onDataChange?: () => void // Novo callback para notificar mudanças
) => {
  const [aplicacoes, setAplicacoes] = useState<RegistroAplicacaoDetalhes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [editingAplicacao, setEditingAplicacao] = useState<RegistroAplicacaoDetalhes | null>(null);
  const { toast } = useToast();
  const loadingRef = useRef(false);
  const lastRegistroIdRef = useRef<string | undefined>();
  const cacheRef = useRef<Record<string, RegistroAplicacaoDetalhes[]>>({});

  // Carregar aplicações existentes com controle de race conditions
  const loadAplicacoes = useCallback(async (registroId: string, forceReload = false) => {
    if (!registroId) {
      setAplicacoes([]);
      return;
    }

    // Evitar carregamentos duplicados apenas se não for force reload
    if (loadingRef.current && !forceReload) {
      return;
    }

    // Verificar cache primeiro (mas só usar cache se não for force reload)
    if (!forceReload && cacheRef.current[registroId] && lastRegistroIdRef.current === registroId) {
      setAplicacoes(cacheRef.current[registroId]);
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    lastRegistroIdRef.current = registroId;
    
    try {
      const data = await fetchAplicacaoDetalhes(registroId);
      const aplicacoesData = data || [];
      
      setAplicacoes(aplicacoesData);
      cacheRef.current[registroId] = aplicacoesData;
      
    } catch (error) {
      console.error("Erro ao carregar aplicações:", error);
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
  const forceReloadAplicacoes = useCallback(async () => {
    if (registroAplicacaoId) {
      clearCache(registroAplicacaoId);
      lastRegistroIdRef.current = undefined;
      loadingRef.current = false;
      await loadAplicacoes(registroAplicacaoId, true);
    }
  }, [registroAplicacaoId, loadAplicacoes, clearCache]);

  // Função para forçar atualização de status após mudanças
  const forceUpdateStatus = useCallback(async () => {
    if (listaEntregaId) {
      try {
        await forceUpdateDeliveryStatus(listaEntregaId);
      } catch (error) {
        console.error("Erro ao atualizar status da entrega:", error);
      }
    }
  }, [listaEntregaId]);

  // Adicionar nova aplicação
  const adicionarAplicacao = async (dadosAplicacao: RegistroAplicacaoDetalhesFormValues) => {
    if (!registroAplicacaoId || !registroCargaId || !listaEntregaId) {
      throw new Error("IDs necessários não fornecidos para criar aplicação");
    }

    setIsLoading(true);
    try {
      const novaAplicacao = await createAplicacaoDetalhe(
        registroAplicacaoId,
        registroCargaId,
        listaEntregaId,
        dadosAplicacao
      );

      // Atualizar estado local imediatamente
      setAplicacoes(prev => [...prev, novaAplicacao]);

      // Limpar cache
      clearCache(registroAplicacaoId);
      
      // Forçar atualização de status após adicionar aplicação
      await forceUpdateStatus();
      
      toast({
        title: "✅ Aplicação por rua salva!",
        description: `${dadosAplicacao.logradouro_nome} - ${dadosAplicacao.tonelada_aplicada}t aplicada`,
      });

      // Notificar componente pai sobre mudança nos dados
      onDataChange?.();

      // Recarregar dados após operação
      await forceReloadAplicacoes();

      return novaAplicacao;
    } catch (error) {
      let errorMessage = "Não foi possível adicionar a aplicação";
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "❌ Erro ao salvar aplicação",
        description: errorMessage,
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

      // Forçar atualização de status após editar aplicação
      await forceUpdateStatus();

      toast({
        title: "Sucesso",
        description: "Aplicação atualizada com sucesso",
      });

      setEditingAplicacao(null);

      // Notificar componente pai sobre mudança nos dados
      onDataChange?.();

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

      // Forçar atualização de status após remover aplicação
      await forceUpdateStatus();

      toast({
        title: "Sucesso",
        description: "Aplicação removida com sucesso",
      });

      // Notificar componente pai sobre mudança nos dados
      onDataChange?.();
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

  const cancelarEdicao = () => {
    setEditingAplicacao(null);
  };

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

  // useEffect para carregar aplicações quando registroAplicacaoId muda
  useEffect(() => {
    if (registroAplicacaoId) {
      loadAplicacoes(registroAplicacaoId, true);
    } else {
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
    clearCache,
    forceUpdateStatus
  };
};
