import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { 
  checkApontamentoExistente, 
  getAvaliacoesForEquipeAndDate,
  getApontamentoByEquipeAndDate
} from "@/services/apontamentoEquipeService";
import { getEquipeById } from "@/services/equipe/getEquipeById";
import { Funcionario } from "@/types/funcionario";
import { ApontamentoEquipe } from "@/types/apontamentoEquipe";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  equipe_id: z.string({
    required_error: "Selecione uma equipe",
  }),
  data_registro: z.date({
    required_error: "Selecione uma data",
  }),
  colaboradores: z.array(
    z.object({
      colaborador_id: z.string().optional(),
      nome_colaborador: z.string().min(1, "Nome é obrigatório"),
      hora_inicio: z.string().optional().nullable(),
      hora_fim: z.string().optional().nullable(),
      presente: z.boolean().default(true),
    })
  ),
});

type FormValues = z.infer<typeof formSchema>;

export interface UseApontamentoEquipeFormProps {
  currentApontamento: ApontamentoEquipe | null;
  onSubmit: (data: any) => void;
  avaliacaoStatusMap: Map<string, {canCreate: boolean, daysRemaining: number}>;
  isAvaliacaoObrigatoria?: boolean;
}

export const useApontamentoEquipeForm = ({
  currentApontamento,
  onSubmit,
  avaliacaoStatusMap,
  isAvaliacaoObrigatoria = false
}: UseApontamentoEquipeFormProps) => {
  const { toast } = useToast();
  const [equipeMembers, setEquipeMembers] = useState<Funcionario[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [apontamentoExistente, setApontamentoExistente] = useState(false);
  const [isCheckingApontamento, setIsCheckingApontamento] = useState(false);
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState<Set<string>>(new Set());
  const [avaliacoesCompletas, setAvaliacoesCompletas] = useState<Set<string>>(new Set());
  const [todosColaboradoresAvaliados, setTodosColaboradoresAvaliados] = useState(false);
  const [alertMessage, setAlertMessage] = useState<{
    colaboradorId: string,
    message: string,
    type: 'error' | 'info'
  } | null>(null);
  const [apontamentosCarregados, setApontamentosCarregados] = useState<boolean>(false);
  const [loadingEquipeError, setLoadingEquipeError] = useState<string | null>(null);
  
  const getCurrentTime = (): string => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  };
  
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      equipe_id: "",
      data_registro: new Date(),
      colaboradores: [],
    },
  });

  const normalizeDate = (date: Date): string => {
    const normalizedDate = new Date(date);
    normalizedDate.setHours(12, 0, 0, 0);
    return format(normalizedDate, "yyyy-MM-dd");
  };

  const checkExistingApontamento = async (equipeId: string, data: Date) => {
    if (!equipeId || !data) return;
    
    setIsCheckingApontamento(true);
    try {
      const formattedDate = normalizeDate(data);
      const exists = await checkApontamentoExistente(equipeId, formattedDate);
      
      setApontamentoExistente(exists && !currentApontamento);
      
      if (exists && !currentApontamento) {
        toast({
          title: "Apontamento já existente",
          description: `Já existe um apontamento registrado para esta equipe na data ${format(data, "dd/MM/yyyy")}.`,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error checking existing apontamento:", error);
    } finally {
      setIsCheckingApontamento(false);
    }
  };

  const fetchExistingAvaliacoes = async (equipeId: string, data: Date) => {
    if (!equipeId || !data) return;
    
    try {
      const formattedDate = normalizeDate(data);
      const avaliacoes = await getAvaliacoesForEquipeAndDate(equipeId, formattedDate);
      
      const completedSet = new Set<string>();
      
      avaliacoes.forEach(avaliacao => {
        if (avaliacao.colaborador_id) {
          completedSet.add(avaliacao.colaborador_id);
        }
      });
      
      setAvaliacoesCompletas(completedSet);
      
      updatePendingEvaluations();
    } catch (error) {
      console.error("Error fetching existing evaluations:", error);
    }
  };

  const loadEquipeMembers = useCallback(async (equipeId: string) => {
    if (!equipeId) {
      console.log("Equipe ID não fornecido para loadEquipeMembers");
      setLoadingEquipeError("ID da equipe não fornecido");
      return;
    }
    
    setIsLoadingMembers(true);
    setLoadingEquipeError(null);
    console.log("Carregando membros da equipe:", equipeId);
    
    try {
      const equipe = await getEquipeById(equipeId);
      console.log("Equipe with membros:", equipe);
      
      if (equipe && equipe.membros && equipe.membros.length > 0) {
        const funcionarios: Funcionario[] = equipe.membros.map(membro => ({
          id: membro.id,
          nome_completo: membro.nome_completo,
          cpf: '',
          email: '',
          telefone: '',
          data_nascimento: '',
          genero: '',
          estado_civil: '',
          nacionalidade: '',
          rg: '',
          orgao_emissor: '',
          data_emissao: '',
          endereco: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: '',
          estado: '',
          cep: '',
          pis: '',
          ctps: '',
          serie_ctps: '',
          uf_ctps: '',
          data_emissao_ctps: '',
          titulo_eleitor: '',
          zona_eleitoral: '',
          secao_eleitoral: '',
          certificado_reservista: '',
          cnh: '',
          categoria_cnh: '',
          validade_cnh: '',
          data_admissao: '',
          data_demissao: '',
          status: 'Ativo',
          cargo: '',
          departamento: '',
          salario: '',
          banco: '',
          agencia: '',
          conta: '',
          tipo_conta: '',
          observacoes: '',
        }));
        
        console.log("Membros da equipe encontrados:", funcionarios.length);
        setEquipeMembers(funcionarios);
        
        if (!currentApontamento || form.getValues().colaboradores.length === 0) {
          const currentTime = getCurrentTime();
          const colaboradores = equipe.membros.map(membro => ({
            colaborador_id: membro.id,
            nome_colaborador: membro.nome_completo,
            hora_inicio: currentTime,
            hora_fim: "",
            presente: true,
          }));
          
          console.log("Inicializando colaboradores para novo apontamento:", colaboradores.length);
          form.setValue("colaboradores", colaboradores);
          form.trigger("colaboradores");
        }
        
        setAvaliacoesPendentes(new Set());
        setAvaliacoesCompletas(new Set());
        
        const currentDate = form.getValues().data_registro;
        if (currentDate) {
          await fetchExistingAvaliacoes(equipeId, currentDate);
        }
        
        updatePendingEvaluations();
      } else {
        console.log("Equipe não possui membros");
        setEquipeMembers([]);
        form.setValue("colaboradores", []);
        setLoadingEquipeError("Esta equipe não possui membros cadastrados");
        toast({
          title: "Aviso",
          description: "Esta equipe não possui membros cadastrados.",
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Error loading equipe members:", error);
      setLoadingEquipeError("Não foi possível carregar os membros da equipe");
      toast({
        title: "Erro",
        description: "Não foi possível carregar os membros da equipe.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMembers(false);
    }
  }, [currentApontamento, toast, form]);

  const loadExistingApontamento = async (equipeId: string, date: Date) => {
    if (!equipeId || !date) {
      console.log("Equipe ID ou data não fornecidos para loadExistingApontamento");
      return;
    }
    
    try {
      const formattedDate = normalizeDate(date);
      console.log("Carregando apontamento existente para equipe:", equipeId, "data:", formattedDate);
      
      const { data: apontamentos, error } = await supabase
        .from("bd_apontamento_equipe")
        .select(`
          *,
          colaborador:colaborador_id (
            id, nome_completo
          )
        `)
        .eq("equipe_id", equipeId)
        .eq("data_registro", formattedDate);
      
      if (error) {
        throw error;
      }
      
      console.log("Apontamentos encontrados:", apontamentos?.length);
      
      if (apontamentos && apontamentos.length > 0) {
        const colaboradores = apontamentos.map(apontamento => ({
          colaborador_id: apontamento.colaborador_id,
          nome_colaborador: apontamento.nome_colaborador || (apontamento.colaborador ? apontamento.colaborador.nome_completo : ''),
          hora_inicio: apontamento.hora_inicio || '',
          hora_fim: apontamento.hora_fim || '',
          presente: apontamento.presente,
        }));
        
        console.log("Definindo colaboradores no form:", colaboradores);
        form.setValue("colaboradores", colaboradores);
        setApontamentosCarregados(true);
      } else {
        console.log("Nenhum apontamento encontrado para esta equipe e data");
        
        if (currentApontamento && equipeMembers.length > 0) {
          console.log("Criando colaboradores para edição baseado nos membros da equipe");
          const currentTime = getCurrentTime();
          const colaboradores = equipeMembers.map(membro => ({
            colaborador_id: membro.id,
            nome_colaborador: membro.nome_completo,
            hora_inicio: currentTime,
            hora_fim: "",
            presente: true,
          }));
          
          form.setValue("colaboradores", colaboradores);
          setApontamentosCarregados(true);
        }
      }
    } catch (error) {
      console.error("Error loading existing apontamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o apontamento existente.",
        variant: "destructive",
      });
    }
  };

  const updatePendingEvaluations = () => {
    const colaboradores = form.getValues().colaboradores;
    const pendingSet = new Set<string>();
    
    colaboradores.forEach((col: any) => {
      if (col.presente && col.colaborador_id) {
        const isAlreadyEvaluated = avaliacoesCompletas.has(col.colaborador_id);
        const avaliacaoStatus = avaliacaoStatusMap.get(col.colaborador_id);
        const canCreate = avaliacaoStatus?.canCreate ?? true;
        
        if (canCreate && !isAlreadyEvaluated) {
          pendingSet.add(col.colaborador_id);
        }
      }
    });
    
    setAvaliacoesPendentes(pendingSet);
    
    const presentColaboradores = colaboradores.filter((col: any) => col.presente);
    const allEvaluated = presentColaboradores.every((col: any) => 
      !col.colaborador_id || 
      avaliacoesCompletas.has(col.colaborador_id) || 
      !(avaliacaoStatusMap.get(col.colaborador_id)?.canCreate ?? true)
    );
    
    setTodosColaboradoresAvaliados(allEvaluated);
  };

  const verificarAvaliacoesPendentes = (values: FormValues): boolean => {
    if (!currentApontamento) {
      const presentColaboradores = values.colaboradores.filter(col => col.presente);
      
      const existemAvaliacoesPendentes = presentColaboradores.some(col => 
        col.colaborador_id && 
        avaliacaoStatusMap.get(col.colaborador_id)?.canCreate && 
        !avaliacoesCompletas.has(col.colaborador_id)
      );
      
      return existemAvaliacoesPendentes;
    }
    
    return false;
  };

  const handleFormSubmit = (values: FormValues) => {
    if (values.colaboradores.length === 0) {
      toast({
        title: "Erro",
        description: "É necessário ter pelo menos um colaborador na equipe.",
        variant: "destructive",
      });
      return;
    }

    if (apontamentoExistente && !currentApontamento) {
      toast({
        title: "Apontamento já existente",
        description: `Já existe um apontamento registrado para esta equipe na data ${format(values.data_registro, "dd/MM/yyyy")}.`,
        variant: "destructive",
      });
      return;
    }

    if (isAvaliacaoObrigatoria) {
      const temAvaliacoesPendentes = verificarAvaliacoesPendentes(values);
      if (temAvaliacoesPendentes) {
        toast({
          title: "Avaliações pendentes",
          description: "É necessário avaliar todos os colaboradores presentes antes de salvar o apontamento.",
          variant: "destructive",
        });
        return;
      }
    }

    const validatedColaboradores = values.colaboradores.map((col: any) => ({
      ...col,
      nome_colaborador: col.nome_colaborador || "",
      hora_inicio: col.presente ? col.hora_inicio || "" : null,
      hora_fim: col.presente ? col.hora_fim || "" : null,
      presente: typeof col.presente === 'boolean' ? col.presente : true
    }));

    const formattedDate = normalizeDate(values.data_registro);
    
    onSubmit({
      equipe_id: values.equipe_id,
      data_registro: formattedDate,
      colaboradores: validatedColaboradores,
    });
  };

  const handleAvaliacaoConcluida = (colaboradorId: string) => {
    if (colaboradorId) {
      const newComplete = new Set(avaliacoesCompletas);
      newComplete.add(colaboradorId);
      setAvaliacoesCompletas(newComplete);
      
      if (avaliacoesPendentes.has(colaboradorId)) {
        const newPending = new Set(avaliacoesPendentes);
        newPending.delete(colaboradorId);
        setAvaliacoesPendentes(newPending);
      }
      
      updatePendingEvaluations();
    }
  };

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      console.log("Form value changed:", name, "change");
      
      if ((name === 'equipe_id' || name === 'data_registro') && 
          value.equipe_id && value.data_registro) {
        
        checkExistingApontamento(value.equipe_id, value.data_registro);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form]);

  const colaboradores = form.watch("colaboradores");
  
  useEffect(() => {
    if (colaboradores.length > 0) {
      console.log("Colaboradores atualizados no formulário:", colaboradores.length);
      if (isAvaliacaoObrigatoria) {
        updatePendingEvaluations();
      } else {
        setTodosColaboradoresAvaliados(true);
      }
    }
  }, [colaboradores, avaliacoesCompletas, isAvaliacaoObrigatoria]);

  useEffect(() => {
    const handleAvaliacaoConcluidaEvent = (event: CustomEvent) => {
      if (event.detail && event.detail.colaboradorId) {
        handleAvaliacaoConcluida(event.detail.colaboradorId);
      }
    };

    document.addEventListener('avaliacaoConcluida', handleAvaliacaoConcluidaEvent as EventListener);
    
    return () => {
      document.removeEventListener('avaliacaoConcluida', handleAvaliacaoConcluidaEvent as EventListener);
    };
  }, []);
  
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (alertMessage) {
      timer = setTimeout(() => {
        setAlertMessage(null);
      }, 5000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [alertMessage]);

  return {
    form,
    handleFormSubmit,
    equipeMembers,
    isLoadingMembers,
    apontamentoExistente,
    isCheckingApontamento,
    avaliacoesPendentes,
    avaliacoesCompletas,
    todosColaboradoresAvaliados,
    alertMessage,
    setAlertMessage,
    handleAvaliacaoConcluida,
    loadEquipeMembers,
    loadExistingApontamento,
    apontamentosCarregados,
    loadingEquipeError
  };
};
