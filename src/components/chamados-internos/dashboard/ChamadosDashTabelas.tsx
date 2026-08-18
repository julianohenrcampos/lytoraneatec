/**
 * Tabelas operacionais do Dashboard de Chamados Internos.
 * Fila de SLA em risco, desempenho por atendente e ranking de solicitantes (AdmSede).
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  Headphones,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import SolicitantesBarChart from "@/components/chamados-internos/dashboard/SolicitantesBarChart";
import AtendentesTemposChart from "@/components/chamados-internos/dashboard/AtendentesTemposChart";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

import { cn } from "@/lib/utils";
import {
  PrioridadeBadge,
  SetorBadge,
  StatusBadge,
} from "@/components/chamados-internos/StatusBadges";
import type {
  ChamadosDashAtendenteRow,
  ChamadosDashFilaRiscoRow,
  ChamadosDashSolicitanteRow,
} from "@/types/chamadosInternosDashboard";

function horas(min?: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${Math.round(min)} min`;
  return `${(min / 60).toFixed(1)} h`;
}

function restante(min: number | null): { texto: string; critico: boolean } {
  if (min == null) return { texto: "—", critico: false };
  if (min < 0) return { texto: `atrasado ${horas(Math.abs(min))}`, critico: true };
  return { texto: horas(min), critico: min <= 120 };
}

export const FilaSlaRiscoTabela: React.FC<{
  linhas?: ChamadosDashFilaRiscoRow[];
  isLoading?: boolean;
  isError?: boolean;
  erroMensagem?: string;
  onTentarNovamente?: () => void;
}> = ({ linhas, isLoading, isError, erroMensagem, onTentarNovamente }) => {
  const navigate = useNavigate();
  const [aberto, setAberto] = React.useState(true);

  return (
    <Card>
      <Collapsible open={aberto} onOpenChange={setAberto}>
        <CardHeader className="pb-2 sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-base font-medium">
              <ShieldAlert className="h-4 w-4 text-destructive" />
              Fila crítica e SLA em risco
            </CardTitle>
            <CardDescription>
              Todos os chamados do período filtrado, ordenados pelo prazo mais próximo do
              vencimento.
            </CardDescription>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 sm:mt-0">
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm">
                <ChevronDown
                  className={cn("mr-2 h-4 w-4 transition-transform", aberto && "rotate-180")}
                />
                {aberto ? "Recolher" : "Expandir"}
              </Button>
            </CollapsibleTrigger>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : isError ? (
            <div className="space-y-3 py-6 text-center">
              <p className="text-sm text-destructive">
                Não foi possível carregar a fila.
                {erroMensagem ? ` (${erroMensagem})` : ""}
              </p>
              {onTentarNovamente ? (
                <Button variant="outline" size="sm" onClick={onTentarNovamente}>
                  Tentar novamente
                </Button>
              ) : null}
            </div>
          ) : !linhas?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nenhum chamado encontrado para os filtros aplicados.
            </p>
          ) : (
            <CollapsibleContent>
              <div className="max-h-[420px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Protocolo</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Setor</TableHead>
                      <TableHead>Prioridade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Solicitante</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>SLA restante</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l) => {
                      const r = restante(l.minutos_restantes);
                      return (
                        <TableRow
                          key={l.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/chamados-internos/${l.id}`)}
                        >
                          <TableCell className="whitespace-nowrap font-medium">
                            {l.protocolo}
                            {l.is_critico && (
                              <Badge variant="destructive" className="ml-2">
                                crítico
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="max-w-[260px] truncate">{l.titulo}</TableCell>
                          <TableCell><SetorBadge setor={l.setor} /></TableCell>
                          <TableCell><PrioridadeBadge prioridade={l.prioridade} /></TableCell>
                          <TableCell><StatusBadge status={l.status} /></TableCell>
                          <TableCell className="max-w-[180px] truncate">{l.solicitante_nome}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{l.responsavel_nome}</TableCell>
                          <TableCell
                            className={cn(
                              "whitespace-nowrap font-medium",
                              r.critico && "text-destructive",
                            )}
                          >
                            {r.texto}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          )}
        </CardContent>
      </Collapsible>
    </Card>
  );
};

export const AtendentesTabela: React.FC<{
  linhas?: ChamadosDashAtendenteRow[];
  isLoading?: boolean;
}> = ({ linhas, isLoading }) => {
  const [aberto, setAberto] = React.useState(false);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <Headphones className="h-4 w-4 text-primary" />
          Desempenho por atendente
        </CardTitle>
        <CardDescription>
          Tempo médio de 1ª resposta e de resolução, em horas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !linhas?.length ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhum chamado atribuído no período.
          </p>
        ) : (
          <>
            <AtendentesTemposChart linhas={linhas} />
            <Collapsible open={aberto} onOpenChange={setAberto}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="w-full sm:w-auto">
                  <ChevronDown
                    className={cn("mr-2 h-4 w-4 transition-transform", aberto && "rotate-180")}
                  />
                  {aberto ? "Ocultar detalhamento" : "Ver detalhamento"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Atendente</TableHead>
                        <TableHead className="text-center">Atribuídos</TableHead>
                        <TableHead className="text-center">Resolvidos</TableHead>
                        <TableHead className="text-center">1ª resposta</TableHead>
                        <TableHead className="text-center">Resolução</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l) => (
                        <TableRow key={l.atendente_profile_id}>
                          <TableCell className="max-w-[240px] truncate">
                            {l.atendente_nome}
                          </TableCell>
                          <TableCell className="text-center">{l.atribuidos}</TableCell>
                          <TableCell className="text-center">{l.resolvidos}</TableCell>
                          <TableCell className="text-center">{horas(l.frt_minutos)}</TableCell>
                          <TableCell className="text-center">{horas(l.mttr_minutos)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const SolicitantesTabela: React.FC<{
  linhas?: ChamadosDashSolicitanteRow[];
  isLoading?: boolean;
  isExportando?: boolean;
  onExportar: () => void;
}> = ({ linhas, isLoading, isExportando, onExportar }) => {
  const [verTodos, setVerTodos] = React.useState(false);
  const [aberto, setAberto] = React.useState(false);

  return (
  <Card>
    <CardHeader className="pb-2 sm:flex sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div>
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <FileSpreadsheet className="h-4 w-4 text-primary" />
          Chamados por AdmSede responsável
        </CardTitle>
        <CardDescription>
          Volume das obras sob responsabilidade de cada AdmSede, somando os centros de custo
          vinculados a ele.
        </CardDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 sm:mt-0"
        onClick={onExportar}
        disabled={isExportando || !linhas?.length}
      >
        {isExportando ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Download className="mr-2 h-4 w-4" />
        )}
        Exportar Excel
      </Button>
    </CardHeader>
    <CardContent className="space-y-4">
      {isLoading ? (
        <Skeleton className="h-72 w-full" />
      ) : !linhas?.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nenhum chamado no período.
        </p>
      ) : (
        <>
          <SolicitantesBarChart linhas={linhas} verTodos={verTodos} />
          {linhas.length > 12 && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={() => setVerTodos((v) => !v)}>
                {verTodos ? "Ver apenas o Top 12" : `Ver todos (${linhas.length})`}
              </Button>
            </div>
          )}
          <Collapsible open={aberto} onOpenChange={setAberto}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full sm:w-auto">
                <ChevronDown
                  className={cn("mr-2 h-4 w-4 transition-transform", aberto && "rotate-180")}
                />
                {aberto ? "Ocultar detalhamento" : "Ver detalhamento"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>AdmSede responsável</TableHead>
                      <TableHead className="text-center">Centros de custo</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                      <TableHead className="text-center">Respondidos</TableHead>
                      <TableHead className="text-center">Sem resposta</TableHead>
                      <TableHead className="text-center">Em andamento</TableHead>
                      <TableHead className="text-center">Encerrados</TableHead>
                      <TableHead className="text-center">1ª resposta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((l, i) => (
                      <TableRow key={l.adm_sede_funcionario_id ?? `sem-adm-${i}`}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell className="max-w-[260px] truncate">{l.nome}</TableCell>
                        <TableCell className="text-center">{l.centros_custo}</TableCell>
                        <TableCell className="text-center font-medium">{l.total}</TableCell>
                        <TableCell className="text-center">{l.respondidos}</TableCell>
                        <TableCell
                          className={cn(
                            "text-center",
                            l.sem_resposta > 0 && "font-medium text-destructive",
                          )}
                        >
                          {l.sem_resposta}
                        </TableCell>
                        <TableCell className="text-center">{l.em_aberto}</TableCell>
                        <TableCell className="text-center">{l.encerrados}</TableCell>
                        <TableCell className="text-center">{horas(l.frt_minutos)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </>
      )}
    </CardContent>
  </Card>
  );
};


