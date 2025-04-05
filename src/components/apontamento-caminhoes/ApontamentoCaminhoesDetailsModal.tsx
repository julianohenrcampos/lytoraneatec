
import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApontamentoCaminhao, ApontamentoInspecao } from "@/services/apontamentoCaminhoesService";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface ApontamentoCaminhoesDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apontamento: ApontamentoCaminhao | null;
  inspecao: ApontamentoInspecao | null;
  isLoading?: boolean;
}

const ApontamentoCaminhoesDetailsModal: React.FC<ApontamentoCaminhoesDetailsModalProps> = ({
  isOpen,
  onClose,
  apontamento,
  inspecao,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  const renderStatusBadge = (status: string | null) => {
    if (!status) return <Badge variant="outline">Não informado</Badge>;
    
    switch(status.toLowerCase()) {
      case 'c':
      case 'conforme':
        return <Badge className="bg-green-500">Conforme</Badge>;
      case 'nc':
      case 'não conforme':
        return <Badge variant="destructive">Não Conforme</Badge>;
      case 'na':
      case 'não aplicável':
        return <Badge variant="secondary">Não Aplicável</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="md:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Detalhes do Apontamento</DialogTitle>
        </DialogHeader>
        
        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium">Informações Básicas</h3>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Data do Registro</p>
                    <p>
                      {apontamento?.data
                        ? format(new Date(apontamento.data), "dd/MM/yyyy", { locale: ptBR })
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Caminhão/Equipamento</p>
                    <p>{apontamento?.veiculo_identificacao || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Operador</p>
                    <p>{apontamento?.nome_operador || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Centro de Custo</p>
                    <p>{apontamento?.nome_centro_custo || "-"}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium">Dados Operacionais</h3>
                <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Horímetro Inicial</p>
                    <p>{apontamento?.horimetro_inicial || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Horímetro Final</p>
                    <p>{apontamento?.horimetro_final || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Abastecimento (L)</p>
                    <p>{apontamento?.abastecimento || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hora Inicial</p>
                    <p>{apontamento?.hora_inicial || "-"}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hora Final</p>
                    <p>{apontamento?.hora_final || "-"}</p>
                  </div>
                </div>
              </div>

              {inspecao && (
                <div>
                  <h3 className="text-lg font-medium">Checklist de Inspeção</h3>
                  <div className="mt-2 space-y-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Item</TableHead>
                          <TableHead className="text-center">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell>Nível de óleo</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.nivel_oleo)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Nível de água</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.nivel_agua)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Nível de combustível</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.nivel_combustivel)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Drenagem tanque de ar</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.drenagem_tanque_ar)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Material rodante</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.material_rodante)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Cinto de segurança</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.cinto_seguranca)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Material de desgaste</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.material_desgaste)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Estado de implementos</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.estado_implementos)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Tacógrafo</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.tacografo)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Limpeza interna</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.limpeza_interna)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Sistema elétrico</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.sistema_eletrico)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Documentação</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.documentacao)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Engate do reboque</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.engate_reboque)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Estado dos equipamentos</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.estado_equipamentos)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Inspeção veicular</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.inspecao_veicular)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>Material de amarração</TableCell>
                          <TableCell className="text-center">{renderStatusBadge(inspecao.material_amarracao)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>

                    {inspecao.anotacoes && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Anotações</p>
                        <p className="whitespace-pre-line">{inspecao.anotacoes}</p>
                      </div>
                    )}

                    {inspecao.fotos_avarias && inspecao.fotos_avarias.length > 0 && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Fotos de Avarias</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                          {inspecao.fotos_avarias.map((foto, index) => (
                            <div key={index} className="relative aspect-square rounded-md overflow-hidden">
                              <img 
                                src={foto} 
                                alt={`Avaria ${index + 1}`} 
                                className="object-cover w-full h-full"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ApontamentoCaminhoesDetailsModal;
