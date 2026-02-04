import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Etapa1FormData } from '@/types/ssoAgendamentoExames';

interface ChecklistDocumentalProps {
  formData: Etapa1FormData;
  onChange: (field: keyof Etapa1FormData, value: any) => void;
  disabled?: boolean;
  optional?: boolean;
}

interface ChecklistItem {
  field: keyof Etapa1FormData;
  label: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { field: 'doc_titulo_eleitor', label: 'Título de Eleitor' },
  { field: 'doc_pis_pasep', label: 'Número do PIS/PASEP' },
  { field: 'doc_certificado_reservista', label: 'Certificado de Reservista' },
  { field: 'doc_comprovante_residencia', label: 'Comprovante de Residência Atualizado' },
  { field: 'doc_comprovante_escolaridade', label: 'Comprovante de Escolaridade' },
  { field: 'doc_cnh', label: 'Carteira Nacional de Habilitação (CNH)' },
  { field: 'doc_exame_toxicologico', label: 'Exame Toxicológico' },
  { field: 'doc_certidao_filhos', label: 'Certidão de Filhos Menores de 18 Anos' },
];

export const ChecklistDocumental: React.FC<ChecklistDocumentalProps> = ({
  formData,
  onChange,
  disabled = false,
  optional = false
}) => {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <h4 className="font-semibold">Checklist Documental</h4>
        {optional && (
          <Badge variant="secondary" className="text-xs">
            Opcional
          </Badge>
        )}
      </div>
      
      <div className="space-y-4">
        {/* Documentos obrigatórios */}
        {CHECKLIST_ITEMS.map((item) => (
          <div key={item.field} className="flex items-center justify-between py-2 border-b last:border-0">
            <Label htmlFor={item.field} className="flex-1 cursor-pointer">
              {item.label}
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formData[item.field] ? 'Sim' : 'Não'}
              </span>
              <Switch
                id={item.field}
                checked={formData[item.field] as boolean}
                onCheckedChange={(checked) => onChange(item.field, checked)}
                disabled={disabled}
              />
            </div>
          </div>
        ))}
        
        {/* Carteira de Trabalho Digital */}
        <div className="flex items-center justify-between py-2 border-b">
          <Label htmlFor="possui_carteira_digital" className="flex-1 cursor-pointer">
            Possui Carteira de Trabalho Digital?
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {formData.possui_carteira_digital ? 'Sim' : 'Não'}
            </span>
            <Switch
              id="possui_carteira_digital"
              checked={formData.possui_carteira_digital}
              onCheckedChange={(checked) => onChange('possui_carteira_digital', checked)}
              disabled={disabled}
            />
          </div>
        </div>
        
        {/* Conta Banco Santander */}
        <div className="space-y-3 py-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="possui_conta_santander" className="flex-1 cursor-pointer">
              Possui conta no Banco Santander?
            </Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {formData.possui_conta_santander ? 'Sim' : 'Não'}
              </span>
              <Switch
                id="possui_conta_santander"
                checked={formData.possui_conta_santander}
                onCheckedChange={(checked) => onChange('possui_conta_santander', checked)}
                disabled={disabled}
              />
            </div>
          </div>
          
          {formData.possui_conta_santander ? (
            <div className="grid grid-cols-2 gap-3 pl-4 pt-2">
              <div className="space-y-1">
                <Label htmlFor="banco_agencia" className="text-xs">Agência</Label>
                <Input
                  id="banco_agencia"
                  placeholder="0000"
                  value={formData.banco_agencia}
                  onChange={(e) => onChange('banco_agencia', e.target.value)}
                  disabled={disabled}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="banco_conta" className="text-xs">Conta</Label>
                <Input
                  id="banco_conta"
                  placeholder="00000000-0"
                  value={formData.banco_conta}
                  onChange={(e) => onChange('banco_conta', e.target.value)}
                  disabled={disabled}
                />
              </div>
            </div>
          ) : (
            <div className="pl-4">
              <Badge variant="warning" className="text-xs">
                Providenciar abertura de conta
              </Badge>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};
