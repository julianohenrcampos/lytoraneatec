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
import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, Loader2, Plus, RotateCcw, Save } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import useCtMobilizacaoCadastros from "@/hooks/central-transporte/useCtMobilizacaoCadastros";
import {
  atribuirAtivoAViagem,
  criarViagemVazia,
  indiceAtendimentos,
  rotuloAtivo,
  sugerirModalidade,
} from "@/lib/central-transporte/mobilizacaoRascunho";
import { abrirNovaRevisaoMobilizacao } from "@/services/centralTransporteMobilizacaoService";
import {
  CT_PLANEJAMENTO_STATUS_LABELS,
  type CtViagemRascunho,
} from "@/types/centralTransporteMobilizacao";
import { formatDateBR } from "@/utils/formatDateBR";
import { useCtSolicitacao } from "./CentralTransporteSolicitacaoProvider";
import ViagemCardEditor from "./ViagemCardEditor";

const horaBR = (iso: string | null): string =>
  iso
    ? new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

/** CT-3D.5 — status material do ativo no ciclo de planejamento. */
type StatusAtivoPlanejamento = "PENDENTE" | "NAO_SALVO" | "SALVO" | "PROGRAMADO";

const ROTULO_STATUS_ATIVO: Record<StatusAtivoPlanejamento, string> = {
  PENDENTE: "Pendente",
  NAO_SALVO: "Não salvo",
  SALVO: "Salvo no rascunho",
  PROGRAMADO: "Programado",
};

