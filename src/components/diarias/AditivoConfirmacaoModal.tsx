// =====================================================
// MODAL: CONFIRMAÇÃO DE ADITIVO DE DIÁRIA (Fase I.4)
// =====================================================
// Exibe os dados de um aditivo pendente e permite aprovar / reprovar via RPC.
// Não faz update direto em bd_diaria_aditivos nem em convocados_pre.
//
// E5/S3 (mai/2026): aceita `aditivos` (lista pré-carregada pela RPC escopada
// `fn_diaria_aditivos_pendentes_escopo`) e `solicitacaoInfo`. Quando fornecidos,
// dispensa as queries diretas a `bd_diaria_aditivos`, `bd_diaria_solicitacoes`
// e `profiles` — que ficavam bloqueadas por RLS para GerenteRegional e
// causavam loading infinito. Suporta múltiplos pendentes via paginação interna
// "X de N" e avança automaticamente após cada decisão.
// =====================================================

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, Check, X, ShieldAlert, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAditivoById } from "@/hooks/diarias/useAditivos";
import { useAprovarAditivo, useReprovarAditivo } from "@/hooks/diarias/useAditivosPendentes";
import { usePermission } from "@/hooks/usePermission";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import type { AditivoPendenteRef } from "@/hooks/diarias/useAditivosPendentesPorSolicitacao";

interface SolicitacaoInfo {
  id: string;
  numero_solicitacao?: string | number | null;
  centro_custo_id?: string | null;
  criado_por?: string | null;
  bd_centros_custo?: { nome_centro_custo?: string | null; codigo_centro_custo?: string | null } | null;
  engenheiro_solicitante_id?: string | null;
}

interface AditivoConfirmacaoModalProps {
  aditivoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Lista pré-carregada (origem segura: RPC escopada). Quando presente, dispensa queries bloqueadas por RLS. */
  aditivos?: AditivoPendenteRef[];
  /** Dados básicos da solicitação já carregados na listagem. Evita SELECT direto em bd_diaria_solicitacoes. */
  solicitacaoInfo?: SolicitacaoInfo;
}

function formatCurrency(value: number | null | undefined): string {
  const v = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

const TIPO_LABEL: Record<string, string> = {
  adicionar_dia: "Adição de dia",
  remover_dia: "Remoção de dia",
  adicionar_funcionario: "Inclusão de funcionário",
  remover_funcionario: "Remoção de funcionário",
  funcionario_inclusao: "Inclusão de funcionário",
  funcionario_remocao: "Remoção de funcionário",
};

export function AditivoConfirmacaoModal({
  aditivoId,
  open,
  onOpenChange,
  aditivos,
  solicitacaoInfo,
}: AditivoConfirmacaoModalProps) {
  const qc = useQueryClient();
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const { user: profile } = useUserProfile();
  const acessoGlobal = !!profile?.acesso_global;
  const bypass = isSuperAdmin || acessoGlobal;
  const podeAprovar =
    bypass || hasActionPermission('diarias_aditivo_aprovar', 'aprovar');

  const usarPropAditivos = Array.isArray(aditivos) && aditivos.length > 0;

  const [modoReprovar, setModoReprovar] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [indiceAtual, setIndiceAtual] = useState(0);

  // Reset ao abrir/trocar solicitação
  useEffect(() => {
    if (!open) {
      setModoReprovar(false);
      setMotivo("");
      setIndiceAtual(0);
      return;
    }
    // Quando a lista mudar (nova solicitação), volta para o primeiro
    setIndiceAtual(0);
  }, [open, solicitacaoInfo?.id]);

  // ---------- Fonte de dados: prop OU query (fallback retro) ----------
  const aditivoPropAtual: AditivoPendenteRef | null = usarPropAditivos
    ? aditivos![Math.min(indiceAtual, aditivos!.length - 1)] ?? null
    : null;

  const { data: aditivoQuery, isLoading: isLoadingQuery } = useAditivoById(
    usarPropAditivos ? undefined : (aditivoId ?? undefined),
  );

  // Adaptador para campo único `aditivo` consumido pelo restante do componente
  const aditivo: any = usarPropAditivos ? aditivoPropAtual : aditivoQuery;
  const isLoading = usarPropAditivos ? false : isLoadingQuery;

  // ---------- Solicitação ----------
  // Quando vem por prop, usamos diretamente. Caso contrário, fallback à query antiga.
  const { data: solicitacaoQuery } = useQuery({
    queryKey: ["aditivo-confirmacao-solic", aditivo?.solicitacao_id],
    enabled: !usarPropAditivos && !!aditivo?.solicitacao_id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_diaria_solicitacoes")
        .select("id, numero_solicitacao, centro_custo_id, criado_por, bd_centros_custo(nome_centro_custo, codigo_centro_custo), engenheiro_solicitante_id")
        .eq("id", aditivo!.solicitacao_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const solicitacao: any = usarPropAditivos ? (solicitacaoInfo ?? null) : solicitacaoQuery;

  // ---------- Nomes (solicitante original / solicitante do aditivo / aprovador) ----------
  // Via RPC SECURITY DEFINER (fn_diaria_nomes_minimos) — uma chamada para todos os ids.
  const idsParaNomes = useMemo(() => {
    const ids: string[] = [];
    if (aditivo?.solicitado_por) ids.push(aditivo.solicitado_por);
    if (aditivo?.decidido_por) ids.push(aditivo.decidido_por);
    if ((solicitacao as any)?.criado_por) ids.push((solicitacao as any).criado_por);
    return Array.from(new Set(ids));
  }, [aditivo?.solicitado_por, aditivo?.decidido_por, solicitacao]);

  const { data: nomesMap } = useQuery({
    queryKey: ["aditivo-nomes-rpc", idsParaNomes.slice().sort().join(",")],
    enabled: open && idsParaNomes.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('fn_diaria_nomes_minimos', { p_ids: idsParaNomes });
      if (error) throw error;
      const m = new Map<string, string>();
      for (const row of (data ?? []) as Array<{ id: string; nome_completo: string | null }>) {
        if (row.id && row.nome_completo) m.set(row.id, row.nome_completo);
      }
      return m;
    },
  });

  const solicitanteAditivoNome = aditivo?.solicitado_por ? nomesMap?.get(aditivo.solicitado_por) ?? null : null;
  const solicitanteOriginalNome = (solicitacao as any)?.criado_por ? nomesMap?.get((solicitacao as any).criado_por) ?? null : null;
  const aprovadorNome = aditivo?.decidido_por ? nomesMap?.get(aditivo.decidido_por) ?? null : null;

  // ---------- Funcionários afetados (snapshot do JSONB) ----------
  const funcionariosSnapshotRaw = useMemo(() => {
    if (!aditivo) return [];
    const arr =
      (Array.isArray(aditivo.funcionarios_adicionados) && aditivo.funcionarios_adicionados.length > 0
        ? aditivo.funcionarios_adicionados
        : Array.isArray(aditivo.funcionarios_removidos) && aditivo.funcionarios_removidos.length > 0
        ? aditivo.funcionarios_removidos
        : null) as any[] | null;
    if (arr) {
      return arr.map((f) => (f?.snapshot ?? f) as any);
    }
    if (aditivo.snapshot_funcionario) return [aditivo.snapshot_funcionario as any];
    return [];
  }, [aditivo]);

  // Hidratação opcional (apenas para SuperAdm/acesso_global, que conseguem ler bd_funcionarios).
  // Para GerenteRegional pulamos para não esbarrar em RLS — o snapshot já traz nome/funcao/valores.
  const idsParaHidratar = useMemo(() => {
    if (!bypass) return [] as string[];
    return funcionariosSnapshotRaw
      .filter((s: any) => s?.funcionario_id && (!s?.nome || !s?.funcao_nome))
      .map((s: any) => s.funcionario_id as string);
  }, [funcionariosSnapshotRaw, bypass]);

  const { data: hidratacao, isLoading: isHidratando } = useQuery({
    queryKey: ["aditivo-hidratar-funcionarios", aditivo?.id, idsParaHidratar.slice().sort().join(","), aditivo?.solicitacao_id],
    enabled: open && bypass && idsParaHidratar.length > 0 && !!aditivo?.solicitacao_id,
    queryFn: async () => {
      const [funcRes, solRes] = await Promise.all([
        supabase
          .from("bd_funcionarios")
          .select("id, nome_completo, matricula, funcao_id, bd_funcoes(nome_funcao)")
          .in("id", idsParaHidratar),
        supabase
          .from("bd_diaria_solicitacoes")
          .select("convocados_pre")
          .eq("id", aditivo!.solicitacao_id!)
          .maybeSingle(),
      ]);

      const funcMap = new Map<string, any>();
      for (const f of (funcRes.data ?? []) as any[]) {
        funcMap.set(f.id, f);
      }
      const convocadosArr = Array.isArray((solRes.data as any)?.convocados_pre)
        ? ((solRes.data as any).convocados_pre as any[])
        : [];
      const convMap = new Map<string, any>();
      for (const c of convocadosArr) {
        if (c?.funcionario_id) convMap.set(c.funcionario_id, c);
      }
      return { funcMap, convMap };
    },
  });

  const funcionariosSnapshot = useMemo(() => {
    if (!funcionariosSnapshotRaw.length) return [];
    return funcionariosSnapshotRaw.map((s: any) => {
      const fid = s?.funcionario_id as string | undefined;
      if (!fid) return s;
      const func = hidratacao?.funcMap.get(fid);
      const conv = hidratacao?.convMap.get(fid);
      return {
        ...s,
        nome: s?.nome ?? func?.nome_completo ?? conv?.nome_funcionario ?? conv?.nome ?? null,
        matricula: s?.matricula ?? func?.matricula ?? conv?.matricula ?? null,
        funcao_id: s?.funcao_id ?? func?.funcao_id ?? conv?.funcao_id ?? null,
        funcao_nome:
          s?.funcao_nome ?? func?.bd_funcoes?.nome_funcao ?? conv?.nome_funcao ?? conv?.funcao_nome ?? null,
        valor_diaria: s?.valor_diaria ?? conv?.valor_diaria ?? 0,
        valor_diaria_exclusiva: s?.valor_diaria_exclusiva ?? conv?.valor_diaria_exclusiva ?? null,
        valor_refeicao: s?.valor_refeicao ?? conv?.valor_refeicao ?? 0,
      };
    });
  }, [funcionariosSnapshotRaw, hidratacao]);

  const impacto = (aditivo?.impacto_financeiro as any) ?? {};
  const totalImpacto =
    typeof impacto?.total === "number"
      ? impacto.total
      : typeof impacto?.diferenca === "number"
      ? impacto.diferenca
      : null;

  const statusVariant: "default" | "secondary" | "destructive" | "outline" =
    aditivo?.status === "aprovado"
      ? "default"
      : aditivo?.status === "reprovado"
      ? "destructive"
      : aditivo?.status === "cancelado"
      ? "outline"
      : "secondary";

  const aprovarMut = useAprovarAditivo();
  const reprovarMut = useReprovarAditivo();

  const totalPendentes = usarPropAditivos ? aditivos!.length : 0;
  const avancarOuFechar = () => {
    if (usarPropAditivos && indiceAtual < totalPendentes - 1) {
      setIndiceAtual((i) => i + 1);
      setModoReprovar(false);
      setMotivo("");
    } else {
      onOpenChange(false);
    }
  };

  async function handleAprovar() {
    if (!aditivo) return;
    try {
      await aprovarMut.mutateAsync({ aditivoId: aditivo.id, solicitacaoId: aditivo.solicitacao_id ?? undefined });
      if (import.meta.env.DEV) {
        console.info('[AUDIT][aditivo:acao]', { acao: 'aprovar', aditivoId: aditivo.id, ok: true });
      }
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.info('[AUDIT][aditivo:acao]', { acao: 'aprovar', aditivoId: aditivo.id, ok: false, error: e?.message });
      }
      throw e;
    }
    invalidarTudo(aditivo.solicitacao_id ?? undefined);
    avancarOuFechar();
  }

  async function handleReprovar() {
    if (!aditivo) return;
    if (motivo.trim().length < 5) return;
    try {
      await reprovarMut.mutateAsync({
        aditivoId: aditivo.id,
        motivo: motivo.trim(),
        solicitacaoId: aditivo.solicitacao_id ?? undefined,
      });
      if (import.meta.env.DEV) {
        console.info('[AUDIT][aditivo:acao]', { acao: 'reprovar', aditivoId: aditivo.id, ok: true });
      }
    } catch (e: any) {
      if (import.meta.env.DEV) {
        console.info('[AUDIT][aditivo:acao]', { acao: 'reprovar', aditivoId: aditivo.id, ok: false, error: e?.message });
      }
      throw e;
    }
    invalidarTudo(aditivo.solicitacao_id ?? undefined);
    avancarOuFechar();
  }

  function invalidarTudo(solicitacaoId?: string) {
    qc.invalidateQueries({ queryKey: ["diarias-solicitacoes"] });
    if (solicitacaoId) {
      qc.invalidateQueries({ queryKey: ["solicitacao-detalhes", solicitacaoId] });
    }
    qc.invalidateQueries({ queryKey: ["diarias-aditivos"] });
    qc.invalidateQueries({ queryKey: ["aditivos-pendentes-por-solicitacao"] });
    qc.invalidateQueries({ queryKey: ["notifications-list"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    qc.invalidateQueries({ queryKey: ["diarias-pendentes-count"] });
  }

  const isPendente = aditivo?.status === "pendente";
  const cc: any = (solicitacao as any)?.bd_centros_custo;
  const hasData = !!aditivo;

  // ---------- Logs DEV-only ----------
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!open) return;
    console.info('[AUDIT][aditivo-modal:state]', {
      isOpen: open,
      isLoading,
      hasData,
      hasError: false,
      pendentesCount: usarPropAditivos ? totalPendentes : (aditivo ? 1 : 0),
      indiceAtual,
      source: usarPropAditivos ? 'pendentesMap' : 'query',
    });
  }, [open, isLoading, hasData, totalPendentes, indiceAtual, usarPropAditivos]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!open) return;
    console.info('[AUDIT][aditivo-modal:query]', {
      enabled: !usarPropAditivos && !!aditivoId,
      solicitacaoId: aditivo?.solicitacao_id ?? solicitacaoInfo?.id ?? null,
      aditivoId: aditivo?.id ?? aditivoId,
      loading: isLoading,
      error: null,
      resultCount: usarPropAditivos ? totalPendentes : (aditivo ? 1 : 0),
    });
  }, [open, aditivoId, isLoading, aditivo, usarPropAditivos, totalPendentes, solicitacaoInfo]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Confirmação de Aditivo de Diária
            {usarPropAditivos && totalPendentes > 1 && (
              <Badge variant="secondary">
                {indiceAtual + 1} de {totalPendentes}
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Revise os dados do aditivo antes de aprovar ou reprovar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !aditivo ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
            <div>
              Não foi possível carregar os detalhes deste aditivo ou você não possui permissão de leitura.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Navegação entre pendentes */}
            {usarPropAditivos && totalPendentes > 1 && (
              <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIndiceAtual((i) => Math.max(0, i - 1));
                    setModoReprovar(false);
                    setMotivo("");
                  }}
                  disabled={indiceAtual === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
                </Button>
                <span className="text-muted-foreground">
                  Aditivo {indiceAtual + 1} de {totalPendentes}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIndiceAtual((i) => Math.min(totalPendentes - 1, i + 1));
                    setModoReprovar(false);
                    setMotivo("");
                  }}
                  disabled={indiceAtual >= totalPendentes - 1}
                >
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            {/* Cabeçalho com tipo + status */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {TIPO_LABEL[aditivo.tipo] ?? aditivo.tipo}
              </Badge>
              <Badge variant={statusVariant} className="capitalize">
                {aditivo.status}
              </Badge>
              {aditivo.retroativo && (
                <Badge variant="destructive">Retroativo</Badge>
              )}
            </div>

            {/* Dados da solicitação */}
            <Card>
              <CardContent className="py-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Nº Solicitação:</span>{" "}
                  <span className="font-medium">{(solicitacao as any)?.numero_solicitacao ?? "—"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Centro de custo:</span>{" "}
                  <span className="font-medium">
                    {cc?.codigo_centro_custo ? `${cc.codigo_centro_custo} — ` : ""}
                    {cc?.nome_centro_custo ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Data ajustada:</span>{" "}
                  <span className="font-medium">
                    {aditivo.data_ajustada ? formatBrazilianDateForDisplay(aditivo.data_ajustada) : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Solicitante original da diária:</span>{" "}
                  <span className="font-medium">
                    {solicitanteOriginalNome ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Solicitante do aditivo:</span>{" "}
                  <span className="font-medium">
                    {solicitanteAditivoNome ?? "—"}
                  </span>
                </div>
                {aditivo.decidido_por && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">
                      {aditivo.status === 'reprovado' ? 'Reprovado por:' : aditivo.status === 'cancelado' ? 'Cancelado por:' : 'Aprovado por:'}
                    </span>{" "}
                    <span className="font-medium">
                      {aprovadorNome ?? "—"}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Funcionários afetados */}
            {funcionariosSnapshot.length > 0 && (
              <Card>
                <CardContent className="py-3 space-y-2">
                  <div className="text-sm font-semibold flex items-center gap-2">
                    Funcionário{funcionariosSnapshot.length > 1 ? "s" : ""} afetado
                    {funcionariosSnapshot.length > 1 ? "s" : ""} ({funcionariosSnapshot.length})
                    {isHidratando && (
                      <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <div className="space-y-2">
                    {funcionariosSnapshot.map((s: any, idx: number) => (
                      <div key={idx} className="rounded border p-2 text-sm grid grid-cols-1 sm:grid-cols-2 gap-1">
                        <div className="sm:col-span-2 font-medium">
                          {s?.nome ?? (s?.funcionario_id ? `Funcionário ${String(s.funcionario_id).slice(0, 8)}` : "—")}
                          {s?.matricula ? (
                            <span className="text-muted-foreground"> · {s.matricula}</span>
                          ) : null}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Função:</span>{" "}
                          <span>{s?.funcao_nome ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Diária útil:</span>{" "}
                          <span>{formatCurrency(s?.valor_diaria)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Diária FDS/Fer:</span>{" "}
                          <span>{formatCurrency(s?.valor_diaria_exclusiva ?? s?.valor_diaria)}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Refeição:</span>{" "}
                          <span>{formatCurrency(s?.valor_refeicao)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Justificativa */}
            {aditivo.justificativa && (
              <Card>
                <CardContent className="py-3 text-sm space-y-1">
                  <div className="font-semibold">Justificativa</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{aditivo.justificativa}</p>
                </CardContent>
              </Card>
            )}

            {/* Impacto financeiro */}
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="py-3 text-sm space-y-1">
                <div className="font-semibold">Impacto financeiro estimado</div>
                {totalImpacto !== null ? (
                  <div className="text-lg font-bold text-primary">
                    {totalImpacto >= 0 ? "+" : ""}
                    {formatCurrency(totalImpacto)}
                  </div>
                ) : (
                  <div className="text-muted-foreground">Sem estimativa registrada.</div>
                )}
              </CardContent>
            </Card>

            {/* Reprovação */}
            {modoReprovar && isPendente && (
              <div className="space-y-1">
                <label className="text-sm font-medium">
                  Motivo da reprovação <span className="text-destructive">*</span>
                </label>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Descreva o motivo (mínimo 5 caracteres)"
                  rows={3}
                />
                <div className="text-xs text-muted-foreground">{motivo.trim().length}/5</div>
              </div>
            )}

            {/* Aviso para sem permissão */}
            {isPendente && !podeAprovar && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5 text-amber-600 flex-shrink-0" />
                <div>
                  Seu perfil não possui a permissão <strong>Aprovar aditivo de diária</strong>.
                  Solicite ao administrador para habilitar a ação <em>aprovar</em>
                  em <code>diarias_aditivo_aprovar</code>.
                </div>
              </div>
            )}

            {!isPendente && (aditivo as any).observacao_aprovador && (
              <>
                <Separator />
                <div className="text-sm">
                  <div className="font-semibold">Observação do aprovador</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {(aditivo as any).observacao_aprovador}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {aditivo && isPendente && podeAprovar && (
            <>
              {!modoReprovar ? (
                <>
                  <Button
                    variant="destructive"
                    onClick={() => setModoReprovar(true)}
                    disabled={aprovarMut.isPending || reprovarMut.isPending}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reprovar Aditivo
                  </Button>
                  <Button
                    onClick={handleAprovar}
                    disabled={aprovarMut.isPending || reprovarMut.isPending}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {aprovarMut.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Aditivo
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setModoReprovar(false);
                      setMotivo("");
                    }}
                    disabled={reprovarMut.isPending}
                  >
                    Voltar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReprovar}
                    disabled={reprovarMut.isPending || motivo.trim().length < 5}
                  >
                    {reprovarMut.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Confirmar Reprovação
                  </Button>
                </>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AditivoConfirmacaoModal;
