
import React from "react";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, Edit, Eye, Loader2, Trash, X, ShieldCheck, Globe, RefreshCw } from "lucide-react";
import { Empresa } from "@/types/empresa";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface EmpresaTableProps {
  empresas: Empresa[] | undefined;
  isLoading: boolean;
  isError: boolean;
  onEdit: (empresa: Empresa) => void;
  onView: (empresa: Empresa) => void;
  onDelete: (empresa: Empresa) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

const isRecent24h = (dateStr?: string | null): boolean => {
  if (!dateStr) return false;
  const diff = Date.now() - new Date(dateStr).getTime();
  return diff < 24 * 60 * 60 * 1000;
};

const EmpresaTable: React.FC<EmpresaTableProps> = ({
  empresas,
  isLoading,
  isError,
  onEdit,
  onView,
  onDelete,
  canEdit = true,
  canDelete = true,
}) => {
  const pagination = usePagination(empresas || [], { pageSize: 10 });

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
      <div className="p-6">
        <div className="relative w-full overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px]">Nome da Empresa</TableHead>
                <TableHead>CNPJ</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      <span>Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Erro ao carregar os dados. Tente novamente.
                  </TableCell>
                </TableRow>
              ) : empresas && empresas.length > 0 ? (
                pagination.paginatedData.map((empresa) => {
                  const isSite = empresa.origem_cadastro === 'integracao_site';
                  const isUpdatedViaSite = empresa.atualizado_via_integracao === true;
                  const isNew24h = isRecent24h(empresa.data_integracao);

                  return (
                    <TableRow 
                      key={empresa.id}
                      className={isNew24h ? 'bg-blue-50/50 dark:bg-blue-950/20 border-l-2 border-l-blue-400' : ''}
                    >
                      <TableCell 
                        className="font-medium cursor-pointer hover:text-primary"
                        onClick={() => onView(empresa)}
                      >
                        <div className="flex items-center gap-2">
                          <span>{empresa.nome_empresa}</span>
                          <TooltipProvider>
                            {isSite && empresa.aprovado_compliance && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <ShieldCheck className="h-4 w-4 text-blue-500 flex-shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Empresa cadastrada via portal de fornecedores e aprovada no compliance</p>
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </TooltipProvider>
                        </div>
                      </TableCell>
                      <TableCell>{empresa.cnpj}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium">
                          {empresa.tipo_empresa === 'PROPRIA' ? 'Própria' : empresa.tipo_empresa === 'GRUPO' ? 'Grupo' : empresa.tipo_empresa === 'FORNECEDOR' ? 'Fornecedor' : empresa.tipo_empresa || '—'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {isSite ? (
                          <div className="flex items-center gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                              <Globe className="h-3 w-3" />
                              Site
                            </span>
                            {isUpdatedViaSite && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                                <RefreshCw className="h-3 w-3" />
                                Atualizada
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </TableCell>
                      <TableCell>{empresa.telefone || "Não informado"}</TableCell>
                      <TableCell>
                        {empresa.situacao === 'Ativa' ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
                            <Check className="mr-1 h-3 w-3" />
                            Ativa
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                            <X className="mr-1 h-3 w-3" />
                            Inativa
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onEdit(empresa)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onView(empresa)}
                            title="Visualizar"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDelete(empresa)}
                              title="Excluir"
                              className="text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Nenhuma empresa encontrada
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {empresas && empresas.length > 0 && (
          <div className="mt-4">
            <TablePagination pagination={pagination} />
          </div>
        )}
      </div>
    </div>
  );
};

export default EmpresaTable;
