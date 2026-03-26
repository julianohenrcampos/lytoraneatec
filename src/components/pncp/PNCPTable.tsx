import { useState, useMemo } from "react";
import { PNCPContratacao, calcularDiasRestantes } from "@/types/pncp";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { formatCurrency, formatDate, formatTime, isNovaLicitacao } from "@/services/pncpService";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ExternalLink, Eye, Trash2, Clock, AlertTriangle, CheckCircle, XCircle, RotateCcw, Sparkles, Brain } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PNCPDetailsModal } from "./PNCPDetailsModal";
import { getScoreLabel, DICIONARIO_SINONIMOS } from "@/utils/smartMatching";
interface PNCPTableProps {
  contratacoes: PNCPContratacao[];
  onDelete?: (id: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onToggleParticipando?: (id: string, participando: boolean) => void;
  onToggleDescartada?: (id: string, descartada: boolean) => void;
  showParticipandoColumn?: boolean;
}
export function PNCPTable({
  contratacoes,
  onDelete,
  onDeleteMultiple,
  onToggleParticipando,
  onToggleDescartada,
  showParticipandoColumn = true
}: PNCPTableProps) {
  const [selectedContratacao, setSelectedContratacao] = useState<PNCPContratacao | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [contratacaoToDelete, setContratacaoToDelete] = useState<PNCPContratacao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const pagination = usePagination(contratacoes, {
    pageSize: 10
  });
  const allCurrentPageSelected = useMemo(() => {
    if (pagination.paginatedData.length === 0) return false;
    return pagination.paginatedData.every(item => selectedIds.has(item.id));
  }, [pagination.paginatedData, selectedIds]);
  const someSelected = selectedIds.size > 0;
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const newSelected = new Set(selectedIds);
      pagination.paginatedData.forEach(item => newSelected.add(item.id));
      setSelectedIds(newSelected);
    } else {
      const newSelected = new Set(selectedIds);
      pagination.paginatedData.forEach(item => newSelected.delete(item.id));
      setSelectedIds(newSelected);
    }
  };
  const getRowStatusClass = (item: PNCPContratacao): string => {
    const dias = calcularDiasRestantes(item.data_fim_propostas);
    const isPrazoEncerrado = dias !== null && dias < 0;
    if (selectedIds.has(item.id)) {
      return "bg-muted/50";
    }
    if (isPrazoEncerrado) {
      return "bg-orange-50 hover:bg-orange-100 dark:bg-orange-950/30 dark:hover:bg-orange-950/50";
    }
    if (item.descartada) {
      return "bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-950/50";
    }
    if (item.participando) {
      return "bg-green-50 hover:bg-green-100 dark:bg-green-950/30 dark:hover:bg-green-950/50";
    }
    return "";
  };
  const handleSelectAllItems = () => {
    const allIds = new Set(contratacoes.map(item => item.id));
    setSelectedIds(allIds);
  };
  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };
  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };
  const getValorBadge = (valor: number | null) => {
    if (!valor) return null;
    if (valor >= 10000000) {
      return <Badge variant="destructive">Mega</Badge>;
    }
    if (valor >= 5000000) {
      return <Badge className="bg-amber-500 hover:bg-amber-600">Alto</Badge>;
    }
    return <Badge variant="secondary">Padrão</Badge>;
  };
  const getPrazoBadge = (dataFim: string | null) => {
    const dias = calcularDiasRestantes(dataFim);
    if (dias === null) return null;
    if (dias < 0) {
      return <Badge variant="outline" className="text-muted-foreground">
          Encerrado
        </Badge>;
    }
    if (dias <= 3) {
      return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {dias === 0 ? "Hoje" : `${dias}d`}
        </Badge>;
    }
    if (dias <= 7) {
      return <Badge className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dias}d
        </Badge>;
    }
    if (dias <= 15) {
      return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dias}d
        </Badge>;
    }
    return <Badge variant="outline" className="text-green-600 border-green-600 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        {dias}d
      </Badge>;
  };
  const handleViewDetails = (contratacao: PNCPContratacao) => {
    setSelectedContratacao(contratacao);
    setDetailsOpen(true);
  };
  const handleDeleteClick = (contratacao: PNCPContratacao) => {
    setContratacaoToDelete(contratacao);
    setDeleteDialogOpen(true);
  };
  const handleConfirmDelete = () => {
    if (contratacaoToDelete && onDelete) {
      onDelete(contratacaoToDelete.id);
    }
    setDeleteDialogOpen(false);
    setContratacaoToDelete(null);
  };
  const handleBulkDelete = () => {
    setBulkDeleteDialogOpen(true);
  };
  const handleConfirmBulkDelete = () => {
    if (onDeleteMultiple && selectedIds.size > 0) {
      onDeleteMultiple(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
    setBulkDeleteDialogOpen(false);
  };
  return <>
      {someSelected && <div className="flex items-center justify-between p-3 mb-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {selectedIds.size} {selectedIds.size === 1 ? "item selecionado" : "itens selecionados"}
            </span>
            {selectedIds.size < contratacoes.length && <Button variant="link" size="sm" className="h-auto p-0" onClick={handleSelectAllItems}>
                Selecionar todos ({contratacoes.length})
              </Button>}
            <Button variant="link" size="sm" className="h-auto p-0" onClick={handleClearSelection}>
              Limpar seleção
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir selecionados
          </Button>
        </div>}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox checked={allCurrentPageSelected} onCheckedChange={handleSelectAll} aria-label="Selecionar todos da página" />
              </TableHead>
              <TableHead className="min-w-[300px]">Objeto</TableHead>
              <TableHead>Órgão / Unidade</TableHead>
              <TableHead>Local</TableHead>
              <TableHead>Perfil</TableHead>
              <TableHead className="text-right">Valor Estimado</TableHead>
              <TableHead className="text-center">Score</TableHead>
              <TableHead>Prazo Propostas</TableHead>
              <TableHead>Capturado em</TableHead>
              {showParticipandoColumn && <TableHead className="text-center">Participando</TableHead>}
              <TableHead className="text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagination.paginatedData.map(item => <TableRow key={item.id} className={getRowStatusClass(item)}>
                <TableCell>
                  <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={checked => handleSelectItem(item.id, !!checked)} aria-label={`Selecionar ${item.objeto.substring(0, 30)}`} />
                </TableCell>
                <TableCell>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <p className="max-w-[300px] truncate cursor-help">
                        {item.objeto}
                      </p>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-md">
                      <p className="text-sm">{item.objeto}</p>
                    </TooltipContent>
                  </Tooltip>
                  {item.modalidade_contratacao && <Badge variant="outline" className="mt-1 text-xs">
                      {item.modalidade_contratacao}
                    </Badge>}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{item.orgao_nome || "N/A"}</p>
                    {item.orgao_sigla ? (
                      <Badge variant="success" className="text-xs">
                        {item.orgao_sigla}
                      </Badge>
                    ) : item.orgao_nome ? (
                      <Badge variant="warning" className="text-xs">
                        Pendente
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        Sem órgão
                      </Badge>
                    )}
                    {item.unidade_nome && <p className="text-xs text-muted-foreground">{item.unidade_nome}</p>}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="whitespace-nowrap">
                    {item.municipio_nome && item.uf ? `${item.municipio_nome} / ${item.uf}` : item.uf ? item.uf : item.municipio_nome ? item.municipio_nome : "N/A"}
                  </span>
                </TableCell>
                <TableCell>
                  {item.perfil_busca_nome ? (
                    <Badge 
                      variant="outline" 
                      className="whitespace-nowrap"
                      style={{ 
                        borderColor: item.perfil_cor || 'hsl(var(--border))', 
                        color: item.perfil_cor || 'hsl(var(--foreground))' 
                      }}
                    >
                      {item.perfil_busca_nome}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex flex-col items-end gap-1">
                    <span className="font-semibold text-primary">
                      {formatCurrency(item.valor_total_estimado)}
                    </span>
                    {getValorBadge(item.valor_total_estimado)}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  {(() => {
                    const score = item.score_busca || 0;
                    const { label, variant } = getScoreLabel(score);
                    const grupos = item.grupos_match || [];
                    const grupoNomes = grupos.map(g => {
                      const found = DICIONARIO_SINONIMOS.find(d => d.id === g);
                      return found?.nome || g;
                    });
                    return (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex flex-col items-center gap-1">
                            {score > 0 ? (
                              <Badge variant={variant} className="flex items-center gap-1">
                                <Brain className="h-3 w-3" />
                                {score}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">-</span>
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {score > 0 ? (
                            <div className="space-y-1">
                              <p className="font-medium">Score: {score} ({label})</p>
                              {grupoNomes.length > 0 && (
                                <p className="text-xs">Grupos: {grupoNomes.join(', ')}</p>
                              )}
                            </div>
                          ) : (
                            <p>Sem score de relevância</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })()}
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="text-sm">
                      <span className="text-muted-foreground">Início:</span>{" "}
                      {formatDate(item.data_inicio_propostas)}
                    </div>
                    <div className="text-sm flex items-center gap-2">
                      <span className="text-muted-foreground">Fim:</span>{" "}
                      {formatDate(item.data_fim_propostas)}
                      {getPrazoBadge(item.data_fim_propostas)}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {isNovaLicitacao(item.created_at, item.updated_at) && (
                      <Badge className="bg-blue-500 hover:bg-blue-600 text-white text-xs animate-pulse flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        NOVA
                      </Badge>
                    )}
                    <div className="text-sm">
                      <div>{formatDate(item.created_at)}</div>
                      <div className="text-muted-foreground text-xs">
                        {formatTime(item.created_at)}
                      </div>
                    </div>
                  </div>
                </TableCell>
                {showParticipandoColumn && <TableCell className="text-center">
                    {(() => {
                const dias = calcularDiasRestantes(item.data_fim_propostas);
                const isPrazoEncerrado = dias !== null && dias < 0;
                if (isPrazoEncerrado) {
                  // Laranja - Prazo encerrado, não pode editar
                  return <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-600">
                            Encerrada
                          </Badge>;
                }
                if (item.descartada) {
                  // Vermelho - Descartada
                  return <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => onToggleDescartada?.(item.id, false)}>
                                <RotateCcw className="h-4 w-4 mr-1" />
                                Reativar
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Reativar licitação descartada</TooltipContent>
                          </Tooltip>;
                }

                // Se está participando, mostra só o switch (sem botão descartar)
                if (item.participando) {
                  return <div className="flex items-center justify-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div>
                                  <Switch checked={true} onCheckedChange={checked => onToggleParticipando?.(item.id, checked)} className="data-[state=checked]:bg-green-500" />
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>Desmarcar participação</TooltipContent>
                            </Tooltip>
                          </div>;
                }

                // Se não está participando, mostra apenas o switch
                return <div className="flex items-center justify-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div>
                                <Switch checked={false} onCheckedChange={checked => onToggleParticipando?.(item.id, checked)} />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>Marcar como participando</TooltipContent>
                          </Tooltip>
                        </div>;
              })()}
                  </TableCell>}
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" onClick={() => handleViewDetails(item)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver detalhes</TooltipContent>
                    </Tooltip>

                    {item.link_origem_pncp && <Tooltip>
                        <TooltipTrigger asChild>
                          
                        </TooltipTrigger>
                        <TooltipContent>Abrir no PNCP</TooltipContent>
                      </Tooltip>}

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteClick(item)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Excluir</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>)}
          </TableBody>
        </Table>
      </div>
      
      <TablePagination pagination={pagination} className="mt-4" />

      <PNCPDetailsModal contratacao={selectedContratacao} open={detailsOpen} onOpenChange={setDetailsOpen} onToggleDescartada={onToggleDescartada} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir licitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A licitação será removida permanentemente da lista.
              {contratacaoToDelete && <span className="block mt-2 text-sm font-medium">
                  "{contratacaoToDelete.objeto.substring(0, 100)}..."
                </span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} licitações?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todas as {selectedIds.size} licitações selecionadas serão removidas permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir {selectedIds.size} itens
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>;
}