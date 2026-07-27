/**
 * Atendimento — painel visual tipo Kanban (sem drag-and-drop).
 *
 * Fonte única de escopo: RPC `fn_chamado_interno_listar_fila_atendimento`
 * (via `useChamadoInternoFilaAtendimento`). O backend já aplica
 * SuperAdm / AdmSede (por CC) / Atendente (por setor) através de
 * `fn_chamado_interno_can_operate`. O frontend NÃO reaplica gate
 * setorial nem filtro de segurança client-side.
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { Filter, Headphones, Loader2 } from "lucide-react";

import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { primeiroNome } from "@/utils/primeiroNome";


import { useChamadoInternoFilaAtendimento } from "@/hooks/useChamadosInternos";
import { useChamadosInternosRealtime } from "@/hooks/useChamadosInternosRealtime";
import {
  PrioridadeBadge,
  SetorBadge,
  formatarPrazoRestante,
} from "@/components/chamados-internos/StatusBadges";
import {
  CHAMADO_INTERNO_SETOR_META,
  CHAMADO_INTERNO_STATUS_META,
} from "@/constants/chamadosInternos";
import type {
  ChamadoFilaAtendimentoRow,
  ChamadoInternoSetor,
  ChamadoInternoStatus,
} from "@/types/chamadosInternos";

const COLUNAS: ChamadoInternoStatus[] = [
  "aberto",
  "em_triagem",
  "em_analise",
  "aguardando_solicitante",
  "respondido",
  "resolvido",
];

/** Colunas extras exibidas quando o filtro inclui status finalizados. */
const COLUNAS_FINALIZADAS: ChamadoInternoStatus[] = ["encerrado", "cancelado"];

/** Quantidade inicial de cards por coluna e incremento do "Carregar mais". */
const PAGINA_KANBAN = 10;


const TODOS = "todos" as const;
type SetorSelecionado = ChamadoInternoSetor | typeof TODOS;

type StatusFiltroModo = "operacional" | "historico" | "todos";
const STATUS_HISTORICO: ChamadoInternoStatus[] = [
  "resolvido",
  "encerrado",
  "cancelado",
];
const STATUS_TODOS: ChamadoInternoStatus[] = [
  "aberto",
  "em_triagem",
  "em_analise",
  "aguardando_solicitante",
  "respondido",
  "resolvido",
  "encerrado",
  "reaberto",
  "cancelado",
];

const SETORES_ORDENADOS = (
  Object.entries(CHAMADO_INTERNO_SETOR_META) as Array<
    [ChamadoInternoSetor, (typeof CHAMADO_INTERNO_SETOR_META)[ChamadoInternoSetor]]
  >
).sort((a, b) => a[1].ordem - b[1].ordem);

