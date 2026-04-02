import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { 
  Etapa1FormData, 
  Etapa2FormData, 
  TIPOS_EXAME, 
  STATUS_AGENDAMENTO,
  MOTIVOS_MUDANCA_RISCO,
  LocalAtendimento,
  calcularDataRegistroCarteira
} from '@/types/ssoAgendamentoExames';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { Building2, User, Calendar, Briefcase, AlertTriangle, MessageCircle } from 'lucide-react';

interface Etapa2AgendamentoFormProps {
  etapa1Data: Etapa1FormData;
  formData: Etapa2FormData;
  onChange: (field: keyof Etapa2FormData, value: any) => void;
  locais: LocalAtendimento[];
  canChangeStatus?: boolean;
  disabled?: boolean;
}

const DIAS_SEMANA_MAP: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado'
};

export const Etapa2AgendamentoForm: React.FC<Etapa2AgendamentoFormProps> = ({
  etapa1Data,
  formData,
  onChange,
  locais,
  canChangeStatus = true,
  disabled = false
}) => {
  const [showIndisponivel, setShowIndisponivel] = useState(false);
  const [motivoIndisponivel, setMotivoIndisponivel] = useState('');

  const dataRegistroCarteira = etapa1Data.data_inicio_prevista 
    ? calcularDataRegistroCarteira(etapa1Data.data_inicio_prevista)
    : '';

  // Validação de disponibilidade da clínica
  useEffect(() => {
    if (!formData.local_atendimento_id || !formData.data_agendamento || !formData.horario_agendamento) return;

    const clinica = locais.find(l => l.id === formData.local_atendimento_id);
    if (!clinica) return;

    const diasAtendimento = clinica.dias_atendimento || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'];
    const horarioInicio = clinica.horario_inicio || '07:00';
    const horarioFim = clinica.horario_fim || '17:00';

    // Verificar dia da semana
    const dataSelecionada = new Date(formData.data_agendamento + 'T12:00:00');
    const diaSemana = DIAS_SEMANA_MAP[dataSelecionada.getDay()];
    
    if (!diasAtendimento.includes(diaSemana)) {
      setMotivoIndisponivel(`A clínica não atende às ${diaSemana}s. Dias disponíveis: ${diasAtendimento.join(', ')}.`);
      setShowIndisponivel(true);
      return;
    }

    // Verificar horário
    const horarioSelecionado = formData.horario_agendamento;
    const inicioNorm = horarioInicio.substring(0, 5);
    const fimNorm = horarioFim.substring(0, 5);

    if (horarioSelecionado < inicioNorm || horarioSelecionado > fimNorm) {
      setMotivoIndisponivel(`Horário fora do expediente da clínica (${inicioNorm} às ${fimNorm}).`);
      setShowIndisponivel(true);
      return;
    }
  }, [formData.local_atendimento_id, formData.data_agendamento, formData.horario_agendamento, locais]);

  const handleCloseIndisponivel = () => {
    setShowIndisponivel(false);
    onChange('data_agendamento', '');
    onChange('horario_agendamento', '');
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent('Olá, preciso de orientação sobre agendamento de exame ocupacional. A clínica selecionada não possui disponibilidade para o período desejado.');
    window.open(`https://wa.me/5521976652245?text=${msg}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Popup de Indisponibilidade */}
      <AlertDialog open={showIndisponivel} onOpenChange={setShowIndisponivel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Aviso: Indisponibilidade de Agenda
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3 pt-2">
              <p>{motivoIndisponivel}</p>
              <p>
                Não há vagas disponíveis na clínica selecionada para este período.
                Por favor, entre em contato com o gestor de contratos para orientações sobre como proceder:
              </p>
              <div className="bg-muted rounded-md p-3 space-y-1">
                <p className="font-medium text-foreground">Responsável: Saúde Ocupacional</p>
                <p className="text-foreground">Contato direto: (21) 97665-2245</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseIndisponivel}>Fechar</AlertDialogCancel>
            <Button onClick={handleWhatsApp} className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Abrir WhatsApp
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          
          {(formData.tipo_exame === 'Admissional' || formData.tipo_exame === 'Mudança de Risco') && (
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
              {formData.tipo_exame === 'Mudança de Risco' && formData.motivo_mudanca_risco && (
                <Badge variant="purple" className="text-xs">
                  {formData.motivo_mudanca_risco}
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
            <Label>Tipo de Exame</Label>
            <Input
              value={formData.tipo_exame}
              readOnly
              disabled
              className="bg-muted"
            />
          </div>
          
          {formData.tipo_exame === 'Mudança de Risco' && (
            <div className="space-y-2">
              <Label>Motivo da Mudança *</Label>
              <Select
                value={formData.motivo_mudanca_risco || ''}
                onValueChange={(v) => onChange('motivo_mudanca_risco', v)}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS_MUDANCA_RISCO.map((motivo) => (
                    <SelectItem key={motivo} value={motivo}>{motivo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          
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
                    {local.nome_local}
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
