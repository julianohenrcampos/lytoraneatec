
import React from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileEdit, Eye, Trash2, Users, Star } from "lucide-react";
import { ApontamentoEquipe } from "@/types/apontamentoEquipe";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatDate } from "@/lib/utils";

interface ApontamentoEquipeSummary {
  equipe_id: string;
  equipe_nome: string;
  data_registro: string;
  encarregado: string;
  apontador: string;
  presenca_percentage: number;
  total_colaboradores: number;
  colaboradores: ApontamentoEquipe[];
}

interface ApontamentoEquipeTableProps {
  apontamentos: ApontamentoEquipeSummary[];
  onViewDetails: (apontamento: ApontamentoEquipe) => void;
  onEdit: (apontamento: ApontamentoEquipe) => void;
  onDelete: (apontamento: ApontamentoEquipe) => void;
  onViewEquipe: (equipeId: string) => void;
  onAvaliarColaborador?: (colaboradorId: string, nomeColaborador: string, equipeId: string) => void;
  avaliacaoStatusMap?: Map<string, {canCreate: boolean, daysRemaining: number}>;
}

const ApontamentoEquipeTable: React.FC<ApontamentoEquipeTableProps> = ({
  apontamentos,
  onViewDetails,
  onEdit,
  onDelete,
  onViewEquipe,
  onAvaliarColaborador,
  avaliacaoStatusMap = new Map()
}) => {
  if (apontamentos.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        Nenhum apontamento encontrado.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Encarregado</TableHead>
            <TableHead>Apontador</TableHead>
            <TableHead>Equipe</TableHead>
            <TableHead>Presença (%)</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apontamentos.map((apontamento) => {
            // Choose first collaborator for the row actions
            const firstColaborador = apontamento.colaboradores[0];
            const colaboradorId = firstColaborador.colaborador_id || '';
            
            // Check evaluation status for this collaborator
            const avaliacaoStatus = avaliacaoStatusMap.get(colaboradorId);
            const canCreateAvaliacao = avaliacaoStatus?.canCreate ?? true;
            const daysRemaining = avaliacaoStatus?.daysRemaining ?? 0;
            
            return (
              <TableRow key={`${apontamento.equipe_id}-${apontamento.data_registro}`}>
                <TableCell>
                  {formatDate(apontamento.data_registro)}
                </TableCell>
                <TableCell>{apontamento.encarregado}</TableCell>
                <TableCell>{apontamento.apontador}</TableCell>
                <TableCell>
                  <Button 
                    variant="link" 
                    className="p-0 h-auto font-normal text-foreground"
                    onClick={() => onViewEquipe(apontamento.equipe_id)}
                  >
                    {apontamento.equipe_nome}
                  </Button>
                </TableCell>
                <TableCell>
                  <span 
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      apontamento.presenca_percentage === 100 
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                        : apontamento.presenca_percentage >= 75
                        ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                        : apontamento.presenca_percentage >= 50
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                    }`}
                  >
                    {apontamento.presenca_percentage}%
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onViewDetails(firstColaborador)}
                      aria-label="Ver detalhes"
                      title="Ver detalhes"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(firstColaborador)}
                      aria-label="Editar apontamento"
                      title="Editar apontamento"
                    >
                      <FileEdit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(firstColaborador)}
                      aria-label="Excluir apontamento"
                      title="Excluir apontamento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    {onAvaliarColaborador && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onAvaliarColaborador(
                                colaboradorId,
                                firstColaborador.nome_colaborador,
                                apontamento.equipe_id
                              )}
                              aria-label="Avaliar desempenho"
                              disabled={!canCreateAvaliacao}
                              className={!canCreateAvaliacao ? "opacity-50" : ""}
                            >
                              <Star className="h-4 w-4 text-amber-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {canCreateAvaliacao 
                              ? "Avaliar desempenho" 
                              : `Próxima avaliação possível em ${daysRemaining} dia(s).`}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default ApontamentoEquipeTable;
