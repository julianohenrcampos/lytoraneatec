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
import { decidirDesmobilizacao } from '@/services/desmobilizacaoService';
import { DESMOBILIZACAO_INVALIDATE_KEYS } from '@/components/solicitacoes-equipamento/desmobilizacaoQueryKeys';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CentralApprovalItem | null;
  mode: 'aprovar' | 'reprovar';
  onSuccess: () => void;
}

export default function CentralDesmobilizacaoDecisionDialog({ open, onOpenChange, item, mode, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const [motivo, setMotivo] = useState('');

  useEffect(() => { if (!open) setMotivo(''); }, [open]);

  const mutation = useMutation({
    mutationFn: () => decidirDesmobilizacao(item!.id, mode === 'aprovar' ? 'APROVAR' : 'REPROVAR', motivo),
    onSuccess: () => {
      DESMOBILIZACAO_INVALIDATE_KEYS.forEach((key) => queryClient.invalidateQueries({ queryKey: [key] }));
      toast.success(
        mode === 'aprovar'
          ? 'Desmobilização aprovada. Previsão de liberação aplicada, mantendo status Alocado e o centro de custo atual.'
          : 'Desmobilização reprovada. A disponibilidade do ativo não foi alterada.',
      );
      onOpenChange(false);
      onSuccess();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (mutation.isPending ? null : onOpenChange(o))}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{mode === 'aprovar' ? 'Aprovar' : 'Reprovar'} desmobilização</DialogTitle>
          <DialogDescription>
            {item?.titulo} — {item?.centroCustoLabel ?? 'sem centro de custo'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label>{mode === 'aprovar' ? 'Comentário (opcional)' : 'Motivo da reprovação'}</Label>
          <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Voltar
          </Button>
          <Button
            variant={mode === 'reprovar' ? 'destructive' : 'default'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !item}
          >
            {mutation.isPending ? 'Processando...' : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
