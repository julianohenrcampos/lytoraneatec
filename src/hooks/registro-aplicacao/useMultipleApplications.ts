
import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacao } from "@/types/registroAplicacao";
import { RegistroCarga } from "@/types/registroCargas";
import { RegistroAplicacaoDetalhes, RegistroAplicacaoCompleto } from "@/types/registroAplicacaoDetalhes";
import { useToast } from "@/hooks/use-toast";
import { fetchRegistroAplicacaoCompleto, finalizarCargaAplicacao } from "@/services/registroAplicacaoDetalhesService";

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
        carga: registroCarga.tonelada_real,
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

      // Calcular valores usando a view ou fallback para cálculos manuais
      const massaTotal = registroCarga.tonelada_real || 0;
      const totalAplicado = dadosCompletos?.total_aplicado || 
        (detalhesAplicacoes?.reduce((sum, det) => sum + (det.tonelada_aplicada || 0), 0) || 0);
      const massaRemanescente = Math.max(0, massaTotal - totalAplicado);
      const percentualAplicado = dadosCompletos?.percentual_aplicado || 
        (massaTotal > 0 ? (totalAplicado / massaTotal) * 100 : 0);
      
      // Determinar próxima sequência
      const proximaSequencia = (aplicacoes?.length || 0) + 1;
      
      // Status da aplicação
      const statusAplicacao = dadosCompletos?.status_calculado || 
        (massaRemanescente <= 0.001 ? 'Finalizada' : 
         totalAplicado > 0 ? 'Em Andamento' : 'Iniciada');
      
      // Verificar se a carga está finalizada
      const cargaFinalizada = aplicacoes?.[0]?.carga_finalizada || statusAplicacao === 'Finalizada' || massaRemanescente <= 0.001;
      
      // Obter média de espessura
      const mediaEspessura = dadosCompletos?.espessura_media_cm || aplicacoes?.[0]?.media_espessura_cm;

      console.log("Resultado final:", {
        massaTotal,
        totalAplicado,
        massaRemanescente,
        cargaFinalizada
      });

      setCargaInfo({
        registroCarga,
        aplicacoes: aplicacoes || [],
        detalhesAplicacoes: detalhesAplicacoes || [],
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
      // Chamar função do banco para finalizar a carga
      const resultado = await finalizarCargaAplicacao(cargaId);

      toast({
        title: "Sucesso",
        description: "Carga finalizada e totais calculados",
      });

      // Recarregar informações da carga
      await loadCargaInfo(cargaId);
      
      return resultado;
    } catch (error) {
      console.error("Erro ao finalizar carga:", error);
      toast({
        title: "Erro",
        description: "Não foi possível finalizar a carga",
        variant: "destructive",
      });
      throw error;
    }
  };

  const refetch = useCallback(() => {
    if (registroCargaId) {
      lastCargaIdRef.current = undefined; // Reset para permitir recarregamento
      loadCargaInfo(registroCargaId);
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
