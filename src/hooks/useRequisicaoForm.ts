
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { Requisicao, RequisicaoWithRuas, RuaRequisicao } from "@/types/requisicao";
import { createRequisicao, updateRequisicao } from "@/services/requisicaoService";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { debugLog } from "@/lib/debug";
import { format } from "date-fns";

// Schema for a street
const ruaSchema = z.object({
  id: z.string().optional(),
  logradouro: z.string().min(1, { message: "Logradouro é obrigatório" }),
  bairro: z.string().optional(),
  largura: z.coerce.number().positive({ message: "Largura deve ser maior que zero" }),
  comprimento: z.coerce.number().positive({ message: "Comprimento deve ser maior que zero" }),
  pintura_ligacao: z.string().min(1, { message: "Pintura de ligação é obrigatória" }),
  traco: z.string().min(1, { message: "Traço é obrigatório" }),
  espessura: z.coerce.number().positive({ message: "Espessura deve ser maior que zero" }),
  area: z.number().optional(),
  volume: z.number().optional(),
});

// Schema for the requisition form
const requisicaoSchema = z.object({
  centro_custo_id: z.string().min(1, { message: "Centro de custo é obrigatório" }),
  diretoria: z.string().optional(),
  gerencia: z.string().optional(),
  engenheiro_id: z.string().min(1, { message: "Engenheiro responsável é obrigatório" }),
  data_requisicao: z.string().min(1, { message: "Data é obrigatória" }),
  ruas: z.array(ruaSchema).min(1, { message: "Adicione pelo menos uma rua" }),
});

export type RequisicaoFormSchema = z.infer<typeof requisicaoSchema>;
export type RuaFormSchema = z.infer<typeof ruaSchema>;

