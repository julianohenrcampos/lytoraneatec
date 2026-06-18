import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LinhaMAT } from "@/lib/planejamentoMacro/planoSemanal/tipos";

const TabelaMateriaisSemanal: React.FC<{ rows: LinhaMAT[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div className="border rounded-md p-6 text-center text-sm text-muted-foreground bg-muted/30">
        Sem materiais previstos para esta semana.
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Material</TableHead>
            <TableHead>Unidade</TableHead>
            <TableHead className="text-right">Qtd na semana</TableHead>
            <TableHead>Atividades</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r, i) => (
            <TableRow key={`${r.descricao}-${r.unidade}-${i}`}>
              <TableCell className="font-medium">
                {r.descricao}
                {r.unidadesDivergentes ? (
                  <Badge variant="destructive" className="ml-2 text-[10px]">
                    unidades divergentes
                  </Badge>
                ) : null}
              </TableCell>
              <TableCell>{r.unidade}</TableCell>
              <TableCell className="text-right">{r.quantidadeSemana}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {r.atividades
                  .slice(0, 3)
                  .map((a) => (a.wbs ? `${a.wbs} ${a.nome}` : a.nome))
                  .join("; ")}
                {r.atividades.length > 3 ? ` (+${r.atividades.length - 3})` : ""}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TabelaMateriaisSemanal;
