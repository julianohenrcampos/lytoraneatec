import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { decidirTransferencia } from '@/services/rh/solicitacaoTransferenciaService';
import { TRANSFERENCIA_CENTRAL_QUERY_KEY } from '@/services/central-aprovacoes/transferenciasProvider';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CentralApprovalItem | null;
  mode: 'aprovar' | 'reprovar';
  onSuccess: () => void;
}

const MIN_MOTIVO = 10;

export default function CentralTransferenciaDecisionDialog({ open, onOpenChange, item, mode, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');

  useEffect(() => { if (!open) setMotivo(''); }, [open]);

  const mutation = useMutation({
    mutationFn: () => decidirTransferencia(item!.id, mode === 'aprovar' ? 'APROVAR' : 'REPROVAR', motivo || undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TRANSFERENCIA_CENTRAL_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ['solicitacoes-transferencia'] });
      toast.success(
        mode === 'aprovar'
          ? 'Transferência aprovada. A lotação dos funcionários foi atualizada para o centro de custo de destino.'
          : 'Transferência rejeitada. Nenhuma lotação foi alterada.',
      );
      onOpenChange(false);
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const motivoInvalido = mode === 'reprovar' && motivo.trim().length < MIN_MOTIVO;

  return (
    <Dialog open={open} onOpenChange={(o) => (mutation.isPending ? null : onOpenChange(o))}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{mode === 'aprovar' ? 'Aprovar' : 'Rejeitar'} transferência</DialogTitle>
          <DialogDescription>
            {item?.protocolo} — {item?.titulo}
          </DialogDescription>
        </DialogHeader>
        {mode === 'aprovar' && (
          <p className="text-sm text-muted-foreground">
            Ao confirmar, a lotação de todos os funcionários da solicitação será alterada
            para o centro de custo de destino de forma atômica, com registro no histórico funcional.
          </p>
        )}
        <div className="space-y-1.5">
          <Label>{mode === 'aprovar' ? 'Comentário (opcional)' : 'Motivo da rejeição (obrigatório)'}</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
          {mode === 'reprovar' && motivoInvalido && motivo.length > 0 && (
            <p className="text-xs text-destructive">Mínimo de {MIN_MOTIVO} caracteres.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Voltar
          </Button>
          <Button
            variant={mode === 'reprovar' ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !item || motivoInvalido}
          >
            {mutation.isPending ? 'Processando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
