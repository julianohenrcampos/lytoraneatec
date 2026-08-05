import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import EmptyState from "../shared/EmptyState";
import TabIntro from "../shared/TabIntro";
import { CalendarDays, Eye } from "lucide-react";
import { useOrdensDiarias } from "@/hooks/planejamentoMacro/useOrdensDiarias";
import { usePermission } from "@/hooks/usePermission";
import VisualizarOrdemDiariaDialog from "../modals/VisualizarOrdemDiariaDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  centroCustoId: string | null;
  planejamentoId: string | null;
  ccLabel: string | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return "—";
  }
}

function statusBadge(s: string) {
  if (s === "emitida") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Emitida</Badge>;
  if (s === "cancelada") return <Badge variant="destructive">Cancelada</Badge>;
  return <Badge variant="secondary">Rascunho</Badge>;
}

const OrdemDiariaTab: React.FC<Props> = ({ centroCustoId, planejamentoId, ccLabel }) => {
  const { hasActionPermission } = usePermission();
  const canView = hasActionPermission("engenharia_ordem_diaria_view", "visualizar");

  const [dataInicio, setDataInicio] = useState<string>("");
  const [dataFim, setDataFim] = useState<string>("");
  const [statusF, setStatusF] = useState<string>("todos");
  const [busca, setBusca] = useState<string>("");
  const [ordemSel, setOrdemSel] = useState<string | null>(null);

  const filtros = useMemo(
    () => ({
      centroCustoId,
      planejamentoId,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
      status: statusF === "todos" ? null : (statusF as any),
    }),
    [centroCustoId, planejamentoId, dataInicio, dataFim, statusF]
  );

  const { data, isLoading } = useOrdensDiarias(filtros);

  const filtradas = useMemo(() => {
    const lista = data ?? [];
    if (!busca.trim()) return lista;
    const q = busca.trim().toLowerCase();
    return lista.filter(
      (o) =>
        (o.responsavel_nome_snapshot ?? "").toLowerCase().includes(q) ||
        (o.observacao_geral ?? "").toLowerCase().includes(q)
    );
  }, [data, busca]);

  if (!centroCustoId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Selecione um Centro de Custo"
            description="Escolha um Centro de Custo para listar Ordens Diárias."
          />
        </CardContent>
      </Card>
    );
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className="pt-6">
          <EmptyState
            icon={<CalendarDays className="h-5 w-5" />}
            title="Sem acesso"
            description="Você não possui permissão para visualizar Ordens Diárias."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <TabIntro text="Ordens Diárias geradas a partir do Planejamento Semanal. Ordens emitidas são imutáveis; o cancelamento exige motivo." />

      <Card>
        <CardContent className="p-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label htmlFor="od-di">Data inicial</Label>
            <Input
              id="od-di"
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="od-df">Data final</Label>
            <Input
              id="od-df"
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select value={statusF} onValueChange={setStatusF}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="emitida">Emitida</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="od-busca">Buscar</Label>
            <Input
              id="od-busca"
              placeholder="Responsável ou observação"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Semana</TableHead>
              <TableHead>Responsável</TableHead>
              <TableHead className="text-center">Tarefas</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Emitida em</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Carregando…
                </TableCell>
              </TableRow>
            ) : filtradas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                  Nenhuma Ordem Diária encontrada.
                </TableCell>
              </TableRow>
            ) : (
              filtradas.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{fmtDate(o.data_ordem)}</TableCell>
                  <TableCell className="text-xs">
                    {fmtDate(o.semana_inicio)} – {fmtDate(o.semana_fim)}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{o.responsavel_nome_snapshot ?? "—"}</div>
                    {o.responsavel_funcao_snapshot && (
                      <div className="text-xs text-muted-foreground">
                        {o.responsavel_funcao_snapshot}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{o.itens_count ?? 0}</Badge>
                  </TableCell>
                  <TableCell>{statusBadge(o.status)}</TableCell>
                  <TableCell className="text-xs">
                    {o.emitido_em ? format(new Date(o.emitido_em), "dd/MM/yyyy HH:mm") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Visualizar"
                      onClick={() => setOrdemSel(o.id)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <VisualizarOrdemDiariaDialog
        open={!!ordemSel}
        onOpenChange={(v) => !v && setOrdemSel(null)}
        ordemId={ordemSel}
        ccLabel={ccLabel}
      />
    </div>
  );
};

export default OrdemDiariaTab;
