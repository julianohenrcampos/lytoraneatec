import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Eye, Download, FileText, Image, FileWarning } from 'lucide-react';
import { valeTransporteService } from '@/services/valeTransporte/valeTransporteService';
import { toast } from 'sonner';
import PdfViewer from './PdfViewer';

interface DocumentoInfo {
  nome: string;
  path: string;
  tipo: 'pdf' | 'imagem';
}

interface AgendamentoDocumentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agendamentoId: string | undefined;
}

export const AgendamentoDocumentosDialog: React.FC<AgendamentoDocumentosDialogProps> = ({
  open,
  onOpenChange,
  agendamentoId,
}) => {
  const [documentos, setDocumentos] = useState<DocumentoInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Fullscreen viewer state
  const [viewerBlob, setViewerBlob] = useState<Blob | null>(null);
  const [viewerType, setViewerType] = useState<'pdf' | 'imagem' | null>(null);
  const [viewerFileName, setViewerFileName] = useState('');
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

  const cleanupViewer = useCallback(() => {
    if (viewerImageUrl) {
      URL.revokeObjectURL(viewerImageUrl);
    }
    setViewerBlob(null);
    setViewerType(null);
    setViewerFileName('');
    setViewerImageUrl(null);
  }, [viewerImageUrl]);

  useEffect(() => {
    if (open && agendamentoId) {
      fetchDocumentos();
    } else {
      setDocumentos([]);
      cleanupViewer();
    }
    return () => {
      cleanupViewer();
    };
  }, [open, agendamentoId]);

  const fetchDocumentos = async () => {
    if (!agendamentoId) return;
    setLoading(true);
    try {
      const docs = await valeTransporteService.getDocumentos(agendamentoId);
      setDocumentos(docs);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
      toast.error('Erro ao carregar documentos');
    } finally {
      setLoading(false);
    }
  };

  const detectType = (blob: Blob, path: string): 'pdf' | 'imagem' => {
    if (blob.type === 'application/pdf') return 'pdf';
    if (blob.type.startsWith('image/')) return 'imagem';
    const ext = path.split('.').pop()?.toLowerCase() || '';
    if (ext === 'pdf') return 'pdf';
    return 'imagem';
  };

  const handlePreview = async (doc: DocumentoInfo) => {
    cleanupViewer();
    setLoadingAction(doc.path);
    try {
      const blob = await valeTransporteService.downloadBlob(doc.path);
      const type = detectType(blob, doc.path);
      const fileName = doc.path.split('/').pop() || doc.nome;

      if (type === 'pdf') {
        setViewerBlob(blob);
        setViewerType('pdf');
        setViewerFileName(fileName);
      } else {
        const url = URL.createObjectURL(blob);
        setViewerImageUrl(url);
        setViewerType('imagem');
        setViewerFileName(fileName);
      }
    } catch (error) {
      console.error('Erro ao gerar preview:', error);
      toast.error('Erro ao gerar pré-visualização do documento');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownload = async (doc: DocumentoInfo) => {
    setLoadingAction(`download-${doc.path}`);
    try {
      const blob = await valeTransporteService.downloadBlob(doc.path);
      const url = URL.createObjectURL(blob);
      const fileName = doc.path.split('/').pop() || 'documento';
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      console.error('Erro ao baixar:', error);
      toast.error('Erro ao baixar documento');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDownloadFromViewer = () => {
    if (viewerBlob) {
      const url = URL.createObjectURL(viewerBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = viewerFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } else if (viewerImageUrl) {
      const link = document.createElement('a');
      link.href = viewerImageUrl;
      link.download = viewerFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const getIcon = (tipo: string) =>
    tipo === 'pdf' ? <FileText className="h-5 w-5 text-destructive" /> : <Image className="h-5 w-5 text-primary" />;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Documentos do Agendamento</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : documentos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <FileWarning className="h-10 w-10" />
              <p className="text-sm">Nenhum documento encontrado para este agendamento.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {documentos.map((doc) => (
                <div key={doc.path} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getIcon(doc.tipo)}
                      <span className="font-medium text-sm">{doc.nome}</span>
                      <Badge variant="secondary" className="text-xs">
                        {doc.tipo === 'pdf' ? 'PDF' : 'Imagem'}
                      </Badge>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(doc)}
                        disabled={loadingAction === doc.path}
                      >
                        {loadingAction === doc.path ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Eye className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5 text-xs">Visualizar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload(doc)}
                        disabled={loadingAction === `download-${doc.path}`}
                      >
                        {loadingAction === `download-${doc.path}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span className="ml-1.5 text-xs">Baixar</span>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen PDF Viewer */}
      {viewerType === 'pdf' && viewerBlob && (
        <PdfViewer
          blob={viewerBlob}
          fileName={viewerFileName}
          onClose={cleanupViewer}
        />
      )}

      {/* Fullscreen Image Viewer */}
      {viewerType === 'imagem' && viewerImageUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
          <div className="flex items-center justify-between px-4 py-2 bg-background/95 border-b border-border shrink-0">
            <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
              {viewerFileName}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleDownloadFromViewer} title="Baixar">
                <Download className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={cleanupViewer} title="Fechar (Esc)">
                ✕
              </Button>
            </div>
          </div>
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={viewerImageUrl}
              alt={viewerFileName}
              className="max-w-full max-h-full object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
};
