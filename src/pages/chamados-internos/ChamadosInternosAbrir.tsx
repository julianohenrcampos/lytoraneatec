/**
 * Abrir Chamado Interno — wizard de 3 etapas.
 * Etapa 1: Categoria (grid de cards com ícone Lucide).
 * Etapa 2: Detalhes (CC, solicitante, título, descrição).
 * Etapa 3: Revisão (confirmação e submit).
 *
 * Mutação exclusivamente via RPC `fn_chamado_interno_abrir`.
 * Sucesso: toast com protocolo + redireciona para /chamados-internos/:chamadoId.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CirclePlus,
  Loader2,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

import {
  useChamadoInternoAbrir,
  useChamadoInternoCategorias,
  useChamadoInternoCcsAbertura,
  useChamadoInternoSolicitantesDoCc,
} from "@/hooks/useChamadosInternos";
import { CategoriaIcon } from "@/components/chamados-internos/CategoriaIcon";
import {
  PrioridadeBadge,
  SetorBadge,
} from "@/components/chamados-internos/StatusBadges";
import type {
  ChamadoInternoCategoriaRow,
  ChamadosInternosError,
} from "@/types/chamadosInternos";

const isError = (e: unknown): e is ChamadosInternosError =>
  !!e && typeof e === "object" && "message" in (e as Record<string, unknown>);

type Etapa = 1 | 2 | 3;

const ChamadosInternosAbrir: React.FC = () => {
  usePageTitle("Abrir Chamado Interno");
  const navigate = useNavigate();

  const [etapa, setEtapa] = React.useState<Etapa>(1);
  const [categoriaId, setCategoriaId] = React.useState("");
  const [centroCustoId, setCentroCustoId] = React.useState("");
  const [solicitanteId, setSolicitanteId] = React.useState("");
  const [titulo, setTitulo] = React.useState("");
  const [descricao, setDescricao] = React.useState("");

  const ccsQ = useChamadoInternoCcsAbertura();
  const categoriasQ = useChamadoInternoCategorias();
  const solicitantesQ = useChamadoInternoSolicitantesDoCc(centroCustoId || undefined);
  const abrirM = useChamadoInternoAbrir();

  const categoriasAtivas = React.useMemo(
    () => (categoriasQ.data ?? []).filter((c) => c.ativo),
    [categoriasQ.data],
  );

  const categoriaSelecionada: ChamadoInternoCategoriaRow | null = React.useMemo(
    () => categoriasAtivas.find((c) => c.id === categoriaId) ?? null,
    [categoriasAtivas, categoriaId],
  );

  const ccOptions: ComboboxOption[] = React.useMemo(
    () =>
      (ccsQ.data ?? []).map((c) => ({
        value: c.centro_custo_id,
        label: `${c.codigo_centro_custo} — ${c.nome_centro_custo}`,
        searchText: `${c.codigo_centro_custo} ${c.nome_centro_custo}`,
      })),
    [ccsQ.data],
  );

  const solicitanteOptions: ComboboxOption[] = React.useMemo(
    () =>
      (solicitantesQ.data ?? []).map((f) => ({
        value: f.id,
        label: f.nome_completo,
      })),
    [solicitantesQ.data],
  );

  const handleCcChange = (novo: string) => {
    setCentroCustoId(novo);
    setSolicitanteId("");
  };

  const tituloTrim = titulo.trim();
  const descricaoTrim = descricao.trim();
  const semCcDisponivel = ccsQ.isSuccess && (ccsQ.data ?? []).length === 0;
  const semCategoriaAtiva = categoriasQ.isSuccess && categoriasAtivas.length === 0;

  const podeAvancar1 = !!categoriaId;
  const podeAvancar2 =
    !!centroCustoId && !!solicitanteId && tituloTrim.length > 0 && descricaoTrim.length > 0;
  const podeSubmeter = podeAvancar1 && podeAvancar2 && !abrirM.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeSubmeter) return;
    try {
      const res = await abrirM.mutateAsync({
        p_centro_custo_id: centroCustoId,
        p_categoria_id: categoriaId,
        p_solicitante_funcionario_id: solicitanteId,
        p_titulo: tituloTrim,
        p_descricao: descricaoTrim,
      });
      toast.success("Chamado aberto", {
        description: `Protocolo ${res.protocolo}`,
      });
      navigate(`/chamados-internos/${res.chamado_id}`);
    } catch {
      /* erro renderizado no bloco Alert */
    }
  };

  const erroUnknown: unknown = abrirM.error;
  const erro = isError(erroUnknown) ? erroUnknown : null;

  return (
    <MainLayout>
      <div className="p-4 md:p-6">
        <form onSubmit={handleSubmit} noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CirclePlus className="h-5 w-5 text-primary" />
                Abrir Chamado Interno
              </CardTitle>
              <CardDescription>
                Registre uma nova solicitação em três passos rápidos. O protocolo é gerado automaticamente.
              </CardDescription>
              <Stepper etapa={etapa} />
            </CardHeader>

            <CardContent className="space-y-6">
              {semCcDisponivel && (
                <Alert variant="destructive" data-testid="empty-ccs">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Você não possui centro de custo autorizado para abrir chamados.
                  </AlertDescription>
                </Alert>
              )}
              {semCategoriaAtiva && (
                <Alert variant="destructive" data-testid="empty-categorias">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Não há categorias de chamado disponíveis no momento.
                  </AlertDescription>
                </Alert>
              )}

              {etapa === 1 && (
                <div>
                  <div className="mb-3 text-sm text-muted-foreground">
                    Selecione o tipo de chamado. Isso define o setor responsável e a prioridade.
                  </div>
                  {categoriasQ.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Carregando categorias...
                    </div>
                  ) : (
                    <div
                      className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
                      role="radiogroup"
                      aria-label="Categoria do chamado"
                    >
                      {categoriasAtivas.map((c) => {
                        const ativo = categoriaId === c.id;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={ativo}
                            onClick={() => setCategoriaId(c.id)}
                            className={cn(
                              "flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-colors",
                              "hover:border-primary/60 focus:outline-none focus:ring-2 focus:ring-ring",
                              ativo
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card",
                            )}
                          >
                            <div className="flex w-full items-center justify-between">
                              <CategoriaIcon codigo={c.codigo} className="text-primary" />
                              {ativo && <CheckCircle2 className="h-4 w-4 text-primary" />}
                            </div>
                            <div className="text-sm font-semibold leading-tight">{c.nome}</div>
                            <div className="flex flex-wrap gap-1">
                              <SetorBadge setor={c.setor} />
                              <PrioridadeBadge prioridade={c.prioridade_padrao} />
                            </div>
                            {c.sla_horas ? (
                              <div className="text-[11px] text-muted-foreground">
                                SLA {c.sla_horas}h
                              </div>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {etapa === 2 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="cc">Centro de custo *</Label>
                    <Combobox
                      options={ccOptions}
                      value={centroCustoId}
                      onChange={handleCcChange}
                      placeholder={ccsQ.isLoading ? "Carregando..." : "Selecione um centro de custo"}
                      emptyText="Nenhum centro de custo disponível"
                      searchPlaceholder="Buscar por código ou nome..."
                      disabled={ccsQ.isLoading || semCcDisponivel}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="solic">Solicitante *</Label>
                    <Combobox
                      options={solicitanteOptions}
                      value={solicitanteId}
                      onChange={setSolicitanteId}
                      placeholder={
                        !centroCustoId
                          ? "Selecione um centro de custo primeiro"
                          : solicitantesQ.isLoading
                          ? "Carregando..."
                          : "Selecione um funcionário"
                      }
                      emptyText="Nenhum funcionário localizado"
                      searchPlaceholder="Buscar por nome..."
                      disabled={!centroCustoId || solicitantesQ.isLoading}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="titulo">Título *</Label>
                    <Input
                      id="titulo"
                      value={titulo}
                      onChange={(e) => setTitulo(e.target.value)}
                      placeholder="Resumo curto do problema"
                      maxLength={160}
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="descricao">Descrição *</Label>
                    <Textarea
                      id="descricao"
                      rows={5}
                      value={descricao}
                      onChange={(e) => setDescricao(e.target.value)}
                      placeholder="Descreva o problema com o máximo de detalhes possível."
                    />
                  </div>
                </div>
              )}

              {etapa === 3 && categoriaSelecionada && (
                <div className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="mb-2 flex items-center gap-2">
                      <CategoriaIcon codigo={categoriaSelecionada.codigo} className="text-primary" />
                      <div className="text-sm font-semibold">{categoriaSelecionada.nome}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <SetorBadge setor={categoriaSelecionada.setor} />
                      <PrioridadeBadge prioridade={categoriaSelecionada.prioridade_padrao} />
                      {categoriaSelecionada.sla_horas ? (
                        <span className="text-xs text-muted-foreground">
                          SLA {categoriaSelecionada.sla_horas}h
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <dl className="grid gap-3 text-sm md:grid-cols-2">
                    <RevisaoItem
                      label="Centro de custo"
                      valor={
                        ccOptions.find((o) => o.value === centroCustoId)?.label ?? "—"
                      }
                    />
                    <RevisaoItem
                      label="Solicitante"
                      valor={
                        solicitanteOptions.find((o) => o.value === solicitanteId)?.label ?? "—"
                      }
                    />
                    <RevisaoItem label="Título" valor={tituloTrim} span />
                    <RevisaoItem label="Descrição" valor={descricaoTrim} span pre />
                  </dl>
                  {erro && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>{erro.message}</AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-muted-foreground">Etapa {etapa} de 3</div>
              <div className="flex items-center gap-2">
                {etapa > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEtapa((e) => (e === 3 ? 2 : 1))}
                  >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                )}
                {etapa === 1 && (
                  <Button
                    type="button"
                    disabled={!podeAvancar1 || semCategoriaAtiva}
                    onClick={() => setEtapa(2)}
                  >
                    Avançar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {etapa === 2 && (
                  <Button
                    type="button"
                    disabled={!podeAvancar2 || semCcDisponivel}
                    onClick={() => setEtapa(3)}
                  >
                    Revisar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
                {etapa === 3 && (
                  <Button type="submit" disabled={!podeSubmeter}>
                    {abrirM.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Abrir chamado
                  </Button>
                )}
              </div>
            </CardFooter>
          </Card>
        </form>
      </div>
    </MainLayout>
  );
};

const Stepper: React.FC<{ etapa: Etapa }> = ({ etapa }) => {
  const passos = [
    { n: 1, label: "Categoria" },
    { n: 2, label: "Detalhes" },
    { n: 3, label: "Revisão" },
  ] as const;
  return (
    <ol className="mt-4 flex items-center gap-2 text-xs" aria-label="Progresso do formulário">
      {passos.map((p, i) => {
        const ativo = etapa === p.n;
        const feito = etapa > p.n;
        return (
          <React.Fragment key={p.n}>
            <li
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2 py-1",
                ativo && "border-primary text-primary bg-primary/5",
                feito && "border-emerald-500/40 text-emerald-700 dark:text-emerald-300",
                !ativo && !feito && "border-border text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold",
                  ativo && "bg-primary text-primary-foreground",
                  feito && "bg-emerald-500 text-white",
                  !ativo && !feito && "bg-muted text-foreground",
                )}
              >
                {p.n}
              </span>
              {p.label}
            </li>
            {i < passos.length - 1 && <span className="h-px w-6 bg-border" />}
          </React.Fragment>
        );
      })}
    </ol>
  );
};

const RevisaoItem: React.FC<{
  label: string;
  valor: string;
  span?: boolean;
  pre?: boolean;
}> = ({ label, valor, span, pre }) => (
  <div className={cn(span && "md:col-span-2")}>
    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
    <dd className={cn("mt-0.5 text-sm", pre && "whitespace-pre-wrap")}>{valor || "—"}</dd>
  </div>
);

export default ChamadosInternosAbrir;
