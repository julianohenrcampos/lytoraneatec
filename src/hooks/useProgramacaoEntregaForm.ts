
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { fetchOperatingVehicles, fetchApontadorByEquipeId, createProgramacao, updateProgramacao, fetchProgramacaoById } from "@/services/programacaoEntregaService";
import { supabase } from "@/integrations/supabase/client";
import { ProgramacaoEntregaWithItems, ItemFormValues } from "@/types/programacaoEntrega";

const programacaoSchema = z.object({
  requisicao_id: z.string().min(1, "Requisição é obrigatória"),
  centro_custo_id: z.string().optional(),
  data_entrega: z.string().min(1, "Data de entrega é obrigatória"),
  itens: z.array(
    z.object({
      requisicao_id: z.string(),
      logradouro: z.string().min(1, "Logradouro é obrigatório"),
      quantidade_massa: z.number().min(0.1, "Quantidade deve ser maior que zero"),
      caminhao_id: z.string().min(1, "Caminhão é obrigatório"),
      tipo_lancamento: z.string().min(1, "Tipo de lançamento é obrigatório"),
      equipe_id: z.string().min(1, "Equipe é obrigatória"),
      apontador_id: z.string(),
      usina_id: z.string().min(1, "Usina é obrigatória"),
      cancelled: z.boolean().optional(),
      status: z.string().optional(),
      data_entrega: z.string().min(1, "Data de entrega é obrigatória"),
    })
  ),
});

const itemFormSchema = z.object({
  requisicao_id: z.string(),
  logradouro: z.string().min(1, "Logradouro é obrigatório"),
  quantidade_massa: z.number().min(0.1, "Quantidade deve ser maior que zero"),
  caminhao_id: z.string().min(1, "Caminhão é obrigatório"),
  tipo_lancamento: z.string().min(1, "Tipo de lançamento é obrigatório"),
  equipe_id: z.string().min(1, "Equipe é obrigatória"),
  apontador_id: z.string().optional(),
  usina_id: z.string().min(1, "Usina é obrigatória"),
  cancelled: z.boolean().optional(),
  data_entrega: z.string().min(1, "Data de entrega é obrigatória"),
});

type ProgramacaoFormValues = z.infer<typeof programacaoSchema>;
type ItemForm = z.infer<typeof itemFormSchema>;

interface RequisicaoDetails {
  totalRuas: number;
  areaTotal: number;
  pesoTotal: number;
}

const getApontadoresFormatados = (data: any[] | null) => {
  if (!data) return [];
  
  return data.map((item: any) => ({
    id: item.id,
    nome_completo: item.nome_completo || item.email
  }));
};

const getApontadorById = async (apontadorId: string) => {
  try {
    const response = await supabase
      .from("bd_funcionarios")
      .select("id, nome_completo")
      .eq("id", apontadorId)
      .single();

    if (response.error) {
      console.error("Error fetching apontador:", response.error);
      throw response.error;
    }

    return response.data || null;
  } catch (error) {
    console.error("Error in getApontadorById:", error);
    return null;
  }
};

