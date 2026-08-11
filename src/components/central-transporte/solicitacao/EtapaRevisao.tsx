/**
 * CT-3C R2 / Fase L — Etapa "Revisão": leitura fiel da versão em foco e gatilho
 * único de programação (`fn_ct_mobilizacao_programar`).
 *
 * Fail-closed: sem estado de mobilização confirmado nada é programável. Toda
 * validação exibida aqui é revalidada no servidor dentro da transação.
 */
import React, { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Loader2, Save, Send } from "lucide-react";
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
import CtSolicitacaoTimeline from "./CtSolicitacaoTimeline";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";

export const EtapaRevisao: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { solicitacaoId, mobilizacao, mobilizacaoDraft, capabilities, ctOperation, irParaEtapa } =
    useCtSolicitacao();
  const [enviando, setEnviando] = useState(false);

  const estado = mobilizacao.estado;
  const rascunho = mobilizacao.rascunhoEmEdicao;
  const planejamento = rascunho ?? mobilizacao.planejamentoVigente;
  const programado = planejamento?.status === "PROGRAMADO";
  // CT-3D.2 — a Revisão renderiza SOMENTE a versão persistida no servidor.
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

  const ativosPendentes = useMemo(() => {
    const planejados = new Set(viagens.flatMap((v) => v.atendimentoIds));
    return (estado?.ativos ?? []).filter((a) => !planejados.has(a.atendimentoId));
  }, [estado, viagens]);


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
      // CT-3D.2 — a agenda do motorista passa a listar a viagem PROGRAMADA.
      await queryClient.invalidateQueries({ queryKey: ["ct3d", "minhas-ordens"] });
      await mobilizacao.refetch();
      mobilizacaoDraft.ressincronizar();
      toast({
        title: out.replay ? "Mobilização já programada" : "Mobilização programada",
        description: "Mobilização programada e disponibilizada ao motorista.",
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
        <AlertDescription className="space-y-2 text-xs">
          <p>
            Agrupe os ativos reservados em viagens na etapa de mobilização e salve o rascunho antes
            de revisar.
          </p>
          <Button
            size="sm"
            variant="outline"
            data-testid="ct3d2-voltar-mobilizacao"
            onClick={() => irParaEtapa("MOBILIZACAO")}
          >
            Voltar à mobilização
          </Button>
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
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={() => irParaEtapa("MOBILIZACAO")}>
            <ArrowLeft className="h-4 w-4" /> Voltar e editar
          </Button>
          {!!rascunho && capabilities.canEditar && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              disabled={mobilizacaoDraft.salvando}
              onClick={() => void mobilizacaoDraft.salvar()}
            >
              <Save className="h-4 w-4" /> Salvar rascunho
            </Button>
          )}
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

      {mobilizacaoDraft.dirty && (
        <Alert data-testid="ct3d2-revisao-desatualizada">
          <AlertTitle className="text-xs">Existem alterações não salvas na mobilização</AlertTitle>
          <AlertDescription className="space-y-2 text-xs">
            <p>
              A revisão abaixo mostra a última versão gravada no servidor. Volte à mobilização e
              salve para revisar as alterações mais recentes.
            </p>
            <Button
              size="sm"
              variant="outline"
              data-testid="ct3d2-voltar-mobilizacao-dirty"
              onClick={() => irParaEtapa("MOBILIZACAO")}
            >
              Voltar à mobilização
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {ativosPendentes.length > 0 && (
        <Alert data-testid="ct3d2-ativos-pendentes">
          <AlertTitle className="text-xs">
            {ativosPendentes.length} ativo(s) sem viagem (mobilização parcial)
          </AlertTitle>
          <AlertDescription className="text-xs">
            <ul className="list-disc pl-4">
              {ativosPendentes.map((a) => (
                <li key={a.atendimentoId}>{rotuloAtivo(a)}</li>
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
                <dt className="text-[11px] text-muted-foreground">Coleta</dt>
                <dd>
                  {[v.origemCcCodigoSnapshot, v.origemCcNomeSnapshot].filter(Boolean).join(" — ") ||
                    "—"}
                </dd>
                {(v.origemEnderecoOperacional || v.origemPontoExato) && (
                  <dd className="text-[11px] text-muted-foreground">
                    {[v.origemEnderecoOperacional, v.origemPontoExato].filter(Boolean).join(" · ")}
                  </dd>
                )}
              </div>
              <div className="md:col-span-2">
                <dt className="text-[11px] text-muted-foreground">Descarga</dt>
                <dd>
                  {[v.destinoCcCodigoSnapshot, v.destinoCcNomeSnapshot]
                    .filter(Boolean)
                    .join(" — ") || "—"}
                </dd>
                {(v.destinoEnderecoOperacional || v.destinoPontoExato) && (
                  <dd className="text-[11px] text-muted-foreground">
                    {[v.destinoEnderecoOperacional, v.destinoPontoExato]
                      .filter(Boolean)
                      .join(" · ")}
                  </dd>
                )}
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Recebedor previsto</dt>
                <dd>
                  {v.recebedorPrevistoNomeSnapshot ?? "—"}
                  {v.recebedorPrevistoTelefoneSnapshot
                    ? ` · ${v.recebedorPrevistoTelefoneSnapshot}`
                    : ""}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Rota</dt>
                <dd>
                  {v.distanciaRotaKm !== null ? `${v.distanciaRotaKm} km` : "—"}
                  {v.duracaoRotaMin !== null ? ` · ${v.duracaoRotaMin} min` : ""}
                </dd>
                {v.rotaResumo && (
                  <dd className="text-[11px] text-muted-foreground">{v.rotaResumo}</dd>
                )}
              </div>
              <div>
                <dt className="text-[11px] text-muted-foreground">Distância operacional</dt>
                <dd>
                  {v.distanciaOperacionalKm !== null
                    ? `${v.distanciaOperacionalKm} km`
                    : v.distanciaKm !== null
                      ? `${v.distanciaKm} km`
                      : "—"}
                </dd>
                {v.distanciaRegraAplicada && (
                  <dd className="text-[11px] text-muted-foreground">
                    {v.distanciaRegraAplicada}
                  </dd>
                )}
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

      {/* CT-3F — linha do tempo operacional consolidada da solicitação. */}
      <CtSolicitacaoTimeline solicitacaoId={solicitacaoId} />
    </div>
  );
};

export default EtapaRevisao;
