
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
            {(form.watch("tonelada_saida") - (form.watch("tonelada_retorno") || 0)).toFixed(3)} t
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