export const EtapaMobilizacao: React.FC = () => {
  const { toast } = useToast();
  const { mobilizacao, mobilizacaoDraft, capabilities, ctOperation, irParaEtapa } =
    useCtSolicitacao();

  const estado = mobilizacao.estado;
  const rascunhoServidor = mobilizacao.rascunhoEmEdicao;
  const vigente = mobilizacao.planejamentoVigente;

  // CT-3D.2 — o rascunho vive no provider: trocar de etapa não perde dados.
  const viagens = mobilizacaoDraft.viagens;
  const setViagens = mobilizacaoDraft.setViagens;
  const salvando = mobilizacaoDraft.salvando;
  const somenteLeitura = mobilizacaoDraft.somenteLeitura;
  const problemasRascunho = mobilizacaoDraft.problemasRascunho;
  const problemasProgramacao = mobilizacaoDraft.problemasProgramacao;

  /**
   * CT-3D.4 — "Salvar rascunho" é permissivo: basta haver algo material a
   * persistir (edição local, ou viagens ainda não persistidas no servidor).
   */
  const podeSalvarRascunho =
    mobilizacaoDraft.dirty ||
    (!mobilizacaoDraft.temPlanejamentoPersistido && mobilizacaoDraft.viagens.length > 0);


  const [abrindoRevisao, setAbrindoRevisao] = useState(false);

  const cadastros = useCtMobilizacaoCadastros(!!estado && capabilities.canVisualizar);

  const indice = useMemo(() => indiceAtendimentos(viagens), [viagens]);
  const indicePersistido = useMemo(
    () =>
      new Map(
        (rascunhoServidor?.viagens ?? vigente?.viagens ?? []).flatMap((v) =>
          v.atendimentoIds.map((id) => [id, v] as const),
        ),
      ),
    [rascunhoServidor, vigente],
  );
  const pendentes = useMemo(
    () => (estado?.ativos ?? []).filter((a) => !indice.has(a.atendimentoId)),
    [estado, indice],
  );
  const planejados = useMemo(
    () => (estado?.ativos ?? []).filter((a) => indice.has(a.atendimentoId)),
    [estado, indice],
  );

  /* ---------- CT-3D.5 — seleção única e status material por ativo ---------- */
  const chaveSelecionada = mobilizacaoDraft.chaveSelecionada;
  const viagemSelecionada =
    viagens.find((v) => v.chaveLocal === chaveSelecionada) ?? viagens[0] ?? null;
  const podeAgruparNaSelecionada =
    !!viagemSelecionada && viagemSelecionada.modalidade === "TRANSPORTADO";

  const statusAtivo = (atendimentoId: string): StatusAtivoPlanejamento => {
    const persistida = indicePersistido.get(atendimentoId);
    if (persistida?.status === "PROGRAMADA") return "PROGRAMADO";
    if (persistida) return "SALVO";
    if (indice.has(atendimentoId)) return "NAO_SALVO";
    return "PENDENTE";
  };

  const problemasDaViagem = (chaveLocal: string): string[] =>
    problemasProgramacao.filter((p) => p.chaveLocal === chaveLocal).map((p) => p.mensagem);

  const patchViagem = (chaveLocal: string, patch: Partial<CtViagemRascunho>) =>
    setViagens((atual) =>
      atual.map((v) => (v.chaveLocal === chaveLocal ? { ...v, ...patch } : v)),
    );


  const adicionarViagem = () => {
    const nova = criarViagemVazia({ destinoCentroCustoId: null, modalidade: null });
    setViagens((atual) => [...atual, nova]);
    // CT-3D.5 — a nova viagem passa a ser o único formulário em foco.
    mobilizacaoDraft.selecionarViagem(nova.chaveLocal);
  };


  const removerViagem = (chaveLocal: string) =>
    setViagens((atual) => atual.filter((v) => v.chaveLocal !== chaveLocal));

  const agrupar = (atendimentoId: string, chaveLocal: string | null) =>
    setViagens((atual) => atribuirAtivoAViagem(atual, atendimentoId, chaveLocal));

  /* CT-3D.5 — a criação de viagem por ativo passou para o provider
     (`selecionarAtivo`), garantindo um único formulário em foco. */


  /**
   * CT-3D.5 — Salvar rascunho: permissivo e sequencial. Após persistir, o
   * próximo ativo pendente é selecionado automaticamente.
   */
  const salvar = async () => {
    const ok = await mobilizacaoDraft.salvar();
    if (!ok) return;
    const proximo = (estado?.ativos ?? []).find((a) => !indice.has(a.atendimentoId));
    if (proximo) mobilizacaoDraft.selecionarAtivo(proximo.atendimentoId);
  };

  /** CT-3D.2 — autosave antes de abrir a Revisão (transição comandada pelo provider). */
  const irParaRevisao = () => irParaEtapa("REVISAO");

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
      mobilizacaoDraft.ressincronizar();
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
          {/* CT-3D.2 — estado do rascunho sempre visível */}
          <span className="text-[11px] text-muted-foreground" data-testid="ct3d2-estado-rascunho">
            {mobilizacaoDraft.status === "SAVING"
              ? "Salvando rascunho..."
              : mobilizacaoDraft.status === "CONFIRMING"
                ? "Operação sendo confirmada"
              : mobilizacaoDraft.status === "DIRTY"
                ? "Alterações não salvas"
                : mobilizacaoDraft.status === "SAVED"
                  ? `Rascunho salvo ${horaBR(mobilizacaoDraft.salvoEm)}`
                  : mobilizacaoDraft.status === "ERROR"
                    ? mobilizacaoDraft.mensagemErro ?? "Falha ao salvar o rascunho"
                    : mobilizacaoDraft.temPlanejamentoPersistido
                      ? "Rascunho sincronizado com o servidor"
                      : "Nenhum rascunho salvo"}
          </span>
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
                variant="outline"
                className="gap-2"
                data-testid="ct3c-salvar-rascunho"
                disabled={salvando || !podeSalvarRascunho}
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
          <Button
            size="sm"
            className="gap-2"
            data-testid="ct3d2-ir-revisao"
            disabled={salvando || viagens.length === 0}
            onClick={irParaRevisao}
          >
            {salvando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Revisar planejamento
          </Button>

        </div>
      </div>

      {mobilizacaoDraft.operacaoPendente && (
        <Alert data-testid="ct3d3-confirmar-salvamento">
          <AlertTitle className="text-xs">Operação sem confirmação</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span>
              Uma tentativa deste planejamento não teve resposta. Resolver reconsulta o servidor e,
              se necessário, repete o mesmo comando com segurança (sem duplicar registros).
            </span>
            <Button
              size="sm"
              variant="outline"
              data-testid="ct3d5-resolver-pendencia"
              disabled={salvando || mobilizacaoDraft.resolvendoPendencia}
              onClick={() => void mobilizacaoDraft.resolverOperacaoPendente()}
            >
              {mobilizacaoDraft.resolvendoPendencia ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Resolver operação pendente"
              )}
            </Button>
          </AlertDescription>
        </Alert>
      )}



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
        {/* CT-3D.5 — coluna lateral: TODOS os ativos com status material e seleção. */}
        <Card data-testid="ct3c-painel-ativos">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xs font-medium">
              Ativos da solicitação
              <Badge variant="outline" className="text-[10px]">
                {planejados.length}/{(estado.ativos ?? []).length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {(estado.ativos ?? []).length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Nenhum ativo reservado nesta solicitação.
              </p>
            ) : (
              (estado.ativos ?? []).map((a) => {
                const st = statusAtivo(a.atendimentoId);
                const chaveDoAtivo = indice.get(a.atendimentoId) ?? null;
                const selecionado = !!chaveDoAtivo && chaveDoAtivo === chaveSelecionada;
                return (
                  <button
                    key={a.atendimentoId}
                    type="button"
                    className={`w-full space-y-1 rounded-md border p-2 text-left transition-colors hover:bg-muted/50 ${
                      selecionado ? "border-primary bg-primary/5" : ""
                    }`}
                    data-testid={`ct3d5-card-ativo-${a.atendimentoId}`}
                    data-status={st}
                    data-selecionado={selecionado ? "true" : "false"}
                    onClick={() => mobilizacaoDraft.selecionarAtivo(a.atendimentoId)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">{rotuloAtivo(a)}</p>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          st === "PROGRAMADO" || st === "SALVO"
                            ? "border-emerald-600/50 bg-emerald-600/10"
                            : st === "NAO_SALVO"
                              ? "border-amber-500/50 bg-amber-500/10"
                              : ""
                        }`}
                      >
                        {ROTULO_STATUS_ATIVO[st]}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {a.centroCustoAtualNome ?? "Sem centro de custo atual"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Reserva a partir de {a.periodoInicio ? formatDateBR(a.periodoInicio) : "—"}
                    </p>
                    {!somenteLeitura && st === "PENDENTE" && podeAgruparNaSelecionada && (
                      <span
                        role="button"
                        tabIndex={0}
                        className="mt-1 inline-flex cursor-pointer text-[11px] font-medium text-primary underline"
                        data-testid={`ct3d5-incluir-na-viagem-${a.atendimentoId}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          agrupar(a.atendimentoId, chaveSelecionada);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.stopPropagation();
                            agrupar(a.atendimentoId, chaveSelecionada);
                          }
                        }}
                      >
                        Incluir nesta viagem transportada
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </CardContent>
          <CardContent className="border-t pt-2 text-[11px] text-muted-foreground">
            Selecione um ativo para planejar. Ativos sem viagem permanecem aguardando planejamento
            (mobilização parcial é permitida).
          </CardContent>
        </Card>

        {/* CT-3D.5 — um único formulário de planejamento visível por vez. */}
        <div className="space-y-3">
          {viagens.length === 0 || !viagemSelecionada ? (
            <Alert data-testid="ct3c-sem-viagens">
              <AlertTitle className="text-xs">Nenhum planejamento em edição</AlertTitle>
              <AlertDescription className="text-xs">
                Selecione um ativo na coluna ao lado para planejar sua mobilização. Ativos que
                ficarem de fora permanecem aguardando planejamento.
              </AlertDescription>
            </Alert>
          ) : (
            (() => {
              const v = viagemSelecionada;
              const i = viagens.findIndex((x) => x.chaveLocal === v.chaveLocal);
              const persistida =
                v.atendimentoIds.map((at) => indicePersistido.get(at)).find((x) => !!x) ?? null;
              const programada = persistida?.status === "PROGRAMADA";
              return (
                <div
                  className="space-y-1"
                  data-state={programada ? "programado" : persistida ? "persistido" : "nao-salvo"}
                  data-testid={`ct3d3-viagem-estado-${v.chaveLocal}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {persistida && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
                    <Badge
                      variant="outline"
                      className={
                        persistida
                          ? "border-emerald-600/50 bg-emerald-600/10 text-[10px]"
                          : "text-[10px]"
                      }
                    >
                      {programada ? "Programada" : persistida ? "Salva no rascunho" : "Não salva"}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {persistida?.codigo ?? v.codigo ?? "Nova viagem"} ·{" "}
                      {v.atendimentoIds.length} ativo(s)
                    </span>
                    {viagens.length > 1 && (
                      <span className="text-[11px] text-muted-foreground">
                        Planejamento {i + 1} de {viagens.length}
                      </span>
                    )}
                  </div>
                  <ViagemCardEditor
                    viagem={v}
                    indice={i}
                    ativos={estado.ativos}
                    problemas={problemasDaViagem(v.chaveLocal)}
                    somenteLeitura={somenteLeitura}
                    cadastros={cadastros}
                    origemCcEndereco={
                      v.origemCentroCustoId
                        ? cadastros.enderecosCentroCusto[v.origemCentroCustoId] ?? null
                        : null
                    }
                    destinoCcEndereco={
                      v.destinoCentroCustoId
                        ? cadastros.enderecosCentroCusto[v.destinoCentroCustoId] ?? null
                        : null
                    }
                    onPatch={(patch) => patchViagem(v.chaveLocal, patch)}
                    onRemover={() => removerViagem(v.chaveLocal)}
                    onRemoverAtivo={(at) => agrupar(at, null)}
                  />
                </div>
              );
            })()
          )}
        </div>
      </div>

    </div>
  );
};

export default EtapaMobilizacao;
