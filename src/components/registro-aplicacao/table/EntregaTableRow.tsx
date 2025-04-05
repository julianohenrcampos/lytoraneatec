
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import EntregaStatusBadge from "./EntregaStatusBadge";
import EntregaActionButtons from "./EntregaActionButtons";

interface EntregaTableRowProps {
  entrega: ListaProgramacaoEntrega;
  onEntregaClick: (entrega: ListaProgramacaoEntrega) => void;
}

const EntregaTableRow: React.FC<EntregaTableRowProps> = ({ entrega, onEntregaClick }) => {
  const isClickable = entrega.status === "Enviada";
  
  return (
    <TableRow 
      className={isClickable ? "hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer" : ""}
      onClick={() => isClickable ? onEntregaClick(entrega) : null}
    >
      <TableCell>{format(new Date(entrega.data_entrega), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
      <TableCell>{entrega.logradouro}</TableCell>
      <TableCell>
        {entrega.caminhao ? 
          `${entrega.caminhao.placa} - ${entrega.caminhao.modelo}` : 
          "N/A"}
      </TableCell>
      <TableCell>{entrega.equipe?.nome_equipe || "N/A"}</TableCell>
      <TableCell>{entrega.quantidade_massa}</TableCell>
      <TableCell>{entrega.tipo_lancamento}</TableCell>
      <TableCell>
        <EntregaStatusBadge status={entrega.status} />
      </TableCell>
      <TableCell className="text-right">
        <EntregaActionButtons 
          entrega={entrega} 
          onEntregaClick={onEntregaClick} 
        />
      </TableCell>
    </TableRow>
  );
};

export default EntregaTableRow;
