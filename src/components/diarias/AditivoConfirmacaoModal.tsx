// =====================================================
// MODAL: CONFIRMAÇÃO DE ADITIVO DE DIÁRIA (Fase I.4)
// =====================================================
// Exibe os dados de um aditivo pendente e permite aprovar / reprovar via RPC.
// Não faz update direto em bd_diaria_aditivos nem em convocados_pre.
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
import { Loader2, Check, X, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAditivoById } from "@/hooks/diarias/useAditivos";
import { useAprovarAditivo, useReprovarAditivo } from "@/hooks/diarias/useAditivosPendentes";
import { usePermission } from "@/hooks/usePermission";
import { useUserProfile } from "@/hooks/useUserProfile";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

interface AditivoConfirmacaoModalProps {
  aditivoId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
  // Aliases legados — manter compat com registros antigos
  funcionario_inclusao: "Inclusão de funcionário",
  funcionario_remocao: "Remoção de funcionário",
};

export function AditivoConfirmacaoModal({
  aditivoId,
  open,
  onOpenChange,
}: AditivoConfirmacaoModalProps) {
  const qc = useQueryClient();
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const { user: profile } = useUserProfile();
  const acessoGlobal = !!profile?.acesso_global;
  // G2 — RBAC granular: aprovar/reprovar respeita permissão de ação
  const podeAprovar =
    isSuperAdmin ||
    acessoGlobal ||
    hasActionPermission('diarias_aditivo_aprovar', 'aprovar');

  const [modoReprovar, setModoReprovar] = useState(false);
  const [motivo, setMotivo] = useState("");

  const { data: aditivo, isLoading } = useAditivoById(aditivoId ?? undefined);

  // Solicitação relacionada (numero, centro de custo, solicitante original)
  const { data: solicitacao } = useQuery({
    queryKey: ["aditivo-confirmacao-solic", aditivo?.solicitacao_id],
    enabled: !!aditivo?.solicitacao_id && open,
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

  // Nome do solicitante do aditivo
  const { data: solicitanteAditivo } = useQuery({
    queryKey: ["aditivo-solicitante", aditivo?.solicitado_por],
    enabled: !!aditivo?.solicitado_por && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome_completo, email")
        .eq("id", aditivo!.solicitado_por)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Nome do solicitante original da diária (bd_diaria_solicitacoes.criado_por)
  const { data: solicitanteOriginal } = useQuery({
    queryKey: ["aditivo-solic-original", (solicitacao as any)?.criado_por],
    enabled: !!(solicitacao as any)?.criado_por && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome_completo, email")
        .eq("id", (solicitacao as any).criado_por)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Nome do aprovador (decidido_por)
  const { data: aprovador } = useQuery({
    queryKey: ["aditivo-aprovador", aditivo?.decidido_por],
    enabled: !!aditivo?.decidido_por && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome_completo, email")
        .eq("id", aditivo!.decidido_por)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const aprovarMut = useAprovarAditivo();
  const reprovarMut = useReprovarAditivo();

  useEffect(() => {
    if (!open) {
      setModoReprovar(false);
      setMotivo("");
    }
  }, [open]);

  const funcionariosSnapshotRaw = useMemo(() => {
    if (!aditivo) return [];
    // funcionarios_adicionados / removidos têm prioridade (operações de dia em lote)
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

  // Hidratação: para itens sem nome/funcao_nome, buscar em bd_funcionarios + convocados_pre
  const idsParaHidratar = useMemo(() => {
    return funcionariosSnapshotRaw
      .filter((s: any) => s?.funcionario_id && (!s?.nome || !s?.funcao_nome))
      .map((s: any) => s.funcionario_id as string);
  }, [funcionariosSnapshotRaw]);

  const { data: hidratacao, isLoading: isHidratando } = useQuery({
    queryKey: ["aditivo-hidratar-funcionarios", aditivo?.id, idsParaHidratar.sort().join(","), aditivo?.solicitacao_id],
    enabled: open && idsParaHidratar.length > 0 && !!aditivo?.solicitacao_id,
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

  async function handleAprovar() {
    if (!aditivo) return;
    try {
      await aprovarMut.mutateAsync({ aditivoId: aditivo.id, solicitacaoId: aditivo.solicitacao_id ?? undefined });
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[AUDIT][aditivo:acao]', { acao: 'aprovar', aditivoId: aditivo.id, ok: true });
      }
    } catch (e: any) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[AUDIT][aditivo:acao]', { acao: 'aprovar', aditivoId: aditivo.id, ok: false, error: e?.message });
      }
      throw e;
    }
    invalidarTudo(aditivo.solicitacao_id ?? undefined);
    onOpenChange(false);
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
        // eslint-disable-next-line no-console
        console.info('[AUDIT][aditivo:acao]', { acao: 'reprovar', aditivoId: aditivo.id, ok: true });
      }
    } catch (e: any) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[AUDIT][aditivo:acao]', { acao: 'reprovar', aditivoId: aditivo.id, ok: false, error: e?.message });
      }
      throw e;
    }
    invalidarTudo(aditivo.solicitacao_id ?? undefined);
    onOpenChange(false);
  }

  function invalidarTudo(solicitacaoId?: string) {
    // Listagem principal + estimativas recalculadas
    qc.invalidateQueries({ queryKey: ["diarias-solicitacoes"] });
    // Detalhes da solicitação
    if (solicitacaoId) {
      qc.invalidateQueries({ queryKey: ["solicitacao-detalhes", solicitacaoId] });
    }
    // Aditivos por solicitação e pendentes agregados (ícone Analisar na listagem)
    qc.invalidateQueries({ queryKey: ["diarias-aditivos"] });
    qc.invalidateQueries({ queryKey: ["aditivos-pendentes-por-solicitacao"] });
    // Notificações e contadores
    qc.invalidateQueries({ queryKey: ["notifications-list"] });
    qc.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    qc.invalidateQueries({ queryKey: ["diarias-pendentes-count"] });
  }

  const isPendente = aditivo?.status === "pendente";
  const cc: any = (solicitacao as any)?.bd_centros_custo;

  // [AUDIT] — aditivo (DEV-only)
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!open) return;
    // eslint-disable-next-line no-console
    console.info('[AUDIT][aditivo]', {
      userId: (profile as any)?.id,
      aditivoId,
      aditivoStatus: aditivo?.status,
      isSuperAdmin,
      acessoGlobal,
      hasAprovar: hasActionPermission('diarias_aditivo_aprovar', 'aprovar'),
      hasVisualizar: hasActionPermission('diarias_aditivo_aprovar', 'visualizar'),
      podeAprovar,
      botoesVisiveis: {
        confirmar: !!(isPendente && podeAprovar && !modoReprovar),
        reprovar: !!(isPendente && podeAprovar),
      },
      modoReprovar,
    });
  }, [open, aditivoId, aditivo?.status, podeAprovar, isSuperAdmin, acessoGlobal, isPendente, modoReprovar, profile, hasActionPermission]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmação de Aditivo de Diária</DialogTitle>
          <DialogDescription>
            Revise os dados do aditivo antes de aprovar ou reprovar.
          </DialogDescription>
        </DialogHeader>

        {isLoading || !aditivo ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
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
                  <span className="font-medium">{solicitacao?.numero_solicitacao ?? "—"}</span>
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
                    {solicitanteOriginal?.nome_completo ?? solicitanteOriginal?.email ?? "—"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Solicitante do aditivo:</span>{" "}
                  <span className="font-medium">
                    {solicitanteAditivo?.nome_completo ?? solicitanteAditivo?.email ?? "—"}
                  </span>
                </div>
                {aditivo.decidido_por && (
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">
                      {aditivo.status === 'reprovado' ? 'Reprovado por:' : aditivo.status === 'cancelado' ? 'Cancelado por:' : 'Aprovado por:'}
                    </span>{" "}
                    <span className="font-medium">
                      {aprovador?.nome_completo ?? aprovador?.email ?? "—"}
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
                          {s?.nome ?? "—"}
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

            {!isPendente && aditivo.observacao_aprovador && (
              <>
                <Separator />
                <div className="text-sm">
                  <div className="font-semibold">Observação do aprovador</div>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {aditivo.observacao_aprovador}
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
