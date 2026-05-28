import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileDown } from 'lucide-react';
import { Desligamento } from '@/types/desligamento';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: Desligamento | null;
  /** Recebe valores manuais (não persistidos) e gera o PDF. */
  onGenerate: (params: { valor_rescisao: number | null; data_exame: string | null }) => void;
}

export const PdfDesligamentoDialog: React.FC<Props> = ({ open, onOpenChange, target, onGenerate }) => {
  const [valorStr, setValorStr] = useState('');
  const [dataExame, setDataExame] = useState('');

  useEffect(() => {
    if (open) { setValorStr(''); setDataExame(''); }
  }, [open]);

  const handleGerar = () => {
    const normalized = valorStr.replace(/\./g, '').replace(',', '.').trim();
    const v = normalized === '' ? null : Number(normalized);
    onGenerate({
      valor_rescisao: v != null && !Number.isNaN(v) ? v : null,
      data_exame: dataExame || null,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar PDF da Solicitação</DialogTitle>
        </DialogHeader>

        {target?.bd_funcionarios && (
          <div className="p-3 bg-muted/40 rounded-md text-sm">
            <p className="font-medium">{target.bd_funcionarios.nome_completo}</p>
            <p className="text-xs text-muted-foreground">
              CPF: {target.bd_funcionarios.cpf}
              {target.bd_funcionarios.matricula ? ` · Matrícula: ${target.bd_funcionarios.matricula}` : ''}
            </p>
          </div>
        )}

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="valor_rescisao">Valor da Rescisão (R$)</Label>
            <Input
              id="valor_rescisao"
              inputMode="decimal"
              placeholder="Ex.: 4.250,00"
              value={valorStr}
              onChange={e => setValorStr(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Informado manualmente pelo RH. Não é persistido no banco.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="data_exame">Data do Exame Demissional</Label>
            <Input
              id="data_exame"
              type="date"
              value={dataExame}
              onChange={e => setDataExame(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Aparece apenas no PDF. Não é persistido nesta versão.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleGerar}>
            <FileDown className="h-4 w-4 mr-2" /> Gerar PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
