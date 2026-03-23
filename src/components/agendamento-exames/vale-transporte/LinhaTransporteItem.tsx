import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

export interface LinhaTransporte {
  nome: string;
  numero: string;
  tarifa: number;
  operadora: 'Jaé' | 'RioCard';
}

interface LinhaTransporteItemProps {
  linha: LinhaTransporte;
  index: number;
  onChange: (index: number, field: keyof LinhaTransporte, value: any) => void;
  onRemove: (index: number) => void;
  canRemove: boolean;
}

export const LinhaTransporteItem: React.FC<LinhaTransporteItemProps> = ({
  linha, index, onChange, onRemove, canRemove
}) => {
  return (
    <div className="grid grid-cols-[1fr_0.6fr_0.6fr_0.6fr_0.8fr_auto] gap-2 items-end p-3 border rounded-md bg-muted/30">
      <div className="space-y-1">
        <Label className="text-xs">Nome da Linha</Label>
        <Input
          value={linha.nome}
          onChange={(e) => onChange(index, 'nome', e.target.value)}
          placeholder="Ex: Linha 474"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Número</Label>
        <Input
          value={linha.numero}
          onChange={(e) => onChange(index, 'numero', e.target.value)}
          placeholder="474"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tarifa (R$)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={linha.tarifa || ''}
          onChange={(e) => onChange(index, 'tarifa', parseFloat(e.target.value) || 0)}
          placeholder="4.40"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Ida/Volta</Label>
        <Input
          value={((linha.tarifa || 0) * 2).toFixed(2)}
          readOnly
          className="bg-muted"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Operadora</Label>
        <Select
          value={linha.operadora}
          onValueChange={(val) => onChange(index, 'operadora', val)}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Jaé">Jaé</SelectItem>
            <SelectItem value="RioCard">RioCard</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex justify-end">
        {canRemove && (
          <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(index)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        )}
      </div>
    </div>
  );
};