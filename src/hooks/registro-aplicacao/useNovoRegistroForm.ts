
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

// Schema de validação simplificado focado nos campos essenciais
const novoRegistroSchema = z.object({
  data_aplicacao: z.string().min(1, "Data é obrigatória"),
  hora_chegada_local: z.string().min(1, "Hora de chegada é obrigatória"),
  hora_saida_caminhao: z.string().min(1, "Hora de saída é obrigatória"),
  temperatura_chegada: z.number().optional().nullable(),
  anotacoes_apontador: z.string().optional(),
  observacoes_aplicacao: z.string().optional(),
  // Campos técnicos (não obrigatórios para finalização)
  logradouro_nome: z.string().optional(),
  comprimento: z.number().optional(),
  largura_media: z.number().optional(),
  area_aplicada: z.number().optional(),
  tonelada_aplicada: z.number().optional(),
  espessura_aplicada: z.number().optional(),
  bordo: z.enum(["Direito", "Esquerdo", "Centro", "Único", "Embocadura"]).optional(),
  temperatura_aplicacao: z.number().optional(),
  densidade_compactacao: z.number().optional(),
  numero_passadas: z.number().int().optional(),
  equipamento_compactacao: z.string().optional(),
  estaca_inicial: z.number().optional(),
  estaca_final: z.number().optional(),
});

type NovoRegistroFormData = z.infer<typeof novoRegistroSchema>;

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

  const form = useForm<NovoRegistroFormData>({
    resolver: zodResolver(novoRegistroSchema),
    defaultValues: {
      data_aplicacao: format(new Date(), "yyyy-MM-dd"),
      hora_chegada_local: "",
      hora_saida_caminhao: "",
      logradouro_nome: entrega?.logradouro || "",
      comprimento: 0,
      largura_media: 0,
      area_aplicada: 0,
      tonelada_aplicada: 0,
      temperatura_chegada: null,
      anotacoes_apontador: "",
      observacoes_aplicacao: "",
    },
  });

  // Watch para cálculos automáticos
  const comprimento = form.watch("comprimento");
  const largura = form.watch("largura_media");
  const toneladaAplicada = form.watch("tonelada_aplicada");

  // Buscar registro existente quando entrega carregada
  useEffect(() => {
    const buscarRegistroExistente = async () => {
      if (!entrega?.id) return;

      try {
        console.log("🔍 Buscando registro existente para entrega:", entrega.id);
        
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
          form.reset({
            data_aplicacao: registro.data_aplicacao || format(new Date(), "yyyy-MM-dd"),
            hora_chegada_local: registro.hora_chegada_local || "",
            hora_saida_caminhao: registro.hora_saida_caminhao || "",
            temperatura_chegada: registro.temperatura_chegada,
            anotacoes_apontador: registro.anotacoes_apontador || "",
            observacoes_aplicacao: registro.observacoes_gerais || "",
            logradouro_nome: entrega?.logradouro || "",
            comprimento: registro.comprimento || 0,
            largura_media: registro.largura_media || 0,
            area_aplicada: registro.area_calculada || 0,
            tonelada_aplicada: registro.tonelada_aplicada || 0,
            espessura_aplicada: registro.espessura_calculada || 0,
            bordo: registro.bordo,
            temperatura_aplicacao: registro.temperatura_aplicacao,
            estaca_inicial: registro.estaca_inicial,
            estaca_final: registro.estaca_final,
          });

          console.log("✅ Formulário preenchido com dados existentes");
        } else {
          console.log("ℹ️ Nenhum registro existente encontrado");
        }
      } catch (error) {
        console.error("Erro ao buscar registro existente:", error);
      }
    };

    buscarRegistroExistente();
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

    // Validação específica
    if (!data.hora_saida_caminhao?.trim()) {
      console.error("Hora de saída não informada");
      toast({
        title: "Erro",
        description: "Hora de saída do caminhão é obrigatória",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
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

        console.log("Registro atualizado:", registroAtualizado);
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

        console.log("Novo registro criado:", novoRegistroCreated);
        setRegistroExistente(novoRegistroCreated);
        setRegistroAplicacaoId(novoRegistroCreated.id);
      }

      toast({
        title: "Sucesso",
        description: "Aplicação salva com sucesso!",
      });

      console.log("=== SALVAMENTO CONCLUÍDO COM SUCESSO ===");

      if (onSuccess) {
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
    calculatedArea,
    calculatedEspessura,
    registroAplicacaoId,
    registroExistente,
    setRegistroAplicacaoId,
    onSubmit: form.handleSubmit(onSubmit),
  };
};
