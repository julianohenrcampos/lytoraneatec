import React, { useState, useCallback } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { gerarPdfBeneficiario, gerarPdfNaoBeneficiario } from '@/services/valeTransporte/pdfGenerator';
import { toast } from 'sonner';
import { ValeTransporteForm, ValeTransporteFormData } from './ValeTransporteForm';
import { NaoBeneficiarioForm, NaoBeneficiarioFormData } from './NaoBeneficiarioForm';
import { CardUpload } from './CardUpload';
import { EnderecoEstruturado } from './ValeTransporteForm';

export interface ValeTransporteStepData {
  isNaoBeneficiario: boolean;
  endereco: EnderecoEstruturado;
  beneficiarioData: ValeTransporteFormData;
  naoBeneficiarioData: NaoBeneficiarioFormData;
  pdfGerado: boolean;
  pdfAssinadoFile?: File;
  comprovanteFile?: File;
  skipped: boolean;
}

interface ValeTransporteStepProps {
  data: ValeTransporteStepData;
  onChange: (data: ValeTransporteStepData) => void;
  candidato: {
    nome: string;
    cpf: string;
    funcao: string;
    empresa: string;
    data_nascimento: string;
    telefone: string;
  };
}

export const ValeTransporteStep: React.FC<ValeTransporteStepProps> = ({ data, onChange, candidato }) => {
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handleToggle = (checked: boolean) => {
    onChange({ ...data, isNaoBeneficiario: checked, skipped: false, pdfGerado: false, pdfAssinadoFile: undefined });
  };

  const handleEnderecoChange = (field: keyof EnderecoEstruturado, value: string) => {
    onChange({ ...data, endereco: { ...data.endereco, [field]: value }, skipped: false });
  };

  const handleBeneficiarioChange = (beneficiarioData: ValeTransporteFormData) => {
    onChange({ ...data, beneficiarioData, skipped: false });
  };

  const handleNaoBeneficiarioChange = (naoBeneficiarioData: NaoBeneficiarioFormData) => {
    onChange({ ...data, naoBeneficiarioData, skipped: false });
  };

  const handleDownloadPdf = useCallback(async () => {
    setIsGeneratingPdf(true);
    try {
      if (data.isNaoBeneficiario) {
        await gerarPdfNaoBeneficiario({
          ...candidato,
          ...data.naoBeneficiarioData,
          endereco: data.endereco,
        });
      } else {
        await gerarPdfBeneficiario({
          ...candidato,
          ...data.beneficiarioData,
          endereco: data.endereco,
        });
      }
      onChange({ ...data, pdfGerado: true, skipped: false });
      toast.success('PDF gerado e baixado com sucesso!');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [data, candidato, onChange]);

  return (
    <div className="space-y-6">
      {/* Toggle principal */}
      <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
        <Label htmlFor="nao-beneficiario-toggle" className="font-medium cursor-pointer">
          Funcionário NÃO necessita de Vale Transporte
        </Label>
        <Switch
          id="nao-beneficiario-toggle"
          checked={data.isNaoBeneficiario}
          onCheckedChange={handleToggle}
        />
      </div>

      {/* Endereço — SEMPRE VISÍVEL */}
      <div className="space-y-2">
        <Label className="font-semibold">Endereço *</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1 space-y-1">
            <Label className="text-xs">Rua *</Label>
            <Input
              value={data.endereco.rua}
              onChange={(e) => handleEnderecoChange('rua', e.target.value)}
              placeholder="Rua / Avenida / Travessa"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Número *</Label>
            <Input
              value={data.endereco.numero}
              onChange={(e) => handleEnderecoChange('numero', e.target.value)}
              placeholder="Nº"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bairro *</Label>
            <Input
              value={data.endereco.bairro}
              onChange={(e) => handleEnderecoChange('bairro', e.target.value)}
              placeholder="Bairro"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cidade *</Label>
            <Input
              value={data.endereco.cidade}
              onChange={(e) => handleEnderecoChange('cidade', e.target.value)}
              placeholder="Cidade"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Estado</Label>
            <Input
              value={data.endereco.estado}
              onChange={(e) => handleEnderecoChange('estado', e.target.value)}
              placeholder="UF"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CEP</Label>
            <Input
              value={data.endereco.cep}
              onChange={(e) => handleEnderecoChange('cep', e.target.value)}
              placeholder="00000-000"
            />
          </div>
        </div>
      </div>

      {/* Formulário condicional */}
      {data.isNaoBeneficiario ? (
        <NaoBeneficiarioForm
          data={data.naoBeneficiarioData}
          onChange={handleNaoBeneficiarioChange}
          candidato={candidato}
        />
      ) : (
        <ValeTransporteForm
          data={data.beneficiarioData}
          onChange={handleBeneficiarioChange}
        />
      )}

      {/* Documentos - Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        <CardUpload
          title={data.isNaoBeneficiario ? 'Baixar Declaração' : 'Baixar Solicitação VT'}
          icon="download"
          done={data.pdfGerado}
          loading={isGeneratingPdf}
          onClick={handleDownloadPdf}
        />
        <CardUpload
          title="Enviar Declaração Assinada"
          icon="upload"
          accept=".pdf,.jpg,.jpeg,.png"
          file={data.pdfAssinadoFile}
          onFileChange={(file) => onChange({ ...data, pdfAssinadoFile: file, skipped: false })}
        />
        {!data.isNaoBeneficiario && (
          <CardUpload
            title="Comprovante de Residência"
            icon="upload"
            accept=".pdf,.jpg,.jpeg,.png"
            file={data.comprovanteFile}
            onFileChange={(file) => onChange({ ...data, comprovanteFile: file, skipped: false })}
          />
        )}
      </div>
    </div>
  );
};
