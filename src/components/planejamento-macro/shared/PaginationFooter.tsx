// Fase 6F.2.1 — Rodapé de paginação client-side com seletor opcional de linhas por página.
import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  totalItems: number;
  startIndex: number; // 0-based
  endIndex: number;   // exclusive
  currentPage: number; // 0-based
  totalPages: number;
  canPreviousPage: boolean;
  canNextPage: boolean;
  onPrevious: () => void;
  onNext: () => void;
  itemLabel?: string;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

const DEFAULT_OPTIONS = [10, 25, 50, 100];

const PaginationFooter: React.FC<Props> = ({
  totalItems,
  startIndex,
  endIndex,
  currentPage,
  totalPages,
  canPreviousPage,
  canNextPage,
  onPrevious,
  onNext,
  itemLabel = "registros",
  pageSize,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_OPTIONS,
}) => {
  if (totalItems === 0) return null;
  const from = startIndex + 1;
  const to = endIndex;
  const showSelector = !!onPageSizeChange && typeof pageSize === "number";

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-3 mt-3 border-t text-sm">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-muted-foreground">
          Mostrando <span className="font-medium text-foreground">{from}</span>–
          <span className="font-medium text-foreground">{to}</span> de{" "}
          <span className="font-medium text-foreground">{totalItems}</span> {itemLabel}
        </div>
        {showSelector && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Linhas por página:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange!(Number(v))}
            >
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((opt) => (
                  <SelectItem key={opt} value={String(opt)}>
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground">
          Página <span className="font-medium text-foreground">{currentPage + 1}</span> de{" "}
          <span className="font-medium text-foreground">{Math.max(1, totalPages)}</span>
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onPrevious}
            disabled={!canPreviousPage}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onNext}
            disabled={!canNextPage}
            className="gap-1"
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaginationFooter;