export const useRequisicaoForm = (
  requisicao: RequisicaoWithRuas | null,
  onSuccess: () => void
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddingRua, setIsAddingRua] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [searchAttempts, setSearchAttempts] = useState(0);
  const [searchStatus, setSearchStatus] = useState<'searching' | 'found' | 'not_found' | 'error'>('searching');
  
  // Enhanced employee search function
  const searchEmployee = async (user: any, attempt: number = 1) => {
    if (!user?.email) {
      console.log("🔍 REINALDO DEBUG: No user email available");
      setSearchStatus('error');
      return null;
    }

    console.log(`🔍 REINALDO DEBUG: Attempt ${attempt} - Searching for employee with email:`, user.email);
    console.log("🔍 REINALDO DEBUG: User object:", JSON.stringify(user, null, 2));

    try {
      // Attempt 1: Exact email match
      console.log("🔍 REINALDO DEBUG: Trying exact email match...");
      const { data: funcionarios, error } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email')
        .eq('email', user.email);
        
      if (error) {
        console.error("🔍 REINALDO DEBUG: Error in exact search:", error);
        setSearchStatus('error');
        return null;
      }

      console.log("🔍 REINALDO DEBUG: Exact search results:", funcionarios);

      if (funcionarios && funcionarios.length > 0) {
        console.log("🔍 REINALDO DEBUG: Found employee with exact match:", funcionarios[0]);
        setSearchStatus('found');
        return funcionarios[0].id;
      }

      // Attempt 2: Case-insensitive search
      console.log("🔍 REINALDO DEBUG: Trying case-insensitive search...");
      const { data: funcionariosInsensitive, error: errorInsensitive } = await supabase
        .from('bd_funcionarios')
        .select('id, nome_completo, email')
        .ilike('email', user.email);
        
      if (errorInsensitive) {
        console.error("🔍 REINALDO DEBUG: Error in case-insensitive search:", errorInsensitive);
        setSearchStatus('error');
        return null;
      }

      console.log("🔍 REINALDO DEBUG: Case-insensitive search results:", funcionariosInsensitive);

      if (funcionariosInsensitive && funcionariosInsensitive.length > 0) {
        console.log("🔍 REINALDO DEBUG: Found employee with case-insensitive match:", funcionariosInsensitive[0]);
        setSearchStatus('found');
        return funcionariosInsensitive[0].id;
      }

      // Attempt 3: Partial email match (in case there are formatting differences)
      console.log("🔍 REINALDO DEBUG: Trying partial email match...");
      const emailParts = user.email.split('@');
      if (emailParts.length > 0) {
        const { data: funcionariosPartial, error: errorPartial } = await supabase
          .from('bd_funcionarios')
          .select('id, nome_completo, email')
          .ilike('email', `%${emailParts[0]}%`);
          
        if (errorPartial) {
          console.error("🔍 REINALDO DEBUG: Error in partial search:", errorPartial);
          setSearchStatus('error');
          return null;
        }

        console.log("🔍 REINALDO DEBUG: Partial search results:", funcionariosPartial);

        if (funcionariosPartial && funcionariosPartial.length > 0) {
          console.log("🔍 REINALDO DEBUG: Found employee with partial match:", funcionariosPartial[0]);
          setSearchStatus('found');
          return funcionariosPartial[0].id;
        }
      }

      // Attempt 4: Search by name if email doesn't work
      if (user.user_metadata?.nome_completo || user.user_metadata?.full_name) {
        const name = user.user_metadata.nome_completo || user.user_metadata.full_name;
        console.log("🔍 REINALDO DEBUG: Trying name search with:", name);
        
        const { data: funcionariosName, error: errorName } = await supabase
          .from('bd_funcionarios')
          .select('id, nome_completo, email')
          .ilike('nome_completo', `%${name}%`);
          
        if (errorName) {
          console.error("🔍 REINALDO DEBUG: Error in name search:", errorName);
        } else {
          console.log("🔍 REINALDO DEBUG: Name search results:", funcionariosName);
          
          if (funcionariosName && funcionariosName.length > 0) {
            console.log("🔍 REINALDO DEBUG: Found employee with name match:", funcionariosName[0]);
            setSearchStatus('found');
            return funcionariosName[0].id;
          }
        }
      }

      console.log("🔍 REINALDO DEBUG: No employee found with any search method");
      setSearchStatus('not_found');
      return null;

    } catch (error) {
      console.error("🔍 REINALDO DEBUG: Exception during employee search:", error);
      setSearchStatus('error');
      return null;
    }
  };

  // Auto-retry search with delay
  const retrySearch = async (user: any) => {
    if (searchAttempts >= 3) {
      console.log("🔍 REINALDO DEBUG: Max search attempts reached");
      setSearchStatus('not_found');
      return;
    }

    const newAttempts = searchAttempts + 1;
    setSearchAttempts(newAttempts);
    
    console.log(`🔍 REINALDO DEBUG: Retrying search (attempt ${newAttempts})...`);
    
    // Wait a bit before retrying
    setTimeout(async () => {
      const foundId = await searchEmployee(user, newAttempts);
      if (foundId) {
        setFuncionarioId(foundId);
        form.setValue("engenheiro_id", foundId);
      }
    }, 1000);
  };
  
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        console.log("🔍 REINALDO DEBUG: Starting user load process...");
        const user = await getCurrentUser();
        setCurrentUser(user);
        
        if (user) {
          console.log("🔍 REINALDO DEBUG: Current user loaded:", {
            id: user.id,
            email: user.email,
            metadata: user.user_metadata
          });
          
          setSearchStatus('searching');
          const foundId = await searchEmployee(user);
          
          if (foundId) {
            console.log("🔍 REINALDO DEBUG: Setting funcionario ID:", foundId);
            setFuncionarioId(foundId);
            form.setValue("engenheiro_id", foundId);
          } else {
            console.log("🔍 REINALDO DEBUG: No funcionario ID found, will retry...");
            retrySearch(user);
          }
        } else {
          console.log("🔍 REINALDO DEBUG: No current user found");
          setSearchStatus('error');
        }
      } catch (error) {
        console.error("🔍 REINALDO DEBUG: Error loading current user:", error);
        setSearchStatus('error');
      }
    };
    
    loadCurrentUser();
  }, []);
  
  const form = useForm<RequisicaoFormSchema>({
    resolver: zodResolver(requisicaoSchema),
    defaultValues: {
      centro_custo_id: "",
      diretoria: "",
      gerencia: "",
      engenheiro_id: "",
      data_requisicao: format(new Date(), "yyyy-MM-dd"),
      ruas: [],
    },
  });
  
  const ruaForm = useForm<RuaFormSchema>({
    resolver: zodResolver(ruaSchema),
    defaultValues: {
      logradouro: "",
      bairro: "",
      largura: 0,
      comprimento: 0,
      pintura_ligacao: "",
      traco: "",
      espessura: 0,
    },
  });
  
  const calculateDerivedValues = (rua: RuaFormSchema): RuaFormSchema => {
    const area = rua.largura * rua.comprimento;
    const volume = area * rua.espessura * 2.4;
    
    return {
      ...rua,
      area,
      volume
    };
  };
  
  useEffect(() => {
    if (requisicao) {
      form.reset({
        centro_custo_id: requisicao.centro_custo_id || "",
        diretoria: requisicao.diretoria || "",
        gerencia: requisicao.gerencia || "",
        engenheiro_id: requisicao.engenheiro_id || "",
        data_requisicao: requisicao.data_requisicao,
        ruas: requisicao.ruas || [],
      });
    } else if (funcionarioId) {
      form.setValue("engenheiro_id", funcionarioId);
    }
  }, [requisicao, form, funcionarioId]);
  
  const onSubmit = async (data: RequisicaoFormSchema) => {
    console.log("🔍 REINALDO DEBUG: Starting form submission...");
    console.log("🔍 REINALDO DEBUG: Form data:", data);
    console.log("🔍 REINALDO DEBUG: funcionarioId state:", funcionarioId);
    console.log("🔍 REINALDO DEBUG: engenheiro_id from form:", data.engenheiro_id);
    
    // Validation before submission
    if (!data.engenheiro_id && !funcionarioId) {
      console.error("🔍 REINALDO DEBUG: No engenheiro_id available for submission");
      toast({
        title: "Erro de validação",
        description: "Não foi possível identificar o engenheiro responsável. Verifique se seu usuário está cadastrado no sistema.",
        variant: "destructive",
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Ensure we have the engineer ID
      const finalEngenheiroId = data.engenheiro_id || funcionarioId;
      console.log("🔍 REINALDO DEBUG: Final engenheiro_id for submission:", finalEngenheiroId);
      
      if (!finalEngenheiroId) {
        throw new Error("Engenheiro ID não encontrado");
      }
      
      data.engenheiro_id = finalEngenheiroId;
      
      // Process streets data without area and volume fields
      const processedRuas = data.ruas.map(rua => ({
        logradouro: rua.logradouro,
        bairro: rua.bairro,
        largura: rua.largura,
        comprimento: rua.comprimento,
        pintura_ligacao: rua.pintura_ligacao,
        traco: rua.traco,
        espessura: rua.espessura
      }));
      
      debugLog("onSubmit - Processed ruas", processedRuas);
      debugLog("onSubmit - Final Engenheiro ID", data.engenheiro_id);
      
      if (requisicao && requisicao.id) {
        console.log("🔍 REINALDO DEBUG: Updating existing requisition");
        await updateRequisicao(
          requisicao.id,
          {
            centro_custo_id: data.centro_custo_id,
            diretoria: data.diretoria,
            gerencia: data.gerencia,
            engenheiro_id: data.engenheiro_id,
            data_requisicao: data.data_requisicao,
          },
          processedRuas
        );
        
        toast({
          title: "Requisição atualizada",
          description: "A requisição foi atualizada com sucesso.",
        });
      } else {
        console.log("🔍 REINALDO DEBUG: Creating new requisition");
        const newRequisicaoId = await createRequisicao(
          {
            centro_custo_id: data.centro_custo_id,
            diretoria: data.diretoria,
            gerencia: data.gerencia,
            engenheiro_id: data.engenheiro_id,
            data_requisicao: data.data_requisicao,
          },
          processedRuas
        );
        
        console.log("🔍 REINALDO DEBUG: New requisition created with ID:", newRequisicaoId);
        
        toast({
          title: "Requisição criada",
          description: "A requisição foi criada com sucesso.",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['requisicoes'] });
      onSuccess();
    } catch (error) {
      console.error("🔍 REINALDO DEBUG: Error in onSubmit:", error);
      toast({
        title: "Erro ao salvar",
        description: `Ocorreu um erro: ${error instanceof Error ? error.message : 'Erro desconhecido'}`,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const addRua = (rua: RuaFormSchema) => {
    const calculatedRua = calculateDerivedValues(rua);
    const currentRuas = form.getValues("ruas") || [];
    form.setValue("ruas", [...currentRuas, calculatedRua]);
    ruaForm.reset();
    setIsAddingRua(false);
  };
  
  const removeRua = (index: number) => {
    const currentRuas = form.getValues("ruas");
    form.setValue("ruas", currentRuas.filter((_, i) => i !== index));
  };
  
  return {
    form,
    ruaForm,
    isSubmitting,
    isAddingRua,
    setIsAddingRua,
    onSubmit,
    addRua,
    removeRua,
    currentUser,
    funcionarioId,
    searchStatus,
    retrySearch: () => currentUser && retrySearch(currentUser),
  };
};
