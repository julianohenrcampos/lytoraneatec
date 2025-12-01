import { useMemo, useRef, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface SSOChecklistFormHeaderProps {
  formData: {
    data_inspecao: string;
    obra_id: string;
    gerente_regional: string;
    engenheiro_obra: string;
    tecnico_seguranca: string;
    total_efetivo?: number;
    observacoes_gerais?: string;
  };
  onChange: (field: string, value: string) => void;
}

export const SSOChecklistFormHeader = ({ formData, onChange }: SSOChecklistFormHeaderProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea quando o valor muda
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [formData.observacoes_gerais]);

  const handleObservacoesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange('observacoes_gerais', e.target.value);
    
    // Auto-resize imediato
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  };

  // Buscar obras
  const { data: obras } = useQuery({
    queryKey: ['centros-custo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      
      if (error) throw error;
      return data;
    }
  });

  // Formatar obras para o Combobox
  const obrasOptions: ComboboxOption[] = useMemo(() => {
    if (!obras) return [];
    
    return obras
      .filter(obra => obra.nome_centro_custo)
      .map((obra) => ({
        value: obra.id,
        label: obra.nome_centro_custo
      }));
  }, [obras]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="data_inspecao">Data da Inspeção *</Label>
          <Input
            id="data_inspecao"
            type="date"
            value={formData.data_inspecao}
            onChange={(e) => onChange('data_inspecao', e.target.value)}
            required
          />
        </div>

        <div>
          <Label htmlFor="obra_id">Obra (L) / Gerente Regional *</Label>
          <Combobox
            options={obrasOptions}
            value={formData.obra_id}
            onChange={(value) => onChange('obra_id', value)}
            placeholder="Selecione a obra"
            searchPlaceholder="Buscar obra..."
            emptyText="Nenhuma obra encontrada"
            disabled={!obras || obras.length === 0}
          />
        </div>

        <div>
          <Label htmlFor="gerente_regional">Gerente Regional *</Label>
          <Input
            id="gerente_regional"
            value={formData.gerente_regional}
            onChange={(e) => onChange('gerente_regional', e.target.value)}
            placeholder="Nome do gerente regional"
            required
          />
        </div>

        <div>
          <Label htmlFor="engenheiro_obra">Engenheiro da Obra *</Label>
          <Input
            id="engenheiro_obra"
            value={formData.engenheiro_obra}
            onChange={(e) => onChange('engenheiro_obra', e.target.value)}
            placeholder="Nome do engenheiro"
            required
          />
        </div>

        <div>
          <Label htmlFor="tecnico_seguranca">Técnico em Segurança no Trabalho *</Label>
          <Input
            id="tecnico_seguranca"
            value={formData.tecnico_seguranca}
            onChange={(e) => onChange('tecnico_seguranca', e.target.value)}
            placeholder="Nome do técnico de segurança"
            required
          />
        </div>

        <div>
          <Label htmlFor="total_efetivo">Total de Efetivo</Label>
          <Input
            id="total_efetivo"
            type="number"
            min="0"
            value={formData.total_efetivo ?? ''}
            onChange={(e) => onChange('total_efetivo', e.target.value)}
            placeholder="Quantidade de trabalhadores"
          />
        </div>

        <div className="md:col-span-2">
          <Label htmlFor="observacoes_gerais">Observações Gerais</Label>
          <Textarea
            ref={textareaRef}
            id="observacoes_gerais"
            value={formData.observacoes_gerais || ''}
            onChange={handleObservacoesChange}
            placeholder="Observações adicionais sobre a inspeção..."
            className="min-h-[80px] resize-none overflow-hidden"
          />
        </div>
      </div>
    </div>
  );
};
