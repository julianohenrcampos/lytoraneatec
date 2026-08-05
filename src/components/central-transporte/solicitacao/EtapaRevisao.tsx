/**
 * CT-3C R2 / Fase L — Etapa "Revisão": leitura fiel da versão em foco e gatilho
 * único de programação (`fn_ct_mobilizacao_programar`).
 *
 * Fail-closed: sem estado de mobilização confirmado nada é programável. Toda
 * validação exibida aqui é revalidada no servidor dentro da transação.
 */
import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { invalidarCachesAtivosOperacionais } from "@/lib/queryInvalidation/ativosOperacionais";
import {
  hidratarRascunho,
  rotuloAtivo,
  validarProgramacao,
} from "@/lib/central-transporte/mobilizacaoRascunho";
import { programarMobilizacao } from "@/services/centralTransporteMobilizacaoService";
import {
  CT_MODALIDADE_LABELS,
  CT_PLANEJAMENTO_STATUS_LABELS,
  CT_TIPO_TRANSPORTE_LABELS,
  CT_VIAGEM_STATUS_LABELS,
} from "@/types/centralTransporteMobilizacao";
import { formatDateBR } from "@/utils/formatDateBR";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";

export const EtapaRevisao: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { mobilizacao, capabilities, ctOperation } = useCtSolicitacao();
  const [enviando, setEnviando] = useState(false);

  const estado = mobilizacao.estado;
  const rascunho = mobilizacao.rascunhoEmEdicao;
  const planejamento = rascunho ?? mobilizacao.planejamentoVigente;
  const programado = planejamento?.status === "PROGRAMADO";
  const viagens = planejamento?.viagens ?? [];

  const rotuloPorAtendimento = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of estado?.ativos ?? []) m.set(a.atendimentoId, rotuloAtivo(a));
    return m;
  }, [estado]);

  const problemas = useMemo(
    () => (estado && rascunho ? validarProgramacao(hidratarRascunho(estado), estado.ativos) : []),
    [estado, rascunho],
  );

  const programar = async () => {
    if (!rascunho) return;
    setEnviando(true);
    const out = await ctOperation.run({
      operation: "ATRIBUIR",
      materialKey: `MOB_PROGRAMAR|${rascunho.id}|${rascunho.lockVersion}`,
      resourceIds: [rascunho.id],
      exec: (requestId) =>
        programarMobilizacao({
          planejamentoId: rascunho.id,
          versaoEsperada: rascunho.lockVersion,
          requestId,
        }),
    });
    setEnviando(false);

    if (out.status === "ok") {
      await invalidarCachesAtivosOperacionais(queryClient);
      await mobilizacao.refetch();
      toast({
        title: out.replay ? "Mobilização já programada" : "Mobilização programada",
        description: `Versão ${out.data.versao} do planejamento passou a vigorar.`,
      });
      return;
    }

    toast({
      title: out.status === "uncertain" ? "Operação sem confirmação" : "Não foi possível programar",
      description: out.error.message,
      variant: "destructive",
    });
  };

  if (mobilizacao.isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="ct3c-revisao-carregando">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mobilizacao.error || !estado) {
    return (
      <Alert variant="destructive" data-testid="ct3c-revisao-erro">
        <AlertTitle className="text-sm">Revisão não disponível</AlertTitle>
        <AlertDescription className="text-xs">
          Não foi possível carregar o planejamento desta solicitação. Nenhuma programação pode ser
          confirmada sem essa leitura.
        </AlertDescription>
      </Alert>
    );
  }

  if (!planejamento) {
    return (
      <Alert data-testid="ct3c-revisao-sem-plano">
        <AlertTitle className="text-xs">Nenhum planejamento registrado</AlertTitle>
        <AlertDescription className="text-xs">
          Agrupe os ativos reservados em viagens na etapa de mobilização e salve o rascunho antes
          de revisar.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4" data-testid="ct3c-etapa-revisao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Revisão da mobilização</h2>
          <Badge variant="outline" className="text-[10px]">
            Versão {planejamento.versao} —{" "}
            {CT_PLANEJAMENTO_STATUS_LABELS[planejamento.status] ?? planejamento.status}
          </Badge>
        </div>
        {!!rascunho && capabilities.canAprovar && (
          <Button
            size="sm"
            className="gap-2"
            data-testid="ct3c-programar"
            disabled={enviando || problemas.length > 0}
            onClick={programar}
          >
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Programar mobilização
          </Button>
        )}
      </div>

      {programado && (
        <Alert data-testid="ct3c-revisao-programada">
          <CheckCircle2 className="h-4 w-4" />
          <AlertTitle className="text-xs">Mobilização programada</AlertTitle>
          <AlertDescription className="text-xs">
            Programada em{" "}
            {planejamento.programadoEm
              ? formatDateBR(planejamento.programadoEm.slice(0, 10))
              : "—"}
            . As viagens abaixo são o registro vigente desta solicitação.
          </AlertDescription>
        </Alert>
      )}

      {!!rascunho && problemas.length > 0 && (
        <Alert variant="destructive" data-testid="ct3c-revisao-problemas">
          <AlertTitle className="text-xs">Pendências antes de programar</AlertTitle>
          <AlertDescription className="text-xs">
            <ul className="list-disc pl-4">
              {problemas.map((p, i) => (
                <li key={`${p.chaveLocal ?? "geral"}-${i}`}>{p.mensagem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {viagens.map((v) => (
        <Card key={v.id} data-testid={`ct3c-revisao-viagem-${v.id}`}>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-xs font-medium">
              {v.codigo}
              <Badge variant="secondary" className="text-[10px]">
                {CT_VIAGEM_STATUS_LABELS[v.status] ?? v.status}
              </Badge>
              {v.modalidade && (
                <Badge variant="outline" className="text-[10px]">
                  {CT_MODALIDADE_LABELS[v.modalidade]}
                </Badge>
              )}
              {v.tipoTransporte && (
                <Badge variant="outline" className="text-[10px]">
                  {CT_TIPO_TRANSPORTE_LABELS[v.tipoTransporte]}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <dl className="grid gap-2 md:grid-cols-4">
              <div>
                <dt className="text-[11px] text-muted-foreground">Motorista</dt>
                <dd>{v.motoristaNomeSnapshot ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Transportador</dt>
                <dd>
                  {[v.placaTransportadorSnapshot, v.empresaTransportadoraNomeSnapshot]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Saída prevista</dt>
                <dd>{v.dataPrevistaSaida ? formatDateBR(v.dataPrevistaSaida) : "—"}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Data da mobilização</dt>
                <dd>{v.dataPrevistaEntrega ? formatDateBR(v.dataPrevistaEntrega) : "—"}</dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] text-muted-foreground">Origem</dt>
                <dd>
                  {[v.origemCcCodigoSnapshot, v.origemCcNomeSnapshot].filter(Boolean).join(" — ") ||
                    "—"}
                </dd>
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] text-muted-foreground">Destino</dt>
                <dd>
                  {[v.destinoCcCodigoSnapshot, v.destinoCcNomeSnapshot]
                    .filter(Boolean)
                    .join(" — ") || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Distância</dt>
                <dd>{v.distanciaKm !== null ? `${v.distanciaKm} km` : "—"}</dd>
              </div>
            </dl>
            <div>
              <p className="text-[11px] text-muted-foreground">
                Ativos ({v.atendimentoIds.length})
              </p>
              <ul className="list-disc pl-4">
                {v.atendimentoIds.map((at) => (
                  <li key={at}>{rotuloPorAtendimento.get(at) ?? "Ativo fora do seu escopo"}</li>
                ))}
              </ul>
            </div>
            {v.observacoes && <p className="text-[11px] text-muted-foreground">{v.observacoes}</p>}
          </CardContent>
        </Card>
      ))}

      {planejamento.observacoes && (
        <Card>
          <CardContent className="pt-4 text-xs">
            <p className="text-[11px] text-muted-foreground">Observações do planejamento</p>
            <p>{planejamento.observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EtapaRevisao;
