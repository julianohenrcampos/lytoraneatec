
import React from "react";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { PaginationResult } from "@/hooks/usePagination";

interface TablePaginationProps<T> {
  pagination: PaginationResult<T>;
  className?: string;
}

export default function TablePagination<T>({ pagination, className }: TablePaginationProps<T>) {
  const {
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    canPreviousPage,
    canNextPage,
    pageSize,
    setPage,
    nextPage,
    previousPage,
    setPageSize,
    goToFirstPage,
    goToLastPage,
  } = pagination;

  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    
    if (totalPages <= maxVisiblePages) {
      for (let i = 0; i < totalPages; i++) {
        pages.push(i);
      }
    } else {
      const start = Math.max(0, currentPage - 2);
      const end = Math.min(totalPages - 1, start + maxVisiblePages - 1);
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
    }
    
    return pages;
  };

  if (totalItems === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col sm:flex-row items-center sm:justify-between gap-2 px-2 overflow-hidden max-w-full ${className}`}>
      <div className="text-sm text-muted-foreground text-center sm:text-left">
        Mostrando {startIndex + 1} a {endIndex} de {totalItems} registros
      </div>
      
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 lg:gap-6 max-w-full">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-medium hidden sm:inline">Itens por página</span>
          <Select
            value={pageSize.toString()}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="h-8 w-[60px] sm:w-[70px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 50].map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <span className="text-xs sm:text-sm font-medium">
          Pág. {currentPage + 1}/{totalPages}
        </span>

        <Pagination className="w-auto mx-0">
          <PaginationContent className="gap-0.5">
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToFirstPage}
                disabled={!canPreviousPage}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </PaginationItem>
            
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={previousPage}
                disabled={!canPreviousPage}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </PaginationItem>
            
            {getPageNumbers().map((pageNum) => (
              <PaginationItem key={pageNum}>
                <PaginationLink
                  onClick={() => setPage(pageNum)}
                  isActive={pageNum === currentPage}
                  className="h-8 w-8 cursor-pointer text-xs"
                >
                  {pageNum + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={nextPage}
                disabled={!canNextPage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </PaginationItem>
            
            <PaginationItem>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={goToLastPage}
                disabled={!canNextPage}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  );
}
