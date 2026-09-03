import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { useDecidirSolicEquip } from '@/hooks/equipamentos/useDecidirSolicEquip';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CentralApprovalItem | null;
  mode: 'aprovar' | 'reprovar';
  onSuccess?: () => void;
}

export default function CentralEquipamentoDecisionDialog({ open, onOpenChange, item, mode, onSuccess }: Props) {
  const [comentario, setComentario] = useState('');
  const mutation = useDecidirSolicEquip();

  useEffect(() => { if (open) setComentario(''); }, [open, item?.id, mode]);

  if (!item) return null;

  const isReprovar = mode === 'reprovar';
  const isAutoApproval = mode === 'aprovar' && item.autoApproval;
  const exigeComentario = isReprovar;
  const comentarioValido = !exigeComentario || comentario.trim().length >= 10;

  const handleConfirm = () => {
    mutation.mutate(
      {
        solicitacaoId: item.id,
        decisao: isReprovar ? 'NEGADO' : 'APROVADO',
        comentario: comentario.trim() || null,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
          onSuccess?.();
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isReprovar ? 'Reprovar solicitação' : 'Aprovar solicitação'}
          </DialogTitle>
          <DialogDescription>
            {item.protocolo} — {item.titulo}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            Solicitante: {item.solicitanteNome ?? '—'}
          </div>

          {isAutoApproval && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Você está aprovando uma solicitação criada por você. A justificativa administrativa será auditada.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="equip-decision-comment">
              Comentário {exigeComentario ? <span className="text-destructive">*</span> : <span className="text-muted-foreground">(opcional)</span>}
            </Label>
            <Textarea
              id="equip-decision-comment"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder={exigeComentario ? 'Explique a decisão (mínimo 10 caracteres).' : 'Comentário opcional.'}
              rows={4}
              disabled={mutation.isPending}
            />
            {exigeComentario && !comentarioValido && comentario.length > 0 && (
              <p className="text-xs text-destructive">Mínimo de 10 caracteres.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant={isReprovar ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={mutation.isPending || !comentarioValido}
          >
            {isReprovar ? 'Confirmar reprovação' : 'Confirmar aprovação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
