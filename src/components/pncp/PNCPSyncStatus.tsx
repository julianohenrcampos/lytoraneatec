import { PNCPSyncLog, PNCPSyncResult } from "@/types/pncp";
import { formatDateTime } from "@/services/pncpService";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2, AlertCircle, RefreshCw, Building2, AlertTriangle } from "lucide-react";

interface PNCPSyncStatusProps {
  lastSync: PNCPSyncLog | null | undefined;
  isSyncing: boolean;
  lastSyncResult?: PNCPSyncResult | null;
}

export function PNCPSyncStatus({ lastSync, isSyncing, lastSyncResult }: PNCPSyncStatusProps) {
  if (isSyncing) {
    return (
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 text-primary animate-spin" />
            <div>
              <p className="font-medium text-primary">Sincronizando com PNCP...</p>
              <p className="text-sm text-muted-foreground">
                Buscando licitações e classificando órgãos automaticamente
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show sync result summary if available
  if (lastSyncResult && lastSyncResult.success) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="py-3">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium text-green-700 dark:text-green-400">
                  Sincronização concluída com sucesso
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastSync ? formatDateTime(lastSync.data_execucao) : "Agora"} 
                  {lastSyncResult.duracao_segundos && ` • ${lastSyncResult.duracao_segundos.toFixed(1)}s`}
                </p>
              </div>
            </div>

            {/* Classification summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-md border bg-background p-2 text-center">
                <p className="text-lg font-bold">{lastSyncResult.total_encontrados}</p>
                <p className="text-xs text-muted-foreground">Analisadas</p>
              </div>
              <div className="rounded-md border bg-background p-2 text-center">
                <p className="text-lg font-bold text-primary">{lastSyncResult.total_inseridos}</p>
                <p className="text-xs text-muted-foreground">Importadas</p>
              </div>
              <div className="rounded-md border bg-background p-2 text-center">
                <p className="text-lg font-bold text-green-600">
                  {lastSyncResult.total_orgaos_classificados ?? 0}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <Building2 className="h-3 w-3" /> Classificados
                </p>
              </div>
              <div className="rounded-md border bg-background p-2 text-center">
                <p className="text-lg font-bold text-amber-600">
                  {lastSyncResult.total_orgaos_pendentes ?? 0}
                </p>
                <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Pendentes
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!lastSync) {
    return (
      <Card className="border-muted">
        <CardContent className="py-3">
          <div className="flex items-center gap-3">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="font-medium">Nenhuma sincronização realizada</p>
              <p className="text-sm text-muted-foreground">
                Clique em "Sincronizar" para buscar licitações do PNCP
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSuccess = lastSync.status === "concluido";
  const isError = lastSync.status === "erro";

  return (
    <Card className={isError ? "border-destructive/50 bg-destructive/5" : "border-green-500/50 bg-green-500/5"}>
      <CardContent className="py-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : isError ? (
              <AlertCircle className="h-5 w-5 text-destructive" />
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="font-medium">
                Última sincronização: {formatDateTime(lastSync.data_execucao)}
              </p>
              {isError ? (
                <p className="text-sm text-destructive">{lastSync.mensagem_erro}</p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {lastSync.total_inseridos} nova(s) • {lastSync.total_encontrados} analisada(s)
                  {lastSync.duracao_segundos && ` • ${lastSync.duracao_segundos.toFixed(1)}s`}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Badge variant={isSuccess ? "default" : isError ? "destructive" : "secondary"}>
              {lastSync.status === "concluido" ? "Sucesso" : lastSync.status === "erro" ? "Erro" : lastSync.status}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
