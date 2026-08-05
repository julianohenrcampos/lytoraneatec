/**
 * CT-3C R2 / Fase J — Etapa "Mobilização": dois painéis.
 *
 * Painel esquerdo: ativos reservados pendentes de planejamento.
 * Painel direito: cards de viagem (RODANTE ou TRANSPORTADO) com responsáveis,
 * origem/destino relacionais, datas e distância.
 *
 * Toda gravação é feita por `fn_ct_mobilizacao_salvar_rascunho` com patch
 * autoritativo e idempotência por request_id. Mobilização parcial é permitida:
 * ativos fora de viagem seguem aguardando planejamento.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, RotateCcw, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import useCtMobilizacaoCadastros from "@/hooks/central-transporte/useCtMobilizacaoCadastros";
import { invalidarCachesAtivosOperacionais } from "@/lib/queryInvalidation/ativosOperacionais";
import {
  atribuirAtivoAViagem,
  chaveMaterialRascunho,
  criarViagemVazia,
  hidratarRascunho,
  indiceAtendimentos,
  rotuloAtivo,
  sugerirModalidade,
  validarProgramacao,
  validarRascunho,
} from "@/lib/central-transporte/mobilizacaoRascunho";
import {
  abrirNovaRevisaoMobilizacao,
  salvarRascunhoMobilizacao,
} from "@/services/centralTransporteMobilizacaoService";
import {
  CT_PLANEJAMENTO_STATUS_LABELS,
  type CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";
import { formatDateBR } from "@/utils/formatDateBR";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";
import ViagemCardEditor from "./ViagemCardEditor";

export const EtapaMobilizacao: React.FC = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { solicitacaoId, mobilizacao, capabilities, ctOperation } = useCtSolicitacao();

  const estado = mobilizacao.estado;
  const rascunhoServidor = mobilizacao.rascunhoEmEdicao;
  const vigente = mobilizacao.planejamentoVigente;

  const [viagens, setViagens] = useState<CtViagemRascunho[]>([]);
  const [chaveEstado, setChaveEstado] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [abrindoRevisao, setAbrindoRevisao] = useState(false);

  const cadastros = useCtMobilizacaoCadastros(!!estado && capabilities.canVisualizar);

  // Hidrata a partir do servidor sempre que a versão em foco mudar.
  const assinaturaServidor = `${rascunhoServidor?.id ?? "-"}:${rascunhoServidor?.lockVersion ?? -1}:${
    vigente?.id ?? "-"
  }:${vigente?.lockVersion ?? -1}`;

  useEffect(() => {
    if (!estado) return;
    if (chaveEstado === assinaturaServidor) return;
    setViagens(hidratarRascunho(estado));
    setChaveEstado(assinaturaServidor);
  }, [estado, assinaturaServidor, chaveEstado]);

  const somenteLeitura = !capabilities.canEditar || (!rascunhoServidor && !!vigente);

  const problemasRascunho = useMemo(() => validarRascunho(viagens), [viagens]);
  const problemasProgramacao = useMemo(
    () => validarProgramacao(viagens, estado?.ativos ?? []),
    [viagens, estado],
  );

  const indice = useMemo(() => indiceAtendimentos(viagens), [viagens]);
  const pendentes = useMemo(
    () => (estado?.ativos ?? []).filter((a) => !indice.has(a.atendimentoId)),
    [estado, indice],
  );

  const problemasDaViagem = (chaveLocal: string): string[] =>
    problemasProgramacao.filter((p) => p.chaveLocal === chaveLocal).map((p) => p.mensagem);

  const patchViagem = (chaveLocal: string, patch: Partial<CtViagemRascunho>) =>
    setViagens((atual) =>
      atual.map((v) => (v.chaveLocal === chaveLocal ? { ...v, ...patch } : v)),
    );

  const adicionarViagem = () =>
    setViagens((atual) => [
      ...atual,
      criarViagemVazia({ destinoCentroCustoId: null, modalidade: null }),
    ]);

  const removerViagem = (chaveLocal: string) =>
    setViagens((atual) => atual.filter((v) => v.chaveLocal !== chaveLocal));

  const agrupar = (atendimentoId: string, chaveLocal: string | null) =>
    setViagens((atual) => atribuirAtivoAViagem(atual, atendimentoId, chaveLocal));

  /** Cria uma viagem já com o ativo, sugerindo a modalidade pelo tipo do ativo. */
  const novaViagemComAtivo = (atendimentoId: string) => {
    const ativo = (estado?.ativos ?? []).find((a) => a.atendimentoId === atendimentoId);
    const nova = criarViagemVazia({
      modalidade: ativo ? sugerirModalidade(ativo) : null,
      origemCentroCustoId: ativo?.centroCustoAtualId ?? null,
      atendimentoIds: [atendimentoId],
    });
    setViagens((atual) => [...atribuirAtivoAViagem(atual, atendimentoId, null), nova]);
  };

  const salvar = async () => {
    if (problemasRascunho.length > 0) {
      toast({
        title: "Rascunho incompleto",
        description: problemasRascunho[0].mensagem,
        variant: "destructive",
      });
      return;
    }

    setSalvando(true);
    const out = await ctOperation.run({
      operation: "ATRIBUIR",
      materialKey: chaveMaterialRascunho(solicitacaoId, viagens),
      resourceIds: viagens.flatMap((v) => v.atendimentoIds),
      exec: (requestId) =>
        salvarRascunhoMobilizacao({
          solicitacaoId,
          planejamentoId: rascunhoServidor?.id ?? null,
          versaoEsperada: rascunhoServidor?.lockVersion ?? null,
          viagens,
          requestId,
        }),
    });
    setSalvando(false);

    if (out.status === "ok") {
      await invalidarCachesAtivosOperacionais(queryClient);
      await mobilizacao.refetch();
      setChaveEstado("");
      toast({
        title: out.data.noChange
          ? "Nenhuma alteração a salvar"
          : out.replay
            ? "Rascunho já salvo"
            : "Rascunho salvo",
        description: `Versão ${out.data.versao} do planejamento atualizada.`,
      });
      return;
    }

    toast({
      title: out.status === "uncertain" ? "Operação sem confirmação" : "Não foi possível salvar",
      description: out.error.message,
      variant: "destructive",
    });
  };

  const abrirRevisao = async () => {
    if (!vigente) return;
    setAbrindoRevisao(true);
    const out = await ctOperation.run({
      operation: "ATRIBUIR",
      materialKey: `MOB_NOVA_REVISAO|${vigente.id}`,
      resourceIds: [vigente.id],
      exec: (requestId) =>
        abrirNovaRevisaoMobilizacao({ planejamentoId: vigente.id, requestId }),
    });
    setAbrindoRevisao(false);

    if (out.status === "ok") {
      await mobilizacao.refetch();
      setChaveEstado("");
      toast({
        title: "Revisão aberta",
        description: `Versão ${out.data.versao} em rascunho. O planejamento programado segue vigente.`,
      });
      return;
    }

    toast({
      title: "Não foi possível abrir a revisão",
      description: out.error.message,
      variant: "destructive",
    });
  };

  if (mobilizacao.isLoading) {
    return (
      <div className="flex justify-center py-12" data-testid="ct3c-mobilizacao-carregando">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (mobilizacao.error || !estado) {
    return (
      <Alert variant="destructive" data-testid="ct3c-mobilizacao-erro">
        <AlertTitle className="text-sm">Mobilização não disponível</AlertTitle>
        <AlertDescription className="text-xs">
          Não foi possível carregar os ativos reservados desta solicitação. Nada pode ser
          planejado sem essa leitura.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4" data-testid="ct3c-etapa-mobilizacao">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold">Mobilização dos ativos reservados</h2>
          {(rascunhoServidor ?? vigente) && (
            <Badge variant="outline" className="text-[10px]">
              Versão {(rascunhoServidor ?? vigente)!.versao} —{" "}
              {CT_PLANEJAMENTO_STATUS_LABELS[(rascunhoServidor ?? vigente)!.status]}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {somenteLeitura && vigente && capabilities.canEditar && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              data-testid="ct3c-abrir-revisao"
              disabled={abrindoRevisao}
              onClick={abrirRevisao}
            >
              {abrindoRevisao ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
              Abrir revisão
            </Button>
          )}
          {!somenteLeitura && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                data-testid="ct3c-nova-viagem"
                onClick={adicionarViagem}
              >
                <Plus className="h-4 w-4" />
                Nova viagem
              </Button>
              <Button
                size="sm"
                className="gap-2"
                data-testid="ct3c-salvar-rascunho"
                disabled={salvando || problemasRascunho.length > 0}
                onClick={salvar}
              >
                {salvando ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Salvar rascunho
              </Button>
            </>
          )}
        </div>
      </div>

      {somenteLeitura && vigente && (
        <Alert data-testid="ct3c-mobilizacao-programada">
          <AlertTitle className="text-xs">Planejamento programado vigente</AlertTitle>
          <AlertDescription className="text-xs">
            Programado em{" "}
            {vigente.programadoEm ? formatDateBR(vigente.programadoEm.slice(0, 10)) : "—"}. Abra uma
            revisão para alterar as viagens; o programado permanece vigente até a nova versão ser
            programada.
          </AlertDescription>
        </Alert>
      )}

      {problemasRascunho.length > 0 && (
        <Alert variant="destructive" data-testid="ct3c-problemas-rascunho">
          <AlertTitle className="text-xs">Ajuste antes de salvar</AlertTitle>
          <AlertDescription className="text-xs">
            <ul className="list-disc pl-4">
              {problemasRascunho.map((p, i) => (
                <li key={`rasc-${i}`}>{p.mensagem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card data-testid="ct3c-painel-ativos">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              Ativos aguardando planejamento
              <Badge variant="outline" className="text-[10px]">
                {pendentes.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {pendentes.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Todos os ativos reservados já estão agrupados em viagens.
              </p>
            ) : (
              pendentes.map((a) => (
                <div
                  key={a.atendimentoId}
                  className="space-y-1 rounded-md border p-2"
                  data-testid={`ct3c-ativo-pendente-${a.atendimentoId}`}
                >
                  <p className="font-medium">{rotuloAtivo(a)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {a.centroCustoAtualNome ?? "Sem centro de custo atual"}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Reserva a partir de{" "}
                    {a.periodoInicio ? formatDateBR(a.periodoInicio) : "—"}
                  </p>
                  {!somenteLeitura && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {viagens.map((v, i) => (
                        <Button
                          key={v.chaveLocal}
                          size="sm"
                          variant="outline"
                          className="h-6 text-[11px]"
                          onClick={() => agrupar(a.atendimentoId, v.chaveLocal)}
                        >
                          {v.codigo ?? `Viagem ${i + 1}`}
                        </Button>
                      ))}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[11px]"
                        data-testid={`ct3c-nova-viagem-com-${a.atendimentoId}`}
                        onClick={() => novaViagemComAtivo(a.atendimentoId)}
                      >
                        + Nova viagem
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {viagens.length === 0 ? (
            <Alert data-testid="ct3c-sem-viagens">
              <AlertTitle className="text-xs">Nenhuma viagem criada</AlertTitle>
              <AlertDescription className="text-xs">
                Crie uma viagem e agrupe os ativos reservados. Ativos que ficarem de fora
                permanecem aguardando planejamento (mobilização parcial).
              </AlertDescription>
            </Alert>
          ) : (
            viagens.map((v, i) => (
              <ViagemCardEditor
                key={v.chaveLocal}
                viagem={v}
                indice={i}
                ativos={estado.ativos}
                problemas={problemasDaViagem(v.chaveLocal)}
                somenteLeitura={somenteLeitura}
                cadastros={cadastros}
                onPatch={(patch) => patchViagem(v.chaveLocal, patch)}
                onRemover={() => removerViagem(v.chaveLocal)}
                onRemoverAtivo={(at) => agrupar(at, null)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default EtapaMobilizacao;
