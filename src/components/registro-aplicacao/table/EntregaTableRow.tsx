
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import EntregaStatusBadge from "./EntregaStatusBadge";
import EntregaActionButtons from "./EntregaActionButtons";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

interface EntregaTableRowProps {
  entrega: ListaProgramacaoEntrega;
  onEntregaClick: (entrega: ListaProgramacaoEntrega) => void;
}

const EntregaTableRow: React.FC<EntregaTableRowProps> = ({ entrega, onEntregaClick }) => {
  const isClickable = entrega.status === "Enviada";
  
  // Get centro de custo name - priority order: centro_custo_nome, centro_custo relation, requisicao relation
  const centroCustoNome = 
    entrega.centro_custo_nome ||
    entrega.centro_custo?.nome_centro_custo ||
    entrega.requisicao?.centro_custo?.nome_centro_custo ||
    "N/A";
  
  return (
    <TableRow 
      className={isClickable ? "hover:bg-amber-50 dark:hover:bg-amber-950/20 cursor-pointer" : ""}
      onClick={() => isClickable ? onEntregaClick(entrega) : null}
    >
      <TableCell>{formatBrazilianDateForDisplay(entrega.data_entrega)}</TableCell>
      <TableCell className="max-w-[200px] truncate" title={centroCustoNome}>
        {centroCustoNome}
      </TableCell>
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
