
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import EntregaStatusBadge from "./EntregaStatusBadge";
import EntregaActionButtons from "./EntregaActionButtons";
import { normalizeDateToNoon } from "@/lib/utils";

interface EntregaTableRowProps {
  entrega: ListaProgramacaoEntrega;
  onEntregaClick: (entrega: ListaProgramacaoEntrega) => void;
}

const EntregaTableRow: React.FC<EntregaTableRowProps> = ({ entrega, onEntregaClick }) => {
  const isClickable = entrega.status === "Enviada";
  
  // Normalize the date to avoid timezone issues and ensure correct display
  const formatEntregaDate = (dateString: string) => {
    try {
      const normalizedDate = normalizeDateToNoon(dateString);
      return format(normalizedDate, "dd/MM/yyyy", { locale: ptBR });
    } catch (error) {
      console.error("Error formatting entrega date:", error, "for date:", dateString);
      return dateString;
    }
  };
  
  return (
    <TableRow 
      className={isClickable ? "hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer" : ""}
      onClick={() => isClickable ? onEntregaClick(entrega) : null}
    >
      <TableCell>{formatEntregaDate(entrega.data_entrega)}</TableCell>
      <TableCell>{entrega.centro_custo_nome || entrega.logradouro}</TableCell>
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
