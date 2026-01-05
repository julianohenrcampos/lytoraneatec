import { useState, useMemo } from "react";
import { PNCPContratacao, calcularDiasRestantes } from "@/types/pncp";
import { usePagination } from "@/hooks/usePagination";
import TablePagination from "@/components/ui/table-pagination";
import { formatCurrency, formatDate } from "@/services/pncpService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Building2, MapPin, Calendar, DollarSign, Eye, Trash2, Clock, AlertTriangle, CheckCircle } from "lucide-react";
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
import { PNCPDetailsModal } from "./PNCPDetailsModal";

interface PNCPMobileCardsProps {
  contratacoes: PNCPContratacao[];
  onDelete?: (id: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onToggleDescartada?: (id: string, descartada: boolean) => void;
}

export function PNCPMobileCards({ contratacoes, onDelete, onDeleteMultiple, onToggleDescartada }: PNCPMobileCardsProps) {
  const [selectedContratacao, setSelectedContratacao] = useState<PNCPContratacao | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [contratacaoToDelete, setContratacaoToDelete] = useState<PNCPContratacao | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const pagination = usePagination(contratacoes, { pageSize: 10 });

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
      return (
        <Badge variant="outline" className="text-muted-foreground">
          Encerrado
        </Badge>
      );
    }
    if (dias <= 3) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          {dias === 0 ? "Hoje" : `${dias}d`}
        </Badge>
      );
    }
    if (dias <= 7) {
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dias}d
        </Badge>
      );
    }
    if (dias <= 15) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {dias}d
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-green-600 border-green-600 flex items-center gap-1">
        <CheckCircle className="h-3 w-3" />
        {dias}d
      </Badge>
    );
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

  return (
    <>
      {/* Selection controls */}
      <div className="flex items-center justify-between p-3 mb-3 bg-muted/50 rounded-lg border">
        <div className="flex items-center gap-3">
          <Checkbox
            checked={allCurrentPageSelected}
            onCheckedChange={handleSelectAll}
            aria-label="Selecionar todos da página"
          />
          <span className="text-sm text-muted-foreground">
            {someSelected ? `${selectedIds.size} selecionados` : "Selecionar"}
          </span>
        </div>
        {someSelected && (
          <div className="flex items-center gap-2">
            {selectedIds.size < contratacoes.length && (
              <Button variant="ghost" size="sm" onClick={handleSelectAllItems}>
                Todos ({contratacoes.length})
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleClearSelection}>
              Limpar
            </Button>
            <Button 
              variant="destructive" 
              size="sm"
              onClick={handleBulkDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {pagination.paginatedData.map((item) => (
          <Card key={item.id} className={`overflow-hidden ${selectedIds.has(item.id) ? "ring-2 ring-primary" : ""}`}>
            <CardHeader className="pb-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                  className="mt-1"
                  aria-label={`Selecionar ${item.objeto.substring(0, 30)}`}
                />
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-3">{item.objeto}</CardTitle>
                    {getValorBadge(item.valor_total_estimado)}
                  </div>
                  {item.modalidade_contratacao && (
                    <Badge variant="outline" className="w-fit text-xs mt-1">
                      {item.modalidade_contratacao}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Órgão */}
              <div className="flex items-start gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">{item.orgao_nome || "N/A"}</p>
                  {item.unidade_nome && (
                    <p className="text-muted-foreground text-xs">{item.unidade_nome}</p>
                  )}
                </div>
              </div>

              {/* Local */}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {item.municipio_nome || "N/A"} / {item.uf || "N/A"}
                </span>
              </div>

              {/* Valor */}
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-lg font-bold text-primary">
                  {formatCurrency(item.valor_total_estimado)}
                </span>
              </div>

              {/* Prazo */}
              <div className="flex items-start gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="text-sm flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">Fim: </span>
                  <span>{formatDate(item.data_fim_propostas)}</span>
                  {getPrazoBadge(item.data_fim_propostas)}
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2 mt-2">
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={() => handleViewDetails(item)}
                >
                  <Eye className="h-4 w-4" />
                  Detalhes
                </Button>
                
                {item.link_origem_pncp && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => window.open(item.link_origem_pncp!, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteClick(item)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <TablePagination pagination={pagination} className="mt-4" />

      <PNCPDetailsModal
        contratacao={selectedContratacao}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onToggleDescartada={onToggleDescartada}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir licitação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A licitação será removida permanentemente da lista.
              {contratacaoToDelete && (
                <span className="block mt-2 text-sm font-medium">
                  "{contratacaoToDelete.objeto.substring(0, 100)}..."
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
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
            <AlertDialogAction
              onClick={handleConfirmBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir {selectedIds.size} itens
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}