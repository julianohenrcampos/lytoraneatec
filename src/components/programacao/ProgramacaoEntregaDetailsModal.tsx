
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProgramacaoEntregaWithItems } from "@/types/programacaoEntrega";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck, Calendar, Building, Table } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Table as UITable,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ProgramacaoEntregaDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  programacao: ProgramacaoEntregaWithItems | null;
}

const ProgramacaoEntregaDetailsModal: React.FC<ProgramacaoEntregaDetailsModalProps> = ({
  isOpen,
  onClose,
  programacao,
}) => {
  if (!programacao) return null;

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
    } catch (e) {
      return dateString;
    }
  };

  const renderStatusBadge = (status: string | undefined) => {
    if (status === 'Cancelada') {
      return <Badge variant="destructive">Cancelada</Badge>;
    }
    return <Badge variant="default">Ativa</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detalhes da Programação de Entrega</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center">
                <Building className="mr-2 h-4 w-4" />
                Requisição
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Número:</dt>
                  <dd className="font-medium">{programacao.requisicao?.numero || "N/A"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Centro de Custo:</dt>
                  <dd className="font-medium">{programacao.centro_custo?.nome_centro_custo || "N/A"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium flex items-center">
                <Calendar className="mr-2 h-4 w-4" />
                Detalhes da Entrega
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Data de Entrega:</dt>
                  <dd className="font-medium">{formatDate(programacao.data_entrega)}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        <Separator className="my-4" />

        <div>
          <h3 className="font-medium text-base flex items-center mb-4">
            <Table className="mr-2 h-4 w-4" />
            Lista de Entregas
          </h3>

          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <UITable>
                <TableHeader>
                  <TableRow>
                    <TableHead>Logradouro</TableHead>
                    <TableHead>Quantidade de Massa (t)</TableHead>
                    <TableHead>Tipo de Lançamento</TableHead>
                    <TableHead>Caminhão</TableHead>
                    <TableHead>Equipe</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Usina</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programacao.itens && programacao.itens.length > 0 ? (
                    programacao.itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.logradouro}</TableCell>
                        <TableCell>{item.quantidade_massa}</TableCell>
                        <TableCell>{item.tipo_lancamento === 'Acabadora' ? 'Acabadora' : 'Manual'}</TableCell>
                        <TableCell>{item.caminhao ? `${item.caminhao.placa} - ${item.caminhao.modelo}` : "N/A"}</TableCell>
                        <TableCell>{item.equipe?.nome_equipe || "N/A"}</TableCell>
                        <TableCell>{renderStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.usina?.nome_usina || "N/A"}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-4">
                        Nenhum item de entrega cadastrado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </UITable>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProgramacaoEntregaDetailsModal;
