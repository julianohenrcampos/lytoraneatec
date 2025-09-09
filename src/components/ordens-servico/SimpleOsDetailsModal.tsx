import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { OrdemServico } from "@/types/ordemServico";

interface SimpleOsDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  os: OrdemServico | null;
  isLoading: boolean;
}

const SimpleOsDetailsModal: React.FC<SimpleOsDetailsModalProps> = ({
  isOpen,
  onClose,
  os,
  isLoading
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aberta':
        return <Badge variant="destructive">{status}</Badge>;
      case 'Em Andamento':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">{status}</Badge>;
      case 'Concluída':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">{status}</Badge>;
      case 'Cancelada':
        return <Badge variant="secondary">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (!os) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            Ordem de Serviço {os.numero_os}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Número OS</label>
              <p className="text-gray-900">{os.numero_os}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Status</label>
              <div>{getStatusBadge(os.status)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Data Abertura</label>
              <p className="text-gray-900">
                {formatBrazilianDateForDisplay(os.data_abertura)}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Tipo de Serviço</label>
              <p className="text-gray-900">{os.tipo_servico || "N/A"}</p>
            </div>
          </div>

          {os.data_previsao && (
            <div>
              <label className="text-sm font-medium text-gray-700">Data Previsão</label>
              <p className="text-gray-900">
                {formatBrazilianDateForDisplay(os.data_previsao as any)}
              </p>
            </div>
          )}

          {os.data_conclusao && (
            <div>
              <label className="text-sm font-medium text-gray-700">Data Conclusão</label>
              <p className="text-gray-900">
                {formatBrazilianDateForDisplay(os.data_conclusao as any)}
              </p>
            </div>
          )}

          {os.caminhao_equipamento && (
            <div>
              <label className="text-sm font-medium text-gray-700">Caminhão/Equipamento</label>
              <p className="text-gray-900">
                {os.caminhao_equipamento.placa} - {os.caminhao_equipamento.marca} {os.caminhao_equipamento.modelo}
              </p>
            </div>
          )}

          {os.descricao_servico && (
            <div>
              <label className="text-sm font-medium text-gray-700">Descrição do Serviço</label>
              <p className="text-gray-900">{os.descricao_servico}</p>
            </div>
          )}

          {os.observacoes && (
            <div>
              <label className="text-sm font-medium text-gray-700">Observações</label>
              <p className="text-gray-900">{os.observacoes}</p>
            </div>
          )}

          {os.valor_servico && (
            <div>
              <label className="text-sm font-medium text-gray-700">Valor do Serviço</label>
              <p className="text-gray-900">
                {new Intl.NumberFormat('pt-BR', { 
                  style: 'currency', 
                  currency: 'BRL' 
                }).format(os.valor_servico)}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SimpleOsDetailsModal;