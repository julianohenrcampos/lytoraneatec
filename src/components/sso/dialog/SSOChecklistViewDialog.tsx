import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useSSOChecklist } from '@/hooks/sso/useSSOChecklist';
import { SSOChecklistViewHeader } from './SSOChecklistViewHeader';
import { SSOChecklistViewHeaderPDF } from './SSOChecklistViewHeaderPDF';
import { SSONonConformityItem } from './SSONonConformityItem';
import { SSONonConformityPDFItem } from './SSONonConformityPDFItem';
import { Loader2, AlertTriangle, Download, CheckCircle } from 'lucide-react';
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
  const handleExportPDF = async () => {
    if (!checklist) return;
    setIsGeneratingPDF(true);
    toast.loading('Gerando PDF...');
    try {
      const obraName = checklist.bd_centros_custo?.nome_centro_custo || 'Sem_Obra';
      const dataFormatada = format(parseBrazilianDate(checklist.data_inspecao), 'dd-MM-yyyy');
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
    return <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>;
  }
  if (!checklist) {
    return null;
  }

  // Filtrar apenas itens não conformes
  const naoConformidades = checklist.bd_sso_checklist_itens?.filter(item => item.avaliacao === 'Não Conforme') || [];

  // Função para determinar se uma NC é "grande" (precisa de página própria)
  const isLargeNC = (item: typeof naoConformidades[0]) => {
    const evidenciaLonga = (item.evidencia?.length || 0) > 200;
    const muitasFotos = (item.fotos?.length || 0) >= 3;
    return evidenciaLonga || muitasFotos;
  };

  // Agrupar NCs em páginas de forma inteligente
  const groupNCsIntoPages = () => {
    const pages: (typeof naoConformidades)[] = [];
    let currentPage: typeof naoConformidades = [];
    naoConformidades.forEach(nc => {
      if (isLargeNC(nc)) {
        // NC grande vai sozinha na página
        if (currentPage.length > 0) {
          pages.push(currentPage);
          currentPage = [];
        }
        pages.push([nc]);
      } else if (currentPage.length >= 2) {
        // Página cheia (2 NCs), iniciar nova
        pages.push(currentPage);
        currentPage = [nc];
      } else {
        currentPage.push(nc);
      }
    });
    if (currentPage.length > 0) {
      pages.push(currentPage);
    }
    return pages;
  };
  const groupedNCPages = naoConformidades.length > 0 ? groupNCsIntoPages() : [];
  const totalPages = groupedNCPages.length + 1; // +1 para página do cabeçalho

  return <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] p-0">
        <DialogHeader className="px-6 pt-6 flex flex-row items-center justify-between space-y-0">
          <DialogTitle>Relatório de Não Conformidades - MTE_TAC</DialogTitle>
          <Button onClick={handleExportPDF} disabled={isGeneratingPDF || naoConformidades.length === 0} variant="outline" size="sm" className="gap-2">
            <Download className="h-4 w-4" />
            {isGeneratingPDF ? 'Gerando...' : 'Baixar PDF'}
          </Button>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-100px)] px-6 pb-6">
          {/* Container para visualização no dialog (normal) */}
          <div id="sso-nc-report-preview" className="space-y-4 bg-white p-6" style={{
          maxWidth: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          fontSize: '11px',
          lineHeight: '1.4'
        }}>
            <SSOChecklistViewHeader checklist={checklist} totalNaoConformidades={naoConformidades.length} />

            <div className="border-t-2 border-primary my-6" />

            <div className="space-y-4">
              

              {naoConformidades.length === 0 ? <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✅ Nenhuma não conformidade foi identificada nesta inspeção.
                  </AlertDescription>
                </Alert> : naoConformidades.map((item, index) => <SSONonConformityItem key={item.id} item={item} index={index} />)}
            </div>

            <div className="mt-6 pt-3 border-t-2 border-border text-center text-[10px] text-muted-foreground space-y-0.5">
              <p className="font-medium">
                Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
                locale: ptBR
              })}
              </p>
              <p>Sistema de Gestão SSO - MTE_TAC</p>
            </div>
          </div>

          {/* Container oculto para geração do PDF */}
          <div id="sso-pdf-pages" className="hidden">
            {naoConformidades.length > 0 && <>
                {/* Página 1: Capa Executiva - Apenas Cabeçalho (SEM RODAPÉ) */}
                <div className="pdf-page" style={{
              width: '794px',
              minHeight: '1123px',
              padding: '75px 57px 95px 57px',
              backgroundColor: '#ffffff',
              position: 'relative',
              boxSizing: 'border-box',
              fontSize: '12px',
              lineHeight: '1.5'
            }}>
                  <SSOChecklistViewHeaderPDF checklist={checklist} totalNaoConformidades={naoConformidades.length} />
                </div>
                
                {/* Páginas 2+: TODAS as NCs agrupadas inteligentemente */}
                {groupedNCPages.map((pageItems, pageIdx) => {
              const pageNumber = pageIdx + 2; // Começa na página 2

              return <div key={`page-${pageNumber}`} className="pdf-page nc-page" style={{
                width: '794px',
                minHeight: '1123px',
                padding: '57px 57px 95px 57px',
                backgroundColor: '#ffffff',
                position: 'relative',
                boxSizing: 'border-box',
                fontSize: '12px',
                lineHeight: '1.5'
              }}>
                      
                      {/* NCs da página */}
                      <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '24px'
                }}>
                        {pageItems.map(item => {
                    const globalIdx = naoConformidades.findIndex(nc => nc.id === item.id);
                    return <SSONonConformityPDFItem key={item.id} item={item} index={globalIdx} />;
                  })}
                      </div>
                      
                      {/* Rodapé */}
                      <div className="pdf-page-footer" style={{
                  position: 'absolute',
                  bottom: '57px',
                  left: '57px',
                  right: '57px',
                  textAlign: 'center',
                  fontSize: '9px',
                  color: '#6b7280',
                  borderTop: '1px solid #e5e7eb',
                  paddingTop: '8px'
                }}>
                        <p style={{
                    margin: '0 0 4px 0'
                  }}>Página {pageNumber} de {totalPages}</p>
                         <p style={{
                    margin: 0
                  }}>
                           Relatório gerado em {format(new Date(), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR
                    })} | Sistema de Gestão SSO - MTE_TAC
                         </p>
                      </div>
                    </div>;
            })}
              </>}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>;
};