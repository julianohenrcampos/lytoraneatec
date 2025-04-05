
import React from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Clipboard, TruckIcon, CheckCircle } from "lucide-react";

interface EntregasTableProps {
  entregas: ListaProgramacaoEntrega[];
  onEntregaClick: (entrega: ListaProgramacaoEntrega) => void;
}

const EntregasTable: React.FC<EntregasTableProps> = ({ entregas, onEntregaClick }) => {
  const statusColor = (status: string) => {
    switch (status) {
      case "Pendente": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300";
      case "Enviada": return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300";
      case "Entregue": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "Cancelada": return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  if (entregas.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        Nenhuma entrega encontrada.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Logradouro</TableHead>
            <TableHead>Caminhão</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Qtd. Massa (t)</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entregas.map((entrega) => (
            <TableRow key={entrega.id}>
              <TableCell>{format(new Date(entrega.data_entrega), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
              <TableCell>{entrega.logradouro}</TableCell>
              <TableCell>
                {entrega.caminhao ? 
                  `${entrega.caminhao.placa} - ${entrega.caminhao.modelo}` : 
                  "N/A"}
              </TableCell>
              <TableCell>{entrega.equipe?.nome_equipe || "N/A"}</TableCell>
              <TableCell>{entrega.quantidade_massa}</TableCell>
              <TableCell>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(entrega.status)}`}>
                  {entrega.status}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {entrega.status === "Pendente" ? (
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={() => onEntregaClick(entrega)}
                    aria-label="Registrar carga"
                  >
                    <TruckIcon className="h-4 w-4" />
                  </Button>
                ) : entrega.status === "Entregue" ? (
                  <div className="flex justify-end" aria-label="Entrega concluída">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Clipboard className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EntregasTable;
