
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao } from "@/types/registroAplicacao";
import { RegistroCarga } from "@/types/registroCargas";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoCompleto } from "@/types/registroAplicacaoDetalhes";
import { useToast } from "@/hooks/use-toast";
import { fetchRegistroAplicacaoCompleto, finalizarCargaAplicacao } from "@/services/registroAplicacaoDetalhesService";
import { formatMassaFromDatabase } from "@/utils/massaConversionUtils";

export interface CargaComAplicacoes {
  registroCarga: RegistroCarga;
  aplicacoes: RegistroAplicacao[];
  detalhesAplicacoes: RegistroAplicacaoDetalhes[];
  massaRemanescente: number;
  massaTotal: number;
  proximaSequencia: number;
  mediaEspessura?: number;
  cargaFinalizada: boolean;
  statusAplicacao: string;
  percentualAplicado: number;
  totalAplicado: number;
}

export const useMultipleApplications = (registroCargaId?: string) => {
  const [cargaInfo, setCargaInfo] = useState<CargaComAplicacoes | null>(null);
  const [registroCompleto, setRegistroCompleto] = useState<RegistroAplicacaoCompleto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const loadingRef = useRef(false);
  const lastCargaIdRef = useRef<string | undefined>();

  const loadCargaInfo = useCallback(async (cargaId: string) => {
    // Evitar múltiplas execuções simultâneas
    if (loadingRef.current || lastCargaIdRef.current === cargaId) {
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    lastCargaIdRef.current = cargaId;

    try {
      console.log("Carregando informações da carga:", cargaId);
      
      // Buscar registro da carga
      const { data: registroCarga, error: cargaError } = await supabase
        .from("bd_registro_cargas")
        .select("*")
        .eq("id", cargaId)
        .single();

      if (cargaError) throw cargaError;

      // Buscar todas as aplicações desta carga através do registro_carga_id
      const { data: aplicacoes, error: aplicacoesError } = await supabase
        .from("bd_registro_apontamento_aplicacao")
        .select("*")
        .eq("registro_carga_id", cargaId)
        .order("aplicacao_sequencia", { ascending: true });

      if (aplicacoesError) throw aplicacoesError;

      // Buscar detalhes das aplicações usando o registro_carga_id
      const { data: detalhesAplicacoes, error: detalhesError } = await supabase
        .from("bd_registro_aplicacao_detalhes")
        .select("*")
        .eq("registro_carga_id", cargaId)
        .order("sequencia_aplicacao", { ascending: true });

      if (detalhesError) throw detalhesError;

      console.log("Dados carregados:", {
        carga: `${registroCarga.tonelada_real}t (banco)`,
        aplicacoes: aplicacoes?.length || 0,
        detalhes: detalhesAplicacoes?.length || 0
      });

      // Buscar dados completos da view se houver aplicações
      let dadosCompletos: RegistroAplicacaoCompleto | null = null;
      if (aplicacoes && aplicacoes.length > 0) {
        try {
          dadosCompletos = await fetchRegistroAplicacaoCompleto(aplicacoes[0].id);
          setRegistroCompleto(dadosCompletos);
        } catch (error) {
          console.warn("Erro ao buscar dados completos:", error);
        }
      }

      const massaTotal = formatMassaFromDatabase(registroCarga.tonelada_real || 0, 'bd_registro_cargas', 'tonelada_real');
      const totalAplicado = dadosCompletos?.total_aplicado || 
        (detalhesAplicacoes?.reduce((sum, det) => sum + (det.tonelada_aplicada || 0), 0) || 0);
      const massaRemanescente = Math.max(0, massaTotal - totalAplicado);
      const percentualAplicado = dadosCompletos?.percentual_aplicado || 
        (massaTotal > 0 ? (totalAplicado / massaTotal) * 100 : 0);
      
      // Determinar próxima sequência baseado em detalhes existentes
      const proximaSequencia = Math.max((detalhesAplicacoes?.length || 0) + 1, (aplicacoes?.length || 0) + 1);
      
      // LÓGICA MELHORADA DE STATUS E FINALIZAÇÃO
      // 1. Verificar se há aplicações/detalhes primeiro
      const temAplicacoes = (detalhesAplicacoes?.length || 0) > 0;
      
      // 2. Status baseado em lógica mais robusta
      let statusAplicacao: string;
      let cargaFinalizada: boolean;
      
      if (!temAplicacoes && massaRemanescente > 0.1) {
        // Carga sem aplicações e com massa disponível - deve estar INICIADA
        statusAplicacao = 'Iniciada';
        cargaFinalizada = false;
      } else if (temAplicacoes && massaRemanescente > 0.1) {
        // Carga com aplicações parciais - EM ANDAMENTO
        statusAplicacao = 'Em Andamento';
        cargaFinalizada = false;
      } else if (massaRemanescente <= 0.1 || percentualAplicado >= 99.9) {
        // Carga praticamente 100% aplicada - FINALIZADA
        statusAplicacao = 'Finalizada';
        cargaFinalizada = true;
      } else {
        // Fallback seguro
        statusAplicacao = dadosCompletos?.status_calculado || 'Iniciada';
        cargaFinalizada = aplicacoes?.[0]?.carga_finalizada || false;
      }
      
      // Obter média de espessura
      const mediaEspessura = dadosCompletos?.espessura_media_cm || aplicacoes?.[0]?.espessura_calculada;

      console.log("🔍 ANÁLISE DETALHADA DA CARGA:", {
        registroCargaId: cargaId,
        massaTotal: `${massaTotal}t`,
        totalAplicado: `${totalAplicado}t`,
        massaRemanescente: `${massaRemanescente}t`,
        percentualAplicado: `${percentualAplicado.toFixed(1)}%`,
        temAplicacoes,
        statusAplicacao,
        cargaFinalizada,
        proximaSequencia,
        valorOriginalBanco: `${registroCarga.tonelada_real}t`
      });

      setCargaInfo({
        registroCarga,
        aplicacoes: (aplicacoes || []).map(app => ({
          ...app,
          bordo: app.bordo as any // Type assertion for bordo
        })),
        detalhesAplicacoes: (detalhesAplicacoes || []).map(det => ({
          ...det,
          bordo: det.bordo as any // Type assertion for bordo
        })),
        massaRemanescente,
        massaTotal,
        proximaSequencia,
        mediaEspessura,
        cargaFinalizada,
        statusAplicacao,
        percentualAplicado,
        totalAplicado
      });
    } catch (error) {
      console.error("Erro ao carregar informações da carga:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as informações da carga",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [toast]);

  const finalizarCargaManualmente = async (cargaId: string) => {
    try {
      console.log("🏁 [useMultipleApplications] Finalizando carga manualmente:", cargaId);
      
      // Chamar função do banco para finalizar a carga
      const resultado = await finalizarCargaAplicacao(cargaId);

      toast({
        title: "Carga finalizada!",
        description: "Totais calculados e entrega concluída",
      });

      // CRÍTICO: Invalidação completa de cache para forçar reload
      console.log("🔄 [useMultipleApplications] Invalidando cache completo");
      lastCargaIdRef.current = undefined;
      loadingRef.current = false;
      
      // Recarregar dados completamente
      await loadCargaInfo(cargaId);
      console.log("✅ [useMultipleApplications] Dados recarregados após finalização");
      
      return resultado;
    } catch (error) {
      console.error("❌ [useMultipleApplications] Erro ao finalizar carga:", error);
      toast({
        title: "Erro na finalização",
        description: "Não foi possível finalizar a carga",
        variant: "destructive",
      });
      throw error;
    }
  };

  const refetch = useCallback(() => {
    if (registroCargaId) {
      console.log("🔄 [useMultipleApplications] FORÇANDO reload completo para:", registroCargaId);
      
      // Invalidação TOTAL do estado
      lastCargaIdRef.current = undefined;
      loadingRef.current = false;
      setCargaInfo(null);
      setRegistroCompleto(null);
      
      // Aguardar um pouco para garantir que o estado foi limpo
      setTimeout(() => {
        console.log("🔄 [useMultipleApplications] Executando reload após timeout");
        loadCargaInfo(registroCargaId);
      }, 100);
    }
  }, [registroCargaId, loadCargaInfo]);

  useEffect(() => {
    if (registroCargaId && registroCargaId !== lastCargaIdRef.current) {
      loadCargaInfo(registroCargaId);
    }
  }, [registroCargaId, loadCargaInfo]);

  return {
    cargaInfo,
    registroCompleto,
    isLoading,
    loadCargaInfo,
    finalizarCargaManualmente,
    refetch
  };
};
