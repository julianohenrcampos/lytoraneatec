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
  
  useEffect(() => {
    const loadCurrentUser = async () => {
      try {
        const user = await getCurrentUser();
        setCurrentUser(user);
        
        if (user) {
          console.log("useRequisicaoForm: Current user email:", user.email);
          
          const { data: funcionarios, error } = await supabase
            .from('bd_funcionarios')
            .select('id, nome_completo, email')
            .eq('email', user.email);
            
          if (funcionarios && funcionarios.length > 0) {
            setFuncionarioId(funcionarios[0].id);
            console.log("useRequisicaoForm: Found funcionario ID:", funcionarios[0].id);
          } else {
            console.log("useRequisicaoForm: No funcionario record found with exact email match:", user.email);
            
            // Try a case-insensitive partial match
            const { data: funcionariosInsensitive, error: errorInsensitive } = await supabase
              .from('bd_funcionarios')
              .select('id, nome_completo, email')
              .ilike('email', `%${user.email}%`);
              
            if (funcionariosInsensitive && funcionariosInsensitive.length > 0) {
              setFuncionarioId(funcionariosInsensitive[0].id);
              console.log("useRequisicaoForm: Found funcionario with partial match:", funcionariosInsensitive[0].id);
            }
          }
          
          if (error) {
            console.error("useRequisicaoForm: Error finding funcionario record:", error);
          }
        }
      } catch (error) {
        console.error("useRequisicaoForm: Error loading current user:", error);
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
    setIsSubmitting(true);
    
    try {
      if (!data.engenheiro_id && funcionarioId) {
        data.engenheiro_id = funcionarioId;
      }
      
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
      debugLog("onSubmit - Engenheiro ID", data.engenheiro_id);
      
      if (requisicao && requisicao.id) {
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
        await createRequisicao(
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
          title: "Requisição criada",
          description: "A requisição foi criada com sucesso.",
        });
      }
      
      queryClient.invalidateQueries({ queryKey: ['requisicoes'] });
      onSuccess();
    } catch (error) {
      console.error("Error in onSubmit:", error);
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
  };
};
