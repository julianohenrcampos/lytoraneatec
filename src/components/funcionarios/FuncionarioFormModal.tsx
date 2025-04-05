
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Funcionario, FuncionarioFormData } from "@/types/funcionario";
import { useQuery } from "@tanstack/react-query";
import { fetchFuncoes } from "@/services/funcaoService";
import { fetchDepartamentos } from "@/services/departamentoService";
import { getEmpresas } from "@/services/empresaService";
import { useCentrosCusto } from "@/hooks/useCentrosCusto";
import { useFuncionarioForm } from "@/hooks/useFuncionarioForm";
import FormTabs from "./form/FormTabs";
import PessoalTab from "./form/PessoalTab";
import ProfissionalTab from "./form/ProfissionalTab";
import ContratualTab from "./form/ContratualTab";
import FinanceiroTab from "./form/FinanceiroTab";

interface FuncionarioFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcionario: Funcionario | null;
  onSubmit: (data: FuncionarioFormData) => void;
  isSubmitting: boolean;
}

const FuncionarioFormModal: React.FC<FuncionarioFormModalProps> = ({
  isOpen,
  onClose,
  funcionario,
  onSubmit,
  isSubmitting,
}) => {
  const { 
    form, 
    activeTab, 
    setActiveTab,
    imagePreview,
    setImagePreview,
    imageFile,
    setImageFile,
    isUploadingImage,
    setIsUploadingImage
  } = useFuncionarioForm(funcionario, isOpen);

  const { data: funcoes = [], isLoading: isLoadingFuncoes } = useQuery({
    queryKey: ["funcoes"],
    queryFn: () => fetchFuncoes(),
  });

  const { data: departamentos = [], isLoading: isLoadingDepartamentos } = useQuery({
    queryKey: ["departamentos"],
    queryFn: () => fetchDepartamentos(),
  });

  const { centrosCusto = [], isLoading: isLoadingCentrosCusto } = useCentrosCusto();

  const { data: empresas = [], isLoading: isLoadingEmpresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: () => getEmpresas(),
  });

  const handleSubmit = (values: any) => {
    onSubmit(values as FuncionarioFormData);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {funcionario ? "Editar Funcionário" : "Novo Funcionário"}
          </DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormTabs activeTab={activeTab} setActiveTab={setActiveTab}>
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
              />
              
              <ContratualTab 
                form={form}
                onClose={onClose}
                setActiveTab={setActiveTab}
              />
              
              <FinanceiroTab 
                form={form}
                onClose={onClose}
                setActiveTab={setActiveTab}
                isSubmitting={isSubmitting}
              />
            </FormTabs>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default FuncionarioFormModal;
