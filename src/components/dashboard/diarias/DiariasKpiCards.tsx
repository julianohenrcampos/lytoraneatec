import React, { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, FileText } from "lucide-react";
import {
  formatBRL,
  isSemanaAtualPadrao,
  totalExecutado,
  type DiariasFilters,
} from "./_dashboardHelpers";
import { useDiariasDataset } from "./useDiariasDataset";
import ImpactoProjetoCard from "./cards/ImpactoProjetoCard";

interface Props {
  filters: DiariasFilters;
}

export default function DiariasKpiCards({ filters }: Props) {
  const { data, isLoading } = useDiariasDataset(filters);

  const exec = useMemo(
    () => (data ? totalExecutado(data.presencas) : 0),
    [data]
  );
  const qtdSols = data?.solicitacoes.length ?? 0;

  // Mostra "Solicitações do Período" apenas quando o usuário sai da semana padrão.
  const isPadrao = isSemanaAtualPadrao(filters);
  const hasPeriodo = !isPadrao;

  const cols = hasPeriodo ? "md:grid-cols-3" : "md:grid-cols-2";

  return (
    <div className={`grid gap-4 ${cols}`}>
      {hasPeriodo && (
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Solicitações do Período
            </CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-[60px]" />
            ) : (
              <>
                <div className="text-2xl font-bold">{qtdSols}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Com período sobreposto ao filtro
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Valor Executado
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-8 w-[120px]" />
          ) : (
            <>
              <div className="text-2xl font-bold">{formatBRL(exec)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Apontamentos confirmados no período
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <ImpactoProjetoCard valorExecutado={exec} />
    </div>
  );
}
