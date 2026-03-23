import React, { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { LinhaTransporteItem, LinhaTransporte } from './LinhaTransporteItem';

export interface EnderecoEstruturado {
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

export interface ValeTransporteFormData {
  endereco: EnderecoEstruturado;
  linhas: LinhaTransporte[];
  motivo: string;
  data_solicitacao: string;
  comprovante?: File;
}

interface ValeTransporteFormProps {
  data: ValeTransporteFormData;
  onChange: (data: ValeTransporteFormData) => void;
}

const MOTIVOS = [
  'Admissão',
  'Mudança de endereço',
  'Transferência de obra',
  'Atualização de passagem',
];

const emptyLinha: LinhaTransporte = { nome: '', numero: '', tarifa: 0, operadora: 'Jaé' };

export const ValeTransporteForm: React.FC<ValeTransporteFormProps> = ({ data, onChange }) => {
  const handleLinhaChange = (index: number, field: keyof LinhaTransporte, value: any) => {
    const newLinhas = [...data.linhas];
    newLinhas[index] = { ...newLinhas[index], [field]: value };
    onChange({ ...data, linhas: newLinhas });
  };

  const addLinha = () => {
    if (data.linhas.length >= 4) return;
    onChange({ ...data, linhas: [...data.linhas, { ...emptyLinha }] });
  };

  const removeLinha = (index: number) => {
    if (data.linhas.length <= 1) return;
    onChange({ ...data, linhas: data.linhas.filter((_, i) => i !== index) });
  };

  const handleEnderecoChange = (field: keyof EnderecoEstruturado, value: string) => {
    onChange({ ...data, endereco: { ...data.endereco, [field]: value } });
  };

  const valorJae = useMemo(() =>
    data.linhas.filter(l => l.operadora === 'Jaé').reduce((s, l) => s + (l.tarifa || 0) * 2, 0),
    [data.linhas]
  );
  const valorRioCard = useMemo(() =>
    data.linhas.filter(l => l.operadora === 'RioCard').reduce((s, l) => s + (l.tarifa || 0) * 2, 0),
    [data.linhas]
  );
  const valorTotal = valorJae + valorRioCard;
  const excedeLimite = valorTotal > 28;

  return (
    <div className="space-y-4">

      {/* Linhas de transporte */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Linhas de Transporte *</Label>
          {data.linhas.length < 4 && (
            <Button type="button" variant="outline" size="sm" onClick={addLinha}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {data.linhas.map((linha, i) => (
            <LinhaTransporteItem
              key={i}
              linha={linha}
              index={i}
              onChange={handleLinhaChange}
              onRemove={removeLinha}
              canRemove={data.linhas.length > 1}
            />
          ))}
        </div>
      </div>

      {/* Valores calculados (ida e volta) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Valor Jaé Ida/Volta (R$)</Label>
          <Input value={valorJae.toFixed(2)} readOnly className="bg-muted" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor RioCard Ida/Volta (R$)</Label>
          <Input value={valorRioCard.toFixed(2)} readOnly className="bg-muted" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-semibold">Total Ida/Volta (R$)</Label>
          <Input value={valorTotal.toFixed(2)} readOnly className={`bg-muted font-semibold ${excedeLimite ? 'text-destructive border-destructive' : ''}`} />
        </div>
      </div>

      {excedeLimite && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive font-medium">
          ⚠ Valor excede R$ 28,00 — requer autorização da Diretoria Financeira
        </div>
      )}

      {/* Motivo */}
      <div className="space-y-2">
        <Label>Motivo da Solicitação *</Label>
        <RadioGroup value={data.motivo} onValueChange={(v) => onChange({ ...data, motivo: v })}>
          {MOTIVOS.map((m) => (
            <div key={m} className="flex items-center space-x-2">
              <RadioGroupItem value={m} id={`motivo-${m}`} />
              <Label htmlFor={`motivo-${m}`} className="font-normal cursor-pointer">{m}</Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Data */}
      <div className="space-y-2">
        <Label>Data da Solicitação</Label>
        <Input
          type="date"
          value={data.data_solicitacao}
          onChange={(e) => onChange({ ...data, data_solicitacao: e.target.value })}
        />
      </div>
    </div>
  );
};
