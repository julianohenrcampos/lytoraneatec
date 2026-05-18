/**
 * Fase 1 — Dashboard read-only de auditoria do modo SHADOW (Ponto × Diárias).
 * Acesso restrito a SuperAdm. Não altera presenças/apontamentos.
 */
import { useMemo, useState } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import {
  usePontoShadowKpis,
  usePontoShadowEventos,
  useExecutarSimulacaoShadow,
} from "@/hooks/diarias/usePontoShadowAuditoria";
import type { ShadowEvento, ShadowFiltros } from "@/services/diarias/pontoShadowAuditService";
import { format } from "date-fns";
import { AlertTriangle, PlayCircle, RotateCcw, ShieldX } from "lucide-react";

const STATUS_OPTIONS = [
  "auto_apontado_simulado",
  "sem_solicitacao_simulado",
  "fora_convocacao_simulado",
  "fora_dia_solicitado_simulado",
  "conflito_cc_simulado",
  "ambiguo_simulado",
  "fora_raio_simulado",
  "ordem_invalida_simulado",
  "aditivo_pendente_simulado",
  "presenca_ja_existente_simulado",
  "batida_invalida_simulado",
];

export default function PontoShadowAuditoria() {
  usePageTitle("Auditoria Ponto × Diárias (Shadow)");
  const { isSuperAdmin, isLoading } = usePermission();
  const { toast } = useToast();

  const hoje = format(new Date(), "yyyy-MM-dd");
  const seteDiasAtras = format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd");

  const [desde, setDesde] = useState(seteDiasAtras);
  const [ate, setAte] = useState(hoje);
  const [status, setStatus] = useState<string>("__all__");
  const [page, setPage] = useState(0);
  const [detalhe, setDetalhe] = useState<ShadowEvento | null>(null);

  const filtros: ShadowFiltros = useMemo(
    () => ({
      desde,
      ate,
      ...(status && status !== "__all__" ? { status } : {}),
    }),
    [desde, ate, status],
  );

  const kpis = usePontoShadowKpis(filtros);
  const eventos = usePontoShadowEventos(filtros, page);
  const exec = useExecutarSimulacaoShadow();

  if (!isLoading && !isSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <ShieldX className="h-5 w-5" /> Acesso restrito
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Esta página é restrita a SuperAdm.
          </CardContent>
        </Card>
      </div>
    );
  }

  async function rodar(reprocessar: boolean) {
    try {
      const res = await exec.mutateAsync({
        desde: `${desde}T00:00:00-03:00`,
        ate: `${ate}T23:59:59-03:00`,
        limit: 500,
        reprocessar,
      });
      toast({
        title: reprocessar ? "Período reprocessado" : "Simulação executada",
        description: `Processadas: ${res.resultado?.processadas ?? 0}. ${
          reprocessar ? `Apagados (shadow): ${res.deleted ?? 0}.` : ""
        }`,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: String(e?.message ?? e), variant: "destructive" });
    }
  }

  const total = kpis.data?.total ?? 0;
  const porStatus = kpis.data?.por_status ?? {};
  const autoOk = porStatus["auto_apontado_simulado"] ?? 0;
  const taxaMatch = total > 0 ? Math.round((autoOk / total) * 100) : 0;
  const divergentes = total - autoOk;

  return (
    <div className="space-y-4">
      {/* título via usePageTitle */}

      <Card className="border-yellow-500/40 bg-yellow-500/5">
        <CardContent className="flex items-start gap-3 py-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
          <div>
            <strong>Modo Shadow (somente observabilidade).</strong> Esta auditoria não cria nem altera
            presenças, apontamentos, pagamentos ou assinaturas. Todos os status terminam em
            <code className="mx-1">_simulado</code>.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Filtros</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <Label>Desde</Label>
            <Input type="date" value={desde} onChange={(e) => { setDesde(e.target.value); setPage(0); }} />
          </div>
          <div>
            <Label>Até</Label>
            <Input type="date" value={ate} onChange={(e) => { setAte(e.target.value); setPage(0); }} />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => { setStatus(v); setPage(0); }}>
              <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {/* Botões operacionais (Executar simulação / Reprocessar) removidos.
              O modo shadow foi descontinuado como fluxo operacional. Esta tela
              permanece apenas como visualização histórica para diagnóstico SuperAdm. */}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Batidas analisadas (shadow)" value={total} />
        <Kpi label="Auto-apontado (simulado)" value={autoOk} />
        <Kpi label="Taxa de match" value={`${taxaMatch}%`} />
        <Kpi label="Divergentes" value={divergentes} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Distribuição por status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((s) => (
            <Badge key={s} variant="outline" className="text-xs">
              {s}: <span className="ml-1 font-semibold">{porStatus[s] ?? 0}</span>
            </Badge>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Eventos shadow ({eventos.data?.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-3">Data op.</th>
                <th className="py-2 pr-3">Funcionário</th>
                <th className="py-2 pr-3">CC</th>
                <th className="py-2 pr-3">Tipo</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Motivo</th>
                <th className="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody>
              {(eventos.data?.rows ?? []).map((r) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="py-2 pr-3">{r.data_operacional ?? "-"}</td>
                  <td className="py-2 pr-3">{r.funcionario_nome ?? r.funcionario_id?.slice(0, 8)}</td>
                  <td className="py-2 pr-3">{r.codigo_centro_custo ?? "-"}</td>
                  <td className="py-2 pr-3">{r.tipo_batida ?? "-"}</td>
                  <td className="py-2 pr-3"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="py-2 pr-3 max-w-[280px] truncate" title={r.motivo ?? ""}>{r.motivo}</td>
                  <td className="py-2 pr-3">
                    <Button size="sm" variant="ghost" onClick={() => setDetalhe(r)}>Detalhes</Button>
                  </td>
                </tr>
              ))}
              {(!eventos.data?.rows || eventos.data.rows.length === 0) && (
                <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Nenhum evento shadow no período/filtro.</td></tr>
              )}
            </tbody>
          </table>
          <div className="flex items-center justify-end gap-2 mt-3">
            <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>Anterior</Button>
            <span className="text-xs text-muted-foreground">Página {page + 1}</span>
            <Button size="sm" variant="outline" disabled={((page + 1) * 50) >= (eventos.data?.total ?? 0)} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        </CardContent>
      </Card>

      <Drawer open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Detalhes do evento shadow</DrawerTitle>
          </DrawerHeader>
          <div className="p-4 max-h-[60vh] overflow-auto">
            <pre className="text-xs whitespace-pre-wrap break-words">
              {detalhe ? JSON.stringify(detalhe, null, 2) : ""}
            </pre>
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
