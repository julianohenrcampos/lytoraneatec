import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  Loader2,
  Copy,
  Search,
  RefreshCcw,
  Filter,
  History,
} from "lucide-react";
import { toast } from "sonner";

const TIPO_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "warning" | "destructive" | "success" | "info" }> = {
  biometria_cadastrada: { label: "Biometria cadastrada", variant: "success" },
  biometria_substituida: { label: "Biometria substituída", variant: "warning" },
  biometria_desativada: { label: "Biometria desativada", variant: "destructive" },
  assinatura_cadastrada: { label: "Assinatura cadastrada", variant: "success" },
  assinatura_substituida: { label: "Assinatura substituída", variant: "warning" },
  cpf_alterado: { label: "CPF alterado", variant: "info" },
};

const ORIGEM_LABELS: Record<string, string> = {
  admin_web: "Painel Admin",
  pwa_mobile: "PWA Mobile",
  totem_device: "Totem",
  api_interna: "API Interna",
  trigger_db: "Trigger DB",
};

const PAGE_SIZE = 50;

interface AuditRow {
  id: string;
  funcionario_id: string;
  tipo_evento: string;
  hash_anterior: string | null;
  hash_novo: string | null;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  origem: string;
  metadata: Record<string, unknown>;
  event_hash: string;
  integridade_hash: string;
  created_at: string;
  funcionario_nome?: string | null;
  funcionario_matricula?: string | null;
  user_email?: string | null;
}

interface FuncOption {
  value: string;
  label: string;
}

const truncHash = (h?: string | null) =>
  h && h.length > 8 ? `${h.slice(0, 4)}...${h.slice(-4)}` : h || "—";

