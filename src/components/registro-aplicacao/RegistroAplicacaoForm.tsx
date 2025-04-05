
import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, CalendarClock, FileText } from "lucide-react";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { useRegistroAplicacaoForm } from "@/hooks/useRegistroAplicacaoForm";
import { fetchRegistroCargaByListaEntregaId } from "@/services/registroCargaService";
import { useToast } from "@/hooks/use-toast";
import { useFormTabs } from "@/hooks/useFormTabs";
import { getEspessuraStatusClass, getEspessuraStatusText } from "./utils/espessuraUtils";

// Import components
import LoadingIndicator from "./LoadingIndicator";
import EntregaSummary from "./EntregaSummary";
import DadosIniciaisTab from "./form-tabs/DadosIniciaisTab";
import DadosTecnicosTab from "./form-tabs/DadosTecnicosTab";
import FinalizacaoTab from "./form-tabs/FinalizacaoTab";

interface RegistroAplicacaoFormProps {
  isOpen: boolean;
  entrega: ListaProgramacaoEntrega;
  onClose: () => void;
  onSuccess: () => void;
}

const RegistroAplicacaoForm: React.FC<RegistroAplicacaoFormProps> = ({
  isOpen,
  entrega,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const { activeTab, setActiveTab, handleNext, handlePrevious } = useFormTabs();
  const [loadingRegistroCarga, setLoadingRegistroCarga] = useState(false);
  
  const {
    form,
    isLoading,
    calculatedArea,
    calculatedEspessura,
    espessuraStatus,
    onSubmit,
    initializeFromEntrega
  } = useRegistroAplicacaoForm(onSuccess);

  useEffect(() => {
    if (isOpen && entrega) {
      loadRegistroCarga();
    }
  }, [isOpen, entrega]);

  const loadRegistroCarga = async () => {
    setLoadingRegistroCarga(true);
    try {
      const registroCarga = await fetchRegistroCargaByListaEntregaId(entrega.id);
      
      if (!registroCarga) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar o registro de carga associado a esta entrega.",
          variant: "destructive",
        });
        onClose();
        return;
      }
      
      await initializeFromEntrega(entrega, registroCarga);
    } catch (error) {
      console.error("Error loading registro carga:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao carregar os dados do registro.",
        variant: "destructive",
      });
      onClose();
    } finally {
      setLoadingRegistroCarga(false);
    }
  };

  const handleFormSubmit = form.handleSubmit(onSubmit);
  const espessuraStatusClassName = getEspessuraStatusClass(espessuraStatus);
  const getStatusText = () => getEspessuraStatusText(espessuraStatus);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Registro de Aplicação</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Preencha os dados da aplicação de massa asfáltica
          </p>
        </DialogHeader>

        {loadingRegistroCarga ? (
          <LoadingIndicator />
        ) : (
          <>
            <EntregaSummary 
              entrega={entrega}
              calculatedEspessura={calculatedEspessura}
              espessuraStatusClass={espessuraStatusClassName}
              getEspessuraStatusText={getStatusText}
            />

            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados-iniciais" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Dados Iniciais</span>
                </TabsTrigger>
                <TabsTrigger value="dados-tecnicos" className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" />
                  <span>Dados Técnicos</span>
                </TabsTrigger>
                <TabsTrigger value="finalizacao" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Finalização</span>
                </TabsTrigger>
              </TabsList>

              <form onSubmit={handleFormSubmit}>
                <TabsContent value="dados-iniciais" className="mt-4">
                  <DadosIniciaisTab 
                    form={form} 
                    onNext={handleNext} 
                  />
                </TabsContent>

                <TabsContent value="dados-tecnicos" className="mt-4">
                  <DadosTecnicosTab 
                    form={form}
                    onNext={handleNext}
                    onPrevious={handlePrevious}
                    calculatedArea={calculatedArea}
                    calculatedEspessura={calculatedEspessura}
                    espessuraStatusClass={espessuraStatusClassName}
                  />
                </TabsContent>

                <TabsContent value="finalizacao" className="mt-4">
                  <FinalizacaoTab 
                    form={form}
                    onPrevious={handlePrevious}
                    onClose={onClose}
                    isLoading={isLoading}
                  />
                </TabsContent>
              </form>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default RegistroAplicacaoForm;
