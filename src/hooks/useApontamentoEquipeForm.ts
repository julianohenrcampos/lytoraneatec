
import { useState, useEffect, useCallback } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Funcionario } from "@/types/funcionario";
import { apontamentoEquipeSchema, ApontamentoEquipeSchema } from "@/validations/apontamentoEquipeSchema";
import { 
  getCurrentBrazilianDate,
  formatBrazilianDateToString 
} from "@/utils/timezoneUtils";

interface ApontamentoEquipeData {
  id?: string;
  equipe_id: string;
  data_registro: string;
  lista_entrega_id?: string;
  colaboradores: {
    colaborador_id: string;
    nome_colaborador: string;
    hora_inicio?: string;
    hora_fim?: string;
    presente: boolean;
  }[];
}

interface AlertMessage {
  colaboradorId: string;
  message: string;
  type: "error" | "info";
}

interface UseApontamentoEquipeFormProps {
  currentApontamento?: any;
  onSubmit?: (data: any) => void;
  avaliacaoStatusMap?: Map<string, {canCreate: boolean, daysRemaining: number}>;
  isAvaliacaoObrigatoria?: boolean;
}

export const useApontamentoEquipeForm = (props?: UseApontamentoEquipeFormProps) => {
  const { currentApontamento, onSubmit, avaliacaoStatusMap = new Map(), isAvaliacaoObrigatoria = false } = props || {};
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [colaboradores, setColaboradores] = useState<Funcionario[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [entregas, setEntregas] = useState<any[]>([]);
  const [equipeMembers, setEquipeMembers] = useState<Funcionario[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [apontamentoExistente, setApontamentoExistente] = useState<any>(null);
  const [avaliacoesPendentes, setAvaliacoesPendentes] = useState<Set<string>>(new Set());
  const [avaliacoesCompletas, setAvaliacoesCompletas] = useState<Set<string>>(new Set());
  const [todosColaboradoresAvaliados, setTodosColaboradoresAvaliados] = useState(true); // Iniciar como true para não bloquear
  const [alertMessage, setAlertMessage] = useState<AlertMessage>({ colaboradorId: "", message: "", type: "info" });
  const [apontamentosCarregados, setApontamentosCarregados] = useState(false);
  const [loadingEquipeError, setLoadingEquipeError] = useState<string>("");

  const form = useForm<ApontamentoEquipeSchema>({
    resolver: zodResolver(apontamentoEquipeSchema),
    defaultValues: {
      equipe_id: currentApontamento?.equipe_id || "",
      data_registro: currentApontamento?.data_registro || getCurrentBrazilianDate(),
      lista_entrega_id: currentApontamento?.lista_entrega_id || "",
      colaboradores: currentApontamento?.colaboradores || []
    }
  });

  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "colaboradores"
  });

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Load equipes
        const { data: equipesData, error: equipesError } = await supabase
          .from('bd_equipes')
          .select(`
            id,
            nome_equipe,
            apontador:apontador_id(id, nome_completo)
          `);

        if (equipesError) throw equipesError;
        setEquipes(equipesData || []);

        // Load entregas
        const { data: entregasData, error: entregasError } = await supabase
          .from('bd_lista_programacao_entrega')
          .select(`
            id,
            logradouro,
            data_entrega,
            equipe_id,
            status
          `)
          .eq('status', 'Ativa');

        if (entregasError) throw entregasError;
        setEntregas(entregasData || []);

      } catch (error) {
        console.error('Error loading initial data:', error);
        toast({
          title: "Erro",
          description: "Erro ao carregar dados iniciais",
          variant: "destructive",
        });
      }
    };

    loadInitialData();
  }, [toast]);

  const loadEquipeMembers = useCallback(async (equipeId: string) => {
    if (!equipeId) {
      setEquipeMembers([]);
      setLoadingEquipeError("");
      return;
    }

    setIsLoadingMembers(true);
    setLoadingEquipeError("");
    
    try {
      console.log("🔄 Carregando membros da equipe:", equipeId);
      
      const { data: colaboradoresData, error: colaboradoresError } = await supabase
        .from('bd_funcionarios')
        .select('*')
        .eq('equipe_id', equipeId)
        .eq('status', 'Ativo');

      if (colaboradoresError) throw colaboradoresError;

      console.log("✅ Membros carregados:", colaboradoresData?.length);

      // Convert string salario to number for type compatibility
      const processedColaboradores = (colaboradoresData || []).map(funcionario => ({
        ...funcionario,
        salario: funcionario.salario ? parseFloat(String(funcionario.salario)) : undefined,
        salario_base: funcionario.salario_base ? parseFloat(String(funcionario.salario_base)) : undefined,
        insalubridade: funcionario.insalubridade ? parseFloat(String(funcionario.insalubridade)) : undefined,
        periculosidade: funcionario.periculosidade ? parseFloat(String(funcionario.periculosidade)) : undefined,
        gratificacao: funcionario.gratificacao ? parseFloat(String(funcionario.gratificacao)) : undefined,
        adicional_noturno: funcionario.adicional_noturno ? parseFloat(String(funcionario.adicional_noturno)) : undefined,
        custo_passagem: funcionario.custo_passagem ? parseFloat(String(funcionario.custo_passagem)) : undefined,
        refeicao: funcionario.refeicao ? parseFloat(String(funcionario.refeicao)) : undefined,
        diarias: funcionario.diarias ? parseFloat(String(funcionario.diarias)) : undefined
      }));

      setEquipeMembers(processedColaboradores);
      setColaboradores(processedColaboradores);

      // Auto-populate colaboradores if not editing existing data
      if (!currentApontamento && processedColaboradores.length > 0) {
        const colaboradoresForm = processedColaboradores.map(col => ({
          colaborador_id: col.id,
          nome_colaborador: col.nome_completo,
          presente: false,
          hora_inicio: "",
          hora_fim: ""
        }));
        
        form.setValue("colaboradores", colaboradoresForm);
      }

    } catch (error) {
      console.error('❌ Error loading colaboradores:', error);
      setLoadingEquipeError("Erro ao carregar colaboradores da equipe");
      toast({
        title: "Erro",
        description: "Erro ao carregar colaboradores da equipe",
        variant: "destructive",
      });
    } finally {
      setIsLoadingMembers(false);
    }
  }, [form, toast, currentApontamento]);

  const loadExistingApontamento = useCallback(async (equipeId: string, dataRegistro: Date) => {
    try {
      console.log("🔍 Verificando apontamento existente:", { equipeId, dataRegistro });
      
      // Check if apontamento already exists for this team and date
      const { data: existingData, error } = await supabase
        .from('bd_apontamento_equipe')
        .select('*')
        .eq('equipe_id', equipeId)
        .eq('data_registro', formatBrazilianDateToString(dataRegistro));

      if (error) throw error;

      if (existingData && existingData.length > 0) {
        console.log("✅ Apontamento existente encontrado:", existingData.length, "registros");
        setApontamentoExistente(existingData);
        
        // Populate form with existing data
        const colaboradoresForm = existingData.map(item => ({
          colaborador_id: item.colaborador_id,
          nome_colaborador: item.nome_colaborador,
          presente: item.presente,
          hora_inicio: item.hora_inicio || "",
          hora_fim: item.hora_fim || ""
        }));
        
        form.setValue("colaboradores", colaboradoresForm);
        setApontamentosCarregados(true);
      } else {
        console.log("ℹ️ Nenhum apontamento existente encontrado");
        setApontamentoExistente(null);
        setApontamentosCarregados(true);
      }
    } catch (error) {
      console.error('❌ Error loading existing apontamento:', error);
      setApontamentosCarregados(true);
    }
  }, [form]);

  // Monitorar mudanças nas avaliações para atualizar o estado
  useEffect(() => {
    const formValues = form.getValues();
    const colaboradoresPresentes = formValues.colaboradores?.filter(col => col.presente) || [];
    
    // Para permitir salvamento básico, apenas verificar se há colaboradores presentes
    // A validação de avaliações é opcional
    if (colaboradoresPresentes.length > 0) {
      setTodosColaboradoresAvaliados(true);
    }
    
    console.log("📊 Status das avaliações:", {
      colaboradoresPresentes: colaboradoresPresentes.length,
      avaliacoesCompletas: avaliacoesCompletas.size,
      todosColaboradoresAvaliados: true, // Sempre true para permitir salvamento
      isAvaliacaoObrigatoria
    });
  }, [form.watch("colaboradores"), avaliacoesCompletas, isAvaliacaoObrigatoria]);

  const handleFormSubmit = useCallback(async (data: ApontamentoEquipeSchema) => {
    setIsSubmitting(true);
    
    try {
      console.log("🚀 Iniciando salvamento do apontamento:", data);
      
      if (onSubmit) {
        await onSubmit(data);
      } else {
        const colaboradoresPresentes = data.colaboradores.filter(col => col.presente);
        
        if (colaboradoresPresentes.length === 0) {
          toast({
            title: "Erro",
            description: "Selecione pelo menos um colaborador presente",
            variant: "destructive",
          });
          return;
        }

        console.log("💾 Salvando apontamento com", colaboradoresPresentes.length, "colaboradores presentes");

        // Prepare data for database
        const apontamentoData = colaboradoresPresentes.map(col => ({
          equipe_id: data.equipe_id,
          colaborador_id: col.colaborador_id,
          nome_colaborador: col.nome_colaborador,
          data_registro: data.data_registro,
          lista_entrega_id: data.lista_entrega_id || null,
          hora_inicio: col.hora_inicio || null,
          hora_fim: col.hora_fim || null,
          presente: col.presente
        }));

        // Save to database
        const { error } = await supabase
          .from('bd_apontamento_equipe')
          .insert(apontamentoData);

        if (error) throw error;

        console.log("✅ Apontamento salvo com sucesso");

        toast({
          title: "Sucesso",
          description: "Apontamento de equipe salvo com sucesso",
        });

        // Reset form
        form.reset();
      }
    } catch (error) {
      console.error('❌ Error saving apontamento:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar apontamento de equipe",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [form, toast, onSubmit]);

  // Load colaboradores when equipe changes
  const watchedEquipeId = form.watch("equipe_id");
  
  useEffect(() => {
    if (watchedEquipeId) {
      loadEquipeMembers(watchedEquipeId);
    }
  }, [watchedEquipeId, loadEquipeMembers]);

  return {
    form,
    fields,
    append,
    remove,
    update,
    isSubmitting,
    colaboradores,
    equipes,
    entregas,
    equipeMembers,
    isLoadingMembers,
    apontamentoExistente,
    avaliacoesPendentes,
    avaliacoesCompletas,
    todosColaboradoresAvaliados,
    alertMessage,
    loadEquipeMembers,
    loadExistingApontamento,
    apontamentosCarregados,
    loadingEquipeError,
    handleFormSubmit,
    onSubmit: form.handleSubmit(handleFormSubmit)
  };
};
