
import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RegistroAplicacao } from '@/types/registroAplicacao';
import { getEspessuraCalculadaStatus, getEspessuraCalculadaStatusText } from '@/utils/aplicacaoCalculations';

interface RegistroAplicacaoViewModalProps {
  registro: RegistroAplicacao;
  isOpen: boolean;
  onClose: () => void;
}

export const RegistroAplicacaoViewModal: React.FC<RegistroAplicacaoViewModalProps> = ({
  registro,
  isOpen,
  onClose,
}) => {
  const getStatusDisplay = () => {
    if (registro.espessura_calculada) {
      const status = getEspessuraCalculadaStatus(registro.espessura_calculada);
      const text = getEspessuraCalculadaStatusText(status);
      const variant = status === 'success' ? 'default' : 'destructive';
      return <Badge variant={variant}>{text}</Badge>;
    }
    return <Badge variant="secondary">Não calculado</Badge>;
  };

  const centroCusto = 
    registro.lista_entrega?.centro_custo_nome ||
    registro.lista_entrega?.centro_custo?.nome_centro_custo ||
    registro.lista_entrega?.requisicao?.centro_custo?.nome_centro_custo ||
    "N/A";

  const logradouro = registro.logradouro_aplicado || 
                    registro.lista_entrega?.logradouro ||
                    "N/A";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Registro de Aplicação</DialogTitle>
          <DialogDescription>
            Visualização completa dos dados do registro
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Dados Básicos */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Data da Aplicação</label>
              <p className="text-sm text-gray-900">
                {registro.data_aplicacao ? 
                  format(new Date(registro.data_aplicacao), "dd/MM/yyyy", { locale: ptBR }) : 
                  "N/A"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Hora de Chegada</label>
              <p className="text-sm text-gray-900">
                {registro.hora_chegada_local || "N/A"}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Logradouro</label>
              <p className="text-sm text-gray-900">{logradouro}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Centro de Custo</label>
              <p className="text-sm text-gray-900">{centroCusto}</p>
            </div>
          </div>

          {/* Dados do Caminhão */}
          <div>
            <h3 className="text-lg font-medium mb-3">Dados do Caminhão</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Caminhão</label>
                <p className="text-sm text-gray-900">
                  {registro.lista_entrega?.caminhao ? 
                    `${registro.lista_entrega.caminhao.placa} - ${registro.lista_entrega.caminhao.modelo}` : 
                    "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Tipo de Lançamento</label>
                <p className="text-sm text-gray-900">
                  {registro.lista_entrega?.tipo_lancamento || "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Dados Técnicos */}
          <div>
            <h3 className="text-lg font-medium mb-3">Dados Técnicos</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Comprimento (m)</label>
                <p className="text-sm text-gray-900">
                  {registro.comprimento || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Largura Média (m)</label>
                <p className="text-sm text-gray-900">
                  {registro.largura_media || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Área Calculada (m²)</label>
                <p className="text-sm text-gray-900">
                  {registro.area_calculada || registro.area || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Qtd. Massa Real (t)</label>
                <p className="text-sm text-gray-900">
                  {registro.registro_carga?.tonelada_real || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Espessura Calculada (cm)</label>
                <p className="text-sm text-gray-900">
                  {registro.espessura_calculada || "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Status</label>
                <div>{getStatusDisplay()}</div>
              </div>
            </div>
          </div>

          {/* Dados de Aplicação */}
          {(registro.hora_aplicacao || registro.temperatura_aplicacao || registro.bordo) && (
            <div>
              <h3 className="text-lg font-medium mb-3">Dados de Aplicação</h3>
              <div className="grid grid-cols-3 gap-4">
                {registro.hora_aplicacao && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Hora da Aplicação</label>
                    <p className="text-sm text-gray-900">{registro.hora_aplicacao}</p>
                  </div>
                )}
                {registro.temperatura_aplicacao && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Temperatura da Aplicação (°C)</label>
                    <p className="text-sm text-gray-900">{registro.temperatura_aplicacao}</p>
                  </div>
                )}
                {registro.bordo && (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Bordo</label>
                    <p className="text-sm text-gray-900">{registro.bordo}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Anotações */}
          {registro.anotacoes_apontador && (
            <div>
              <label className="text-sm font-medium text-gray-700">Anotações do Apontador</label>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-md">
                {registro.anotacoes_apontador}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
