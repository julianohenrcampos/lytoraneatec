
import React from "react";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { Table, TableBody } from "@/components/ui/table";
import EntregaTableHeader from "./table/EntregaTableHeader";
import EntregaTableRow from "./table/EntregaTableRow";
import EmptyEntregasMessage from "./table/EmptyEntregasMessage";

interface EntregasTableProps {
  entregas: ListaProgramacaoEntrega[];
  onEntregaClick: (entrega: ListaProgramacaoEntrega) => void;
}

const EntregasTable: React.FC<EntregasTableProps> = ({ entregas, onEntregaClick }) => {
  if (entregas.length === 0) {
    return <EmptyEntregasMessage />;
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <EntregaTableHeader />
        <TableBody>
          {entregas.map((entrega) => (
            <EntregaTableRow 
              key={entrega.id}
              entrega={entrega}
              onEntregaClick={onEntregaClick}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default EntregasTable;
