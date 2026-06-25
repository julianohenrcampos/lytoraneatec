
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import { 
  normalizeDateToBrazilianNoon, 
  formatBrazilianDateToString, 
  getCurrentBrazilianDate 
} from "@/utils/timezoneUtils";

const funcionarioSchema = z.object({
  nome_completo: z.string().min(1, { message: "Nome completo é obrigatório" }),
  cpf: z.string().min(1, { message: "CPF é obrigatório" }),
  data_nascimento: z.string().nullable().optional(),
  genero: z.string().optional(),
  escolaridade: z.string().optional(),
  email: z.string().email({ message: "Email inválido" }).optional().or(z.literal("")),
  endereco_completo: z.string().optional(),
  funcao_id: z.string().min(1, { message: "Função é obrigatória" }),
  departamento_id: z.string().optional(),
  empresa_id: z.string().optional(),
  centro_custo_id: z.string().optional(),
  data_admissao: z.string().nullable().optional(),
  salario_base: z.number().min(0, { message: "Salário deve ser positivo" }).optional(),
  data_ferias: z.string().nullable().optional(),
  status: z.enum(["Ativo", "Ativo sem Registro", "Inativo", "Aviso Prévio", "INSS", "Férias"]).optional(),
  tipo_escala: z.enum(["normal", "12x36"], {
    required_error: "Tipo de Escala é obrigatório",
    invalid_type_error: "Tipo de Escala é obrigatório",
  }),
  data_demissao: z.string().nullable().optional(),
  insalubridade: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  periculosidade: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  gratificacao: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  adicional_noturno: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  custo_passagem: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  refeicao: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  diarias: z.number().min(0, { message: "Valor deve ser positivo" }).optional(),
  matricula: z.string().optional(),
  equipe_id: z.string().optional(),
  observacoes: z.string().optional(),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta_corrente: z.string().optional(),
  chave_pix: z.string().optional(),
});

export type FuncionarioFormSchema = z.infer<typeof funcionarioSchema>;

const EMPTY_FUNCIONARIO_DEFAULTS: FuncionarioFormData = {
  nome_completo: "",
  cpf: "",
  data_nascimento: null,
  genero: "",
  matricula: "",
  escolaridade: "",
  email: "",
  endereco_completo: "",
  funcao_id: "",
  departamento_id: "",
  empresa_id: "",
  centro_custo_id: "",
  equipe_id: "",
  data_admissao: null,
  salario_base: undefined,
  data_ferias: null,
  status: "Ativo",
  tipo_escala: "normal",
  data_demissao: null,
  insalubridade: undefined,
  periculosidade: undefined,
  gratificacao: undefined,
  adicional_noturno: undefined,
  custo_passagem: undefined,
  refeicao: undefined,
  diarias: undefined,
  observacoes: "",
  banco: "",
  agencia: "",
  conta_corrente: "",
  chave_pix: "",
};


export const useFuncionarioForm = (
  funcionario: Funcionario | null,
  isOpen: boolean
) => {
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("pessoal");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const form = useForm<FuncionarioFormData>({
    resolver: zodResolver(funcionarioSchema),
    defaultValues: EMPTY_FUNCIONARIO_DEFAULTS,
  });

  useEffect(() => {
    if (funcionario) {
      const next: FuncionarioFormData = {
        nome_completo: funcionario.nome_completo || "",
        cpf: funcionario.cpf || "",
        data_nascimento: funcionario.data_nascimento || null,
        genero: funcionario.genero || "",
        matricula: funcionario.matricula || "",
        escolaridade: funcionario.escolaridade || "",
        email: funcionario.email || "",
        endereco_completo: funcionario.endereco_completo || "",
        funcao_id: funcionario.funcao_id || "",
        departamento_id: funcionario.departamento_id || "",
        empresa_id: funcionario.empresa_id || "",
        centro_custo_id: funcionario.centro_custo_id || "",
        equipe_id: funcionario.equipe_id || "",
        data_admissao: funcionario.data_admissao || null,
        salario_base: funcionario.salario_base ?? undefined,
        data_ferias: funcionario.data_ferias || null,
        status: funcionario.status || "Ativo",
        tipo_escala: (funcionario.tipo_escala === "12x36" ? "12x36" : "normal"),
        data_demissao: funcionario.data_demissao || null,
        insalubridade: funcionario.insalubridade ?? undefined,
        periculosidade: funcionario.periculosidade ?? undefined,
        gratificacao: funcionario.gratificacao ?? undefined,
        adicional_noturno: funcionario.adicional_noturno ?? undefined,
        custo_passagem: funcionario.custo_passagem ?? undefined,
        refeicao: funcionario.refeicao ?? undefined,
        diarias: funcionario.diarias ?? undefined,
        observacoes: funcionario.observacoes || "",
        banco: funcionario.banco || "",
        agencia: funcionario.agencia || "",
        conta_corrente: funcionario.conta_corrente || "",
        chave_pix: funcionario.chave_pix || "",
      };
      form.reset(next);
      setUploadedImageUrl(funcionario.foto_url || null);
      setImagePreview(funcionario.foto_url || null);
      if (import.meta.env.DEV) {
        console.log("[FUNCIONARIOS][FORM_RESET]", {
          modo: "edit",
          funcionarioId: funcionario.id,
          nome: next.nome_completo,
          cpf: next.cpf,
          matricula: next.matricula,
        });
      }
    } else {
      const hoje = getCurrentBrazilianDate();
      form.reset({ ...EMPTY_FUNCIONARIO_DEFAULTS, data_admissao: hoje });
      setUploadedImageUrl(null);
      setImagePreview(null);
      setImageFile(null);
      if (import.meta.env.DEV) {
        console.log("[FUNCIONARIOS][FORM_RESET]", {
          modo: "create",
          funcionarioId: null,
          nome: "",
          cpf: "",
          matricula: "",
        });
      }
    }
  }, [funcionario, form]);

  // Reset tab when modal opens
  useEffect(() => {
    if (isOpen) {
      setActiveTab("pessoal");
    }
  }, [isOpen]);

  return {
    form,
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
  };
};
