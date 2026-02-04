import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Etapa1FormData, calcularDataRegistroCarteira } from '@/types/ssoAgendamentoExames';
import { ChecklistDocumental } from './ChecklistDocumental';
import { formatBrazilianDateForDisplay } from '@/utils/timezoneUtils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info } from 'lucide-react';

interface Etapa1CadastroFormProps {
  formData: Etapa1FormData;
  onChange: (field: keyof Etapa1FormData, value: any) => void;
  empresas: Array<{
    nome_empresa: string;
  }>;
  funcoes: Array<{
    nome_funcao: string;
  }>;
  centrosCusto: Array<{
    nome_centro_custo: string;
  }>;
  disabled?: boolean;
  modoFuncionario?: boolean;
}

export const Etapa1CadastroForm: React.FC<Etapa1CadastroFormProps> = ({
  formData,
  onChange,
  empresas,
  funcoes,
  centrosCusto,
  disabled = false,
  modoFuncionario = false
}) => {
  const empresasOptions = useMemo(() => empresas.map(e => ({
    value: e.nome_empresa,
    label: e.nome_empresa
  })), [empresas]);
  const funcoesOptions = useMemo(() => funcoes.map(f => ({
    value: f.nome_funcao,
    label: f.nome_funcao
  })), [funcoes]);
  const centrosCustoOptions = useMemo(() => centrosCusto.map(c => ({
    value: c.nome_centro_custo,
    label: c.nome_centro_custo
  })), [centrosCusto]);

  // Calcular data de registro da carteira automaticamente
  const dataRegistroCarteira = formData.data_inicio_prevista ? calcularDataRegistroCarteira(formData.data_inicio_prevista) : '';

  // Para modo funcionário, campos principais ficam readonly
  const isFieldReadonly = modoFuncionario && !disabled;

  return (
    <div className="space-y-6">
      {/* Aviso modo funcionário */}
      {modoFuncionario && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Dados do funcionário pré-preenchidos. Campos como telefone podem ser atualizados se necessário.
          </AlertDescription>
        </Alert>
      )}

      {/* Dados do Candidato */}
      <Card className="p-4">
        <h4 className="font-semibold mb-4">
          {modoFuncionario ? 'Dados do Funcionário' : 'Dados do Candidato'}
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2 md:col-span-2">
            <Label>Nome Completo *</Label>
            <Input 
              value={formData.nome_colaborador} 
              onChange={e => onChange('nome_colaborador', e.target.value)} 
              disabled={disabled} 
              readOnly={isFieldReadonly}
              className={isFieldReadonly ? 'bg-muted cursor-not-allowed' : ''}
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label>Telefone Celular *</Label>
            <Input 
              type="tel" 
              placeholder="(00) 00000-0000" 
              value={formData.telefone_celular} 
              onChange={e => onChange('telefone_celular', e.target.value)} 
              disabled={disabled} 
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label>E-mail *</Label>
            <Input 
              type="email" 
              placeholder="email@exemplo.com" 
              value={formData.email} 
              onChange={e => onChange('email', e.target.value)} 
              disabled={disabled} 
              readOnly={isFieldReadonly}
              className={isFieldReadonly ? 'bg-muted cursor-not-allowed' : ''}
              required 
            />
          </div>
          
          <div className="space-y-2">
            <Label>Função / Cargo *</Label>
            <Combobox 
              options={funcoesOptions} 
              value={formData.funcao} 
              onChange={value => onChange('funcao', value)} 
              placeholder="Selecione a função..." 
              searchPlaceholder="Buscar função..." 
              emptyText="Nenhuma função encontrada" 
              disabled={disabled || isFieldReadonly} 
            />
          </div>
          
          <div className="space-y-2">
            <Label>Centro de Custo</Label>
            <Combobox 
              options={centrosCustoOptions} 
              value={formData.contrato} 
              onChange={value => onChange('contrato', value)} 
              placeholder="Selecione o centro de custo..." 
              searchPlaceholder="Buscar..." 
              emptyText="Nenhum centro de custo encontrado" 
              disabled={disabled || isFieldReadonly} 
            />
          </div>
          
          <div className="space-y-2">
            <Label>Empresa *</Label>
            <Combobox 
              options={empresasOptions} 
              value={formData.empresa} 
              onChange={value => onChange('empresa', value)} 
              placeholder="Selecione a empresa..." 
              searchPlaceholder="Buscar empresa..." 
              emptyText="Nenhuma empresa encontrada" 
              disabled={disabled || isFieldReadonly} 
            />
          </div>
          
          <div className="space-y-2">
            <Label>Data de Nascimento</Label>
            <Input 
              type="date" 
              value={formData.data_nascimento} 
              onChange={e => onChange('data_nascimento', e.target.value)} 
              disabled={disabled} 
              readOnly={isFieldReadonly}
              className={isFieldReadonly ? 'bg-muted cursor-not-allowed' : ''}
            />
          </div>
          
          <div className="space-y-2">
            <Label>RG</Label>
            <Input 
              value={formData.rg} 
              onChange={e => onChange('rg', e.target.value)} 
              disabled={disabled} 
            />
          </div>
          
          <div className="space-y-2">
            <Label>CPF *</Label>
            <Input 
              placeholder="000.000.000-00" 
              value={formData.cpf} 
              onChange={e => onChange('cpf', e.target.value)} 
              disabled={disabled} 
              readOnly={isFieldReadonly}
              className={isFieldReadonly ? 'bg-muted cursor-not-allowed' : ''}
              required 
            />
          </div>
          
          {/* Data de Início - só mostrar para novo (admissional) */}
          {!modoFuncionario && (
            <>
              <div className="space-y-2">
                <Label>Data Prevista de Início (automático)</Label>
                <div className="flex items-center gap-2">
                  <Input 
                    type="date" 
                    value={formData.data_inicio_prevista} 
                    disabled
                    className="bg-muted cursor-not-allowed"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    (Agendamento +2 dias)
                  </span>
                </div>
                {!formData.data_inicio_prevista && (
                  <p className="text-xs text-warning">
                    Será calculado após definir a data do agendamento na Etapa 2
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Data Registro Carteira (automático)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    (+15 dias após início)
                  </span>
                </div>
                {dataRegistroCarteira && (
                  <p className="text-xs text-muted-foreground">
                    Limite: {formatBrazilianDateForDisplay(dataRegistroCarteira)}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </Card>
      
      {/* Checklist Documental - NÃO renderizar para funcionário existente */}
      {!modoFuncionario && (
        <ChecklistDocumental 
          formData={formData} 
          onChange={onChange} 
          disabled={disabled}
        />
      )}
    </div>
  );
};