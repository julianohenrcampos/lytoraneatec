import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { updateRegistroAplicacao } from "@/services/registro-aplicacao";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { supabase } from "@/integrations/supabase/client";

// Schema de validação simplificado e mais permissivo
const novoRegistroSchema = z.object({
  data_aplicacao: z.string().min(1, "Data é obrigatória"),
  hora_chegada_local: z.string().min(1, "Hora de chegada é obrigatória"),
  hora_saida_caminhao: z.string().min(1, "Hora de saída é obrigatória"),
  temperatura_chegada: z.union([z.number(), z.null(), z.undefined()]).optional(),
  anotacoes_apontador: z.string().optional().nullable(),
  observacoes_aplicacao: z.string().optional().nullable(),
  // Campos técnicos (todos opcionais)
  logradouro_nome: z.string().optional().nullable(),
  comprimento: z.union([z.number(), z.null(), z.undefined()]).optional(),
  largura_media: z.union([z.number(), z.null(), z.undefined()]).optional(),
  area_aplicada: z.union([z.number(), z.null(), z.undefined()]).optional(),
  tonelada_aplicada: z.union([z.number(), z.null(), z.undefined()]).optional(),
  espessura_aplicada: z.union([z.number(), z.null(), z.undefined()]).optional(),
  bordo: z.enum(["Direito", "Esquerdo", "Centro", "Único", "Embocadura"]).optional().nullable(),
  temperatura_aplicacao: z.union([z.number(), z.null(), z.undefined()]).optional(),
  densidade_compactacao: z.union([z.number(), z.null(), z.undefined()]).optional(),
  numero_passadas: z.union([z.number().int(), z.null(), z.undefined()]).optional(),
  equipamento_compactacao: z.string().optional().nullable(),
  estaca_inicial: z.union([z.number(), z.null(), z.undefined()]).optional(),
  estaca_final: z.union([z.number(), z.null(), z.undefined()]).optional(),
});

type NovoRegistroFormData = z.infer<typeof novoRegistroSchema>;

// Função para obter valores padrão limpos
const getCleanDefaultValues = (): Partial<NovoRegistroFormData> => ({
  data_aplicacao: format(new Date(), "yyyy-MM-dd"),
  hora_chegada_local: "",
  hora_saida_caminhao: "",
  temperatura_chegada: null,
  anotacoes_apontador: "",
  observacoes_aplicacao: "",
  logradouro_nome: "",
  comprimento: null,
  largura_media: null,
  area_aplicada: null,
  tonelada_aplicada: null,
  espessura_aplicada: null,
  bordo: null,
  temperatura_aplicacao: null,
  densidade_compactacao: null,
  numero_passadas: null,
  equipamento_compactacao: "",
  estaca_inicial: null,
  estaca_final: null,
});

