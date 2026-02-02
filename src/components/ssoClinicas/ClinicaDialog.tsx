import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useLocaisAtendimento } from '@/hooks/ssoAgendamentoExames';
import { LocalAtendimentoFormData } from '@/services/ssoAgendamentoExames/locaisAtendimentoService';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ClinicaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicaId?: string;
}

const initialFormData: LocalAtendimentoFormData = {
  nome_local: '',
  endereco: '',
  cidade: '',
  telefone: '',
  ativo: true
};

export const ClinicaDialog: React.FC<ClinicaDialogProps> = ({
  open,
  onOpenChange,
  clinicaId
}) => {
  const [formData, setFormData] = useState<LocalAtendimentoFormData>(initialFormData);
  const { local, create, update, isCreating, isUpdating, isLoading } = useLocaisAtendimento(clinicaId);

  useEffect(() => {
    if (local && clinicaId) {
      setFormData({
        nome_local: local.nome_local,
        endereco: local.endereco,
        cidade: local.cidade || '',
        telefone: local.telefone || '',
        ativo: local.ativo
      });
    } else if (!clinicaId) {
      setFormData(initialFormData);
    }
  }, [local, clinicaId, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_local || !formData.endereco || !formData.cidade) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    try {
      if (clinicaId) {
        await update({ id: clinicaId, data: formData });
      } else {
        await create(formData);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar:', error);
    }
  };

  const handleChange = (field: keyof LocalAtendimentoFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading && clinicaId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{clinicaId ? 'Editar Clínica' : 'Nova Clínica'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Clínica *</Label>
            <Input
              value={formData.nome_local}
              onChange={(e) => handleChange('nome_local', e.target.value)}
              placeholder="Ex: Clínica São José"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Cidade *</Label>
            <Input
              value={formData.cidade}
              onChange={(e) => handleChange('cidade', e.target.value)}
              placeholder="Ex: Duque de Caxias"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Endereço Completo *</Label>
            <Input
              value={formData.endereco}
              onChange={(e) => handleChange('endereco', e.target.value)}
              placeholder="Ex: Av. Principal, 100 - Centro"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Telefone</Label>
            <Input
              value={formData.telefone}
              onChange={(e) => handleChange('telefone', e.target.value)}
              placeholder="(21) 9999-9999"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="ativo">Clínica Ativa</Label>
            <Switch
              id="ativo"
              checked={formData.ativo}
              onCheckedChange={(v) => handleChange('ativo', v)}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {(isCreating || isUpdating) && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {clinicaId ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
