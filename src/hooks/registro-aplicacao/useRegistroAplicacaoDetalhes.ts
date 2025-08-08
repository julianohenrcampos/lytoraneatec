import { useState, useEffect, useCallback } from "react";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoDetalhesFormValues } from "@/types/registroAplicacaoDetalhes";
import { criarAplicacaoPorRua, buscarAplicacoesPorRegistro, calcularMassaRemanescenteTempoReal } from "@/services/registro-aplicacao/aplicacaoPorRuaService";
import { useToast } from "@/hooks/use-toast";

export const useRegistroAplicacaoDetalhes = (registroAplicacaoId?: string) => {
  const [aplicacoes, setAplicacoes] = useState<RegistroAplicacaoDetalhes[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [massaRemanescente, setMassaRemanescente] = useState<number>(0);
  const { toast } = useToast();

  /**
   * Carregar aplicações e massa remanescente
   */
  const loadAplicacoes = useCallback(async (forceRefresh = false) => {
    if (!registroAplicacaoId) {
      console.log("🔍 [useRegistroAplicacaoDetalhes] Sem registroAplicacaoId, pulando carregamento");
      return;
    }

    if (isLoading && !forceRefresh) {
      console.log("🔍 [useRegistroAplicacaoDetalhes] Já carregando, pulando");
      return;
    }

    setIsLoading(true);
    try {
      console.log("🔄 [useRegistroAplicacaoDetalhes] Carregando aplicações para:", registroAplicacaoId);

      // Carregar aplicações e massa remanescente em paralelo
      const [aplicacoesData, massaRemanescenteData] = await Promise.all([
        buscarAplicacoesPorRegistro(registroAplicacaoId),
        calcularMassaRemanescenteTempoReal(registroAplicacaoId)
      ]);

      console.log("✅ [useRegistroAplicacaoDetalhes] Dados carregados:", {
        aplicacoes: aplicacoesData.length,
        massaRemanescente: massaRemanescenteData
      });

      setAplicacoes(aplicacoesData as RegistroAplicacaoDetalhes[]);
      setMassaRemanescente(massaRemanescenteData);

    } catch (error) {
      console.error("❌ [useRegistroAplicacaoDetalhes] Erro ao carregar:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar aplicações por rua",
        variant: "destructive",
      });
      setAplicacoes([]);
      setMassaRemanescente(0);
    } finally {
      setIsLoading(false);
    }
  }, [registroAplicacaoId, isLoading, toast]);

  /**
   * Criar nova aplicação por rua - OTIMIZADO para usar as novas RPC functions
   */
  const criarNovaAplicacao = useCallback(async (
    listaEntregaId: string,
    registroCargaId: string,
    valores: RegistroAplicacaoDetalhesFormValues
  ) => {
    try {
      console.log("🏗️ [useRegistroAplicacaoDetalhes] Criando nova aplicação:", {
        valores,
        listaEntregaId,
        registroCargaId,
        registroAplicacaoId
      });

      // Validações básicas
      if (!valores.logradouro_nome?.trim()) {
        throw new Error("Nome do logradouro é obrigatório");
      }
      
      if (!valores.area_aplicada || valores.area_aplicada <= 0) {
        throw new Error("Área aplicada deve ser maior que zero");
      }
      
      if (!valores.tonelada_aplicada || valores.tonelada_aplicada <= 0) {
        throw new Error("Tonelada aplicada deve ser maior que zero");
      }

      // Verificar massa remanescente atual antes de criar
      if (registroAplicacaoId) {
        console.log("🔍 [useRegistroAplicacaoDetalhes] Verificando massa remanescente...");
        const massaAtual = await calcularMassaRemanescenteTempoReal(registroAplicacaoId);
        console.log(`📊 [useRegistroAplicacaoDetalhes] Massa atual: ${massaAtual}t, Solicitada: ${valores.tonelada_aplicada}t`);
        
        if (valores.tonelada_aplicada > massaAtual) {
          throw new Error(`Massa aplicada (${valores.tonelada_aplicada}t) excede massa remanescente (${massaAtual}t)`);
        }
      }

      console.log("✅ [useRegistroAplicacaoDetalhes] Validações OK, chamando RPC...");

      const resultado = await criarAplicacaoPorRua(
        listaEntregaId,
        registroCargaId,
        valores
      );

      console.log("🎯 [useRegistroAplicacaoDetalhes] Aplicação criada com sucesso:", resultado);

      // Recalcular massa remanescente imediatamente
      console.log("🔄 [useRegistroAplicacaoDetalhes] Recalculando massa remanescente...");
      const novaMassaRemanescente = await calcularMassaRemanescenteTempoReal(registroAplicacaoId);
      setMassaRemanescente(novaMassaRemanescente);
      
      // Forçar recarregamento completo dos dados
      console.log("🔄 [useRegistroAplicacaoDetalhes] Recarregando dados...");
      await loadAplicacoes(true);

      toast({
        title: "✅ Aplicação por rua salva!",
        description: `${valores.logradouro_nome} - ${valores.tonelada_aplicada}t aplicada com sucesso`,
      });

      return resultado;
    } catch (error) {
      console.error("❌ [useRegistroAplicacaoDetalhes] Erro ao criar aplicação:", error);
      
      let errorMessage = "Erro desconhecido ao salvar aplicação por rua";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast({
        title: "❌ Erro ao salvar aplicação",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    }
  }, [registroAplicacaoId, loadAplicacoes, toast]);

  /**
   * Recarregar dados
   */
  const refetch = useCallback(() => {
    return loadAplicacoes(true);
  }, [loadAplicacoes]);

  // Carregar dados quando o registroAplicacaoId mudar
  useEffect(() => {
    if (registroAplicacaoId) {
      loadAplicacoes();
    } else {
      setAplicacoes([]);
      setMassaRemanescente(0);
    }
  }, [registroAplicacaoId, loadAplicacoes]);

  return {
    aplicacoes,
    massaRemanescente,
    isLoading,
    criarNovaAplicacao,
    refetch,
    loadAplicacoes
  };
};