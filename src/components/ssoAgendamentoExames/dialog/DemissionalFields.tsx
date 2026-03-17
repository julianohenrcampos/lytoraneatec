import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, UserMinus } from 'lucide-react';
import { MOTIVOS_DESLIGAMENTO, TipoDesligamento } from '@/types/desligamento';

export interface DemissionalFormData {
  tipo_desligamento: TipoDesligamento;
  dias_aviso: number;
  motivo: string;
  recontratavel: boolean;
  observacoes_desligamento: string;
}

export const initialDemissionalData: DemissionalFormData = {
  tipo_desligamento: 'sem_aviso',
  dias_aviso: 30,
  motivo: '',
  recontratavel: false,
  observacoes_desligamento: '',
};

interface DemissionalFieldsProps {
  formData: DemissionalFormData;
  onChange: (field: keyof DemissionalFormData, value: any) => void;
  disabled?: boolean;
}

export const DemissionalFields: React.FC<DemissionalFieldsProps> = ({
  formData,
  onChange,
  disabled = false,
}) => {
  const dataFimAviso = React.useMemo(() => {
    if (formData.tipo_desligamento !== 'com_aviso' || !formData.dias_aviso) return '';
    const d = new Date();
    d.setDate(d.getDate() + formData.dias_aviso);
    return d.toISOString().split('T')[0];
  }, [formData.tipo_desligamento, formData.dias_aviso]);

  return (
    <Card className="p-4 border-destructive/30 bg-destructive/5">
      <h4 className="font-semibold mb-4 flex items-center gap-2 text-destructive">
        <UserMinus className="h-4 w-4" />
        Dados do Desligamento
      </h4>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tipo desligamento */}
        <div className="space-y-2 md:col-span-2">
          <Label>Tipo de Desligamento *</Label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('tipo_desligamento', 'sem_aviso')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                formData.tipo_desligamento === 'sem_aviso'
                  ? 'bg-destructive text-destructive-foreground border-destructive'
                  : 'bg-background border-input hover:bg-accent'
              }`}
            >
              Sem Aviso Prévio
            </button>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange('tipo_desligamento', 'com_aviso')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-colors ${
                formData.tipo_desligamento === 'com_aviso'
                  ? 'bg-warning text-warning-foreground border-warning'
                  : 'bg-background border-input hover:bg-accent'
              }`}
            >
              Com Aviso Prévio
            </button>
          </div>
        </div>

        {/* Alerta sem aviso */}
        {formData.tipo_desligamento === 'sem_aviso' && (
          <div className="md:col-span-2 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <span>O funcionário será <strong>inativado imediatamente</strong> após a criação do agendamento.</span>
          </div>
        )}

        {/* Dias de aviso */}
        {formData.tipo_desligamento === 'com_aviso' && (
          <>
            <div className="space-y-2">
              <Label>Dias de Aviso Prévio *</Label>
              <Input
                type="number"
                min={1}
                max={90}
                value={formData.dias_aviso}
                onChange={(e) => onChange('dias_aviso', parseInt(e.target.value) || 30)}
                disabled={disabled}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final do Aviso</Label>
              <Input
                value={dataFimAviso}
                readOnly
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Calculado automaticamente</p>
            </div>
          </>
        )}

        {/* Motivo */}
        <div className="space-y-2 md:col-span-2">
          <Label>Motivo do Desligamento *</Label>
          <Select
            value={formData.motivo}
            onValueChange={(v) => onChange('motivo', v)}
            disabled={disabled}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o motivo..." />
            </SelectTrigger>
            <SelectContent>
              {MOTIVOS_DESLIGAMENTO.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Recontratável */}
        <div className="flex items-center justify-between md:col-span-2 p-3 border rounded-md">
          <div>
            <Label className="text-sm font-medium">Recontratável</Label>
            <p className="text-xs text-muted-foreground">Elegível para futura recontratação?</p>
          </div>
          <Switch
            checked={formData.recontratavel}
            onCheckedChange={(v) => onChange('recontratavel', v)}
            disabled={disabled}
          />
        </div>

        {/* Observações */}
        <div className="space-y-2 md:col-span-2">
          <Label>Observações do Desligamento</Label>
          <Textarea
            value={formData.observacoes_desligamento}
            onChange={(e) => onChange('observacoes_desligamento', e.target.value)}
            disabled={disabled}
            rows={2}
            placeholder="Informações adicionais sobre o desligamento..."
          />
        </div>
      </div>
    </Card>
  );
};
