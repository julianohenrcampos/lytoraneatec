import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RegistroAplicacaoDetalhesFormValues } from '@/types/registroAplicacaoDetalhes';
import { calculateMassaAplicacao, getEspessuraStatusText } from '@/utils/massaAplicacaoUtils';

interface NovaAplicacaoFormProps {
  onSubmit?: (data: any) => void;
  onSave?: (dadosAplicacao: RegistroAplicacaoDetalhesFormValues) => Promise<void>;
  editingAplicacao?: RegistroAplicacaoDetalhesFormValues | null;
  onCancel?: () => void;
  onCancelEdit?: () => void;
  isSubmitting?: boolean;
  massaRemanescente?: number;
  proximaSequencia?: number;
  programacaoData?: any;
  isLoading?: boolean;
  requisicaoId?: string;
}

const NovaAplicacaoForm: React.FC<NovaAplicacaoFormProps> = ({ 
  onSubmit,
  onSave,
  editingAplicacao,
  onCancel,
  onCancelEdit,
  isSubmitting,
  massaRemanescente = 0,
  proximaSequencia = 1,
  programacaoData,
  isLoading,
  requisicaoId
}) => {
  const [aplicarTodaMassa, setAplicarTodaMassa] = useState(false);
  const [calculatedValues, setCalculatedValues] = useState({
    toneladaAplicada: 0,
    espessura: 0,
    espessuraStatus: null as any,
    massaRemanescente: massaRemanescente
  });

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<RegistroAplicacaoDetalhesFormValues>({
    defaultValues: {
      logradouro_nome: '',
      area_aplicada: 0,
      tonelada_aplicada: 0,
      comprimento: undefined,
      largura_media: undefined,
      aplicar_toda_massa: false
    }
  });

  const watchComprimento = watch('comprimento');
  const watchLargura = watch('largura_media');
  const watchTonelada = watch('tonelada_aplicada');

  // Preencher formulário quando estiver editando
  useEffect(() => {
    if (editingAplicacao) {
      reset(editingAplicacao);
      setAplicarTodaMassa(editingAplicacao.aplicar_toda_massa || false);
    } else {
      reset({
        logradouro_nome: '',
        area_aplicada: 0,
        tonelada_aplicada: 0,
        comprimento: undefined,
        largura_media: undefined,
        aplicar_toda_massa: false
      });
      setAplicarTodaMassa(false);
    }
  }, [editingAplicacao, reset]);

  // Calcular valores automaticamente
  useEffect(() => {
    const resultado = calculateMassaAplicacao(
      watchComprimento || null,
      watchLargura || null,
      massaRemanescente,
      aplicarTodaMassa
    );
    
    setCalculatedValues(resultado);
    
    // Atualizar campos do formulário
    setValue('tonelada_aplicada', resultado.toneladaAplicada);
    setValue('area_aplicada', (watchComprimento || 0) * (watchLargura || 0));
    setValue('espessura_aplicada', resultado.espessura);
    setValue('aplicar_toda_massa', aplicarTodaMassa);
  }, [watchComprimento, watchLargura, massaRemanescente, aplicarTodaMassa, setValue]);

  const handleFormSubmit = async (data: RegistroAplicacaoDetalhesFormValues) => {
    const dadosCompletos = {
      ...data,
      aplicar_toda_massa: aplicarTodaMassa,
      sequencia_aplicacao: proximaSequencia
    };

    if (onSave) {
      await onSave(dadosCompletos);
      // Reset form after successful save
      if (!editingAplicacao) {
        reset();
        setAplicarTodaMassa(false);
      }
    }
  };

  const handleCancel = () => {
    if (editingAplicacao) {
      onCancelEdit?.();
    } else {
      onCancel?.();
    }
    reset();
    setAplicarTodaMassa(false);
  };

  const podeAplicarTodaMassa = massaRemanescente > 0 && massaRemanescente <= 0.5; // Ativar toggle apenas para pequenas quantidades

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {editingAplicacao ? 'Editar Aplicação de Rua' : 'Nova Aplicação de Rua'}
          <Badge variant="outline" className="ml-2">
            Sequência {proximaSequencia}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Nome do Logradouro */}
          <div>
            <Label htmlFor="logradouro_nome">Nome do Logradouro *</Label>
            <Input
              id="logradouro_nome"
              {...register('logradouro_nome', { required: 'Nome do logradouro é obrigatório' })}
              placeholder="Ex: Rua das Flores, Av. Principal..."
            />
            {errors.logradouro_nome && (
              <p className="text-sm text-red-600 mt-1">{errors.logradouro_nome.message}</p>
            )}
          </div>

          {/* Dimensões */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="comprimento">Comprimento (m) *</Label>
              <Input
                id="comprimento"
                type="number"
                step="0.01"
                {...register('comprimento', { 
                  required: 'Comprimento é obrigatório',
                  min: { value: 0.01, message: 'Comprimento deve ser maior que 0' }
                })}
                placeholder="0.00"
              />
              {errors.comprimento && (
                <p className="text-sm text-red-600 mt-1">{errors.comprimento.message}</p>
              )}
            </div>
            <div>
              <Label htmlFor="largura_media">Largura Média (m) *</Label>
              <Input
                id="largura_media"
                type="number"
                step="0.01"
                {...register('largura_media', { 
                  required: 'Largura é obrigatória',
                  min: { value: 0.01, message: 'Largura deve ser maior que 0' }
                })}
                placeholder="0.00"
              />
              {errors.largura_media && (
                <p className="text-sm text-red-600 mt-1">{errors.largura_media.message}</p>
              )}
            </div>
          </div>

          {/* Toggle Aplicar Toda Massa */}
          {podeAplicarTodaMassa && (
            <div className="flex items-center space-x-2 p-4 bg-blue-50 rounded-lg">
              <Switch
                id="aplicar_toda_massa"
                checked={aplicarTodaMassa}
                onCheckedChange={setAplicarTodaMassa}
              />
              <Label htmlFor="aplicar_toda_massa" className="text-sm font-medium">
                Aplicar toda a massa remanescente nesta rua ({massaRemanescente.toFixed(3)}t)
              </Label>
            </div>
          )}

          {/* Resultados Calculados */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <h4 className="font-medium text-gray-900">Cálculos Automáticos</h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Área:</span>
                <span className="ml-2 font-medium">
                  {((watchComprimento || 0) * (watchLargura || 0)).toFixed(2)} m²
                </span>
              </div>
              <div>
                <span className="text-gray-600">Tonelada aplicada:</span>
                <span className="ml-2 font-medium">
                  {calculatedValues.toneladaAplicada.toFixed(3)}t
                </span>
              </div>
              <div>
                <span className="text-gray-600">Espessura:</span>
                <span className="ml-2 font-medium">
                  {calculatedValues.espessura.toFixed(2)} cm
                </span>
                {calculatedValues.espessuraStatus && (
                  <Badge 
                    variant={calculatedValues.espessuraStatus === 'success' ? 'default' : 'destructive'}
                    className="ml-2 text-xs"
                  >
                    {getEspessuraStatusText(calculatedValues.espessuraStatus, aplicarTodaMassa)}
                  </Badge>
                )}
              </div>
              <div>
                <span className="text-gray-600">Nova massa remanescente:</span>
                <span className="ml-2 font-medium">
                  {aplicarTodaMassa && massaRemanescente <= 0.02 ? (
                    <>
                      0.000t 
                      <Badge variant="outline" className="ml-2 text-xs">
                        Será zerado automaticamente
                      </Badge>
                    </>
                  ) : (
                    `${calculatedValues.massaRemanescente.toFixed(3)}t`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label htmlFor="observacoes_aplicacao">Observações</Label>
            <Textarea
              id="observacoes_aplicacao"
              {...register('observacoes_aplicacao')}
              placeholder="Observações sobre a aplicação..."
              rows={3}
            />
          </div>

          {/* Botões */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isSubmitting || isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting || isLoading ? 'Salvando...' : (editingAplicacao ? 'Atualizar' : 'Salvar')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default NovaAplicacaoForm;