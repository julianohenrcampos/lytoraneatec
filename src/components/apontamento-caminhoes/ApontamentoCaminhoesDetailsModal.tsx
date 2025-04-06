
import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { ApontamentoCaminhao, ApontamentoInspecao } from "@/services/apontamentoCaminhoesService";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ApontamentoCaminhoesDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apontamento: ApontamentoCaminhao | null;
  inspecao: ApontamentoInspecao | null;
  isLoading: boolean;
}

const ApontamentoCaminhoesDetailsModal: React.FC<ApontamentoCaminhoesDetailsModalProps> = ({
  isOpen,
  onClose,
  apontamento,
  inspecao,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState('dados');
  const isMobile = useIsMobile();

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[600px]">
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!apontamento) {
    return null;
  }

  const isVehicleTruck = 
    apontamento.veiculo_identificacao?.toLowerCase().includes('caminhão') ||
    (apontamento.veiculo_identificacao?.includes('-') && apontamento.veiculo_identificacao?.includes(' '));

  const getHorimetroLabel = (isFinal = false) => {
    if (isVehicleTruck) {
      return isFinal ? "Hodômetro Final (KM)" : "Hodômetro Inicial (KM)"; 
    }
    return isFinal ? "Horímetro Final" : "Horímetro Inicial";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={cn("sm:max-w-[700px]", isMobile ? "p-3" : "")}>
        <DialogHeader>
          <DialogTitle>Detalhes do Apontamento</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="dados" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={cn("grid w-full mb-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            <TabsTrigger value="dados">Dados Operacionais</TabsTrigger>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
          </TabsList>
          
          <TabsContent value="dados">
            <ScrollArea className="h-[60vh] md:h-[400px] pr-4">
              <dl className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Data</dt>
                    <dd className="mt-1">
                      {apontamento.data ? format(new Date(apontamento.data), 'dd/MM/yyyy') : 'N/A'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Operador</dt>
                    <dd className="mt-1">{apontamento.nome_operador || 'N/A'}</dd>
                  </div>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-600">Caminhão/Equipamento</dt>
                  <dd className="mt-1">{apontamento.veiculo_identificacao || 'N/A'}</dd>
                </div>
                
                <div>
                  <dt className="text-sm font-medium text-gray-600">Centro de Custo</dt>
                  <dd className="mt-1">{apontamento.nome_centro_custo || 'N/A'}</dd>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">{getHorimetroLabel()}</dt>
                    <dd className="mt-1">{apontamento.horimetro_inicial || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">{getHorimetroLabel(true)}</dt>
                    <dd className="mt-1">{apontamento.horimetro_final || 'N/A'}</dd>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Hora Inicial</dt>
                    <dd className="mt-1">{apontamento.hora_inicial || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Hora Final</dt>
                    <dd className="mt-1">{apontamento.hora_final || 'N/A'}</dd>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Situação</dt>
                    <dd className="mt-1">{apontamento.situacao || 'N/A'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-600">Abastecimento</dt>
                    <dd className="mt-1">{apontamento.abastecimento ? `${apontamento.abastecimento} litros` : 'N/A'}</dd>
                  </div>
                </div>
              </dl>
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="checklist">
            <ScrollArea className="h-[60vh] md:h-[400px] pr-4">
              {inspecao ? (
                <dl className="space-y-4">
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Documentação</dt>
                      <dd className="mt-1">{inspecao.documentacao || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Tacógrafo</dt>
                      <dd className="mt-1">{inspecao.tacografo || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Sistema Elétrico</dt>
                      <dd className="mt-1">{inspecao.sistema_eletrico || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Nível Óleo</dt>
                      <dd className="mt-1">{inspecao.nivel_oleo || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Nível Água</dt>
                      <dd className="mt-1">{inspecao.nivel_agua || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Nível Combustível</dt>
                      <dd className="mt-1">{inspecao.nivel_combustivel || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Drenagem Tanque Ar</dt>
                      <dd className="mt-1">{inspecao.drenagem_tanque_ar || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Material Rodante</dt>
                      <dd className="mt-1">{inspecao.material_rodante || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Cinto de Segurança</dt>
                      <dd className="mt-1">{inspecao.cinto_seguranca || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Material de Desgaste</dt>
                      <dd className="mt-1">{inspecao.material_desgaste || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Estado dos Implementos</dt>
                      <dd className="mt-1">{inspecao.estado_implementos || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Limpeza Interna</dt>
                      <dd className="mt-1">{inspecao.limpeza_interna || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Engate Reboque</dt>
                      <dd className="mt-1">{inspecao.engate_reboque || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Estado dos Equipamentos</dt>
                      <dd className="mt-1">{inspecao.estado_equipamentos || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  <div className={cn("grid gap-4", isMobile ? "grid-cols-1" : "grid-cols-2")}>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Inspeção Veicular</dt>
                      <dd className="mt-1">{inspecao.inspecao_veicular || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Material de Amarração</dt>
                      <dd className="mt-1">{inspecao.material_amarracao || 'N/A'}</dd>
                    </div>
                  </div>
                  
                  {inspecao.anotacoes && (
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Anotações</dt>
                      <dd className="mt-1">{inspecao.anotacoes}</dd>
                    </div>
                  )}
                  
                  {inspecao.fotos_avarias && inspecao.fotos_avarias.length > 0 && (
                    <div>
                      <dt className="text-sm font-medium text-gray-600">Fotos de Avarias</dt>
                      <dd className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2">
                        {inspecao.fotos_avarias.map((foto, index) => (
                          <div key={index} className="relative aspect-square">
                            <img
                              src={foto}
                              alt={`Foto de avaria ${index + 1}`}
                              className="object-cover rounded w-full h-full"
                            />
                          </div>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Nenhum dado de checklist disponível</p>
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        <div className="flex justify-end mt-4">
          <Button onClick={onClose} variant="outline" className="w-full md:w-auto">Fechar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoCaminhoesDetailsModal;
