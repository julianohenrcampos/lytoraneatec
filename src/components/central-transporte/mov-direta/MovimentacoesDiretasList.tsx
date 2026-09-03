/**
 * CT-4 — Listagem das movimentações diretas (viagens sem solicitação).
 *
 * Leitura pura de fn_ct_mov_direta_listar: o que o usuário não pode ver não é
 * devolvido pelo servidor.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, MapPin, Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCtMovDiretas } from "@/hooks/central-transporte/useCtMovDireta";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import {
  CT_PARADA_STATUS_LABELS,
  CT_VIAGEM_STATUS_LABELS,
} from "@/types/centralTransporteMobilizacao";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

const MovimentacoesDiretasList: React.FC = () => {
  const navigate = useNavigate();
  const capabilities = useCentralTransporteCapabilities();
  const { viagens, isLoading, error, refetch } = useCtMovDiretas();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Movimentações planejadas sem solicitação, com uma ou várias paradas de entrega.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          {capabilities.canCriar && (
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() =>
                navigate("/gestao-maquinas/central-transporte/movimentacao/nova")
              }
              data-testid="ct4-nova-movimentacao"
            >
              <Plus className="h-3.5 w-3.5" /> Planejar movimentação
            </Button>
          )}
        </div>
      </div>

      {isLoading && <Skeleton className="h-32 w-full" />}

      {!isLoading && error && (
        <Alert variant="destructive" data-testid="ct4-lista-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Não foi possível carregar as movimentações</AlertTitle>
          <AlertDescription className="text-xs">
            {error instanceof Error ? error.message : "Erro inesperado."}
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && viagens.length === 0 && (
        <Alert data-testid="ct4-lista-vazia">
          <AlertTitle className="text-xs">Nenhuma movimentação direta</AlertTitle>
          <AlertDescription className="text-xs">
            Use "Planejar movimentação" para transportar ativos sem passar por uma solicitação.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {viagens.map((v) => (
          <Card
            key={v.id}
            className="cursor-pointer transition-colors hover:border-primary"
            onClick={() =>
              navigate(`/gestao-maquinas/central-transporte/movimentacao/${v.id}`)
            }
            data-testid={`ct4-mov-${v.id}`}
          >
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm">{v.codigo || "Rascunho"}</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {CT_VIAGEM_STATUS_LABELS[v.status] ?? v.status}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Saída{" "}
                {v.dataPrevistaSaida
                  ? formatBrazilianDateForDisplay(v.dataPrevistaSaida)
                  : "sem data"}{" "}
                · {v.cargas.length} ativo(s) · {v.paradas.length} parada(s)
              </p>
            </CardHeader>
            <CardContent className="space-y-1 text-xs">
              <p className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5 text-primary" />
                {v.origemCentroCusto ?? "Origem não informada"}
              </p>
              <ul className="space-y-0.5 pl-4 text-muted-foreground">
                {v.paradas.map((p) => (
                  <li key={p.id}>
                    {p.ordem}ª · {p.ccCodigo ?? ""} {p.ccNome ?? "Sem obra"} —{" "}
                    {CT_PARADA_STATUS_LABELS[p.status]}
                  </li>
                ))}
              </ul>
              {v.motoristaNome && (
                <p className="text-muted-foreground">Motorista: {v.motoristaNome}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MovimentacoesDiretasList;
