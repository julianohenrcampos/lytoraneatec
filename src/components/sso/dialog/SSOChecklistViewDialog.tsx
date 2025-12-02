import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useSSOChecklist } from '@/hooks/sso/useSSOChecklist';
import { SSOChecklistViewHeader } from './SSOChecklistViewHeader';
import { SSONonConformityItem } from './SSONonConformityItem';
import { Loader2, Download, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateSSOReportPDF } from '@/services/pdfService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseBrazilianDate } from '@/utils/timezoneUtils';

interface SSOChecklistViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId?: string;
}

export const SSOChecklistViewDialog = ({
  open,
  onOpenChange,
  checklistId
}: SSOChecklistViewDialogProps) => {
  const {
    checklist,
    isLoading
  } = useSSOChecklist(checklistId);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  // Filtrar apenas itens não conformes
  const naoConformidades = checklist?.bd_sso_checklist_itens?.filter(item => item.avaliacao === 'Não Conforme') || [];

  const handleExportPDF = async () => {
    if (!checklist) return;
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Gerando PDF profissional...', { duration: Infinity });
    
    try {
      const obraName = checklist.bd_centros_custo?.nome_centro_custo || 'Sem_Obra';
      const dataFormatada = format(parseBrazilianDate(checklist.data_inspecao), 'dd-MM-yyyy');
      const fileName = `Relatorio_NC_SSO_${obraName.replace(/[^a-zA-Z0-9]/g, '_')}_${dataFormatada}`;
      
      await generateSSOReportPDF(checklist, naoConformidades, fileName);
      
      toast.dismiss(toastId);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.dismiss(toastId);
      toast.error('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!checklist) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Relatório de Não Conformidades - MTE_TAC</DialogTitle>
          <Button 
            onClick={handleExportPDF} 
            disabled={isGeneratingPDF || naoConformidades.length === 0} 
            variant="outline" 
            size="sm" 
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {isGeneratingPDF ? 'Gerando...' : 'Baixar PDF'}
          </Button>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] px-6 pb-6">
          {/* Container para visualização no dialog */}
          <div className="space-y-4 bg-white p-6" style={{
            maxWidth: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            fontSize: '11px',
            lineHeight: '1.4'
          }}>
            <SSOChecklistViewHeader 
              checklist={checklist} 
              totalNaoConformidades={naoConformidades.length} 
            />

            <div className="border-t-2 border-primary my-6" />

            <div className="space-y-4">
              {naoConformidades.length === 0 ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✅ Nenhuma não conformidade foi identificada nesta inspeção.
                  </AlertDescription>
                </Alert>
              ) : (
                naoConformidades.map((item, index) => (
                  <SSONonConformityItem key={item.id} item={item} index={index} />
                ))
              )}
            </div>

            <div className="mt-6 pt-3 border-t-2 border-border text-center text-[10px] text-muted-foreground space-y-0.5">
              <p className="font-medium">
                Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p>Sistema de Gestão SSO - MTE_TAC</p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
