
import React from "react";
import { UseFormReturn } from "react-hook-form";
import WeightInput from "./WeightInput";
import ImageUpload from "./ImageUpload";

interface PesagemSectionProps {
  form: UseFormReturn<any>;
  ticketSaidaPreview: string | null;
  ticketRetornoPreview: string | null;
  handleTicketSaidaChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTicketRetornoChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const PesagemSection: React.FC<PesagemSectionProps> = ({
  form,
  ticketSaidaPreview,
  ticketRetornoPreview,
  handleTicketSaidaChange,
  handleTicketRetornoChange,
}) => {
  // Função para calcular tonelada real com validação - formato correto com 1 casa decimal
  const calcularToneladaReal = (): string => {
    try {
      const toneladaSaida = form.watch("tonelada_saida");
      const toneladaRetorno = form.watch("tonelada_retorno");

      console.log("PesagemSection - Valores para cálculo:", { toneladaSaida, toneladaRetorno });

      // Validar tonelada de saída
      const saidaNum = Number(toneladaSaida);
      if (isNaN(saidaNum) || saidaNum < 0) {
        return "0.0 t";
      }

      // Validar tonelada de retorno (pode ser null ou undefined)
      let retornoNum = 0;
      if (toneladaRetorno !== null && toneladaRetorno !== undefined) {
        retornoNum = Number(toneladaRetorno);
        if (isNaN(retornoNum) || retornoNum < 0) {
          retornoNum = 0;
        }
      }

      const resultado = saidaNum - retornoNum;
      console.log("PesagemSection - Resultado calculado:", resultado);

      // Formato correto: 1 casa decimal (ex: 2.5 t)
      return `${Math.max(0, resultado).toFixed(1)} t`;
    } catch (error) {
      console.error("PesagemSection - Erro no cálculo:", error);
      return "0.0 t";
    }
  };

  return (
    <div>
      <h3 className="text-lg font-medium mb-4">Dados da Pesagem</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <WeightInput
            form={form}
            name="tonelada_saida"
            label="Peso da Balança (kg)"
          />
          
          <ImageUpload
            form={form}
            name="imagem_ticket_saida"
            label="Imagem do Ticket (Saída)"
            inputId="ticketSaida"
            preview={ticketSaidaPreview}
            onImageChange={handleTicketSaidaChange}
            icon="camera"
          />
        </div>
        
        <div className="space-y-4">
          <WeightInput
            form={form}
            name="tonelada_retorno"
            label="Peso da Balança - Retorno (kg)"
            isRetorno={true}
          />
          
          <ImageUpload
            form={form}
            name="imagem_ticket_retorno"
            label="Imagem do Ticket (Retorno)"
            inputId="ticketRetorno"
            preview={ticketRetornoPreview}
            onImageChange={handleTicketRetornoChange}
            icon="upload"
          />
        </div>
      </div>
      
      <div className="mt-6 p-4 bg-muted rounded-md">
        <div className="flex justify-between items-center">
          <h4 className="text-sm font-medium">Tonelada Real (Aplicada)</h4>
          <div className="text-xl font-bold">
            {calcularToneladaReal()}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Calculado automaticamente (Tonelada de Saída - Tonelada de Retorno)
        </p>
      </div>
    </div>
  );
};

export default PesagemSection;
