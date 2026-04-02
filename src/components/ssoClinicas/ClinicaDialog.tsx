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
import { Checkbox } from '@/components/ui/checkbox';
import { useLocaisAtendimento } from '@/hooks/ssoAgendamentoExames';
import { LocalAtendimentoFormData } from '@/services/ssoAgendamentoExames/locaisAtendimentoService';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ClinicaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicaId?: string;
}

const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

const initialFormData: LocalAtendimentoFormData = {
  nome_local: '',
  endereco: '',
  cidade: '',
  telefone: '',
  ativo: true,
  dias_atendimento: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
  horario_inicio: '07:00',
  horario_fim: '17:00'
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
        ativo: local.ativo,
        dias_atendimento: local.dias_atendimento || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
        horario_inicio: local.horario_inicio || '07:00',
        horario_fim: local.horario_fim || '17:00'
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
    if (!formData.dias_atendimento || formData.dias_atendimento.length === 0) {
      toast.error('Selecione ao menos um dia de atendimento');
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

  const toggleDia = (dia: string) => {
    const current = formData.dias_atendimento || [];
    if (current.includes(dia)) {
      handleChange('dias_atendimento', current.filter(d => d !== dia));
    } else {
      handleChange('dias_atendimento', [...current, dia]);
    }
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

          <div className="space-y-2">
            <Label>Dias de Atendimento *</Label>
            <div className="flex flex-wrap gap-3">
              {DIAS_SEMANA.map((dia) => (
                <div key={dia} className="flex items-center space-x-1.5">
                  <Checkbox
                    id={`dia-${dia}`}
                    checked={(formData.dias_atendimento || []).includes(dia)}
                    onCheckedChange={() => toggleDia(dia)}
                  />
                  <Label htmlFor={`dia-${dia}`} className="text-xs cursor-pointer">
                    {dia.substring(0, 3)}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Horário Início *</Label>
              <Input
                type="time"
                value={formData.horario_inicio || '07:00'}
                onChange={(e) => handleChange('horario_inicio', e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Horário Fim *</Label>
              <Input
                type="time"
                value={formData.horario_fim || '17:00'}
                onChange={(e) => handleChange('horario_fim', e.target.value)}
                required
              />
            </div>
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
