import React from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Etapa1FormData, 
  Etapa2FormData, 
  TIPOS_EXAME, 
  STATUS_AGENDAMENTO,
  LocalAtendimento,
  calcularDataRegistroCarteira
} from '@/types/ssoAgendamentoExames';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { Building2, User, Calendar, Briefcase } from 'lucide-react';

interface Etapa2AgendamentoFormProps {
  etapa1Data: Etapa1FormData;
  formData: Etapa2FormData;
  onChange: (field: keyof Etapa2FormData, value: any) => void;
  locais: LocalAtendimento[];
  canChangeStatus?: boolean;
  disabled?: boolean;
}

export const Etapa2AgendamentoForm: React.FC<Etapa2AgendamentoFormProps> = ({
  etapa1Data,
  formData,
  onChange,
  locais,
  canChangeStatus = true,
  disabled = false
}) => {
  const dataRegistroCarteira = etapa1Data.data_inicio_prevista 
    ? calcularDataRegistroCarteira(etapa1Data.data_inicio_prevista)
    : '';

  return (
    <div className="space-y-6">
      {/* Resumo do Candidato (somente leitura) */}
      <Card className="p-4 bg-muted/30">
        <h4 className="font-semibold mb-3 text-sm text-muted-foreground">Resumo do Candidato</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium">{etapa1Data.nome_colaborador || 'Nome não informado'}</span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-2">
              <Briefcase className="h-3 w-3 text-muted-foreground" />
              <span>{etapa1Data.funcao || '-'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-3 w-3 text-muted-foreground" />
              <span>{etapa1Data.empresa || '-'}</span>
            </div>
          </div>
          
          {formData.tipo_exame === 'Admissional' && (
            <div className="flex flex-wrap gap-2 mt-2">
              {etapa1Data.data_inicio_prevista && (
                <Badge variant="outline" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  Início: {formatBrazilianDateForDisplay(etapa1Data.data_inicio_prevista)}
                </Badge>
              )}
              {dataRegistroCarteira && (
                <Badge variant="secondary" className="text-xs">
                  Carteira até: {formatBrazilianDateForDisplay(dataRegistroCarteira)}
                </Badge>
              )}
            </div>
          )}
        </div>
      </Card>
      
      {/* Dados do Agendamento */}
      <Card className="p-4">
        <h4 className="font-semibold mb-4">Agendamento do Exame</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Tipo de Exame *</Label>
            <Select
              value={formData.tipo_exame}
              onValueChange={(v) => onChange('tipo_exame', v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo..." />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_EXAME.map((tipo) => (
                  <SelectItem key={tipo} value={tipo}>{tipo}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Local de Atendimento *</Label>
            <Select
              value={formData.local_atendimento_id}
              onValueChange={(v) => onChange('local_atendimento_id', v)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o local..." />
              </SelectTrigger>
              <SelectContent>
                {locais.map((local) => (
                  <SelectItem key={local.id} value={local.id}>
                    {local.cidade || local.nome_local}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Data do Agendamento *</Label>
            <Input
              type="date"
              value={formData.data_agendamento}
              onChange={(e) => onChange('data_agendamento', e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Horário *</Label>
            <Input
              type="time"
              value={formData.horario_agendamento}
              onChange={(e) => onChange('horario_agendamento', e.target.value)}
              disabled={disabled}
              required
            />
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => onChange('observacoes', e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="Informações adicionais sobre o agendamento..."
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="documentos_anexados"
              checked={formData.documentos_anexados}
              onCheckedChange={(v) => onChange('documentos_anexados', v)}
              disabled={disabled}
            />
            <Label htmlFor="documentos_anexados" className="cursor-pointer">
              Possui documentos anexos
            </Label>
          </div>
          
          {canChangeStatus && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(v) => onChange('status', v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_AGENDAMENTO.map((status) => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
