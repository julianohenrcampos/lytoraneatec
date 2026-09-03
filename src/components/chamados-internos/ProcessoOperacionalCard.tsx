import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Clock, Package, ShieldAlert, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useProcessoOperacionalChamado } from "@/hooks/useChamadoOperacional";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";
import { derivarFaseOperacional, type EventoFaseLike } from "@/utils/chamadoFaseOperacional";
import { traduzirOrigemAprovador } from "@/utils/chamadoEventoOperacional";

interface Props {
  chamadoId: string;
  /** RBAC da Central do Transporte (visualizar) — habilita a análise de disponibilidade. */
  podeAnalisarDisponibilidade?: boolean;
  /** RBAC da Central do Transporte (criar/editar) — habilita o planejamento definitivo. */
  podePlanejar?: boolean;
  /** Eventos já carregados na página (evita N+1 / consulta duplicada). */
  eventos?: EventoFaseLike[];
  /** Responsável atual pelo atendimento do CHI. */
  responsavelNome?: string | null;
  /** CHI cancelado — reflete na fase operacional. */
  chamadoCancelado?: boolean;
}

const statusMeta: Record<string, { label: string; classes: string; Icon: typeof Clock }> = {
  AGUARDANDO: { label: "Aguardando aprovação", classes: "bg-amber-500/15 text-amber-700 dark:text-amber-300", Icon: Clock },
  APROVADO: { label: "Solicitação aprovada", classes: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", Icon: CheckCircle2 },
  REJEITADO: { label: "Solicitação rejeitada", classes: "bg-destructive/15 text-destructive", Icon: XCircle },
  SEM_FLUXO_CONFIGURADO: { label: "Sem fluxo configurado", classes: "bg-muted text-muted-foreground", Icon: ShieldAlert },
};

const ProcessoOperacionalCard: React.FC<Props> = ({
  chamadoId,
  podeAnalisarDisponibilidade = false,
  podePlanejar = false,
  eventos = [],
  responsavelNome = null,
  chamadoCancelado = false,
}) => {
  const navigate = useNavigate();
  const { data, isLoading } = useProcessoOperacionalChamado(chamadoId);

  if (isLoading || !data?.tem_processo) return null;

  const aprov = data.aprovacao ?? {};
  const meta = statusMeta[String(aprov.status ?? "AGUARDANDO")] ?? statusMeta.AGUARDANDO;
  const etapa = aprov.etapa_atual ?? null;
  const fase = derivarFaseOperacional(data, eventos, chamadoCancelado);
  const aprovado = fase?.aprovado === true;
  const rejeitado = fase?.rejeitado === true;

  return (
    <Card data-testid="processo-operacional-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          Processo operacional
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {/* Cabeçalho: fase corrente (fonte autoritativa), distinta do status do CHI */}
        <div className="rounded-md border bg-muted/30 p-3 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Solicitação</p>
            <p className="font-mono font-semibold">{data.referencia_tecnica}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Fase atual</p>
            {fase ? (
              <Badge className={fase.classes} data-testid="fase-operacional">
                {fase.label}
              </Badge>
            ) : (
              <p>—</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">
              {fase?.aguardando ? "Aguardando" : "Responsável pelo atendimento"}
            </p>
            <p className="font-medium">
              {fase?.aguardando ?? responsavelNome ?? "—"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Protocolo</p>
            <p className="font-semibold">{data.protocolo}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Ref. técnica</p>
            <p className="font-mono">{data.referencia_tecnica}</p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase text-muted-foreground mb-1">Itens</p>
          <ul className="space-y-1">
            {(data.itens ?? []).map((i, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="font-semibold">{i.quantidade} ×</span>
                <span>{i.descricao}</span>
                {i.com_operador ? <Badge variant="secondary" className="text-[10px]">com operador</Badge> : null}
              </li>
            ))}
          </ul>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="text-xs uppercase text-muted-foreground">Aprovação</p>
          <Badge className={meta.classes}>
            <meta.Icon className="h-3 w-3 mr-1" />
            {meta.label}
          </Badge>

          {aprov.total_etapas ? (
            <p className="text-muted-foreground">
              Etapa {etapa?.ordem ?? aprov.etapas_concluidas ?? 0} de {aprov.total_etapas}
              {aprov.fluxo?.nome ? ` — ${aprov.fluxo.nome}` : ""}
            </p>
          ) : null}

          {etapa ? (
            <div className="rounded-md border p-3 space-y-1">
              <p className="font-medium">{etapa.nome ?? "Etapa de aprovação"}</p>
              <p>
                Aguardando:{" "}
                <span className="font-semibold">{etapa.aprovador_nome ?? "aprovador por permissão (RBAC)"}</span>
              </p>
              {etapa.aprovador_origem ? (
                <p className="text-xs text-muted-foreground">
                  Origem: {traduzirOrigemAprovador(etapa.aprovador_origem)}
                </p>
              ) : null}
            </div>
          ) : null}

          {(data.historico_etapas ?? []).filter((e) => e.status && e.status !== "pendente").map((e, idx) => (
            <p key={idx} className="text-xs text-muted-foreground">
              {e.status === "aprovado" ? "✓" : "✕"} {e.aprovador_nome ?? "—"}
              {e.ordem && aprov.total_etapas ? ` — etapa ${e.ordem}/${aprov.total_etapas}` : ""}
              {e.data_aprovacao ? ` — ${formatBrazilianDateForDisplay(e.data_aprovacao)}` : ""}
            </p>
          ))}
        </div>

        {rejeitado ? (
          <div className="rounded-md border border-destructive/40 p-3">
            <p className="text-destructive font-medium">
              ✕ Solicitação rejeitada — processo operacional encerrado.
            </p>
          </div>
        ) : !aprovado ? (
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <p className="text-muted-foreground">
              {etapa?.aprovador_nome
                ? `Aguardando aprovação de ${etapa.aprovador_nome}. `
                : "Aguardando aprovação. "}
              Você pode analisar disponibilidade, mas o planejamento definitivo será liberado após aprovação.
            </p>
            {podeAnalisarDisponibilidade ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  navigate(
                    data.solicitacao_id
                      ? `/gestao-maquinas/central-transporte/solicitacao/${data.solicitacao_id}`
                      : "/gestao-maquinas/central-transporte?modo=analise",
                  )
                }
              >
                Analisar disponibilidade
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-emerald-700 dark:text-emerald-300 font-medium">✓ Solicitação aprovada</p>
            {podePlanejar ? (
              <Button
                size="sm"
                onClick={() =>
                  navigate(
                    data.solicitacao_id
                      ? `/gestao-maquinas/central-transporte/solicitacao/${data.solicitacao_id}`
                      : "/gestao-maquinas/central-transporte",
                  )
                }
              >
                Planejar atendimento
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                O planejamento exige permissão da Central do Transporte.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ProcessoOperacionalCard;
