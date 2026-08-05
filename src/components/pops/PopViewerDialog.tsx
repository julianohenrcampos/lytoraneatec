// Dialog de visualização do PDF do POP.
// Busca o binário via Edge Function (pop-arquivo-blob) e delega ao viewer próprio.

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import PopPdfViewer from './PopPdfViewer';
import { baixarArquivoPop } from '@/services/popsService';
import { formatVersao } from '@/utils/pops/versao';
import type { PopComRascunho } from '@/types/pops';

interface PopViewerDialogProps {
  pop: PopComRascunho | null;
  origem?: 'vigente' | 'rascunho';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PopViewerDialog: React.FC<PopViewerDialogProps> = ({
  pop,
  origem = 'vigente',
  open,
  onOpenChange,
}) => {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pop) {
      setBlob(null);
      setErro(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErro(null);
      try {
        const b = await baixarArquivoPop(pop.id, origem);
        if (!cancelled) setBlob(b);
      } catch (e: any) {
        if (!cancelled) setErro(e?.message || 'Falha ao abrir o documento.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pop, origem]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>
            {pop ? `${pop.codigo} — ${pop.titulo}` : 'Documento'}
          </DialogTitle>
          <DialogDescription>
            {origem === 'rascunho'
              ? 'Revisão em preparação (ainda não publicada).'
              : pop
                ? `Versão vigente ${formatVersao(pop.versao_major, pop.versao_minor)}`
                : ''}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex h-[50vh] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && erro && (
          <div className="flex h-[30vh] items-center justify-center text-sm text-destructive">
            {erro}
          </div>
        )}
        {!loading && !erro && blob && <PopPdfViewer blob={blob} />}
      </DialogContent>
    </Dialog>
  );
};

export default PopViewerDialog;
