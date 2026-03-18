
import React from "react";
import { Form } from "@/components/ui/form";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UseFormReturn, FieldErrors } from "react-hook-form";
import { FuncionarioFormData, Funcionario } from "@/types/funcionario";
import PessoalTab from "./PessoalTab";
import ProfissionalTab from "./ProfissionalTab";
import ContratualTab from "./ContratualTab";
import FinanceiroTab from "./FinanceiroTab";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface FormTabsProps {
  form: UseFormReturn<FuncionarioFormData>;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onSubmit: (data: FuncionarioFormData) => void;
  onClose: () => void;
  isSubmitting: boolean;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  isUploadingImage: boolean;
  setIsUploadingImage: (uploading: boolean) => void;
  funcionarioId?: string;
  funcionario?: Funcionario | null;
}

const FormTabs: React.FC<FormTabsProps> = ({
  form,
  activeTab,
  setActiveTab,
  onSubmit,
  onClose,
  isSubmitting,
  imagePreview,
  setImagePreview,
  imageFile,
  setImageFile,
  isUploadingImage,
  setIsUploadingImage,
  funcionarioId,
  funcionario
}) => {
  // Buscar dados auxiliares
  const { data: funcoes = [], isLoading: isLoadingFuncoes } = useQuery({
    queryKey: ['funcoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_funcoes")
        .select("id, nome_funcao");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: departamentos = [], isLoading: isLoadingDepartamentos } = useQuery({
    queryKey: ['departamentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_departamentos")
        .select("id, nome_departamento");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: centrosCusto = [], isLoading: isLoadingCentrosCusto } = useQuery({
    queryKey: ['centrosCusto'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_centros_custo")
        .select("id, codigo_centro_custo, nome_centro_custo");
      if (error) throw error;
      return data || [];
    }
  });

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ['empresas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_empresas")
        .select("id, nome_empresa");
      if (error) throw error;
      return data || [];
    }
  });

  const { toast } = useToast();

  const handleFormSubmit = (data: FuncionarioFormData) => {
    onSubmit(data);
  };

  const handleInvalidSubmit = (errors: FieldErrors<FuncionarioFormData>) => {
    console.log("❌ Validation errors:", errors);
    
    const errorFields = Object.keys(errors);
    const pessoalFields = ['nome_completo', 'cpf', 'data_nascimento', 'genero', 'email', 'endereco_completo', 'escolaridade'];
    const profissionalFields = ['funcao_id', 'departamento_id', 'centro_custo_id', 'empresa_id', 'matricula'];
    const contratualFields = ['data_admissao', 'data_demissao', 'data_ferias', 'status'];
    const financeiroFields = ['salario_base', 'insalubridade', 'periculosidade', 'gratificacao', 'adicional_noturno', 'custo_passagem', 'refeicao', 'diarias'];

    // Navegar para a aba com o primeiro erro
    if (errorFields.some(f => pessoalFields.includes(f))) {
      setActiveTab("pessoal");
    } else if (errorFields.some(f => profissionalFields.includes(f))) {
      setActiveTab("profissional");
    } else if (errorFields.some(f => contratualFields.includes(f))) {
      setActiveTab("contratual");
    } else if (errorFields.some(f => financeiroFields.includes(f))) {
      setActiveTab("financeiro");
    }

    // Mapear nomes amigáveis para todos os campos com erro
    const fieldLabels: Record<string, string> = {
      nome_completo: "Nome Completo",
      funcao_id: "Função",
      salario_base: "Salário Base",
      insalubridade: "Insalubridade",
      periculosidade: "Periculosidade",
      gratificacao: "Gratificação",
      adicional_noturno: "Adicional Noturno",
      custo_passagem: "Custo com Passagem",
      refeicao: "Refeição",
      diarias: "Diárias",
      email: "Email",
    };

    const messages = errorFields
      .map(f => fieldLabels[f] || f)
      .slice(0, 5);

    const description = messages.length > 0
      ? `Campos com erro: ${messages.join(", ")}${errorFields.length > 5 ? ` e mais ${errorFields.length - 5}` : ""}`
      : "Preencha todos os campos obrigatórios antes de salvar.";

    toast({ title: "Erro de validação", description, variant: "destructive" });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleFormSubmit, handleInvalidSubmit)} className="space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pessoal">Pessoal</TabsTrigger>
            <TabsTrigger value="profissional">Profissional</TabsTrigger>
            <TabsTrigger value="contratual">Contratual</TabsTrigger>
            <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          </TabsList>
          
          <TabsContent value="pessoal">
            <PessoalTab
              form={form}
              funcionario={funcionario}
              onClose={onClose}
              setActiveTab={setActiveTab}
              imagePreview={imagePreview}
              setImagePreview={setImagePreview}
              imageFile={imageFile}
              setImageFile={setImageFile}
              isUploadingImage={isUploadingImage}
              setIsUploadingImage={setIsUploadingImage}
            />
          </TabsContent>
          
          <TabsContent value="profissional">
            <ProfissionalTab
              form={form}
              onClose={onClose}
              setActiveTab={setActiveTab}
              funcoes={funcoes}
              departamentos={departamentos}
              centrosCusto={centrosCusto}
              empresas={empresas}
              isLoadingFuncoes={isLoadingFuncoes}
              isLoadingDepartamentos={isLoadingDepartamentos}
              isLoadingCentrosCusto={isLoadingCentrosCusto}
              isLoadingEmpresas={isLoadingEmpresas}
              funcionarioId={funcionarioId}
            />
          </TabsContent>
          
          <TabsContent value="contratual">
            <ContratualTab
              form={form}
              onClose={onClose}
              setActiveTab={setActiveTab}
            />
          </TabsContent>
          
          <TabsContent value="financeiro">
            <FinanceiroTab
              form={form}
              onClose={onClose}
              setActiveTab={setActiveTab}
              isSubmitting={isSubmitting}
            />
          </TabsContent>
        </Tabs>
      </form>
    </Form>
  );
};

export default FormTabs;