export const useNovoRegistroForm = (
  entrega: ListaProgramacaoEntrega | null,
  registroCarga: RegistroCarga | null,
  onSuccess?: () => void
) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedArea, setCalculatedArea] = useState<number | null>(null);
  const [calculatedEspessura, setCalculatedEspessura] = useState<number | null>(null);
  const [registroAplicacaoId, setRegistroAplicacaoId] = useState<string | null>(null);
  const [registroExistente, setRegistroExistente] = useState<any>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const form = useForm<NovoRegistroFormData>({
    resolver: zodResolver(novoRegistroSchema),
    defaultValues: getCleanDefaultValues(),
    mode: "onChange",
  });

  // Watch para cálculos automáticos
  const comprimento = form.watch("comprimento");
  const largura = form.watch("largura_media");
  const toneladaAplicada = form.watch("tonelada_aplicada");
  const horaChegadaLocal = form.watch("hora_chegada_local");
  const horaSaidaCaminhao = form.watch("hora_saida_caminhao");
  const temperaturaChegada = form.watch("temperatura_chegada");

  // Buscar registro existente com controle de estado
  useEffect(() => {
    const buscarRegistroExistente = async () => {
      if (!entrega?.id || dataLoaded) return;

      setIsLoadingData(true);
      console.log("🔍 Buscando registro existente para entrega:", entrega.id);

      try {
        const { data: registros, error } = await supabase
          .from("bd_registro_apontamento_aplicacao")
          .select("*")
          .eq("lista_entrega_id", entrega.id)
          .order("created_at", { ascending: false })
          .limit(1);

        if (error) {
          console.error("Erro ao buscar registro existente:", error);
          return;
        }

        if (registros && registros.length > 0) {
          const registro = registros[0];
          setRegistroExistente(registro);
          setRegistroAplicacaoId(registro.id);
          
          console.log("📄 Registro existente encontrado:", registro);
          
          // Preencher formulário com dados existentes
          const formData = {
            data_aplicacao: registro.data_aplicacao || format(new Date(), "yyyy-MM-dd"),
            hora_chegada_local: registro.hora_chegada_local || "",
            hora_saida_caminhao: registro.hora_saida_caminhao || "",
            temperatura_chegada: registro.temperatura_chegada || null,
            anotacoes_apontador: registro.anotacoes_apontador || "",
            observacoes_aplicacao: registro.observacoes_gerais || "",
            logradouro_nome: entrega?.logradouro || "",
            comprimento: registro.comprimento || null,
            largura_media: registro.largura_media || null,
            area_aplicada: registro.area_calculada || null,
            tonelada_aplicada: registro.tonelada_aplicada || null,
            espessura_aplicada: registro.espessura_calculada || null,
            bordo: registro.bordo || null,
            temperatura_aplicacao: registro.temperatura_aplicacao || null,
            estaca_inicial: registro.estaca_inicial || null,
            estaca_final: registro.estaca_final || null,
          };

          // Reset do formulário com os dados carregados
          form.reset(formData);
          console.log("✅ Formulário preenchido com dados existentes");
        } else {
          console.log("ℹ️ Nenhum registro existente encontrado - usando valores padrão");
          // Apenas definir o logradouro da entrega atual
          form.setValue("logradouro_nome", entrega?.logradouro || "");
        }

        setDataLoaded(true);
      } catch (error) {
        console.error("Erro ao buscar registro existente:", error);
      } finally {
        setIsLoadingData(false);
      }
    };

    // Reset do estado quando entrega muda
    if (entrega?.id) {
      setDataLoaded(false);
      setRegistroExistente(null);
      setRegistroAplicacaoId(null);
      buscarRegistroExistente();
    }
  }, [entrega?.id, form]);

  // Calcular área automaticamente
  useEffect(() => {
    if (comprimento && largura) {
      const area = comprimento * largura;
      setCalculatedArea(area);
      form.setValue("area_aplicada", area);
    }
  }, [comprimento, largura, form]);

  // Calcular espessura automaticamente
  useEffect(() => {
    if (calculatedArea && toneladaAplicada && calculatedArea > 0) {
      // Fórmula: espessura = (tonelada / área) / 2.4
      const espessura = (toneladaAplicada / calculatedArea) / 2.4;
      setCalculatedEspessura(espessura);
      form.setValue("espessura_aplicada", Number(espessura.toFixed(3)));
    }
  }, [calculatedArea, toneladaAplicada, form]);

  const onSubmit = async (data: NovoRegistroFormData) => {
    console.log("=== INÍCIO SALVAMENTO REGISTRO APLICAÇÃO ===");
    console.log("Dados recebidos:", data);
    console.log("Entrega:", entrega);
    console.log("Registro Carga:", registroCarga);
    console.log("Registro existente:", registroExistente);

    if (!entrega || !registroCarga) {
      console.error("Dados obrigatórios não encontrados");
      toast({
        title: "Erro",
        description: "Dados de entrega ou carga não encontrados",
        variant: "destructive",
      });
      return;
    }

    // Validação específica simplificada
    if (!data.hora_saida_caminhao?.trim()) {
      console.error("Hora de saída não informada");
      toast({
        title: "Erro",
        description: "Hora de saída do caminhão é obrigatória",
        variant: "destructive",
      });
      return;
    }

    if (!data.hora_chegada_local?.trim()) {
      console.error("Hora de chegada não informada");
      toast({
        title: "Erro", 
        description: "Hora de chegada no local é obrigatória",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      let registroSalvo = null;

      if (registroExistente) {
        // Atualizar registro existente
        console.log("📝 Atualizando registro existente:", registroExistente.id);

        const updateData = {
          data_aplicacao: data.data_aplicacao,
          hora_chegada_local: data.hora_chegada_local,
          hora_saida_caminhao: data.hora_saida_caminhao,
          temperatura_chegada: data.temperatura_chegada,
          anotacoes_apontador: data.anotacoes_apontador || null,
          observacoes_gerais: data.observacoes_aplicacao || null,
          status_aplicacao: 'Finalizada',
          tonelada_aplicada: registroCarga.tonelada_real, // Usar toda a massa da carga
          updated_at: new Date().toISOString()
        };

        console.log("Dados para atualização:", updateData);

        const { data: registroAtualizado, error: updateError } = await supabase
          .from("bd_registro_apontamento_aplicacao")
          .update(updateData)
          .eq("id", registroExistente.id)
          .select()
          .single();

        if (updateError) {
          console.error("Erro ao atualizar registro:", updateError);
          throw new Error(`Erro ao atualizar registro: ${updateError.message}`);
        }

        registroSalvo = registroAtualizado;
        console.log("✅ Registro atualizado:", registroAtualizado);
      } else {
        // Criar novo registro
        console.log("🆕 Criando novo registro");
        
        const novoRegistro = {
          lista_entrega_id: entrega.id,
          registro_carga_id: registroCarga.id,
          data_aplicacao: data.data_aplicacao,
          hora_chegada_local: data.hora_chegada_local,
          hora_saida_caminhao: data.hora_saida_caminhao,
          temperatura_chegada: data.temperatura_chegada,
          anotacoes_apontador: data.anotacoes_apontador || null,
          observacoes_gerais: data.observacoes_aplicacao || null,
          status_aplicacao: 'Finalizada',
          tonelada_aplicada: registroCarga.tonelada_real, // Usar toda a massa da carga
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        console.log("Criando novo registro:", novoRegistro);

        const { data: novoRegistroCreated, error: createError } = await supabase
          .from("bd_registro_apontamento_aplicacao")
          .insert(novoRegistro)
          .select()
          .single();

        if (createError) {
          console.error("Erro ao criar registro:", createError);
          throw new Error(`Erro ao criar registro: ${createError.message}`);
        }

        registroSalvo = novoRegistroCreated;
        console.log("✅ Novo registro criado:", novoRegistroCreated);
        setRegistroExistente(novoRegistroCreated);
        setRegistroAplicacaoId(novoRegistroCreated.id);
      }

      // Criar/atualizar detalhe de aplicação usando a nova função
      if (registroSalvo) {
        console.log("📄 Sincronizando detalhes da aplicação");
        
        try {
          const { error: syncError } = await supabase.rpc(
            'sincronizar_aplicacao_formulario_novo',
            {
              registro_aplicacao_id: registroSalvo.id,
              tonelada_aplicada_formulario: registroCarga.tonelada_real
            }
          );

          if (syncError) {
            console.warn("Aviso ao sincronizar detalhes:", syncError);
            // Não falha por causa disso, apenas logga
          } else {
            console.log("✅ Detalhes sincronizados com sucesso");
          }
        } catch (syncError) {
          console.warn("Erro ao sincronizar detalhes, mas continuando:", syncError);
        }
      }

      // Atualizar status da entrega manualmente para "Entregue"
      if (data.hora_saida_caminhao?.trim()) {
        console.log("🔄 Atualizando status da entrega para 'Entregue'");
        try {
          const { error: statusError } = await supabase
            .from("bd_lista_programacao_entrega")
            .update({ status: 'Entregue' })
            .eq("id", entrega.id);

          if (statusError) {
            console.warn("⚠️ Erro ao atualizar status, mas registro foi salvo:", statusError);
          } else {
            console.log("✅ Status da entrega atualizado para 'Entregue'");
          }
        } catch (statusError) {
          console.warn("⚠️ Erro ao atualizar status, mas registro foi salvo:", statusError);
        }
      }

      toast({
        title: "Sucesso",
        description: "Aplicação salva com sucesso!",
      });

      console.log("=== SALVAMENTO CONCLUÍDO COM SUCESSO ===");

      // Chamar callback de sucesso
      if (onSuccess) {
        console.log("🔄 Chamando callback onSuccess");
        onSuccess();
      }
    } catch (error) {
      console.error("=== ERRO NO SALVAMENTO ===");
      console.error("Erro:", error);
      
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Erro ao salvar a aplicação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    isLoading,
    isLoadingData,
    dataLoaded,
    calculatedArea,
    calculatedEspessura,
    registroAplicacaoId,
    registroExistente,
    setRegistroAplicacaoId,
    onSubmit: form.handleSubmit(onSubmit),
  };
};
