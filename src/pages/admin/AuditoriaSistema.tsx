import { useEffect, useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import { AlertTriangle, Copy, Download, FileText, List, RotateCcw, Search, Timer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PeriodoPickerCompacto } from "./components/PeriodoPickerCompacto";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DateRange } from "react-day-picker";
import { AuditoriaAlertasBanner, type AuditoriaAlertas24h } from "./components/AuditoriaAlertasBanner";
import { AuditoriaTimeline } from "./components/AuditoriaTimeline";
import { AuditoriaEscopoBadge } from "./components/AuditoriaEscopoBadge";
import { traduzirEvento, categoriaLabel, CATEGORIA_LABEL } from "./utils/traduzirEvento";

type Categoria = "biometria" | "assinatura" | "cpf" | "seguranca" | "ponto" | "dados";
type NivelRisco = "baixo" | "medio" | "alto";

interface MotivoRisco {
  codigo: string;
  label: string;
  peso: "alto" | "medio" | "baixo";
}

interface AuditoriaRow {
  id: string;
  categoria: Categoria;
  tipo_evento: string;
  funcionario_id: string | null;
  funcionario_nome: string | null;
  usuario_id: string | null;
  usuario_email: string | null;
  usuario_nome: string | null;
  ip: string | null;
  user_agent: string | null;
  origem: string;
  hash_anterior: string | null;
  hash_novo: string | null;
  nivel_risco: NivelRisco;
  is_suspeito: boolean;
  motivos_risco: MotivoRisco[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const CATEGORIAS: { value: Categoria; color: string }[] = [
  { value: "biometria", color: "bg-blue-500/10 text-blue-700 dark:text-blue-300" },
  { value: "assinatura", color: "bg-purple-500/10 text-purple-700 dark:text-purple-300" },
  { value: "cpf", color: "bg-pink-500/10 text-pink-700 dark:text-pink-300" },
  { value: "seguranca", color: "bg-red-500/10 text-red-700 dark:text-red-300" },
  { value: "ponto", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  { value: "dados", color: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
];

const RISCO_BADGE: Record<NivelRisco, string> = {
  baixo: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  medio: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30",
  alto: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/30",
};

const PAGE_SIZE = 50;

export default function AuditoriaSistema() {
  usePageTitle("Central de Auditoria");
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("__all");
  const [nivelFiltro, setNivelFiltro] = useState<string>("__all");
  const [apenasSuspeitos, setApenasSuspeitos] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AuditoriaRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [detalhe, setDetalhe] = useState<AuditoriaRow | null>(null);
  const [viewMode, setViewMode] = useState<"tabela" | "timeline">("tabela");
  const [alertas, setAlertas] = useState<AuditoriaAlertas24h | null>(null);
  const [alertasLoading, setAlertasLoading] = useState(true);

  async function fetchAlertas() {
    setAlertasLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_auditoria_alertas_24h");
      if (error) throw error;
      setAlertas(data as unknown as AuditoriaAlertas24h);
    } catch {
      setAlertas(null);
    } finally {
      setAlertasLoading(false);
    }
  }

  useEffect(() => {
    fetchAlertas();
  }, []);

  function handleInvestigarCriticos() {
    setDateRange({ from: subDays(new Date(), 1), to: new Date() });
    setNivelFiltro("alto");
    setCategoriaFiltro("__all");
    setApenasSuspeitos(false);
    setSearch("");
    setPage(1);
    setViewMode("tabela");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function fetchRows(targetPage = page) {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_auditoria_sistema", {
        p_categorias: categoriaFiltro === "__all" ? null : [categoriaFiltro],
        p_funcionario_id: null,
        p_usuario_id: null,
        p_data_inicio: dateRange?.from?.toISOString() ?? null,
        p_data_fim: dateRange?.to?.toISOString() ?? new Date().toISOString(),
        p_nivel_risco: nivelFiltro === "__all" ? null : [nivelFiltro],
        p_apenas_suspeitos: apenasSuspeitos,
        p_search: search.trim() || null,
        p_page: targetPage,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      const payload = data as unknown as { total_count: number; rows: AuditoriaRow[] } | null;
      setRows(payload?.rows ?? []);
      setTotal(Number(payload?.total_count ?? 0));
    } catch (err: any) {
      toast({
        title: "Erro ao carregar auditoria",
        description: err?.message ?? "Falha desconhecida",
        variant: "destructive",
      });
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows(1);
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriaFiltro, nivelFiltro, apenasSuspeitos, dateRange?.from, dateRange?.to]);

  function handleSearch() {
    setPage(1);
    fetchRows(1);
  }

  function handleReset() {
    setDateRange({ from: subDays(new Date(), 30), to: new Date() });
    setCategoriaFiltro("__all");
    setNivelFiltro("__all");
    setApenasSuspeitos(false);
    setSearch("");
    setPage(1);
  }

  async function buscarTodasParaExport(): Promise<AuditoriaRow[]> {
    const acumulado: AuditoriaRow[] = [];
    const hardCap = 10000;
    let p = 1;
    while (acumulado.length < hardCap) {
      const { data, error } = await supabase.rpc("get_auditoria_sistema", {
        p_categorias: categoriaFiltro === "__all" ? null : [categoriaFiltro],
        p_funcionario_id: null,
        p_usuario_id: null,
        p_data_inicio: dateRange?.from?.toISOString() ?? null,
        p_data_fim: dateRange?.to?.toISOString() ?? new Date().toISOString(),
        p_nivel_risco: nivelFiltro === "__all" ? null : [nivelFiltro],
        p_apenas_suspeitos: apenasSuspeitos,
        p_search: search.trim() || null,
        p_page: p,
        p_page_size: 200,
      });
      if (error) throw error;
      const payload = data as unknown as { rows: AuditoriaRow[]; total_count: number };
      const batch = payload?.rows ?? [];
      acumulado.push(...batch);
      if (batch.length < 200) break;
      p += 1;
    }
    return acumulado;
  }

  function rowsToFlat(data: AuditoriaRow[]) {
    return data.map((r) => ({
      Data: format(new Date(r.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }),
      Categoria: categoriaLabel(r.categoria),
      Evento: traduzirEvento(r.tipo_evento),
      "Evento (código)": r.tipo_evento,
      Risco: r.nivel_risco,
      "Motivos do risco": (r.motivos_risco ?? []).map((m) => m.label).join("; "),
      Suspeito: r.is_suspeito ? "Sim" : "Não",
      Funcionário: r.funcionario_nome ?? "",
      Usuário: r.usuario_nome ?? r.usuario_email ?? "",
      Email: r.usuario_email ?? "",
      IP: r.ip ?? "",
      Origem: r.origem,
      "Hash anterior": r.hash_anterior ?? "",
      "Hash novo": r.hash_novo ?? "",
    }));
  }

  async function exportarCsv() {
    setExporting(true);
    try {
      const all = await buscarTodasParaExport();
      const flat = rowsToFlat(all);
      const headers = Object.keys(flat[0] ?? { Data: "" });
      const csv = [
        headers.join(";"),
        ...flat.map((row) =>
          headers
            .map((h) => {
              const v = String((row as any)[h] ?? "").replace(/"/g, '""');
              return `"${v}"`;
            })
            .join(";")
        ),
      ].join("\n");
      const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
      saveAs(blob, `auditoria_sistema_${format(new Date(), "yyyy-MM-dd")}.csv`);
      toast({ title: "CSV gerado", description: `${all.length} registros exportados.` });
    } catch (err: any) {
      toast({ title: "Erro ao exportar CSV", description: err?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  async function exportarExcel() {
    setExporting(true);
    try {
      const all = await buscarTodasParaExport();
      const flat = rowsToFlat(all);
      const ws = XLSX.utils.json_to_sheet(flat);
      ws["!cols"] = [
        { wch: 20 }, { wch: 22 }, { wch: 28 }, { wch: 24 }, { wch: 10 },
        { wch: 50 }, { wch: 10 }, { wch: 28 }, { wch: 24 }, { wch: 28 },
        { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 22 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Auditoria Sistema");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(blob, `auditoria_sistema_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast({ title: "Excel gerado", description: `${all.length} registros exportados.` });
    } catch (err: any) {
      toast({ title: "Erro ao exportar Excel", description: err?.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  }

  const categoriaInfo = useMemo(() => {
    const m = new Map(CATEGORIAS.map((c) => [c.value, c]));
    return (cat: string) => m.get(cat as Categoria);
  }, []);

  return (
    <>
      <div className="space-y-4 p-4 md:p-6">
        {/* Header com badge de escopo */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Central de Auditoria</h1>
            <p className="text-xs text-muted-foreground">
              Investigação e rastreabilidade de eventos sensíveis do sistema.
            </p>
          </div>
          <AuditoriaEscopoBadge />
        </div>

        {/* Banner de alertas 24h */}
        <AuditoriaAlertasBanner
          data={alertas}
          loading={alertasLoading}
          onInvestigar={handleInvestigarCriticos}
        />

        {/* Filtros */}
        <Card>
          <CardContent className="grid grid-cols-1 gap-3 p-4 md:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Período</Label>
              <PeriodoPickerCompacto value={dateRange} onChange={setDateRange} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Categoria</Label>
              <Select value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="__all">Todas</SelectItem>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{categoriaLabel(c.value)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Nível de risco</Label>
              <Select value={nivelFiltro} onValueChange={setNivelFiltro}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent className="z-[10000]">
                  <SelectItem value="__all">Todos</SelectItem>
                  <SelectItem value="baixo">Baixo</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="alto">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              <Switch id="susp" checked={apenasSuspeitos} onCheckedChange={setApenasSuspeitos} />
              <Label htmlFor="susp" className="text-sm">Apenas suspeitos</Label>
            </div>

            <div className="md:col-span-3">
              <Label className="text-xs">Busca livre</Label>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  placeholder="Email, IP ou tipo de evento"
                />
                <Button onClick={handleSearch} variant="default">
                  <Search className="h-4 w-4" />
                  Buscar
                </Button>
              </div>
            </div>

            <div className="flex items-end gap-2">
              <Button variant="outline" onClick={handleReset} className="flex-1">
                <RotateCcw className="h-4 w-4" /> Limpar
              </Button>
            </div>

            <div className="md:col-span-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
              <div className="text-sm text-muted-foreground">
                {loading ? "Carregando…" : `${total.toLocaleString("pt-BR")} registros`}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportarCsv} disabled={exporting || total === 0}>
                  <FileText className="h-4 w-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" onClick={exportarExcel} disabled={exporting || total === 0}>
                  <Download className="h-4 w-4" /> Excel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Toggle Tabela / Timeline */}
        <div className="flex items-center justify-end">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(v) => v && setViewMode(v as "tabela" | "timeline")}
            size="sm"
          >
            <ToggleGroupItem value="tabela" aria-label="Tabela">
              <List className="mr-1 h-4 w-4" /> Tabela
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" aria-label="Linha do tempo">
              <Timer className="mr-1 h-4 w-4" /> Linha do tempo
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        {/* Tabela ou Timeline */}
        <Card>
          <CardContent className="p-0">
            {viewMode === "timeline" ? (
              <AuditoriaTimeline
                rows={rows}
                loading={loading}
                onSelect={(id) => {
                  const r = rows.find((x) => x.id === id);
                  if (r) setDetalhe(r);
                }}
              />
            ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead>Susp.</TableHead>
                    <TableHead>Funcionário</TableHead>
                    <TableHead>Evento</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 9 }).map((__, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        Nenhum registro encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((r) => {
                      const cat = categoriaInfo(r.categoria);
                      return (
                        <TableRow key={`${r.categoria}-${r.id}`}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(r.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={cat?.color}>{categoriaLabel(r.categoria)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={RISCO_BADGE[r.nivel_risco]}>
                              {r.nivel_risco}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {r.is_suspeito ? (
                              <AlertTriangle className="h-4 w-4 text-amber-500" />
                            ) : null}
                          </TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.funcionario_nome ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.tipo_evento}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{r.usuario_nome ?? r.usuario_email ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{r.ip ?? "—"}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setDetalhe(r)}>Detalhes</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
            )}

            {/* Paginação */}
            <div className="flex items-center justify-between gap-2 border-t p-3">
              <div className="text-xs text-muted-foreground">
                Página {page} de {totalPages}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading}
                  onClick={() => { const np = page - 1; setPage(np); fetchRows(np); }}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading}
                  onClick={() => { const np = page + 1; setPage(np); fetchRows(np); }}>
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de detalhes */}
      <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da auditoria</DialogTitle>
          </DialogHeader>
          {detalhe && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Categoria" value={categoriaLabel(detalhe.categoria)} />
                <Field label="Evento" value={traduzirEvento(detalhe.tipo_evento)} />
                <Field label="Risco" value={detalhe.nivel_risco} />
                <Field label="Suspeito" value={detalhe.is_suspeito ? "Sim" : "Não"} />
                <Field label="Funcionário" value={detalhe.funcionario_nome ?? "—"} />
                <Field label="Usuário" value={detalhe.usuario_email ?? "—"} />
                <Field label="IP" value={detalhe.ip ?? "—"} />
                <Field label="Origem" value={detalhe.origem} />
              </div>
              <HashField label="Hash anterior" value={detalhe.hash_anterior} />
              <HashField label="Hash novo" value={detalhe.hash_novo} />
              {detalhe.user_agent && (
                <Field label="User Agent" value={detalhe.user_agent} multiline />
              )}
              <div>
                <Label className="text-xs">Metadata</Label>
                <pre className="mt-1 max-h-60 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(detalhe.metadata, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className={`mt-0.5 ${multiline ? "break-all" : "truncate"}`}>{value}</div>
    </div>
  );
}

function HashField({ label, value }: { label: string; value: string | null }) {
  const { toast } = useToast();
  if (!value) return null;
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-0.5 flex items-center gap-2">
        <code className="break-all rounded bg-muted px-2 py-1 text-xs">{value}</code>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            navigator.clipboard.writeText(value);
            toast({ title: "Hash copiado" });
          }}
        >
          <Copy className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
