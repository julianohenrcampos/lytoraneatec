
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  getCurrentBrazilianDate 
} from "@/utils/timezoneUtils";

const funcionarioSchema = z.object({
  nome_completo: z.string().min(1, { message: "Nome completo é obrigatório" }),
  cpf: z.string().optional(),
  rg: z.string().optional(),
  data_nascimento: z.string().nullable().optional(),
  estado_civil: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  endereco: z.string().optional(),
  funcao_id: z.string().min(1, { message: "Função é obrigatória" }),
  departamento_id: z.string().optional(),
  empresa_id: z.string().optional(),
  data_admissao: z.string().nullable().optional(),
  salario: z.number().optional(),
  tipo_contrato: z.string().optional(),
  jornada_trabalho: z.string().optional(),
  data_ferias: z.string().nullable().optional(),
  status: z.string().optional(),
  data_demissao: z.string().nullable().optional(),
  motivo_demissao: z.string().optional(),
  registro_profissional: z.string().optional(),
  especialidade: z.string().optional(),
  observacoes: z.string().optional(),
  conta_banco: z.string().optional(),
  agencia_banco: z.string().optional(),
  banco: z.string().optional(),
  pix: z.string().optional(),
  beneficios: z.string().optional(),
  desconto_vr: z.number().optional(),
  desconto_va: z.number().optional(),
});

export type FuncionarioFormSchema = z.infer<typeof funcionarioSchema>;

export const useFuncionarioForm = (
  funcionario: Funcionario | null,
  isOpen: boolean
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pessoal");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const form = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: {
      nome_completo: "",
      cpf: "",
      rg: "",
      data_nascimento: null,
      estado_civil: "",
      telefone: "",
      email: "",
      endereco: "",
      funcao_id: "",
      departamento_id: "",
      empresa_id: "",
      data_admissao: null,
      salario: undefined,
      tipo_contrato: "",
      jornada_trabalho: "",
      data_ferias: null,
      status: "Ativo",
      data_demissao: null,
      motivo_demissao: "",
      registro_profissional: "",
      especialidade: "",
      observacoes: "",
      conta_banco: "",
      agencia_banco: "",
      banco: "",
      pix: "",
      beneficios: "",
      desconto_vr: undefined,
      desconto_va: undefined,
    },
  });

  useEffect(() => {
    if (funcionario) {
      form.reset({
        nome_completo: funcionario.nome_completo || "",
        cpf: funcionario.cpf || "",
        rg: funcionario.rg || "",
        data_nascimento: funcionario.data_nascimento || null,
        estado_civil: funcionario.estado_civil || "",
        telefone: funcionario.telefone || "",
        email: funcionario.email || "",
        endereco: funcionario.endereco || "",
        funcao_id: funcionario.funcao_id || "",
        departamento_id: funcionario.departamento_id || "",
        empresa_id: funcionario.empresa_id || "",
        data_admissao: funcionario.data_admissao || null,
        salario: funcionario.salario || undefined,
        tipo_contrato: funcionario.tipo_contrato || "",
        jornada_trabalho: funcionario.jornada_trabalho || "",
        data_ferias: funcionario.data_ferias || null,
        status: funcionario.status || "Ativo",
        data_demissao: funcionario.data_demissao || null,
        motivo_demissao: funcionario.motivo_demissao || "",
        registro_profissional: funcionario.registro_profissional || "",
        especialidade: funcionario.especialidade || "",
        observacoes: funcionario.observacoes || "",
        conta_banco: funcionario.conta_banco || "",
        agencia_banco: funcionario.agencia_banco || "",
        banco: funcionario.banco || "",
        pix: funcionario.pix || "",
        beneficios: funcionario.beneficios || "",
        desconto_vr: funcionario.desconto_vr || undefined,
        desconto_va: funcionario.desconto_va || undefined,
      });
      setUploadedImageUrl(funcionario.foto_url || null);
      setImagePreview(funcionario.foto_url || null);
    } else {
      // Para novos funcionários, usar data atual brasileira como padrão para data de admissão
      const hoje = getCurrentBrazilianDate();
      form.setValue("data_admissao", hoje);
    }
  }, [funcionario, form]);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("pessoal");
    }
  }, [isOpen]);

  const onSubmit = async (data: FuncionarioFormData) => {
    setIsSubmitting(true);
    try {
      // Normalizar todas as datas antes de enviar
      const normalizedData = {
        ...data,
        data_nascimento: data.data_nascimento ? formatBrazilianDateToString(normalizeDateToBrazilianNoon(data.data_nascimento)) : null,
        data_admissao: data.data_admissao ? formatBrazilianDateToString(normalizeDateToBrazilianNoon(data.data_admissao)) : null,
        data_ferias: data.data_ferias ? formatBrazilianDateToString(normalizeDateToBrazilianNoon(data.data_ferias)) : null,
        data_demissao: data.data_demissao ? formatBrazilianDateToString(normalizeDateToBrazilianNoon(data.data_demissao)) : null,
        foto_url: uploadedImageUrl,
      };

      if (funcionario && funcionario.id) {
        const { error } = await supabase
          .from('bd_funcionarios')
          .update(normalizedData)
          .eq('id', funcionario.id);

        if (error) throw error;

        toast({
          title: "Funcionário atualizado",
          description: "O funcionário foi atualizado com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('bd_funcionarios')
          .insert(normalizedData);

        if (error) throw error;

        toast({
          title: "Funcionário criado",
          description: "O funcionário foi criado com sucesso.",
        });
      }

      queryClient.invalidateQueries({ queryKey: ['funcionarios'] });
      return true;
    } catch (error) {
      console.error('Error saving funcionario:', error);
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar o funcionário. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    isSubmitting,
    uploadedImageUrl,
    setUploadedImageUrl,
    activeTab,
    setActiveTab,
    imagePreview,
    setImagePreview,
    imageFile,
    setImageFile,
    isUploadingImage,
    setIsUploadingImage,
    onSubmit,
  };
};
