import React, { useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ApontamentoEquipe, ApontamentoEquipeFormValues } from "@/types/apontamentoEquipe";
import { Equipe } from "@/types/equipe";
import { useApontamentoEquipeForm } from "@/hooks/useApontamentoEquipeForm";
import ApontamentoFormHeader from "./ApontamentoFormHeader";
import ApontamentoFormAlerts from "./ApontamentoFormAlerts";
import ColaboradoresSection from "./ColaboradoresSection";

interface ApontamentoEquipeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ApontamentoEquipeFormValues) => void;
  currentApontamento: ApontamentoEquipe | null;
  equipes: Equipe[];
  isLoading: boolean;
  onAvaliarColaborador?: (colaboradorId: string, nomeColaborador: string, equipeId: string) => void;
  canCreateAvaliacao?: boolean;
  daysRemainingForEvaluation?: number;
  avaliacaoStatusMap?: Map<string, {canCreate: boolean, daysRemaining: number}>;
  isAvaliacaoObrigatoria?: boolean;
}

const ApontamentoEquipeForm: React.FC<ApontamentoEquipeFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentApontamento,
  equipes,
  isLoading,
  onAvaliarColaborador,
  avaliacaoStatusMap = new Map(),
  isAvaliacaoObrigatoria = false
}) => {
  const {
    form,
    handleFormSubmit,
    equipeMembers,
    isLoadingMembers,
    apontamentoExistente,
    avaliacoesPendentes,
    avaliacoesCompletas,
    todosColaboradoresAvaliados,
    alertMessage,
    loadEquipeMembers,
    loadExistingApontamento,
    apontamentosCarregados,
    loadingEquipeError
  } = useApontamentoEquipeForm({
    currentApontamento,
    onSubmit,
    avaliacaoStatusMap,
    isAvaliacaoObrigatoria
  });

  const isEditing = !!currentApontamento;
  
  useEffect(() => {
    if (isOpen) {
      const setupForm = async () => {
        try {
          if (currentApontamento) {
            console.log("Modal de edição aberto para apontamento:", currentApontamento);
            
            let dateObject: Date;
            if (typeof currentApontamento.data_registro === 'string') {
              const [year, month, day] = currentApontamento.data_registro.split('-').map(Number);
              dateObject = new Date(year, month - 1, day, 12, 0, 0);
            } else {
              dateObject = currentApontamento.data_registro;
              dateObject.setHours(12, 0, 0, 0);
            }
            
            form.reset({
              equipe_id: currentApontamento.equipe_id,
              data_registro: dateObject,
              colaboradores: []
            });
            
            await loadEquipeMembers(currentApontamento.equipe_id);
            await loadExistingApontamento(
              currentApontamento.equipe_id, 
              dateObject
            );
          }
        } catch (error) {
          console.error("Erro ao configurar o formulário:", error);
        }
      };
      
      setupForm();
    }
  }, [isOpen, currentApontamento]);

  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'equipe_id' && value.equipe_id) {
        console.log("Equipe ID changed, loading members:", value.equipe_id);
        loadEquipeMembers(value.equipe_id);
      }
    });
    
    return () => subscription.unsubscribe();
  }, [form, loadEquipeMembers]);

  useEffect(() => {
    if (isEditing && apontamentosCarregados) {
      console.log("Verificando colaboradores do apontamento carregados:", form.getValues().colaboradores);
    }
  }, [isEditing, apontamentosCarregados, form]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {currentApontamento ? "Editar Apontamento" : "Novo Apontamento"}
          </DialogTitle>
          <DialogDescription>
            {currentApontamento 
              ? "Edite os dados de presença e horários dos colaboradores" 
              : "Registre a presença e horários dos colaboradores da equipe"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(values => handleFormSubmit(values))} className="space-y-6">
            <ApontamentoFormHeader 
              form={form} 
              equipes={equipes} 
              isLoading={isLoading} 
              isEditing={isEditing} 
            />
            
            {loadingEquipeError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Erro</AlertTitle>
                <AlertDescription>
                  {loadingEquipeError}
                </AlertDescription>
              </Alert>
            )}
            
            <ApontamentoFormAlerts 
              apontamentoExistente={apontamentoExistente} 
              isEditing={isEditing} 
              avaliacoesPendentes={avaliacoesPendentes} 
            />
            
            <Separator />
            
            <ColaboradoresSection 
              form={form}
              equipeId={form.getValues().equipe_id}
              isLoadingMembers={isLoadingMembers}
              equipeMembers={equipeMembers}
              onAvaliarColaborador={onAvaliarColaborador}
              avaliacoesCompletas={avaliacoesCompletas}
              avaliacaoStatusMap={avaliacaoStatusMap}
              alertMessage={alertMessage}
              isEditing={isEditing}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={
                  isLoading || 
                  isLoadingMembers || 
                  (apontamentoExistente && !currentApontamento) || 
                  (!todosColaboradoresAvaliados && !currentApontamento && isAvaliacaoObrigatoria) ||
                  !!loadingEquipeError
                }
                className="bg-blue-500 hover:bg-blue-600"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-current border-t-transparent rounded-full" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Apontamento"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoEquipeForm;
