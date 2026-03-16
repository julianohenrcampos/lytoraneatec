
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Loader2, Wrench, Truck, Building2, User, AlertTriangle, Calendar, ImageIcon } from "lucide-react";

interface ChamadoDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConvert: (chamado: any) => void;
  chamado: any | null;
  isLoading: boolean;
}

const ChamadoDetailsModal: React.FC<ChamadoDetailsModalProps> = ({
  isOpen,
  onClose,
  onConvert,
  chamado,
  isLoading
}) => {
  if (!chamado) return null;

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'Emergencial':
        return <Badge variant="destructive">🔴 {priority}</Badge>;
      case 'Alta':
        return <Badge variant="outline" className="bg-orange-100 text-orange-800 border-orange-300">🟠 {priority}</Badge>;
      case 'Média':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">🟡 {priority}</Badge>;
      case 'Baixa':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">🟢 {priority}</Badge>;
      default:
        return <Badge variant="secondary">{priority}</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aberto':
        return <Badge variant="destructive">{status}</Badge>;
      case 'Convertido para OS':
      case 'OS em Andamento':
        return <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">{status}</Badge>;
      case 'Concluído':
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">{status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const isChamadoConvertido = (status: string) => {
    return status === 'Convertido para OS' || status === 'OS em Andamento' || status === 'Concluído';
  };

  const isConvertedOrProcessing = isChamadoConvertido(chamado.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4 border-b">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <DialogTitle className="text-xl font-semibold">
              Chamado #{chamado.numero_chamado}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {getStatusBadge(chamado.status)}
              {getPriorityBadge(chamado.prioridade)}
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
            <Calendar className="h-4 w-4" />
            <span>
              {format(new Date(chamado.data_solicitacao), "dd/MM/yyyy", { locale: ptBR })}
              {chamado.hora_solicitacao && (
                <span> às {chamado.hora_solicitacao.substring(0, 5)}</span>
              )}
            </span>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
          {/* Coluna Esquerda - Informações Principais */}
          <div className="space-y-4">
            {/* Caminhão/Equipamento */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Caminhão/Equipamento</h3>
              </div>
              {chamado.caminhao_equipamento ? (
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="font-medium">{chamado.caminhao_equipamento.placa || chamado.caminhao_equipamento.modelo}</p>
                  <p className="text-sm text-muted-foreground">
                    {chamado.caminhao_equipamento.tipo_veiculo} {chamado.caminhao_equipamento.fabricante} {chamado.caminhao_equipamento.modelo}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum caminhão/equipamento associado</p>
              )}
            </div>

            {/* Obra/Centro de Custo */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Obra/Centro de Custo</h3>
              </div>
              {chamado.centro_custo ? (
                <div className="bg-muted/50 p-3 rounded-md">
                  <p className="font-medium">{chamado.centro_custo.codigo_centro_custo}</p>
                  <p className="text-sm text-muted-foreground">{chamado.centro_custo.nome_centro_custo}</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum centro de custo associado</p>
              )}
            </div>

            {/* Tipo de Falha e Solicitante */}
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Tipo de Falha</h3>
                </div>
                <p className="text-sm">{chamado.tipo_falha || "Não especificado"}</p>
              </div>
              
              <div className="border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Solicitante</h3>
                </div>
                {chamado.solicitante ? (
                  <p className="text-sm">{chamado.solicitante.nome_completo || chamado.solicitante.email}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Não especificado</p>
                )}
              </div>
            </div>
          </div>

          {/* Coluna Direita - Descrição e Fotos */}
          <div className="space-y-4">
            {/* Descrição do Problema */}
            <div className="border rounded-lg p-4 h-fit">
              <h3 className="text-sm font-medium mb-3">Descrição do Problema</h3>
              <div className="bg-muted/50 p-3 rounded-md min-h-[80px]">
                <p className="text-sm whitespace-pre-wrap">{chamado.descricao_problema || "Sem descrição"}</p>
              </div>
            </div>

            {/* Fotos de Avarias */}
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium">Fotos de Avarias</h3>
              </div>
              {chamado.fotos_avarias && chamado.fotos_avarias.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {chamado.fotos_avarias.map((foto: string, index: number) => (
                    <a 
                      key={index}
                      href={foto}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative group"
                    >
                      <img 
                        src={foto} 
                        alt={`Avaria ${index + 1}`} 
                        className="h-24 w-full object-cover rounded-md transition-transform group-hover:scale-105 cursor-pointer"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma foto registrada</p>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Fechar
          </Button>
          {!isConvertedOrProcessing && (
            <Button 
              onClick={() => onConvert(chamado)}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Convertendo...
                </>
              ) : (
                <>
                  <Wrench className="mr-2 h-4 w-4" />
                  Converter para OS
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ChamadoDetailsModal;
