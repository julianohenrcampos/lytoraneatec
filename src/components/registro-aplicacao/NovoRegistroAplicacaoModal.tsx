import React, { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, MapPin, FileText, Eye } from "lucide-react";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga } from "@/types/registroCargas";
import { useToast } from "@/hooks/use-toast";
import { fetchRegistroCargaByListaEntregaId } from "@/services/registroCargaService";
import { useMultipleApplications } from "@/hooks/registro-aplicacao/useMultipleApplications";
import { useNovoRegistroForm } from "@/hooks/registro-aplicacao/useNovoRegistroForm";

// Import components
import EntregaHeader from "./EntregaHeader";
import NovoRegistroDadosIniciaisTab from "./form-tabs/NovoRegistroDadosIniciaisTab";
import DadosTecnicosMultiplaAplicacaoTab from "./form-tabs/DadosTecnicosMultiplaAplicacaoTab";
import NovoRegistroFinalizacaoTab from "./form-tabs/NovoRegistroFinalizacaoTab";

interface NovoRegistroAplicacaoModalProps {
  isOpen: boolean;
  entrega: ListaProgramacaoEntrega | null;
  onClose: () => void;
  onSuccess: () => void;
}

const NovoRegistroAplicacaoModal: React.FC<NovoRegistroAplicacaoModalProps> = ({
  isOpen,
  entrega,
  onClose,
  onSuccess
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("dados-iniciais");
  const [registroCarga, setRegistroCarga] = useState<RegistroCarga | null>(null);
  const [registroAplicacaoId, setRegistroAplicacaoId] = useState<string | null>(null);
  const [loadingCarga, setLoadingCarga] = useState(false);

  // Determine if this is a finalized delivery (read-only mode)
  const isReadOnlyMode = entrega?.status === "Entregue";

  // Use multiple applications hook to get real-time data
  const { cargaInfo, refetch: refetchCargaInfo } = useMultipleApplications(registroCarga?.id);

  // Callback de sucesso otimizado
  const handleFormSuccess = useCallback(() => {
    try {
      if (registroCarga?.id) {
        refetchCargaInfo();
      }
      onSuccess();
    } catch (error) {
      console.error("❌ [MODAL] Erro no callback de sucesso:", error);
    }
  }, [registroCarga?.id, refetchCargaInfo, onSuccess]);

  // Hook do formulário
  const { 
    form, 
    isLoading, 
    isLoadingData, 
    registroExistente,
    onSubmit 
  } = useNovoRegistroForm(
    entrega,
    registroCarga,
    handleFormSuccess
  );

  // Função para carregar dados da carga
  const loadRegistroCarga = useCallback(async () => {
    if (!entrega) return;
    
    setLoadingCarga(true);
    try {
      const cargaData = await fetchRegistroCargaByListaEntregaId(entrega.id);
      if (!cargaData) {
        toast({
          title: "Erro",
          description: "Não foi possível encontrar o registro de carga para esta entrega.",
          variant: "destructive",
        });
        onClose();
        return;
      }
      setRegistroCarga(cargaData);
    } catch (error) {
      console.error("❌ [MODAL] Erro ao carregar registro de carga:", error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados da carga.",
        variant: "destructive",
      });
      onClose();
    } finally {
      setLoadingCarga(false);
    }
  }, [entrega, toast, onClose]);

  // Effect para abrir modal
  useEffect(() => {
    if (isOpen && entrega) {
      loadRegistroCarga();
      setActiveTab("dados-iniciais");
      setRegistroAplicacaoId(null);
    }
  }, [isOpen, entrega, loadRegistroCarga]);

  // Effect para atualizar dados da carga
  useEffect(() => {
    if (registroCarga?.id) {
      refetchCargaInfo();
    }
  }, [registroCarga?.id, refetchCargaInfo]);

  const handleNext = async () => {
    if (activeTab === "dados-iniciais") {
      setActiveTab("dados-tecnicos");
    } else if (activeTab === "dados-tecnicos") {
      setActiveTab("finalizacao");
    }
  };

  const handlePrevious = () => {
    if (activeTab === "finalizacao") {
      setActiveTab("dados-tecnicos");
    } else if (activeTab === "dados-tecnicos") {
      setActiveTab("dados-iniciais");
    }
  };

  const handleRegistroCreated = useCallback((id: string) => {
    setRegistroAplicacaoId(id);
    // Refetch imediato dos dados da carga
    refetchCargaInfo();
  }, [refetchCargaInfo]);

  const handleModalClose = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    }
  }, [onClose]);

  if (!entrega) return null;

  const getModalTitle = () => {
    if (isReadOnlyMode) {
      return "Visualizar Registro de Aplicação";
    }
    return "Novo Registro de Aplicação";
  };

  // Mostrar loading enquanto carrega dados da carga ou dados do formulário
  const isLoadingAllData = loadingCarga || isLoadingData;

  return (
    <Dialog open={isOpen} onOpenChange={handleModalClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isReadOnlyMode && <Eye className="h-5 w-5" />}
            {getModalTitle()}
          </DialogTitle>
          {isReadOnlyMode && (
            <p className="text-sm text-muted-foreground">
              Esta entrega está finalizada e os dados são somente para visualização.
            </p>
          )}
          {registroExistente && !isReadOnlyMode && (
            <p className="text-sm text-blue-600">
              Registro existente carregado. Você pode modificar e salvar as alterações.
            </p>
          )}
        </DialogHeader>

        {isLoadingAllData ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">
              {loadingCarga ? "Carregando dados da carga..." : "Carregando dados do registro..."}
            </span>
          </div>
        ) : (
          <>
            <EntregaHeader 
              entrega={entrega}
              registroCarga={registroCarga}
              cargaInfo={cargaInfo}
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados-iniciais" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>Dados Iniciais</span>
                </TabsTrigger>
                <TabsTrigger value="dados-tecnicos" className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>Aplicações</span>
                </TabsTrigger>
                <TabsTrigger value="finalizacao" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Finalização</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados-iniciais" className="mt-6">
                <NovoRegistroDadosIniciaisTab 
                  form={form}
                  entrega={entrega}
                  registroCarga={registroCarga}
                  onNext={handleNext}
                  isReadOnly={isReadOnlyMode}
                />
              </TabsContent>

              <TabsContent value="dados-tecnicos" className="mt-6">
                <DadosTecnicosMultiplaAplicacaoTab 
                  form={form}
                  onNext={handleNext}
                  onPrevious={handlePrevious}
                  registroCarga={registroCarga}
                  registroAplicacaoId={registroAplicacaoId}
                  listaEntregaId={entrega.id}
                  entrega={entrega}
                  onRegistroCreated={handleRegistroCreated}
                  isReadOnly={isReadOnlyMode}
                />
              </TabsContent>

              <TabsContent value="finalizacao" className="mt-6">
                <NovoRegistroFinalizacaoTab 
                  form={form}
                  entrega={entrega}
                  registroCarga={registroCarga}
                  onPrevious={handlePrevious}
                  onClose={onClose}
                  onSubmit={onSubmit}
                  isLoading={isLoading}
                  isReadOnly={isReadOnlyMode}
                  cargaInfo={cargaInfo}
                  registroExistente={registroExistente}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NovoRegistroAplicacaoModal;