const AuditoriaBiometria: React.FC = () => {
  usePageTitle("Auditoria de Biometria");

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [funcionarios, setFuncionarios] = useState<FuncOption[]>([]);

  // Filtros
  const [filtroFuncionario, setFiltroFuncionario] = useState<string>("");
  const [filtroTipo, setFiltroTipo] = useState<string>("__all");
  const [filtroOrigem, setFiltroOrigem] = useState<string>("__all");
  const [filtroDataIni, setFiltroDataIni] = useState<string>("");
  const [filtroDataFim, setFiltroDataFim] = useState<string>("");

  // Detalhe
  const [detalhe, setDetalhe] = useState<AuditRow | null>(null);

  // Carrega dropdown de funcionários (apenas para filtro)
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("bd_funcionarios")
          .select("id, nome_completo, matricula")
          .in("status", ["Ativo", "Ativo sem Registro"] as any)
          .order("nome_completo");
        const opts: FuncOption[] = (data || []).map((f: any) => ({
          value: f.id,
          label: `${f.nome_completo}${f.matricula ? ` — ${f.matricula}` : ""}`,
        }));
        setFuncionarios(opts);
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const carregar = async (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 0 : page;
    try {
      let q = supabase
        .from("bd_auditoria_biometria" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

      if (filtroFuncionario) q = q.eq("funcionario_id", filtroFuncionario);
      if (filtroTipo && filtroTipo !== "__all") q = q.eq("tipo_evento", filtroTipo);
      if (filtroOrigem && filtroOrigem !== "__all") q = q.eq("origem", filtroOrigem);
      if (filtroDataIni) q = q.gte("created_at", new Date(filtroDataIni).toISOString());
      if (filtroDataFim) {
        const fim = new Date(filtroDataFim);
        fim.setHours(23, 59, 59, 999);
        q = q.lte("created_at", fim.toISOString());
      }

      const { data, error } = await q;
      if (error) throw error;
      const baseRows = (data || []) as unknown as AuditRow[];

      // Joins manuais (defensivo): nomes de funcionários e e-mails
      const funcIds = Array.from(new Set(baseRows.map((r) => r.funcionario_id))).filter(Boolean);
      const userIds = Array.from(new Set(baseRows.map((r) => r.user_id).filter(Boolean))) as string[];

      const [funcsRes, profRes] = await Promise.all([
        funcIds.length
          ? supabase
              .from("bd_funcionarios")
              .select("id, nome_completo, matricula")
              .in("id", funcIds)
          : Promise.resolve({ data: [] as any[] }),
        userIds.length
          ? supabase.from("profiles").select("id, email, nome_completo").in("id", userIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const mapFunc = new Map<string, { nome: string | null; matricula: string | null }>(
        (funcsRes.data || []).map((f: any) => [f.id, { nome: f.nome_completo, matricula: f.matricula }]),
      );
      const mapProf = new Map<string, string | null>(
        (profRes.data || []).map((p: any) => [p.id, p.email || p.nome_completo || null]),
      );

      const enriched = baseRows.slice(0, PAGE_SIZE).map((r) => ({
        ...r,
        funcionario_nome: mapFunc.get(r.funcionario_id)?.nome ?? null,
        funcionario_matricula: mapFunc.get(r.funcionario_id)?.matricula ?? null,
        user_email: r.user_id ? mapProf.get(r.user_id) ?? null : null,
      }));

      setRows(enriched);
      setHasMore(baseRows.length > PAGE_SIZE);
      if (resetPage) setPage(0);
    } catch (e: any) {
      console.error("[AUDITORIA] erro:", e);
      toast.error(e?.message || "Erro ao carregar auditoria");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    carregar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const aplicarFiltros = () => {
    setPage(0);
    carregar(true);
  };

  const limparFiltros = () => {
    setFiltroFuncionario("");
    setFiltroTipo("__all");
    setFiltroOrigem("__all");
    setFiltroDataIni("");
    setFiltroDataFim("");
    setPage(0);
    setTimeout(() => carregar(true), 0);
  };

  const copy = async (v: string | null | undefined, label: string) => {
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  const totalRegistros = rows.length;

  return (
    <MainLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" /> Auditoria de Biometria e Assinatura
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Trilha completa de alterações em biometria, assinatura e dados sensíveis (CPF).
                </p>
              </div>
              <Badge variant="secondary" className="w-fit">
                <History className="h-3.5 w-3.5 mr-1" /> {totalRegistros} eventos nesta página
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Funcionário</label>
                <Combobox
                  options={funcionarios}
                  value={filtroFuncionario}
                  onChange={setFiltroFuncionario}
                  placeholder="Todos"
                  emptyText="Nenhum funcionário"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tipo de evento</label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todos</SelectItem>
                    {Object.entries(TIPO_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Origem</label>
                <Select value={filtroOrigem} onValueChange={setFiltroOrigem}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all">Todas</SelectItem>
                    {Object.entries(ORIGEM_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">De</label>
                <Input type="date" value={filtroDataIni} onChange={(e) => setFiltroDataIni(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Até</label>
                <Input type="date" value={filtroDataFim} onChange={(e) => setFiltroDataFim(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={aplicarFiltros} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                Aplicar filtros
              </Button>
              <Button variant="outline" onClick={limparFiltros} disabled={loading}>
                <Filter className="h-4 w-4 mr-2" /> Limpar
              </Button>
              <Button variant="ghost" onClick={() => carregar(true)} disabled={loading}>
                <RefreshCcw className="h-4 w-4 mr-2" /> Atualizar
              </Button>
            </div>

            {/* Tabela */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="px-3 py-2 whitespace-nowrap">Data/Hora</th>
                    <th className="px-3 py-2">Funcionário</th>
                    <th className="px-3 py-2">Evento</th>
                    <th className="px-3 py-2">Origem</th>
                    <th className="px-3 py-2">Usuário</th>
                    <th className="px-3 py-2">IP</th>
                    <th className="px-3 py-2">Hash anterior</th>
                    <th className="px-3 py-2">Hash novo</th>
                    <th className="px-3 py-2">Integridade</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {loading && rows.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">
                      <Loader2 className="h-4 w-4 inline animate-spin mr-2" /> Carregando…
                    </td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={10} className="text-center py-8 text-muted-foreground">
                      Nenhum evento encontrado para os filtros atuais.
                    </td></tr>
                  ) : (
                    rows.map((r) => {
                      const tipo = TIPO_LABELS[r.tipo_evento] || { label: r.tipo_evento, variant: "default" as const };
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium">{r.funcionario_nome || "—"}</div>
                            {r.funcionario_matricula && (
                              <div className="text-xs text-muted-foreground">Mat. {r.funcionario_matricula}</div>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={tipo.variant}>{tipo.label}</Badge>
                          </td>
                          <td className="px-3 py-2 text-xs">{ORIGEM_LABELS[r.origem] || r.origem}</td>
                          <td className="px-3 py-2 text-xs">{r.user_email || (r.user_id ? r.user_id.slice(0, 8) + "…" : "—")}</td>
                          <td className="px-3 py-2 text-xs font-mono">{r.ip || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{truncHash(r.hash_anterior)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{truncHash(r.hash_novo)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{truncHash(r.integridade_hash)}</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" onClick={() => setDetalhe(r)}>Detalhes</Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Página {page + 1}
              </span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page === 0 || loading} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={!hasMore || loading} onClick={() => setPage((p) => p + 1)}>
                  Próxima
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal de detalhe */}
        <Dialog open={!!detalhe} onOpenChange={(o) => !o && setDetalhe(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do evento</DialogTitle>
              <DialogDescription>
                Hashes completos, metadata e user-agent do evento de auditoria.
              </DialogDescription>
            </DialogHeader>
            {detalhe && (
              <div className="space-y-3 text-sm">
                <Field label="Funcionário" value={detalhe.funcionario_nome || detalhe.funcionario_id} />
                <Field label="Tipo" value={TIPO_LABELS[detalhe.tipo_evento]?.label || detalhe.tipo_evento} />
                <Field label="Origem" value={ORIGEM_LABELS[detalhe.origem] || detalhe.origem} />
                <Field label="Usuário" value={detalhe.user_email || detalhe.user_id || "—"} />
                <Field label="IP" value={detalhe.ip || "—"} mono />
                <Field label="User-Agent" value={detalhe.user_agent || "—"} small />
                <Field label="Data" value={new Date(detalhe.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })} />

                <HashRow label="Hash anterior" value={detalhe.hash_anterior} onCopy={(v) => copy(v, "Hash anterior")} />
                <HashRow label="Hash novo" value={detalhe.hash_novo} onCopy={(v) => copy(v, "Hash novo")} />
                <HashRow label="Event hash (anti-duplicidade)" value={detalhe.event_hash} onCopy={(v) => copy(v, "Event hash")} />
                <HashRow label="Integridade hash" value={detalhe.integridade_hash} onCopy={(v) => copy(v, "Integridade hash")} />

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Metadata</div>
                  <pre className="bg-muted rounded p-2 text-xs overflow-x-auto">
                    {JSON.stringify(detalhe.metadata || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetalhe(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

const Field: React.FC<{ label: string; value: string; mono?: boolean; small?: boolean }> = ({ label, value, mono, small }) => (
  <div className="grid grid-cols-[140px_1fr] gap-2">
    <div className="text-muted-foreground">{label}:</div>
    <div className={[mono ? "font-mono" : "", small ? "text-xs break-all" : ""].join(" ")}>{value}</div>
  </div>
);

const HashRow: React.FC<{ label: string; value: string | null; onCopy: (v: string | null) => void }> = ({ label, value, onCopy }) => (
  <div className="grid grid-cols-[140px_1fr_auto] gap-2 items-center">
    <div className="text-muted-foreground">{label}:</div>
    <div className="font-mono text-xs break-all">{value || "—"}</div>
    <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!value} onClick={() => onCopy(value)} title="Copiar">
      <Copy className="h-3.5 w-3.5" />
    </Button>
  </div>
);

export default AuditoriaBiometria;
