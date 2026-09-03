import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, ChevronLeft, ChevronRight, Inbox, RotateCcw } from "lucide-react";
import { DOMINIO_LABEL } from "@/lib/qualidade-cadastral/regras";
import type { QcPendencia } from "@/services/qualidadeCadastralService";
import { SeveridadeBadge, TipoBadge, scoreClass } from "./qualidadeUi";
import { cn } from "@/lib/utils";

interface Props {
  rows: QcPendencia[];
  total: number;
  page: number;
  pageSize: number;
  isLoading: boolean;
  isError: boolean;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onSelecionar: (p: QcPendencia) => void;
  onRetry: () => void;
}

function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR");
}

const PendenciasTable: React.FC<Props> = ({
  rows,
  total,
  page,
  pageSize,
  isLoading,
  isError,
  onPageChange,
  onPageSizeChange,
  onSelecionar,
  onRetry,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <CardHeader className="pb-2 flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Pendências cadastrais</CardTitle>
        {!isLoading && !isError && (
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString("pt-BR")} pendência(s)
          </span>
        )}
      </CardHeader>
      <CardContent>
        {isError ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <p className="text-sm text-muted-foreground">
              Não foi possível carregar as pendências.
            </p>
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RotateCcw className="h-4 w-4 mr-2" /> Tentar novamente
            </Button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhuma pendência encontrada</p>
            <p className="text-xs text-muted-foreground">
              Ajuste ou limpe os filtros para ampliar o diagnóstico.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[92px]">Severidade</TableHead>
                    <TableHead>Domínio</TableHead>
                    <TableHead>Identificação</TableHead>
                    <TableHead>Nome/descrição</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>CC</TableHead>
                    <TableHead>Problema</TableHead>
                    <TableHead>Regra</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead className="text-center">Atualização</TableHead>
                    <TableHead className="text-center">Dias</TableHead>
                    <TableHead className="text-center">Score</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={`${p.dominio}-${p.registro_id}-${p.regra}`}>
                      <TableCell><SeveridadeBadge severidade={p.severidade} /></TableCell>
                      <TableCell className="text-xs">{DOMINIO_LABEL[p.dominio] ?? p.dominio}</TableCell>
                      <TableCell className="font-medium text-sm">{p.identificacao ?? "—"}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">{p.descricao ?? "—"}</TableCell>
                      <TableCell className="max-w-[140px] truncate text-xs text-muted-foreground">{p.empresa_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs">{p.cc_codigo ?? "—"}</TableCell>
                      <TableCell className="max-w-[240px] text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="truncate">{p.mensagem}</span>
                          <TipoBadge tipo={p.tipo} />
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{p.regra}{p.campo ? ` · ${p.campo}` : ""}</TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs">
                        {p.responsavel_nome ?? <span className="text-muted-foreground">Não definido</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs">{fmtData(p.atualizado_em)}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums">{p.dias_sem_atualizacao ?? "—"}</TableCell>
                      <TableCell className={cn("text-center text-xs font-semibold tabular-nums", scoreClass(p.score))}>
                        {p.score}%
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => onSelecionar(p)}>Abrir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Itens por página</span>
                <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
                  <SelectTrigger className="h-8 w-[80px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[25, 50, 100, 200].map((s) => (
                      <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </span>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default PendenciasTable;
