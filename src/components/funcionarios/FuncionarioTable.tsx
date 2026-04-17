
import React, { useState } from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye, Pencil, Trash2, ArrowUpCircle, MoreVertical, Printer, FileX2 } from "lucide-react";
import { Funcionario } from "@/types/funcionario";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from "@/lib/utils";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { formatCPF } from "@/utils/textTransform";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useReimprimirClassificacao } from "@/hooks/useReimprimirClassificacao";
import { useExcluirUltimaClassificacao } from "@/hooks/useExcluirUltimaClassificacao";

interface FuncionarioTableProps {
  funcionarios: Funcionario[];
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onEdit: (funcionario: Funcionario) => void;
  onViewDetails: (funcionario: Funcionario) => void;
  onDelete: (funcionario: Funcionario) => void;
  onRefetch: () => void;
  openImageModal?: (funcionario: Funcionario) => void;
  onBaixarClassificacao?: (funcionario: Funcionario) => void;
}

const FuncionarioTable: React.FC<FuncionarioTableProps> = ({
  funcionarios,
  isLoading,
  isError,
  error,
  onEdit,
  onViewDetails,
  onDelete,
  onRefetch,
  openImageModal,
  onBaixarClassificacao,
}) => {
  const pagination = usePagination(funcionarios, { pageSize: 10 });
  const { reimprimir, isLoading: reimprimindo } = useReimprimirClassificacao();
  const { excluir, isLoading: excluindo } = useExcluirUltimaClassificacao();
  const [confirmExcluirId, setConfirmExcluirId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-center p-4">Carregando funcionários...</div>;
  }

  if (isError) {
    const errorMessage = error?.message || "Erro desconhecido ao carregar funcionários";
    return (
      <div className="text-center p-6 space-y-4">
        <div className="text-destructive font-medium">
          Não foi possível carregar os funcionários.
        </div>
        <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md text-left max-w-2xl mx-auto">
          <strong>Detalhes do erro:</strong>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
            {errorMessage}
          </pre>
        </div>
        <Button variant="outline" size="sm" onClick={onRefetch}>
          Tentar novamente
        </Button>
      </div>
    );
  }

  if (funcionarios.length === 0) {
    return <div className="text-center p-4">Nenhum funcionário encontrado.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Foto</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>CPF</TableHead>
              <TableHead>Função</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Data Admissão</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map((funcionario) => (
              <TableRow key={funcionario.id}>
                <TableCell>
                  <Avatar className="h-10 w-10 cursor-pointer" onClick={() => openImageModal && openImageModal(funcionario)}>
                    <AvatarImage 
                      src={funcionario.imagem || `https://ui-avatars.com/api/?name=${encodeURIComponent(funcionario.nome_completo)}&background=random`} 
                      alt={funcionario.nome_completo} 
                    />
                    <AvatarFallback>
                      {funcionario.nome_completo.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </TableCell>
                <TableCell>{funcionario.nome_completo}</TableCell>
                <TableCell>{formatCPF(funcionario.cpf || "")}</TableCell>
                <TableCell>{funcionario.bd_funcoes?.nome_funcao || '-'}</TableCell>
                <TableCell>{funcionario.bd_departamentos?.nome_departamento || '-'}</TableCell>
                <TableCell>{formatDate(funcionario.data_admissao)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onViewDetails(funcionario)}
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onEdit(funcionario)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onBaixarClassificacao && onBaixarClassificacao(funcionario)}
                      title="Baixar Classificação"
                    >
                      <ArrowUpCircle className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="icon" title="Mais ações">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => reimprimir(funcionario.id)}
                          disabled={reimprimindo}
                        >
                          <Printer className="h-4 w-4 mr-2" />
                          Reimprimir Classificação
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmExcluirId(funcionario.id)}
                          disabled={excluindo}
                          className="text-destructive focus:text-destructive"
                        >
                          <FileX2 className="h-4 w-4 mr-2" />
                          Excluir Classificação
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => onDelete(funcionario)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir Funcionário
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      
      {funcionarios.length > 0 && (
        <TablePagination pagination={pagination} />
      )}

      <AlertDialog
        open={!!confirmExcluirId}
        onOpenChange={(o) => !o && setConfirmExcluirId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir última classificação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação remove o último registro de classificação do funcionário.
              Se a classificação já estava efetivada, o cargo e salário serão revertidos
              para os valores anteriores. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (confirmExcluirId) {
                  await excluir(confirmExcluirId);
                  setConfirmExcluirId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FuncionarioTable;