export const useProgramacaoEntregaForm = (initialData?: any, onSuccess?: () => void) => {
  const [requisicoes, setRequisicoes] = useState<any[]>([]);
  const [logradouros, setLogradouros] = useState<any[]>([]);
  const [equipes, setEquipes] = useState<any[]>([]);
  const [usinas, setUsinas] = useState<any[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedRequisicaoId, setSelectedRequisicaoId] = useState<string | null>(null);
  const [selectedEquipeId, setSelectedEquipeId] = useState<string | null>(null);
  const [requisicaoDetails, setRequisicaoDetails] = useState<RequisicaoDetails>({
    totalRuas: 0,
    areaTotal: 0,
    pesoTotal: 0,
  });

  const { data: caminhoes = [] } = useQuery({
    queryKey: ['operating-vehicles'],
    queryFn: fetchOperatingVehicles,
  });

  const form = useForm<ProgramacaoFormValues>({
    resolver: zodResolver(programacaoSchema),
    defaultValues: {
      requisicao_id: initialData?.requisicao_id || "",
      centro_custo_id: initialData?.centro_custo_id || "",
      data_entrega: initialData?.data_entrega || "",
      itens: initialData?.itens.map(item => ({
        requisicao_id: item.requisicao_id,
        logradouro: item.logradouro,
        quantidade_massa: item.quantidade_massa,
        caminhao_id: item.caminhao_id,
        tipo_lancamento: item.tipo_lancamento,
        equipe_id: item.equipe_id,
        apontador_id: item.apontador_id,
        usina_id: item.usina_id,
        cancelled: item.status === 'Cancelada',
        status: item.status,
        data_entrega: item.data_entrega,
      })) || [],
    },
  });

  const itemForm = useForm<ItemForm>({
    resolver: zodResolver(itemFormSchema),
    defaultValues: {
      requisicao_id: "",
      logradouro: "",
      quantidade_massa: 0,
      caminhao_id: "",
      tipo_lancamento: "",
      equipe_id: "",
      apontador_id: "",
      usina_id: "",
      cancelled: false,
      data_entrega: form.watch("data_entrega"),
    },
  });

  const watchRequisicaoId = form.watch("requisicao_id");
  const watchItens = form.watch("itens");
  
  useEffect(() => {
    if (watchRequisicaoId && watchRequisicaoId !== selectedRequisicaoId) {
      setSelectedRequisicaoId(watchRequisicaoId);
      
      const fetchRequisicao = async () => {
        const { data: requisicao, error } = await supabase
          .from('bd_requisicoes')
          .select("centro_custo_id")
          .eq("id", watchRequisicaoId)
          .maybeSingle();
          
        if (error) {
          console.error("Erro ao buscar requisição:", error);
          return;
        }
        
        if (requisicao) {
          form.setValue("centro_custo_id", requisicao.centro_custo_id);
        }
      };
      
      const fetchLogradouros = async () => {
        try {
          const { data, error } = await supabase
            .from('bd_ruas_requisicao')
            .select("id, logradouro, bairro, volume, area")
            .eq("requisicao_id", watchRequisicaoId);
            
          if (error) throw error;
          setLogradouros(data || []);
          
          if (data && data.length > 0) {
            const areaTotal = data.reduce((sum, rua) => sum + (parseFloat(rua.area) || 0), 0);
            const pesoTotal = data.reduce((sum, rua) => sum + (parseFloat(rua.volume) || 0), 0);
            
            console.log("Volume total das ruas:", pesoTotal);
            
            setRequisicaoDetails({
              totalRuas: data.length,
              areaTotal: areaTotal,
              pesoTotal: pesoTotal,
            });
          }
          
          itemForm.reset({
            requisicao_id: watchRequisicaoId,
            logradouro: "",
            quantidade_massa: 0,
            caminhao_id: "",
            tipo_lancamento: "",
            equipe_id: "",
            apontador_id: "",
            usina_id: "",
            cancelled: false,
            data_entrega: form.watch("data_entrega"),
          });
        } catch (error) {
          console.error("Erro ao buscar logradouros:", error);
          toast.error("Erro ao buscar logradouros");
        }
      };
      
      fetchRequisicao();
      fetchLogradouros();
    }
  }, [watchRequisicaoId]);

  const watchEquipeId = itemForm.watch("equipe_id");
  
  useEffect(() => {
    if (watchEquipeId && watchEquipeId !== selectedEquipeId) {
      setSelectedEquipeId(watchEquipeId);
      
      const fetchApontador = async () => {
        try {
          const apontador = await fetchApontadorByEquipeId(watchEquipeId);
          
          if (apontador) {
            // Check if apontador is an array and has at least one item
            if (Array.isArray(apontador) && apontador.length > 0) {
              const firstItem = apontador[0];
              if (firstItem && typeof firstItem === 'object' && firstItem !== null) {
                // Check if id property exists in the firstItem
                if ('id' in firstItem && firstItem.id) {
                  // Ensure the ID is a string
                  const apontadorId = String(firstItem.id);
                  itemForm.setValue("apontador_id", apontadorId);
                }
              }
            } 
            // Check if apontador is an object with an id property
            else if (apontador && typeof apontador === 'object' && apontador !== null) {
              if ('id' in apontador && apontador.id) {
                // Ensure the ID is a string
                const apontadorId = String(apontador.id);
                itemForm.setValue("apontador_id", apontadorId);
              }
            }
          }
        } catch (error) {
          console.error("Erro ao buscar apontador:", error);
        }
      };
      
      fetchApontador();
    }
  }, [watchEquipeId]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: reqData, error: reqError } = await supabase
          .from('bd_requisicoes')
          .select(`
            id, 
            numero, 
            centro_custo_id,
            centro_custo:bd_centros_custo(id, nome_centro_custo, codigo_centro_custo)
          `);
          
        if (reqError) throw reqError;
        setRequisicoes(reqData || []);
        
        const { data: eqData, error: eqError } = await supabase
          .from('bd_equipes')
          .select(`
            id, 
            nome_equipe, 
            apontador_id,
            apontador:bd_funcionarios!bd_equipes_apontador_id_fkey(id, nome_completo)
          `);
          
        if (eqError) throw eqError;
        setEquipes(eqData || []);
        
        const { data: usData, error: usError } = await supabase
          .from('bd_usinas')
          .select("id, nome_usina");
          
        if (usError) throw usError;
        setUsinas(usData || []);
        
        if (initialData) {
          setSelectedRequisicaoId(initialData.requisicao_id);
          
          const { data, error } = await supabase
            .from('bd_ruas_requisicao')
            .select("id, logradouro, bairro, volume, area")
            .eq("requisicao_id", initialData.requisicao_id);
            
          if (error) throw error;
          setLogradouros(data || []);
          
          if (data && data.length > 0) {
            const areaTotal = data.reduce((sum, rua) => sum + (parseFloat(rua.area) || 0), 0);
            const pesoTotal = data.reduce((sum, rua) => sum + (parseFloat(rua.volume) || 0), 0);
            
            console.log("Volume total das ruas (edição):", pesoTotal);
            
            setRequisicaoDetails({
              totalRuas: data.length,
              areaTotal: areaTotal,
              pesoTotal: pesoTotal,
            });
          }
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error);
        toast.error("Erro ao carregar dados");
      }
    };
    
    fetchData();
  }, [initialData]);

  const calculateProgrammedQuantity = () => {
    return watchItens.reduce((sum, item) => {
      if (!item.cancelled) {
        return sum + (item.quantidade_massa || 0);
      }
      return sum;
    }, 0);
  };

  const addItem = (values: ItemForm) => {
    const newItem = {
      ...values,
      status: values.cancelled ? 'Cancelada' : 'Pendente',
    };
    
    const currentItems = form.getValues("itens") || [];
    form.setValue("itens", [...currentItems, newItem]);
    
    itemForm.reset({
      requisicao_id: watchRequisicaoId || "",
      logradouro: "",
      quantidade_massa: 0,
      caminhao_id: "",
      tipo_lancamento: "",
      equipe_id: "",
      apontador_id: "",
      usina_id: "",
      cancelled: false,
      data_entrega: form.watch("data_entrega"),
    });
    
    setIsAddingItem(false);
    toast.success("Item adicionado com sucesso");
  };

  const removeItem = (index: number) => {
    const currentItems = form.getValues("itens");
    const newItems = currentItems.filter((_, i) => i !== index);
    form.setValue("itens", newItems);
  };

  const cancelItem = (index: number) => {
    const currentItems = form.getValues("itens");
    const newItems = [...currentItems];
    newItems[index] = {
      ...newItems[index],
      cancelled: true,
      status: 'Cancelada'
    };
    form.setValue("itens", newItems);
  };

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    
    try {
      if (!data.itens || data.itens.length === 0) {
        toast.error("Adicione pelo menos uma entrega");
        setIsSubmitting(false);
        return;
      }
      
      const allCancelled = data.itens.every(item => item.cancelled);
      if (allCancelled) {
        toast.error("Todas as entregas estão canceladas");
        setIsSubmitting(false);
        return;
      }
      
      const programacaoData = {
        requisicao_id: data.requisicao_id,
        centro_custo_id: data.centro_custo_id || "",
        data_entrega: data.data_entrega,
      };
      
      if (initialData) {
        await updateProgramacao(
          initialData.id,
          programacaoData,
          data.itens as ItemFormValues[]
        );
        toast.success("Programação atualizada com sucesso");
      } else {
        await createProgramacao(
          programacaoData,
          data.itens as ItemFormValues[]
        );
        toast.success("Programação criada com sucesso");
      }
      
      onSuccess();
    } catch (error) {
      console.error("Erro ao salvar programação:", error);
      toast.error("Erro ao salvar programação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    itemForm,
    isSubmitting,
    isAddingItem,
    setIsAddingItem,
    onSubmit: handleSubmit,
    addItem,
    removeItem,
    cancelItem,
    requisicoes,
    logradouros,
    equipes,
    usinas,
    caminhoes,
    selectedRequisicaoId,
    selectedEquipeId,
    requisicaoDetails,
    calculateProgrammedQuantity,
    watchItens
  };
};
