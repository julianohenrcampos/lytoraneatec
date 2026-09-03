import { useState, useCallback, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  ApontamentoEquipe, 
  ApontamentoEquipeFormValues,
  ApontamentoEquipeApiData
} from "@/types/apontamentoEquipe";
import { apontamentoEquipeSchema } from "@/validations/apontamentoEquipeSchema";
import { fetchEquipeMembers } from "@/services/equipe/fetchEquipeMembers";
import { format } from "date-fns";

interface UseApontamentoEquipeFormProps {
  currentApontamento: ApontamentoEquipe | null;
  onSubmit: (data: ApontamentoEquipeFormValues) => void; // Keep as FormValues for internal use
  avaliacaoStatusMap?: Map<string, {canCreate: boolean, daysRemaining: number}>;
  isAvaliacaoObrigatoria?: boolean;
}

export const useApontamentoEquipeForm = ({
  currentApontamento,
  onSubmit,
  avaliacaoStatusMap = new Map(),
  isAvaliacaoObrigatoria = false
}: UseApontamentoEquipeFormProps) => {
  const { toast } = useToast();
  
  // Estados
  const [equipeMembers, setEquipeMembers] = useState<any[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [loadingEquipeError, setLoadingEquipeError] = useState<string | null>(null);
  const [apontamentoExistente, setApontamentoExistente] = useState<any>(null);
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState<Set<string>>(new Set());
  const [avaliacoesCompletas, setAvaliacoesCompletas] = useState<Set<string>>(new Set());
  const [todosColaboradoresAvaliados, setTodosColaboradoresAvaliados] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{
    colaboradorId: string;
    message: string;
    type: "info" | "error";
  } | null>(null);
  const [apontamentosCarregados, setApontamentosCarregados] = useState(false);

  // Form setup
  const form = useForm<ApontamentoEquipeFormValues>({
    resolver: zodResolver(apontamentoEquipeSchema),
    defaultValues: {
      equipe_id: "",
      data_registro: new Date(), // Default to current date
      lista_entrega_id: "",
      colaboradores: []
    }
  });

  // Carregar membros da equipe
  const loadEquipeMembers = useCallback(async (equipeId: string) => {
    if (!equipeId) {
      setEquipeMembers([]);
      return;
    }

    console.log("🔍 Carregando membros da equipe:", equipeId);
    setIsLoadingMembers(true);
    setLoadingEquipeError(null);

    try {
      const members = await fetchEquipeMembers(equipeId);
      console.log("✅ Membros carregados:", members);
      
      setEquipeMembers(members);
      
      // Se não estiver editando, inicializar colaboradores
      if (!currentApontamento) {
        const colaboradoresIniciais = members.map(member => ({
          colaborador_id: member.id || "", // Garantir que não seja undefined
          nome_colaborador: member.nome_completo || "",
          presente: false,
          hora_inicio: "",
          hora_fim: ""
        }));
        
        console.log("🔄 Inicializando colaboradores:", colaboradoresIniciais);
        form.setValue("colaboradores", colaboradoresIniciais);
      }
      
    } catch (error) {
      console.error("❌ Erro ao carregar membros:", error);
      const errorMessage = error instanceof Error ? error.message : "Erro ao carregar membros da equipe";
      setLoadingEquipeError(errorMessage);
      
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsLoadingMembers(false);
    }
  }, [form, currentApontamento, toast]);

  // Carregar apontamento existente
  const loadExistingApontamento = useCallback(async (equipeId: string, dataRegistro: Date) => {
    if (!equipeId || !dataRegistro) return;

    console.log("🔍 Verificando apontamento existente para:", { equipeId, dataRegistro });

    try {
      const dataFormatada = format(dataRegistro, "yyyy-MM-dd");
      
      const { data: existingData, error } = await supabase
        .from("bd_apontamento_equipe")
        .select("*")
        .eq("equipe_id", equipeId)
        .eq("data_registro", dataFormatada);

      if (error) {
        console.error("❌ Erro ao verificar apontamento existente:", error);
        return;
      }

      if (existingData && existingData.length > 0) {
        console.log("📄 Apontamento existente encontrado:", existingData);
        setApontamentoExistente(existingData[0]);

        // Fase 1B — União: membros atuais da equipe + colaboradores já salvos.
        // Preserva integralmente os valores salvos (presente/horas/nome_colaborador).
        const salvosMap = new Map<string, any>();
        for (const item of existingData) {
          if (item?.colaborador_id) salvosMap.set(item.colaborador_id, item);
        }
        const membrosIds = new Set(
          equipeMembers.map((m: any) => m.id).filter(Boolean)
        );

        const base = equipeMembers.map((member: any) => {
          const salvo = salvosMap.get(member.id);
          if (salvo) {
            return {
              colaborador_id: salvo.colaborador_id,
              nome_colaborador:
                salvo.nome_colaborador || member.nome_completo || "",
              presente: !!salvo.presente,
              hora_inicio: salvo.hora_inicio || "",
              hora_fim: salvo.hora_fim || "",
              _avulso: false,
              funcao_nome: member.funcao_nome ?? null,
            };
          }
          return {
            colaborador_id: member.id || "",
            nome_colaborador: member.nome_completo || "",
            presente: false,
            hora_inicio: "",
            hora_fim: "",
            _avulso: false,
            funcao_nome: member.funcao_nome ?? null,
          };
        });

        // Salvos que NÃO estão mais na composição atual → avulsos
        const avulsos = existingData
          .filter(
            (item) =>
              item?.colaborador_id && !membrosIds.has(item.colaborador_id)
          )
          .map((item) => ({
            colaborador_id: item.colaborador_id!,
            nome_colaborador: item.nome_colaborador || "",
            presente: !!item.presente,
            hora_inicio: item.hora_inicio || "",
            hora_fim: item.hora_fim || "",
            _avulso: true,
            funcao_nome: null,
          }));

        const colaboradoresCombinados = [...base, ...avulsos];

        console.log(
          "🔄 União membros+salvos:",
          `membros=${equipeMembers.length}`,
          `salvos=${existingData.length}`,
          `avulsos=${avulsos.length}`,
          `total=${colaboradoresCombinados.length}`
        );
        form.setValue("colaboradores", colaboradoresCombinados);

        if (existingData[0].lista_entrega_id) {
          form.setValue("lista_entrega_id", existingData[0].lista_entrega_id);
        }
      } else {
        console.log("ℹ️ Nenhum apontamento existente encontrado");
        setApontamentoExistente(null);
      }
      
      setApontamentosCarregados(true);
      
    } catch (error) {
      console.error("❌ Erro ao carregar apontamento existente:", error);
    }
  }, [equipeMembers, form]);

  // Calcular estatísticas de avaliação
  const calcularEstatisticasAvaliacao = useCallback(() => {
    const colaboradoresPresentes = form.getValues().colaboradores?.filter(col => col.presente) || [];
    
    const pendentes = new Set<string>();
    const completas = new Set<string>();
    
    colaboradoresPresentes.forEach(colaborador => {
      if (colaborador.colaborador_id) {
        const status = avaliacaoStatusMap.get(colaborador.colaborador_id);
        if (status?.canCreate || !status) {
          pendentes.add(colaborador.colaborador_id);
        } else {
          completas.add(colaborador.colaborador_id);
        }
      }
    });
    
    setAvaliacoesPendentes(pendentes);
    setAvaliacoesCompletas(completas);
    setTodosColaboradoresAvaliados(pendentes.size === 0 && colaboradoresPresentes.length > 0);
    
    // Definir mensagem de alerta
    if (isAvaliacaoObrigatoria && pendentes.size > 0) {
      setAlertMessage({
        colaboradorId: "",
        message: `Avaliação obrigatória! ${pendentes.size} colaborador(es) precisam ser avaliados hoje.`,
        type: "error"
      });
    } else if (pendentes.size > 0) {
      setAlertMessage({
        colaboradorId: "",
        message: `${pendentes.size} colaborador(es) podem ser avaliados.`,
        type: "info"
      });
    } else if (completas.size > 0) {
      setAlertMessage({
        colaboradorId: "",
        message: `Todos os ${completas.size} colaborador(es) já foram avaliados recentemente.`,
        type: "info"
      });
    } else {
      setAlertMessage(null);
    }
  }, [form, avaliacaoStatusMap, isAvaliacaoObrigatoria]);

  // Efeito para recalcular estatísticas quando dados mudam
  useEffect(() => {
    calcularEstatisticasAvaliacao();
  }, [calcularEstatisticasAvaliacao]);

  // Efeito para carregar apontamento existente quando equipe e membros mudam
  useEffect(() => {
    const equipeId = form.getValues().equipe_id;
    const dataRegistro = form.getValues().data_registro;
    
    if (equipeId && dataRegistro && equipeMembers.length > 0 && !currentApontamento) {
      loadExistingApontamento(equipeId, dataRegistro);
    }
  }, [form, equipeMembers, currentApontamento, loadExistingApontamento]);

  // Handle form submission - keep as FormValues
  const handleFormSubmit = useCallback((data: ApontamentoEquipeFormValues) => {
    console.log("📤 Submetendo formulário:", data);
    
    try {
      // Validar dados antes de submeter
      const colaboradoresPresentes = data.colaboradores?.filter(col => col.presente) || [];
      
      if (colaboradoresPresentes.length === 0) {
        toast({
          title: "Erro de Validação",
          description: "Pelo menos um colaborador deve estar presente.",
          variant: "destructive"
        });
        return;
      }
      
      // Validar se colaboradores presentes têm IDs válidos
      const colaboradoresSemId = colaboradoresPresentes.filter(col => !col.colaborador_id || col.colaborador_id.trim() === "");
      if (colaboradoresSemId.length > 0) {
        console.warn("⚠️ Colaboradores sem ID encontrados:", colaboradoresSemId);
        toast({
          title: "Erro de Validação",
          description: "Todos os colaboradores presentes devem ter identificação válida.",
          variant: "destructive"
        });
        return;
      }
      
      console.log("✅ Dados validados para submissão:", data);
      onSubmit(data); // Pass FormValues directly
      
    } catch (error) {
      console.error("❌ Erro ao processar submissão:", error);
      toast({
        title: "Erro",
        description: "Erro ao processar dados do formulário",
        variant: "destructive"
      });
    }
  }, [toast, onSubmit]);

  // ---------------------------------------------------------------------------
  // Fase 2/3/4 — helpers locais (não tocam banco, não alteram salvar)
  // Todas as operações resolvem o índice real por colaborador_id.
  // ---------------------------------------------------------------------------

  const liberarColaborador = useCallback((originalIndex: number) => {
    const atuais = form.getValues("colaboradores") || [];
    if (originalIndex < 0 || originalIndex >= atuais.length) return;
    const proximos = atuais.filter((_: any, i: number) => i !== originalIndex);
    form.setValue("colaboradores", proximos, { shouldDirty: true, shouldValidate: false });
  }, [form]);

  const adicionarAvulso = useCallback((func: {
    id: string;
    nome_completo: string;
    funcao_nome?: string | null;
  }) => {
    if (!func?.id) return;
    const atuais = form.getValues("colaboradores") || [];
    if (atuais.some((c: any) => c.colaborador_id === func.id)) return;
    const novo = {
      colaborador_id: func.id,
      nome_colaborador: func.nome_completo || "",
      presente: false,
      hora_inicio: "",
      hora_fim: "",
      _avulso: true,
      funcao_nome: func.funcao_nome ?? null,
    };
    form.setValue("colaboradores", [...atuais, novo], { shouldDirty: true, shouldValidate: false });
  }, [form]);

  const selecionarTodos = useCallback((ids: string[]) => {
    if (!ids || ids.length === 0) return;
    const atuais = form.getValues("colaboradores") || [];
    const idSet = new Set(ids);
    const proximos = atuais.map((c: any) =>
      idSet.has(c.colaborador_id) ? { ...c, presente: true } : c
    );
    form.setValue("colaboradores", proximos, { shouldDirty: true, shouldValidate: false });
  }, [form]);

  const marcarSaidaTodos = useCallback((ids: string[], horaAtual: string) => {
    if (!ids || ids.length === 0 || !horaAtual) return;
    const atuais = form.getValues("colaboradores") || [];
    const idSet = new Set(ids);
    const proximos = atuais.map((c: any) => {
      if (!idSet.has(c.colaborador_id)) return c;
      if (c.presente === true && !!c.hora_inicio && !c.hora_fim) {
        return { ...c, hora_fim: horaAtual };
      }
      return c;
    });
    form.setValue("colaboradores", proximos, { shouldDirty: true, shouldValidate: false });
  }, [form]);

  return {
    form,
    handleFormSubmit,
    equipeMembers,
    isLoadingMembers,
    loadingEquipeError,
    apontamentoExistente,
    avaliacoesPendentes,
    avaliacoesCompletas,
    todosColaboradoresAvaliados,
    alertMessage,
    loadEquipeMembers,
    loadExistingApontamento,
    apontamentosCarregados,
    // helpers Fase 2/3/4
    liberarColaborador,
    adicionarAvulso,
    selecionarTodos,
    marcarSaidaTodos,
  };
};

