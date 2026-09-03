import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Pencil, Trash2, Droplets, Clock, Flag, AlertTriangle } from "lucide-react";
import { ApontamentoCaminhao } from "@/services/apontamentoCaminhoesService";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { useIsMobile } from "@/hooks/use-mobile";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";

interface ApontamentoCaminhoesTableProps {
  apontamentos: ApontamentoCaminhao[];
  onView: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onFinalizar?: (id: string) => void;
  isLoading?: boolean;
  canDelete?: boolean;
}

type CicloStatus = "em_andamento" | "finalizado" | "inconsistente";

const deriveStatus = (ap: ApontamentoCaminhao): CicloStatus => {
  const hasHoraFinal = ap.hora_final != null && ap.hora_final !== "";
  const hasHorimetroFinal = ap.horimetro_final != null;
  if (hasHoraFinal && hasHorimetroFinal) return "finalizado";
  if (!hasHoraFinal && !hasHorimetroFinal) return "em_andamento";
  return "inconsistente";
};

const StatusBadge: React.FC<{ status: CicloStatus }> = ({ status }) => {
  if (status === "finalizado") {
    return (
      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-500/30 border">
        Finalizado
      </Badge>
    );
  }
  if (status === "em_andamento") {
    return (
      <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 border">
        Em andamento
      </Badge>
    );
  }
  return (
    <Badge className="bg-destructive/15 text-destructive border-destructive/30 border gap-1">
      <AlertTriangle className="h-3 w-3" />
      Inconsistente
    </Badge>
  );
};

const ApontamentoCaminhoesTable: React.FC<ApontamentoCaminhoesTableProps> = ({
  apontamentos,
  onView,
  onEdit,
  onDelete,
  onFinalizar,
  isLoading = false,
  canDelete = true,
}) => {
  const isMobile = useIsMobile();
  const pagination = usePagination(apontamentos, { pageSize: 10 });

  const formatApontamentoDate = (dateString: string) => {
    try {
      return formatBrazilianDateForDisplay(dateString);
    } catch (error) {
      console.error("Error formatting apontamento date:", error, "for date:", dateString);
      return dateString;
    }
  };

  const desktopCols = 8;
  const mobileCols = 3;

  const EmptyState = () => (
    <TableRow>
      <TableCell colSpan={isMobile ? mobileCols : desktopCols} className="h-24 text-center">
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-gray-500 mb-1">Nenhum registro encontrado.</p>
          <p className="text-sm text-gray-400">
            {isMobile ? "Tente ajustar os filtros avançados." : "Tente ajustar os filtros de busca."}
          </p>
        </div>
      </TableCell>
    </TableRow>
  );

  const LoadingState = () => (
    <TableRow>
      <TableCell colSpan={isMobile ? mobileCols : desktopCols} className="h-24 text-center">
        Carregando...
      </TableCell>
    </TableRow>
  );

  if (isMobile) {
    return (
      <div className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border p-4 text-center">Carregando...</div>
        ) : pagination.paginatedData.length === 0 ? (
          <div className="rounded-lg border p-6 text-center">
            <p className="text-gray-500 mb-1">Nenhum registro encontrado.</p>
            <p className="text-sm text-gray-400">Tente ajustar os filtros avançados.</p>
          </div>
        ) : (
          pagination.paginatedData.map((apontamento) => {
            const status = deriveStatus(apontamento);
            return (
              <div key={apontamento.id} className="rounded-lg border shadow-sm p-4 bg-white">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <div className="font-medium">
                      {apontamento.data ? formatApontamentoDate(apontamento.data) : "-"}
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="text-sm text-gray-500">
                    {apontamento.nome_operador || "Operador não especificado"}
                  </div>

                  <div className="font-semibold text-gray-800">
                    {apontamento.veiculo_identificacao || "-"}
                  </div>

                  <div className="grid grid-cols-1 xs:grid-cols-3 gap-2 pt-2 text-sm">
                    <div className="flex items-center">
                      <Droplets className="h-4 w-4 text-blue-500 mr-1.5" />
                      <span className="text-gray-700">
                        {apontamento.abastecimento ? `${apontamento.abastecimento}L` : "-"}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-green-500 mr-1.5" />
                      <span className="text-gray-700">{apontamento.horimetro_inicial || "-"}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-amber-500 mr-1.5" />
                      <span className="text-gray-700">{apontamento.horimetro_final || "-"}</span>
                    </div>
                  </div>

                  <div className="flex justify-end space-x-1 pt-2 border-t mt-2">
                    <Button variant="ghost" size="sm" onClick={() => onView(apontamento.id)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {status === "em_andamento" && onFinalizar && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onFinalizar(apontamento.id)}
                        title="Finalizar apontamento"
                      >
                        <Flag className="h-4 w-4 text-emerald-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onEdit(apontamento.id)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDelete(apontamento.id)}
                      disabled={!canDelete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {apontamentos.length > 0 && <TablePagination pagination={pagination} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Data</TableHead>
              <TableHead className="min-w-[200px]">Caminhão/Equipamento</TableHead>
              <TableHead className="min-w-[150px]">Operador</TableHead>
              <TableHead className="text-center">Status</TableHead>
              <TableHead className="text-center">Abastecimento (L)</TableHead>
              <TableHead className="text-center">Horímetro Inicial</TableHead>
              <TableHead className="text-center">Horímetro Final</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <LoadingState />
            ) : pagination.paginatedData.length === 0 ? (
              <EmptyState />
            ) : (
              pagination.paginatedData.map((apontamento) => {
                const status = deriveStatus(apontamento);
                return (
                  <TableRow
                    key={apontamento.id}
                    className={
                      status === "em_andamento" && onFinalizar
                        ? "bg-amber-50/70 hover:bg-amber-100/60 border-l-4 border-l-amber-500 cursor-pointer"
                        : undefined
                    }
                    onClick={
                      status === "em_andamento" && onFinalizar
                        ? () => onFinalizar(apontamento.id)
                        : undefined
                    }
                    title={status === "em_andamento" && onFinalizar ? "Clique para finalizar este apontamento" : undefined}
                  >
                    <TableCell className="font-medium">
                      {apontamento.data ? formatApontamentoDate(apontamento.data) : "-"}
                    </TableCell>
                    <TableCell>{apontamento.veiculo_identificacao || "-"}</TableCell>
                    <TableCell>{apontamento.nome_operador || "-"}</TableCell>
                    <TableCell className="text-center">
                      <StatusBadge status={status} />
                    </TableCell>
                    <TableCell className="text-center">
                      {apontamento.abastecimento || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {apontamento.horimetro_inicial || "-"}
                    </TableCell>
                    <TableCell className="text-center">
                      {apontamento.horimetro_final || "-"}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => onView(apontamento.id)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {status === "em_andamento" && onFinalizar && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onFinalizar(apontamento.id)}
                            title="Finalizar apontamento"
                          >
                            <Flag className="h-4 w-4 text-emerald-600" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => onEdit(apontamento.id)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(apontamento.id)}
                          disabled={!canDelete}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {apontamentos.length > 0 && <TablePagination pagination={pagination} />}
    </div>
  );
};

export default ApontamentoCaminhoesTable;
