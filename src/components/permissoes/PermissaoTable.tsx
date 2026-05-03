
import React from "react";
import { Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { type RBACPermission, type RBACPermissionFilter } from "@/services/rbac/permissionsCRUD";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { Badge } from "@/components/ui/badge";
import { getModuloLabel } from "@/components/permissoes/modulosCatalogo";
import ActionGuard from "./ActionGuard";

interface PermissaoTableProps {
  permissoes: RBACPermission[];
  isLoading: boolean;
  onEdit: (permissao: RBACPermission) => void;
  onDelete: (permissao: RBACPermission) => void;
  filters: RBACPermissionFilter;
  onFilterChange: (name: string, value: any) => void;
  onResetFilters: () => void;
}

const PermissaoTable: React.FC<PermissaoTableProps> = ({
  permissoes,
  isLoading,
  onEdit,
  onDelete,
  filters,
  onFilterChange,
  onResetFilters
}) => {
  const pagination = usePagination(permissoes, { pageSize: 10 });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    onFilterChange(name, value);
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label htmlFor="codigo" className="text-sm font-medium">
              Código da Permissão
            </label>
            <Input
              id="codigo"
              name="codigo"
              value={filters.codigo || ""}
              onChange={handleInputChange}
              placeholder="Filtrar por código"
              className="mt-1"
            />
          </div>
          <div>
            <label htmlFor="rota" className="text-sm font-medium">
              Rota
            </label>
            <Input
              id="rota"
              name="rota"
              value={filters.rota || ""}
              onChange={handleInputChange}
              placeholder="Filtrar por rota"
              className="mt-1"
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={onResetFilters}
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Módulo</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Rota</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : pagination.paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-4">
                  Nenhuma permissão encontrada
                </TableCell>
              </TableRow>
            ) : (
              pagination.paginatedData.map((permissao) => (
                <TableRow key={permissao.id}>
                  <TableCell className="font-mono text-sm">{permissao.codigo}</TableCell>
                  <TableCell>{permissao.nome}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {getModuloLabel(permissao.modulo) ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>{permissao.descricao || "-"}</TableCell>
                  <TableCell>{permissao.rota || "-"}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      <ActionGuard permission="admin_permissoes_view" action="editar">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(permissao)}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Editar</span>
                        </Button>
                      </ActionGuard>
                      <ActionGuard permission="admin_permissoes_view" action="excluir">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(permissao)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Excluir</span>
                        </Button>
                      </ActionGuard>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      {permissoes.length > 0 && (
        <TablePagination pagination={pagination} />
      )}
    </div>
  );
};

export default PermissaoTable;
