import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { Button } from '@/components/ui/button';
import { Loader2, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface PdfViewerProps {
  blob: Blob;
  fileName?: string;
  onClose: () => void;
}

const PdfViewer: React.FC<PdfViewerProps> = ({ blob, fileName = 'documento.pdf', onClose }) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [zoom, setZoom] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);

  // Load PDF from blob
  useEffect(() => {
    let cancelled = false;
    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      try {
        const arrayBuffer = await blob.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        if (!cancelled) {
          setPdfDoc(pdf);
          setTotalPages(pdf.numPages);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error('Erro ao carregar PDF:', err);
        if (!cancelled) setError('Não foi possível renderizar o PDF.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadPdf();
    return () => { cancelled = true; };
  }, [blob]);

  // Render current page
  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    // Cancel any ongoing render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
    }

    try {
      const page = await pdfDoc.getPage(currentPage);
      const viewport = page.getViewport({ scale: zoom });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport,
      };
      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Erro ao renderizar página:', err);
      }
    }
  }, [pdfDoc, currentPage, zoom]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  const handleDownload = () => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.3, 4));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.3, 0.5));
  const handlePrev = () => setCurrentPage((p) => Math.max(p - 1, 1));
  const handleNext = () => setCurrentPage((p) => Math.min(p + 1, totalPages));

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [totalPages, onClose]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/90">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-background/95 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground truncate max-w-[300px]">
            {fileName}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={handleZoomOut} title="Diminuir zoom">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[50px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" onClick={handleZoomIn} title="Aumentar zoom">
            <ZoomIn className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button variant="ghost" size="sm" onClick={handlePrev} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[70px] text-center">
            {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="sm" onClick={handleNext} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="w-px h-5 bg-border mx-1" />

          <Button variant="ghost" size="sm" onClick={handleDownload} title="Baixar">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose} title="Fechar (Esc)">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto flex items-start justify-center p-4">
        {loading && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-white">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="text-sm">Carregando PDF...</span>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-white">
            <p className="text-sm">{error}</p>
            <Button variant="secondary" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Baixar arquivo
            </Button>
          </div>
        )}

        {!loading && !error && (
          <canvas
            ref={canvasRef}
            className="shadow-2xl"
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        )}
      </div>
    </div>
  );
};

export default PdfViewer;
