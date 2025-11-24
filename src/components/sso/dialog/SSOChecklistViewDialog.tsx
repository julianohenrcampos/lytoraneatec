import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSSOChecklist } from '@/hooks/sso/useSSOChecklist';
import { SSOChecklistViewHeader } from './SSOChecklistViewHeader';
import { SSONonConformityItem } from './SSONonConformityItem';
import { Loader2, AlertTriangle, Download, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { generateSSOReportPDF } from '@/services/pdfService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SSOChecklistViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistId?: string;
}

export const SSOChecklistViewDialog = ({
  open,
  onOpenChange,
  checklistId,
}: SSOChecklistViewDialogProps) => {
  const { checklist, isLoading } = useSSOChecklist(checklistId);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleExportPDF = async () => {
    if (!checklist) return;
    
    setIsGeneratingPDF(true);
    toast.loading('Gerando PDF...');
    
    try {
      const obraName = checklist.bd_centros_custo?.nome_centro_custo || 'Sem_Obra';
      const dataFormatada = format(new Date(checklist.data_inspecao), 'dd-MM-yyyy');
      
      await generateSSOReportPDF(obraName, dataFormatada);
      
      toast.dismiss();
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.dismiss();
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

  // Filtrar apenas itens não conformes
  const naoConformidades =
    checklist.bd_sso_checklist_itens?.filter(
      (item) => item.avaliacao === 'Não Conforme'
    ) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Relatório de Não Conformidades - SSO NR-18</DialogTitle>
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
          {/* Container para visualização no dialog (normal) */}
          <div 
            id="sso-nc-report-preview" 
            className="space-y-4 bg-white p-6"
            style={{
              maxWidth: '210mm',
              minHeight: '297mm',
              margin: '0 auto',
              fontSize: '11px',
              lineHeight: '1.4'
            }}
          >
            <SSOChecklistViewHeader checklist={checklist} />

            <div className="border-t-2 border-primary my-6" />

            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b-2 border-border">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <h2 className="font-bold text-lg text-foreground flex-1">
                  Não Conformidades Identificadas
                </h2>
                <Badge variant="destructive" className="text-xs font-bold px-2.5 py-0.5">
                  {naoConformidades.length} {naoConformidades.length === 1 ? 'item' : 'itens'}
                </Badge>
              </div>

              {naoConformidades.length === 0 ? (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✅ Nenhuma não conformidade foi identificada nesta inspeção.
                  </AlertDescription>
                </Alert>
              ) : (
                naoConformidades.map((item, index) => (
                  <SSONonConformityItem
                    key={item.id}
                    item={item}
                    index={index}
                  />
                ))
              )}
            </div>

            <div className="mt-6 pt-3 border-t-2 border-border text-center text-[10px] text-muted-foreground space-y-0.5">
              <p className="font-medium">
                Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
              <p>Sistema de Gestão SSO - NR-18</p>
            </div>
          </div>

          {/* Container oculto para geração do PDF */}
          <div id="sso-pdf-pages" className="hidden">
            {naoConformidades.length > 0 && (() => {
              const pages: JSX.Element[] = [];
              
              // Página 1: Cabeçalho + primeira NC
              pages.push(
                <div
                  key="page-1"
                  className="pdf-page bg-white p-6 relative"
                  style={{
                    width: '210mm',
                    height: '297mm',
                    pageBreakAfter: 'always',
                    fontSize: '11px',
                    lineHeight: '1.4'
                  }}
                >
                  <SSOChecklistViewHeader checklist={checklist} />
                  <div className="border-t-2 border-primary my-4" />
                  
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-destructive" />
                    <h2 className="font-bold text-lg">Não Conformidades Identificadas</h2>
                  </div>
                  
                  <SSONonConformityItem item={naoConformidades[0]} index={0} />
                  
                  <div className="absolute bottom-6 left-6 right-6 text-center text-[10px] text-muted-foreground border-t pt-2">
                    <p>Página 1 de {Math.ceil(naoConformidades.length / 2)}</p>
                    <p className="mt-1">
                      Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
              
              // Páginas seguintes: 2 NCs por página
              for (let i = 1; i < naoConformidades.length; i += 2) {
                const pageNumber = Math.floor(i / 2) + 2;
                const totalPages = Math.ceil(naoConformidades.length / 2);
                
                pages.push(
                  <div
                    key={`page-${pageNumber}`}
                    className="pdf-page bg-white p-6 relative"
                    style={{
                      width: '210mm',
                      height: '297mm',
                      pageBreakAfter: 'always',
                      fontSize: '11px',
                      lineHeight: '1.4'
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="h-5 w-5 text-destructive" />
                      <h2 className="font-bold text-lg">Não Conformidades Identificadas</h2>
                    </div>
                    
                    <div className="space-y-3">
                      <SSONonConformityItem item={naoConformidades[i]} index={i} />
                      
                      {i + 1 < naoConformidades.length && (
                        <SSONonConformityItem item={naoConformidades[i + 1]} index={i + 1} />
                      )}
                    </div>
                    
                    <div className="absolute bottom-6 left-6 right-6 text-center text-[10px] text-muted-foreground border-t pt-2">
                      <p>Página {pageNumber} de {totalPages}</p>
                      <p className="mt-1">
                        Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                );
              }
              
              return pages;
            })()}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
