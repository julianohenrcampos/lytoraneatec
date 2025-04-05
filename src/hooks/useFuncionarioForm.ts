
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, addDays } from "date-fns";
import { Funcionario, FuncionarioFormData } from "@/types/funcionario";

const formSchema = z.object({
  // Dados Pessoais
  imagem: z.string().optional(),
  nome_completo: z.string().min(3, "Nome completo é obrigatório"),
  cpf: z.string().min(11, "CPF é obrigatório"),
  data_nascimento: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").min(1, "E-mail é obrigatório"),
  endereco_completo: z.string().min(1, "Endereço é obrigatório"),
  escolaridade: z.string().min(1, "Escolaridade é obrigatória"),
  genero: z.string().min(1, "Gênero é obrigatório"),
  
  // Dados Profissionais
  funcao_id: z.string().nullable().optional(),
  departamento_id: z.string().nullable().optional(),
  centro_custo_id: z.string().nullable().optional(),
  empresa_id: z.string().nullable().optional(),
  equipe_id: z.string().nullable().optional(),
  
  // Dados Contratuais
  data_admissao: z.string().nullable().optional(),
  data_ferias: z.string().nullable().optional(),
  data_demissao: z.string().nullable().optional(),
  status: z.string().default("Ativo"),
  
  // Dados Financeiros
  salario_base: z.coerce.number().min(0).default(0),
  insalubridade: z.coerce.number().min(0).default(0),
  periculosidade: z.coerce.number().min(0).default(0),
  gratificacao: z.coerce.number().min(0).default(0),
  adicional_noturno: z.coerce.number().min(0).default(0),
  custo_passagem: z.coerce.number().min(0).default(0),
  refeicao: z.coerce.number().min(0).default(0),
  diarias: z.coerce.number().min(0).default(0),
});

export function useFuncionarioForm(funcionario: Funcionario | null, isOpen: boolean) {
  const [activeTab, setActiveTab] = useState("pessoal");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  
  // Calculate vacation date based on admission date
  const calculateVacationDate = (admissionDateStr: string | undefined | null): string => {
    if (!admissionDateStr) return "";
    
    try {
      const admissionDate = new Date(admissionDateStr);
      const vacationDate = addDays(admissionDate, 365);
      return format(vacationDate, "yyyy-MM-dd");
    } catch (error) {
      console.error("Error calculating vacation date:", error);
      return "";
    }
  };
  
  // Set initial form values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      imagem: funcionario?.imagem || "",
      nome_completo: funcionario?.nome_completo || "",
      cpf: funcionario?.cpf || "",
      data_nascimento: funcionario?.data_nascimento 
        ? format(new Date(funcionario.data_nascimento), "yyyy-MM-dd") 
        : null,
      email: funcionario?.email || "",
      endereco_completo: funcionario?.endereco_completo || "",
      escolaridade: funcionario?.escolaridade || "",
      genero: funcionario?.genero || "",
      funcao_id: funcionario?.funcao_id || null,
      departamento_id: funcionario?.departamento_id || null,
      centro_custo_id: funcionario?.centro_custo_id || null,
      empresa_id: funcionario?.empresa_id || null,
      equipe_id: funcionario?.equipe_id || null,
      data_admissao: funcionario?.data_admissao 
        ? format(new Date(funcionario.data_admissao), "yyyy-MM-dd") 
        : null,
      data_ferias: funcionario?.data_ferias 
        ? format(new Date(funcionario.data_ferias), "yyyy-MM-dd") 
        : null,
      data_demissao: funcionario?.data_demissao 
        ? format(new Date(funcionario.data_demissao), "yyyy-MM-dd") 
        : null,
      status: funcionario?.status || "Ativo",
      salario_base: funcionario?.salario_base || 0,
      insalubridade: funcionario?.insalubridade || 0,
      periculosidade: funcionario?.periculosidade || 0,
      gratificacao: funcionario?.gratificacao || 0,
      adicional_noturno: funcionario?.adicional_noturno || 0,
      custo_passagem: funcionario?.custo_passagem || 0,
      refeicao: funcionario?.refeicao || 0,
      diarias: funcionario?.diarias || 0,
    },
  });

  useEffect(() => {
    if (isOpen) {
      // Calculate vacation date if admission date exists but vacation date doesn't
      let vacationDate = "";
      if (funcionario?.data_admissao && !funcionario?.data_ferias) {
        vacationDate = calculateVacationDate(funcionario.data_admissao);
      } else if (funcionario?.data_ferias) {
        vacationDate = format(new Date(funcionario.data_ferias), "yyyy-MM-dd");
      }
      
      // Reset form values
      form.reset({
        imagem: funcionario?.imagem || "",
        nome_completo: funcionario?.nome_completo || "",
        cpf: funcionario?.cpf || "",
        data_nascimento: funcionario?.data_nascimento 
          ? format(new Date(funcionario.data_nascimento), "yyyy-MM-dd") 
          : null,
        email: funcionario?.email || "",
        endereco_completo: funcionario?.endereco_completo || "",
        escolaridade: funcionario?.escolaridade || "",
        genero: funcionario?.genero || "",
        funcao_id: funcionario?.funcao_id || null,
        departamento_id: funcionario?.departamento_id || null,
        centro_custo_id: funcionario?.centro_custo_id || null,
        empresa_id: funcionario?.empresa_id || null,
        equipe_id: funcionario?.equipe_id || null,
        data_admissao: funcionario?.data_admissao 
          ? format(new Date(funcionario.data_admissao), "yyyy-MM-dd") 
          : null,
        data_ferias: vacationDate || null,
        data_demissao: funcionario?.data_demissao 
          ? format(new Date(funcionario.data_demissao), "yyyy-MM-dd") 
          : null,
        status: funcionario?.status || "Ativo",
        salario_base: funcionario?.salario_base || 0,
        insalubridade: funcionario?.insalubridade || 0,
        periculosidade: funcionario?.periculosidade || 0,
        gratificacao: funcionario?.gratificacao || 0,
        adicional_noturno: funcionario?.adicional_noturno || 0,
        custo_passagem: funcionario?.custo_passagem || 0,
        refeicao: funcionario?.refeicao || 0,
        diarias: funcionario?.diarias || 0,
      });
      
      // Reset other state
      setActiveTab("pessoal");
      
      if (funcionario?.imagem) {
        setImagePreview(funcionario.imagem);
      } else {
        setImagePreview(null);
        setImageFile(null);
      }
    }
  }, [isOpen, funcionario, form]);

  // Watch admission date changes to update vacation date
  const admissionDate = form.watch("data_admissao");
  useEffect(() => {
    if (admissionDate) {
      const vacationDate = calculateVacationDate(admissionDate);
      if (vacationDate) {
        form.setValue("data_ferias", vacationDate);
      }
    }
  }, [admissionDate, form]);

  return {
    form,
    activeTab,
    setActiveTab,
    imagePreview,
    setImagePreview,
    imageFile,
    setImageFile,
    isUploadingImage,
    setIsUploadingImage,
    formSchema
  };
}
