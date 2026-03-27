import React from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Loader2, Check, X } from "lucide-react";
import { Frota } from "@/services/frotaService";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface FrotaTableProps {
  frotas: Frota[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onEdit: (frota: Frota) => void;
}

const TIPO_LABELS: Record<string, string> = {
  PROPRIO: "Próprio",
  LOCADO: "Locado",
  TERCEIRO: "Terceiro",
};

const FrotaTable: React.FC<FrotaTableProps> = ({ frotas, isLoading, isError, onEdit }) => {
  const pagination = usePagination(frotas || [], { pageSize: 10 });

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Empresa Vinculada</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Erro ao carregar os dados.
                  </TableCell>
                </TableRow>
              ) : frotas && frotas.length > 0 ? (
                pagination.paginatedData.map((frota) => (
                  <TableRow key={frota.id}>
                    <TableCell className="font-mono font-bold">{frota.codigo}</TableCell>
                    <TableCell>{frota.descricao || "—"}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium">
                        {TIPO_LABELS[frota.tipo_propriedade_padrao || ''] || frota.tipo_propriedade_padrao || "—"}
                      </span>
                    </TableCell>
                    <TableCell>{frota.empresa?.nome_empresa || "—"}</TableCell>
                    <TableCell>
                      {frota.ativo ? (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                          <Check className="mr-1 h-3 w-3" /> Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                          <X className="mr-1 h-3 w-3" /> Inativo
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(frota)} title="Editar">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhuma frota encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        {frotas && frotas.length > 0 && (
          <div className="mt-4">
            <TablePagination pagination={pagination} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FrotaTable;
