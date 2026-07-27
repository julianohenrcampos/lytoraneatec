/**
 * Detalhe de um Chamado Interno.
 *
 * Timeline completa (bd_chamado_interno_eventos) + ações condicionadas por
 * capacidades derivadas do helper puro `getChamadoActionCapabilities`. Todas
 * as mutações via RPCs `fn_chamado_interno_*`. Ações de solicitante mantêm o
 * comportamento existente e NÃO passam pelo helper nesta rodada.
 */
import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  UserPlus,
  XCircle,
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
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

import {
  CHAMADOS_INTERNOS_KEYS,
  useChamadoInterno,
  useChamadoInternoEventos,
  useChamadoInternoResponder,
  useChamadoInternoSolicitarInformacao,
  useChamadoInternoAdicionarNotaInterna,
  useChamadoInternoResolver,
  useChamadoInternoResponderSolicitante,
  useChamadoInternoConfirmarEncerramento,
  useChamadoInternoReabrir,
  useChamadoInternoCancelar,
  useChamadoInternoCapacidadeOperar,
  useChamadoInternoEnriquecimento,
} from "@/hooks/useChamadosInternos";
import { primeiroNome } from "@/utils/primeiroNome";

import { useChamadosInternosRealtime } from "@/hooks/useChamadosInternosRealtime";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { usePermission } from "@/hooks/usePermission";
import {
  StatusBadge,
  PrioridadeBadge,
  SetorBadge,
  formatarDataHora,
  formatarPrazoRestante,
} from "@/components/chamados-internos/StatusBadges";
import { CHAMADO_INTERNO_EVENTO_META } from "@/constants/chamadosInternos";
import type { ChamadoInternoEventoTipo } from "@/types/chamadosInternos";
import {
  getChamadoActionCapabilities,
  getErrorField,
  isRpcForbidden,
  traduzirErroChamado,
  traduzirErroAssumir,
} from "@/utils/chamadosInternosCapabilities";
import CancelarChamadoDialog from "@/components/chamados-internos/CancelarChamadoDialog";
import ReabrirChamadoDialog from "@/components/chamados-internos/ReabrirChamadoDialog";

type AcaoAtendente =
  | "responder"
  | "solicitar_informacao"
  | "nota_interna"
  | "resolver";

