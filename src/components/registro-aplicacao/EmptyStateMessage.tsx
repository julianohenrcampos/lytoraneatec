
import React from "react";
import { Calendar, FileX, Filter, FilterX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EmptyStateMessageProps {
  hasFilters: boolean;
  onClearFilters?: () => void;
}

const EmptyStateMessage: React.FC<EmptyStateMessageProps> = ({
  hasFilters,
  onClearFilters
}) => {
  return (
    <Card>
      <CardContent className="p-8">
        <div className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
            {hasFilters ? (
              <Filter className="h-8 w-8 text-muted-foreground" />
            ) : (
              <FileX className="h-8 w-8 text-muted-foreground" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-medium text-foreground">
              {hasFilters ? "Nenhum registro encontrado" : "Nenhum registro de aplicação"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {hasFilters ? (
                "Não foram encontrados registros que correspondam aos filtros aplicados. Tente ajustar os critérios de busca."
              ) : (
                "Ainda não há registros de aplicação cadastrados para esta data. Clique em 'Novo Apontamento' para criar o primeiro registro."
              )}
            </p>
          </div>

          {hasFilters && onClearFilters && (
            <div className="pt-2">
              <Button 
                variant="outline" 
                onClick={onClearFilters}
                className="gap-2"
              >
                <FilterX className="h-4 w-4" />
                Limpar Filtros
              </Button>
            </div>
          )}

          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-4">
            <Calendar className="h-4 w-4" />
            <span>Data atual selecionada nos filtros</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default EmptyStateMessage;
