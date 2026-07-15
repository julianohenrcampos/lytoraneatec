import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { CentralApprovalItem } from '@/services/central-aprovacoes/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: CentralApprovalItem | null;
  acao: 'REVERTER' | 'CANCELAR';
  onSuccess?: () => void;
}

export default function CentralEquipamentoPostDecisionDialog({
  open, onOpenChange, item, acao, onSuccess,
}: Props) {
  const [comentario, setComentario] = useState('');
  const qc = useQueryClient();

  useEffect(() => { if (open) setComentario(''); }, [open, item?.id, acao]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item) throw new Error('Nenhuma solicitação selecionada.');
      const { data, error } = await supabase.rpc(
        'fn_solic_equip_pos_decisao' as any,
        {
          p_solicitacao_id: item.id,
          p_acao: acao,
          p_comentario: comentario.trim(),
        } as any,
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(acao === 'REVERTER' ? 'Decisão revertida.' : 'Solicitação cancelada.');
      qc.invalidateQueries({ queryKey: ['central-aprovacoes:equipamentos:list'] });
      qc.invalidateQueries({ queryKey: ['central-aprovacoes:equipamentos:minha-acao-count'] });
      qc.invalidateQueries({ queryKey: ['central-aprovacoes:equipamentos:indicadores'] });
      if (item) qc.invalidateQueries({ queryKey: ['central-aprovacoes', 'equipamentos', 'detalhe', item.id] });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Erro ao executar ação.');
    },
  });

  if (!item) return null;
  const isReverter = acao === 'REVERTER';
  const comentarioValido = comentario.trim().length >= 10;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isReverter ? 'Reverter decisão' : 'Cancelar solicitação'}</DialogTitle>
          <DialogDescription>{item.protocolo} — {item.titulo}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {isReverter
                ? 'A solicitação retornará para PENDENTE_APROVACAO. A ação será auditada.'
                : 'A solicitação será marcada como CANCELADA. A ação será auditada.'}
            </AlertDescription>
          </Alert>

          <div className="space-y-1.5">
            <Label htmlFor="posdec-comment">
              Justificativa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="posdec-comment"
              value={comentario}
              onChange={(e) => setComentario(e.target.value)}
              placeholder="Explique a decisão (mínimo 10 caracteres)."
              rows={4}
              disabled={mutation.isPending}
            />
            {!comentarioValido && comentario.length > 0 && (
              <p className="text-xs text-destructive">Mínimo de 10 caracteres.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant={isReverter ? 'default' : 'destructive'}
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !comentarioValido}
          >
            {isReverter ? 'Confirmar reversão' : 'Confirmar cancelamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