const ChamadosInternosAtendimento: React.FC = () => {
  usePageTitle("Atendimento de Chamados");
  const navigate = useNavigate();
  useChamadosInternosRealtime();

  const [setor, setSetor] = React.useState<SetorSelecionado>(TODOS);
  const [statusModo, setStatusModo] =
    React.useState<StatusFiltroModo>("operacional");

  const statusParam: ChamadoInternoStatus[] | undefined =
    statusModo === "historico"
      ? STATUS_HISTORICO
      : statusModo === "todos"
        ? STATUS_TODOS
        : undefined;

  const q = useChamadoInternoFilaAtendimento({
    setor: setor === TODOS ? null : setor,
    status: statusParam,
  });

  const colunasVisiveis = React.useMemo(
    () =>
      statusModo === "operacional"
        ? COLUNAS
        : statusModo === "historico"
          ? [...COLUNAS.filter((s) => s === "resolvido"), ...COLUNAS_FINALIZADAS]
          : [...COLUNAS, ...COLUNAS_FINALIZADAS],
    [statusModo],
  );

  const porStatus = React.useMemo(() => {
    const m = new Map<ChamadoInternoStatus, ChamadoFilaAtendimentoRow[]>();
    for (const s of colunasVisiveis) m.set(s, []);
    for (const r of q.data ?? []) {
      const arr = m.get(r.status);
      if (arr) arr.push(r);
    }
    return m;
  }, [q.data, colunasVisiveis]);

  // "Carregar mais" por coluna — reinicia quando os filtros mudam.
  const [visiveisPorColuna, setVisiveisPorColuna] = React.useState<
    Partial<Record<ChamadoInternoStatus, number>>
  >({});
  React.useEffect(() => {
    setVisiveisPorColuna({});
  }, [setor, statusModo]);


  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Headphones className="h-5 w-5 text-primary" />
                Atendimento
              </CardTitle>
              <CardDescription>
                Fila de atendimento com escopo definido pelo backend. Clique em
                um chamado para atendê-lo e movê-lo para o próximo estágio.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-xs">
                  <Filter className="h-3 w-3" /> Setor
                </Label>
                <Select
                  value={setor}
                  onValueChange={(v) => setSetor(v as SetorSelecionado)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODOS}>Todos os setores</SelectItem>
                    {SETORES_ORDENADOS.map(([k, m]) => (
                      <SelectItem key={k} value={k}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="flex items-center gap-1 text-xs">
                  <Filter className="h-3 w-3" /> Status
                </Label>
                <Select
                  value={statusModo}
                  onValueChange={(v) => setStatusModo(v as StatusFiltroModo)}
                >
                  <SelectTrigger className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operacional">Fila operacional</SelectItem>
                    <SelectItem value="historico">
                      Histórico (resolvido / encerrado / cancelado)
                    </SelectItem>
                    <SelectItem value="todos">Todos os status</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>

        {q.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando fila de
            atendimento...
          </div>
        ) : q.isError ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-destructive" data-testid="fila-erro">
                Não foi possível carregar a fila de atendimento.
              </p>
            </CardContent>
          </Card>
        ) : (q.data?.length ?? 0) === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p
                className="text-sm text-muted-foreground"
                data-testid="fila-vazia"
              >
                Não há chamados disponíveis para atendimento nos filtros selecionados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex min-w-max gap-3 pb-3">
              {colunasVisiveis.map((s) => {
                const meta = CHAMADO_INTERNO_STATUS_META[s];
                const rows = porStatus.get(s) ?? [];
                const visiveis = visiveisPorColuna[s] ?? PAGINA_KANBAN;
                const exibidos = rows.slice(0, visiveis);
                const restantes = rows.length - exibidos.length;
                return (
                  <div key={s} className="w-72 shrink-0">
                    <div
                      className={cn(
                        "mb-2 flex items-center justify-between rounded-md border px-2 py-1 text-xs font-semibold",
                        meta.badgeClasses,
                      )}
                    >
                      <span>{meta.label}</span>
                      <span className="rounded-full bg-background/60 px-1.5 py-0.5">
                        {rows.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {rows.length === 0 ? (
                        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                          Sem chamados nesta coluna.
                        </div>
                      ) : (
                        <>
                          {exibidos.map((r) => (
                            <button
                              key={r.id}
                              onClick={() =>
                                navigate(`/chamados-internos/${r.id}`)
                              }
                              className={cn(
                                "rounded-md border p-3 text-left transition-colors hover:border-primary",
                                r.status === "encerrado"
                                  ? "border-success/40 bg-success/10"
                                  : "bg-card",
                                r.is_critico && "border-destructive/50",
                              )}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground">
                                  {r.protocolo}
                                  {r.centro_custo_codigo &&
                                    ` · CC ${r.centro_custo_codigo}`}
                                </span>
                                <PrioridadeBadge prioridade={r.prioridade} />
                              </div>
                              <div className="line-clamp-2 text-sm font-medium">
                                {r.titulo}
                              </div>
                              {r.solicitante_nome && (
                                <div className="text-[11px] text-muted-foreground">
                                  por: {primeiroNome(r.solicitante_nome)}
                                </div>
                              )}
                              <div className="mt-2 flex flex-wrap items-center gap-1">
                                <SetorBadge setor={r.setor} />
                                <span className="text-[11px] text-muted-foreground">
                                  {formatarPrazoRestante(r.sla_prazo)}
                                </span>
                              </div>
                            </button>
                          ))}
                          {restantes > 0 && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full"
                              onClick={() =>
                                setVisiveisPorColuna((prev) => ({
                                  ...prev,
                                  [s]: visiveis + PAGINA_KANBAN,
                                }))
                              }
                            >
                              Carregar mais ({restantes})
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>
    </MainLayout>
  );
};

export default ChamadosInternosAtendimento;
