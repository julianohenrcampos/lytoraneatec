import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';

export interface NaoBeneficiarioFormData {
  motivos: string[];
  motivo_outros_texto: string;
  data_solicitacao: string;
}

interface NaoBeneficiarioFormProps {
  data: NaoBeneficiarioFormData;
  onChange: (data: NaoBeneficiarioFormData) => void;
  candidato: {
    nome: string;
    cpf: string;
    funcao: string;
    empresa: string;
    data_nascimento: string;
    telefone: string;
  };
}

const MOTIVOS_NAO_BENEFICIARIO = [
  { id: 'transporte_proprio', label: 'Possuo transporte próprio' },
  { id: 'custo_inferior', label: 'Custo inferior a 6% do salário' },
  { id: 'mora_proximo', label: 'Resido próximo ao local de trabalho' },
  { id: 'outros', label: 'Outros' },
];

export const NaoBeneficiarioForm: React.FC<NaoBeneficiarioFormProps> = ({ data, onChange, candidato }) => {
  const toggleMotivo = (motivo: string) => {
    const newMotivos = data.motivos.includes(motivo)
      ? data.motivos.filter(m => m !== motivo)
      : [...data.motivos, motivo];
    onChange({ ...data, motivos: newMotivos });
  };

  return (
    <div className="space-y-4">
      {/* Dados readonly do funcionário */}
      <div className="grid grid-cols-2 gap-3 p-3 border rounded-md bg-muted/30">
        <div>
          <Label className="text-xs text-muted-foreground">Nome</Label>
          <p className="text-sm font-medium">{candidato.nome || '—'}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">CPF</Label>
          <p className="text-sm font-medium">{candidato.cpf || '—'}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Função</Label>
          <p className="text-sm font-medium">{candidato.funcao || '—'}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Empresa</Label>
          <p className="text-sm font-medium">{candidato.empresa || '—'}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Data Nascimento</Label>
          <p className="text-sm font-medium">{candidato.data_nascimento || '—'}</p>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Celular</Label>
          <p className="text-sm font-medium">{candidato.telefone || '—'}</p>
        </div>
      </div>

      {/* Motivos */}
      <div className="space-y-3">
        <Label>Motivos da Declaração *</Label>
        {MOTIVOS_NAO_BENEFICIARIO.map((m) => (
          <div key={m.id} className="flex items-center space-x-2">
            <Checkbox
              id={`naoben-${m.id}`}
              checked={data.motivos.includes(m.id)}
              onCheckedChange={() => toggleMotivo(m.id)}
            />
            <Label htmlFor={`naoben-${m.id}`} className="font-normal cursor-pointer">{m.label}</Label>
          </div>
        ))}
        {data.motivos.includes('outros') && (
          <Textarea
            value={data.motivo_outros_texto}
            onChange={(e) => onChange({ ...data, motivo_outros_texto: e.target.value })}
            placeholder="Descreva o motivo..."
            rows={2}
          />
        )}
      </div>

      {/* Data */}
      <div className="space-y-2">
        <Label>Data da Declaração</Label>
        <Input
          type="date"
          value={data.data_solicitacao}
          onChange={(e) => onChange({ ...data, data_solicitacao: e.target.value })}
        />
      </div>
    </div>
  );
};