const ChamadoInternoDetalhe: React.FC = () => {
  const { chamadoId } = useParams<{ chamadoId: string }>();
  usePageTitle("Detalhe do Chamado");
  const navigate = useNavigate();
  useChamadosInternosRealtime();
  const qc = useQueryClient();

  const { userId } = useAuth();
  const { user: userProfile } = useUserProfile();
  const funcionarioId: string | null =
    (userProfile && typeof userProfile === "object" && "funcionario_id" in userProfile
      ? (userProfile as { funcionario_id: string | null }).funcionario_id
      : null) ?? null;

  const { hasActionPermission, isSuperAdmin } = usePermission();

  const chamadoQ = useChamadoInterno(chamadoId);
  const eventosQ = useChamadoInternoEventos(chamadoId);
  const chamado = chamadoQ.data;
  const { mapa: extrasMapa } = useChamadoInternoEnriquecimento(
    chamadoId ? [chamadoId] : [],
  );
  const extras = chamadoId ? extrasMapa.get(chamadoId) : undefined;


  // Autorização operacional via `fn_chamado_interno_can_operate(chamado_id)` —
  // cobre SuperAdm, AdmSede (por CC) e Atendente (por setor), sem depender de
  // `fn_chamado_interno_can_attend`. Fail-closed enquanto carrega ou em erro.
  const capacidadeQ = useChamadoInternoCapacidadeOperar(chamado?.id);
  const canOperateChamado =
    !capacidadeQ.isLoading && !capacidadeQ.isError && capacidadeQ.data === true;

  // Action-aware RBAC (visualizar vs editar).
  const canVisualizarAtendimento = hasActionPermission(
    "chamados_internos_atender",
    "visualizar",
  );
  const canEditarAtendimento = hasActionPermission(
    "chamados_internos_atender",
    "editar",
  );
  const canAdministrarEditar = hasActionPermission(
    "chamados_internos_admin",
    "editar",
  );
  const canAbrirEditar = hasActionPermission(
    "chamados_internos_abrir",
    "editar",
  );

  const capabilities = React.useMemo(() => {
    if (!chamado) {
      return {
        canAssumir: false,
        canResponder: false,
        canSolicitarInformacao: false,
        canAdicionarNotaInterna: false,
        canResolver: false,
        canCancelar: false,
        showAcoesAtendenteTab: false,
      };
    }
    return getChamadoActionCapabilities({
      chamado: {
        status: chamado.status,
        setor: chamado.setor,
        responsavel_atual_profile_id: chamado.responsavel_atual_profile_id,
        aberto_por: chamado.aberto_por,
        solicitante_funcionario_id: chamado.solicitante_funcionario_id,
      },
      profileId: userId ?? null,
      funcionarioId,
      isSuperAdmin,
      acessoGlobal:
        userProfile && typeof userProfile === "object" && "acesso_global" in userProfile
          ? (userProfile as { acesso_global?: boolean | null }).acesso_global === true
          : false,
      canAttendSetor: canOperateChamado,
      permissions: {
        canVisualizarAtendimento,
        canEditarAtendimento,
        canAdministrarEditar,
        canAbrirEditar,
      },
    });
  }, [
    chamado,
    userId,
    funcionarioId,
    isSuperAdmin,
    userProfile,
    canOperateChamado,
    canVisualizarAtendimento,
    canEditarAtendimento,
    canAdministrarEditar,
    canAbrirEditar,
  ]);

  const responderM = useChamadoInternoResponder();
  const solicitarM = useChamadoInternoSolicitarInformacao();
  const notaM = useChamadoInternoAdicionarNotaInterna();
  const resolverM = useChamadoInternoResolver();
  const cancelarM = useChamadoInternoCancelar();
  const responderSolicitanteM = useChamadoInternoResponderSolicitante();
  const confirmarM = useChamadoInternoConfirmarEncerramento();
  const reabrirM = useChamadoInternoReabrir();

  const [msgAtendente, setMsgAtendente] = React.useState("");
  const [acaoAtendente, setAcaoAtendente] =
    React.useState<AcaoAtendente>("responder");
  const [msgSolicitante, setMsgSolicitante] = React.useState("");
  const [cancelarOpen, setCancelarOpen] = React.useState(false);
  const [reabrirOpen, setReabrirOpen] = React.useState(false);
  const [isAssumindo, setIsAssumindo] = React.useState(false);

  // Trata erros de mutação de forma centralizada, sem toast otimista.
  const handleMutationError = (e: unknown, contexto: string) => {
    if (import.meta.env.DEV) {
      console.error(`[chamados-internos] Erro em "${contexto}"`, e);
    }
    toast.error(traduzirErroChamado(e));
    if (chamado && isRpcForbidden(e)) {
      void qc.invalidateQueries({
        queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", chamado.id),
      });
      void qc.invalidateQueries({
        queryKey: CHAMADOS_INTERNOS_KEYS.item(chamado.id),
      });
    }
  };

  // Sanity check: se a ação selecionada não é mais permitida (mudança de
  // status/responsável em realtime), reajusta para uma opção válida.
  React.useEffect(() => {
    const permitidas: AcaoAtendente[] = [];
    if (capabilities.canResponder) permitidas.push("responder");
    if (capabilities.canSolicitarInformacao) permitidas.push("solicitar_informacao");
    if (capabilities.canAdicionarNotaInterna) permitidas.push("nota_interna");
    if (capabilities.canResolver) permitidas.push("resolver");
    if (permitidas.length > 0 && !permitidas.includes(acaoAtendente)) {
      setAcaoAtendente(permitidas[0]);
    }
  }, [
    capabilities.canResponder,
    capabilities.canSolicitarInformacao,
    capabilities.canAdicionarNotaInterna,
    capabilities.canResolver,
    acaoAtendente,
  ]);

  const executarAtendente = async () => {
    if (!chamado) return;
    const msg = msgAtendente.trim();
    if (!msg) {
      toast.error("Informe uma mensagem antes de continuar.");
      return;
    }
    try {
      switch (acaoAtendente) {
        case "responder":
          if (!capabilities.canResponder) return;
          await responderM.mutateAsync({ chamadoId: chamado.id, args: msg });
          toast.success("Resposta enviada");
          break;
        case "solicitar_informacao":
          if (!capabilities.canSolicitarInformacao) return;
          await solicitarM.mutateAsync({ chamadoId: chamado.id, args: msg });
          toast.success("Informação solicitada");
          break;
        case "nota_interna":
          if (!capabilities.canAdicionarNotaInterna) return;
          await notaM.mutateAsync({ chamadoId: chamado.id, args: msg });
          toast.success("Nota interna registrada");
          break;
        case "resolver":
          if (!capabilities.canResolver) return;
          await resolverM.mutateAsync({ chamadoId: chamado.id, args: msg });
          toast.success("Chamado marcado como resolvido");
          break;
      }
      setMsgAtendente("");
    } catch (e) {
      handleMutationError(e, acaoAtendente);
    }
  };

  const confirmarCancelamento = async (motivo: string) => {
    if (!chamado) throw new Error("Sem chamado");
    try {
      await cancelarM.mutateAsync({ chamadoId: chamado.id, args: motivo });
      // Aguarda o item refletir status=cancelado antes de fechar o modal.
      await chamadoQ.refetch();
      toast.success("Chamado cancelado com sucesso.");
      setCancelarOpen(false);
    } catch (e) {
      handleMutationError(e, "cancelar");
      throw e;
    }
  };

  const executarAssumir = async () => {
    if (!chamado) return;
    if (!capabilities.canAssumir || isAssumindo) return;

    let preflight: boolean | null = null;
    let assumeError: unknown = null;

    try {
      setIsAssumindo(true);
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      console.error("[chamados-internos][assumir][request]", {
        chamadoId: chamado.id,
        protocolo: chamado.protocolo,
        status: chamado.status,
        responsavelAtual: chamado.responsavel_atual_profile_id,
        profileId: userId,
        isSuperAdmin,
        acessoGlobal:
          userProfile && typeof userProfile === "object" && "acesso_global" in userProfile
            ? (userProfile as { acesso_global?: boolean | null }).acesso_global ?? null
            : null,
        canOperateFromHook: capacidadeQ.data ?? null,
        session: {
          hasSession: !!session,
          userId: session?.user?.id ?? null,
        },
        sessionError: sessionError
          ? {
              name: sessionError.name,
              message: sessionError.message,
              status: sessionError.status,
            }
          : null,
      });

      if (sessionError) {
        assumeError = sessionError;
        throw sessionError;
      }

      const { data: canOperate, error: canOperateError } = await supabase.rpc(
        "fn_chamado_interno_can_operate",
        { p_chamado_id: chamado.id },
      );
      preflight = canOperate === true;

      console.error("[chamados-internos][assumir][preflight]", {
        canOperate,
        error: canOperateError
          ? {
              code: getErrorField(canOperateError, "code"),
              message: getErrorField(canOperateError, "message"),
              details: getErrorField(canOperateError, "details"),
              hint: getErrorField(canOperateError, "hint"),
              httpStatus: getErrorField(canOperateError, "status"),
            }
          : null,
      });

      if (canOperateError) {
        assumeError = canOperateError;
        throw canOperateError;
      }
      if (canOperate !== true) {
        const error = {
          code: "42501",
          message: "forbidden: fn_chamado_interno_can_operate retornou false",
          details: "preflight_can_operate_false",
        };
        assumeError = error;
        throw error;
      }

      const assumeResult = await supabase.rpc("fn_chamado_interno_assumir", {
        p_chamado_id: chamado.id,
      });

      console.error("[chamados-internos][assumir][response]", {
        data: assumeResult.data ?? null,
        error: assumeResult.error
          ? {
              code: getErrorField(assumeResult.error, "code"),
              message: getErrorField(assumeResult.error, "message"),
              details: getErrorField(assumeResult.error, "details"),
              hint: getErrorField(assumeResult.error, "hint"),
              httpStatus: getErrorField(assumeResult.error, "status"),
            }
          : null,
      });

      if (assumeResult.error) {
        assumeError = assumeResult.error;
        throw assumeResult.error;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.item(chamado.id) }),
        qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.eventos(chamado.id) }),
        qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", chamado.id) }),
        qc.invalidateQueries({ queryKey: ["chamados-internos", "lista"] }),
        qc.invalidateQueries({ queryKey: ["chamados-internos", "fila-atendimento"] }),
      ]);
      await Promise.all([chamadoQ.refetch(), capacidadeQ.refetch()]);
      toast.success("Chamado assumido com sucesso.");
    } catch (e) {
      console.error("[chamados-internos][assumir][response-error]", {
        routeParam: chamadoId,
        chamadoId: chamado?.id,
        protocolo: chamado?.protocolo,
        statusChamado: chamado?.status,
        responsavelAtual: chamado?.responsavel_atual_profile_id,
        preflight,
        error: {
          code: getErrorField(assumeError ?? e, "code"),
          message: getErrorField(assumeError ?? e, "message"),
          details: getErrorField(assumeError ?? e, "details"),
          hint: getErrorField(assumeError ?? e, "hint"),
          httpStatus: getErrorField(assumeError ?? e, "status"),
        },
      });
      toast.error(traduzirErroAssumir(e));
      if (chamado && isRpcForbidden(e)) {
        void qc.invalidateQueries({
          queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", chamado.id),
        });
        void qc.invalidateQueries({
          queryKey: CHAMADOS_INTERNOS_KEYS.item(chamado.id),
        });
      }
    } finally {
      setIsAssumindo(false);
    }
  };

  // -------------------- Ações do solicitante (preservadas) --------------------
  const executarResponderSolicitante = async () => {
    if (!chamado) return;
    const msg = msgSolicitante.trim();
    if (!msg) {
      toast.error("Informe uma mensagem antes de continuar.");
      return;
    }
    try {
      await responderSolicitanteM.mutateAsync({
        chamadoId: chamado.id,
        args: msg,
      });
      toast.success("Resposta enviada");
      setMsgSolicitante("");
    } catch (e) {
      handleMutationError(e, "responder_solicitante");
    }
  };

  const executarConfirmar = async () => {
    if (!chamado) return;
    try {
      await confirmarM.mutateAsync(chamado.id);
      toast.success("Chamado encerrado");
    } catch (e) {
      handleMutationError(e, "confirmar_encerramento");
    }
  };

  const confirmarReabertura = async (motivo: string) => {
    if (!chamado) throw new Error("Sem chamado");
    try {
      await reabrirM.mutateAsync({ chamadoId: chamado.id, args: motivo });
      await chamadoQ.refetch();
      toast.success("Chamado reaberto");
      setReabrirOpen(false);
    } catch (e) {
      handleMutationError(e, "reabrir");
      throw e;
    }
  };

  if (chamadoQ.isLoading) {
    return (
      <MainLayout>
        <div className="p-4 md:p-6 space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!chamado) {
    return (
      <MainLayout>
        <div className="p-4 md:p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Chamado não encontrado ou sem permissão de leitura.
            </AlertDescription>
          </Alert>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => navigate("/chamados-internos")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Voltar
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/chamados-internos")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Meus chamados
          </Button>
          <div className="flex items-center gap-2">
            {capabilities.canAssumir && (
              <Button
                size="sm"
                onClick={executarAssumir}
                disabled={isAssumindo}
                title="Assumir este chamado e tornar-se o responsável pelo atendimento."
              >
                {isAssumindo ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}
                Assumir
              </Button>
            )}
            {capabilities.canCancelar && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setCancelarOpen(true)}
                disabled={cancelarM.isPending}
                data-testid="btn-abrir-cancelar"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}
            {(chamado.status === "resolvido" ||
              chamado.status === "respondido") && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setReabrirOpen(true)}
                  disabled={reabrirM.isPending}
                >
                  <RefreshCw className="mr-2 h-4 w-4" /> Reabrir
                </Button>
                <Button
                  size="sm"
                  onClick={executarConfirmar}
                  disabled={confirmarM.isPending}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" /> Encerrar
                </Button>
              </>
            )}
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-lg">{chamado.titulo}</CardTitle>
                <CardDescription className="mt-1 font-mono text-xs">
                  {chamado.protocolo}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-1">
                <StatusBadge status={chamado.status} />
                <SetorBadge setor={chamado.setor} />
                <PrioridadeBadge prioridade={chamado.prioridade} />
                {chamado.is_critico && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                    <ShieldAlert className="h-3 w-3" /> Crítico
                  </span>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <Meta label="SLA">
              {formatarPrazoRestante(chamado.sla_prazo)}
              {chamado.sla_prazo && (
                <div className="text-[11px] text-muted-foreground">
                  {formatarDataHora(chamado.sla_prazo)}
                </div>
              )}
            </Meta>
            <Meta label="Aberto em">
              {formatarDataHora(chamado.created_at)}
            </Meta>
            <Meta label="Última atualização">
              {formatarDataHora(chamado.updated_at)}
            </Meta>
            <Meta label="Centro de custo">
              {extras?.centro_custo_codigo
                ? `${extras.centro_custo_codigo}${extras.centro_custo_nome ? ` — ${extras.centro_custo_nome}` : ""}`
                : "—"}
            </Meta>
            <Meta label="Solicitante">
              {extras?.solicitante_nome
                ? `por: ${primeiroNome(extras.solicitante_nome)}`
                : "—"}
            </Meta>
            <Meta label="Responsável pelo atendimento">

              {chamado.responsavel_atual_profile_id
                ? chamado.responsavel_atual_profile_id === userId
                  ? "Você"
                  : "Atendente atribuído"
                : "Não atribuído"}
            </Meta>
            <div className="md:col-span-3">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Descrição
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">
                {chamado.descricao}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="timeline">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            {capabilities.showAcoesAtendenteTab && (
              <TabsTrigger value="atendente" data-testid="tab-acoes-atendente">
                Ações do atendente
              </TabsTrigger>
            )}
            {chamado.status === "aguardando_solicitante" && (
              <TabsTrigger value="solicitante">Responder ao setor</TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="timeline" className="mt-3">
            <Card>
              <CardContent className="p-4">
                {eventosQ.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando
                    eventos...
                  </div>
                ) : (eventosQ.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Sem eventos registrados.
                  </p>
                ) : (
                  <ol className="space-y-4">
                    {(eventosQ.data ?? []).map((ev) => {
                      const meta =
                        CHAMADO_INTERNO_EVENTO_META[
                          ev.tipo as ChamadoInternoEventoTipo
                        ];
                      const label = meta?.label ?? ev.tipo;
                      return (
                        <li key={ev.id} className="flex gap-3">
                          <div
                            className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary"
                            aria-hidden
                          />
                          <div className="flex-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-full px-2 py-0.5 font-semibold",
                                  meta?.badgeClasses ??
                                    "bg-muted text-foreground",
                                )}
                              >
                                {label}
                              </span>
                              <span className="text-muted-foreground">
                                {formatarDataHora(ev.created_at)}
                              </span>
                            </div>
                            {ev.mensagem && (
                              <p className="mt-1 whitespace-pre-wrap text-sm">
                                {ev.mensagem}
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {capabilities.showAcoesAtendenteTab && (
            <TabsContent value="atendente" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Ações do atendente
                  </CardTitle>
                  <CardDescription>
                    Escolha o tipo de ação e escreva a mensagem que ficará
                    registrada na timeline.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div
                    className="flex flex-wrap gap-2"
                    data-testid="acoes-atendente-buttons"
                  >
                    {capabilities.canResponder && (
                      <BotaoAcao
                        v="responder"
                        label="Responder"
                        Icon={Send}
                        atual={acaoAtendente}
                        onClick={setAcaoAtendente}
                      />
                    )}
                    {capabilities.canSolicitarInformacao && (
                      <BotaoAcao
                        v="solicitar_informacao"
                        label="Solicitar info"
                        Icon={Info}
                        atual={acaoAtendente}
                        onClick={setAcaoAtendente}
                      />
                    )}
                    {capabilities.canAdicionarNotaInterna && (
                      <BotaoAcao
                        v="nota_interna"
                        label="Nota interna"
                        Icon={MessageSquare}
                        atual={acaoAtendente}
                        onClick={setAcaoAtendente}
                      />
                    )}
                    {capabilities.canResolver && (
                      <BotaoAcao
                        v="resolver"
                        label="Resolver"
                        Icon={Sparkles}
                        atual={acaoAtendente}
                        onClick={setAcaoAtendente}
                      />
                    )}
                  </div>
                  <Textarea
                    value={msgAtendente}
                    onChange={(e) => setMsgAtendente(e.target.value)}
                    rows={5}
                    placeholder="Escreva sua mensagem..."
                  />
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    onClick={executarAtendente}
                    disabled={
                      !msgAtendente.trim() ||
                      responderM.isPending ||
                      solicitarM.isPending ||
                      notaM.isPending ||
                      resolverM.isPending
                    }
                  >
                    {(responderM.isPending ||
                      solicitarM.isPending ||
                      notaM.isPending ||
                      resolverM.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Registrar
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          )}

          {chamado.status === "aguardando_solicitante" && (
            <TabsContent value="solicitante" className="mt-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Responder ao setor
                  </CardTitle>
                  <CardDescription>
                    O setor solicitou informações complementares. Envie sua
                    resposta abaixo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={msgSolicitante}
                    onChange={(e) => setMsgSolicitante(e.target.value)}
                    rows={5}
                    placeholder="Complemente a informação solicitada..."
                  />
                </CardContent>
                <CardFooter className="justify-end">
                  <Button
                    onClick={executarResponderSolicitante}
                    disabled={
                      !msgSolicitante.trim() || responderSolicitanteM.isPending
                    }
                  >
                    {responderSolicitanteM.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Enviar resposta
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <CancelarChamadoDialog
          open={cancelarOpen}
          onOpenChange={setCancelarOpen}
          protocolo={chamado.protocolo}
          titulo={chamado.titulo}
          status={chamado.status}
          isPending={cancelarM.isPending}
          onConfirm={confirmarCancelamento}
        />

        <ReabrirChamadoDialog
          open={reabrirOpen}
          onOpenChange={setReabrirOpen}
          protocolo={chamado.protocolo}
          titulo={chamado.titulo}
          status={chamado.status}
          isPending={reabrirM.isPending}
          onConfirm={confirmarReabertura}
        />
      </div>
    </MainLayout>
  );
};

interface BotaoAcaoProps {
  v: AcaoAtendente;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  atual: AcaoAtendente;
  onClick: (v: AcaoAtendente) => void;
}

const BotaoAcao: React.FC<BotaoAcaoProps> = ({
  v,
  label,
  Icon,
  atual,
  onClick,
}) => (
  <Button
    type="button"
    size="sm"
    variant={atual === v ? "default" : "outline"}
    onClick={() => onClick(v)}
  >
    <Icon className="mr-2 h-4 w-4" />
    {label}
  </Button>
);

const Meta: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <div>
    <div className="text-xs uppercase tracking-wide text-muted-foreground">
      {label}
    </div>
    <div className="mt-1 text-sm">{children}</div>
  </div>
);

export default ChamadoInternoDetalhe;
