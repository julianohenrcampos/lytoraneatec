import { useState, useCallback } from "react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import MainLayout from "@/components/layout/MainLayout";
import { RefreshCw, X, Clock, FileCheck, Shield, CheckCircle2, CalendarIcon, Filter, FileText, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGestaoAprovacoesDiarias, type SolicitacaoGestao, type GestaoAprovacoesFiltros } from "@/hooks/diarias/useGestaoAprovacoesDiarias";
import GestaoAprovacoesTabelaDesktop from "@/components/diarias/gestao-aprovacoes/GestaoAprovacoesTabelaDesktop";
import GestaoAprovacoesMobileCards from "@/components/diarias/gestao-aprovacoes/GestaoAprovacoesMobileCards";
import FluxoAprovacaoModal from "@/components/diarias/FluxoAprovacaoModal";
import {
  useAprovarGerenteAdm,
  useReprovarGerenteAdm,
  useAprovarDiretorOperacional,
  useReprovarDiretorOperacional,
  useAprovarDiretorAdm,
  useReprovarDiretorAdm,
} from "@/hooks/diarias/useFluxoAprovacao";
import { useAssinaturaDigital } from "@/hooks/useAssinaturaDigital";
import { useEtapasExecucao, useAprovarEtapaDinamica, useRejeitarEtapaDinamica } from "@/hooks/useFluxoExecucao";
import type { DiariaSolicitacao } from "@/types/diarias";

const statusOptions = [
  { value: "aguardando_aprovacao_gerenteadm", label: "Aguardando Gerente ADM" },
  { value: "aguardando_aprovacao_diretor_operacional", label: "Aguardando Diretor Operacional" },
  { value: "aguardando_aprovacao_diretor_adm", label: "Aguardando Diretor ADM" },
  { value: "ajuste_solicitado_adm", label: "Ajuste Solicitado" },
  { value: "finalizado", label: "Finalizado" },
];

const tipoEnvioOptions = [
  { value: "normal", label: "Normal" },
  { value: "remessa", label: "Remessa" },
];

function getEtapaForStatus(statusFluxo: string | null): 'gerente_adm' | 'diretor_operacional' | 'diretor_adm' {
  if (statusFluxo === 'aguardando_aprovacao_gerenteadm') return 'gerente_adm';
  if (statusFluxo === 'aguardando_aprovacao_diretor_operacional') return 'diretor_operacional';
  return 'diretor_adm';
}

// ── Skeleton Components ──

function KpiSkeleton() {
  return (
    <Card className="border-l-4 border-l-muted rounded-2xl shadow-sm">
      <CardContent className="p-6 flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-12 w-12 rounded-xl" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="p-6 space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-40 flex-1" />
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

function MobileSkeleton() {
  return (
    <div className="p-4 space-y-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="rounded-2xl shadow-sm">
          <div className="p-5 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-5 w-28 rounded-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <div className="border-t border-border px-5 py-3 flex gap-2">
            <Skeleton className="h-11 flex-1 rounded-md" />
            <Skeleton className="h-11 flex-1 rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Main Page ──

export default function GestaoAprovacoesDiarias() {
  usePageTitle("Gestão de Aprovações de Diárias");
  const isMobile = useIsMobile();
  const [centroCusto, setCentroCusto] = useState("");
  const [status, setStatus] = useState("");
  const [tipoEnvio, setTipoEnvio] = useState("");
  const [solicitante, setSolicitante] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalSol, setModalSol] = useState<SolicitacaoGestao | null>(null);
  const [modalMode, setModalMode] = useState<'view' | 'aprovar' | 'reprovar'>('view');

  const filtros: GestaoAprovacoesFiltros = {
    centro_custo_id: centroCusto || undefined,
    status_fluxo: status || undefined,
    tipo_envio: tipoEnvio || undefined,
    solicitante_id: solicitante || undefined,
    periodo_inicio: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd') : undefined,
    periodo_fim: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd') : undefined,
  };

  const {
    solicitacoes,
    kpis,
    isLoading,
    isError,
    refetch,
    userFluxoRole,
    centrosCustoOptions,
    solicitantesOptions,
  } = useGestaoAprovacoesDiarias(filtros);

  // Mutations
  const aprovarGerente = useAprovarGerenteAdm();
  const reprovarGerente = useReprovarGerenteAdm();
  const aprovarDirOp = useAprovarDiretorOperacional();
  const reprovarDirOp = useReprovarDiretorOperacional();
  const aprovarDirAdm = useAprovarDiretorAdm();
  const reprovarDirAdm = useReprovarDiretorAdm();

  // Assinatura digital
  const { assinatura, hasAssinatura } = useAssinaturaDigital();

  // Dynamic flow mutations
  const aprovarDinamica = useAprovarEtapaDinamica();
  const rejeitarDinamica = useRejeitarEtapaDinamica();

  // Fetch dynamic execution steps when modal is open and solicitação is dynamic
  const isDinamico = modalSol?.motor_aprovacao === 'dinamico';
  const etapasExecQuery = useEtapasExecucao(isDinamico ? modalSol?.id ?? null : null);
  const etapaAtualDinamica = etapasExecQuery.data?.find(e => e.pode_aprovar && e.status === 'pendente');

  const handleClearFilters = () => {
    setCentroCusto("");
    setStatus("");
    setTipoEnvio("");
    setSolicitante("");
    setDateRange(undefined);
  };

  const hasFilters = centroCusto || status || tipoEnvio || solicitante || dateRange?.from;

  const openModal = useCallback((sol: SolicitacaoGestao, mode: 'view' | 'aprovar' | 'reprovar') => {
    setModalSol(sol);
    setModalMode(mode);
    setModalOpen(true);
  }, []);

  const handleAprovar = useCallback(() => {
    if (!modalSol) return;

    if (!hasAssinatura || !assinatura) {
      toast.error('Você precisa cadastrar sua assinatura digital antes de aprovar. Acesse pelo menu do usuário → Assinatura Digital.');
      return;
    }

    // Dynamic flow
    if (modalSol.motor_aprovacao === 'dinamico') {
      if (!etapaAtualDinamica) {
        toast.error('Nenhuma etapa disponível para aprovação neste momento.');
        return;
      }
      aprovarDinamica.mutate(
        { solicitacaoId: modalSol.id, etapaExecId: etapaAtualDinamica.id },
        { onSuccess: () => { setModalOpen(false); refetch(); } }
      );
      return;
    }

    // Legacy flow
    const data = {
      solicitacao_id: modalSol.id,
      assinatura_png: assinatura.assinatura_url,
      nome_usuario: assinatura.nome_completo,
      cargo: assinatura.cargo || '',
      cpf: assinatura.cpf,
    };

    const etapa = getEtapaForStatus(modalSol.status_fluxo);
    if (etapa === 'gerente_adm') aprovarGerente.mutate(data, { onSuccess: () => { setModalOpen(false); refetch(); } });
    else if (etapa === 'diretor_operacional') aprovarDirOp.mutate(data, { onSuccess: () => { setModalOpen(false); refetch(); } });
    else aprovarDirAdm.mutate(data, { onSuccess: () => { setModalOpen(false); refetch(); } });
  }, [modalSol, aprovarGerente, aprovarDirOp, aprovarDirAdm, refetch, hasAssinatura, assinatura, aprovarDinamica, etapaAtualDinamica]);

  const handleReprovar = useCallback((observacao?: string) => {
    if (!modalSol) return;

    // Dynamic flow
    if (modalSol.motor_aprovacao === 'dinamico') {
      if (!etapaAtualDinamica) {
        toast.error('Nenhuma etapa disponível para rejeição neste momento.');
        return;
      }
      rejeitarDinamica.mutate(
        { solicitacaoId: modalSol.id, etapaExecId: etapaAtualDinamica.id, observacao },
        { onSuccess: () => { setModalOpen(false); refetch(); } }
      );
      return;
    }

    // Legacy flow
    const etapa = getEtapaForStatus(modalSol.status_fluxo);
    const payload = { solicitacaoId: modalSol.id, observacao };

    if (etapa === 'gerente_adm') reprovarGerente.mutate(payload, { onSuccess: () => { setModalOpen(false); refetch(); } });
    else if (etapa === 'diretor_operacional') reprovarDirOp.mutate(payload, { onSuccess: () => { setModalOpen(false); refetch(); } });
    else reprovarDirAdm.mutate(payload, { onSuccess: () => { setModalOpen(false); refetch(); } });
  }, [modalSol, reprovarGerente, reprovarDirOp, reprovarDirAdm, refetch, rejeitarDinamica, etapaAtualDinamica]);

  const isMutating = aprovarGerente.isPending || reprovarGerente.isPending
    || aprovarDirOp.isPending || reprovarDirOp.isPending
    || aprovarDirAdm.isPending || reprovarDirAdm.isPending
    || aprovarDinamica.isPending || rejeitarDinamica.isPending;

  const modalSolAsCompleta: DiariaSolicitacao | null = modalSol ? {
    ...modalSol,
    justificativa: '',
    considera_fds_feriado: false,
    qtde_dias_uteis_estimado: 0,
    qtde_fds_estimado: 0,
    qtde_feriados_estimado: 0,
    valor_estimado_total: modalSol.valor_estimado_total || 0,
    status: modalSol.status as any,
    responsavel_campo_id: null,
    engenheiro_solicitante_id: null,
    data_inicio_semana: (modalSol as any).data_inicio_semana || null,
    data_fim_semana: (modalSol as any).data_fim_semana || null,
    tipo_solicitacao: (modalSol as any).tipo_solicitacao || 'normal',
    flag_extraordinaria: (modalSol as any).flag_extraordinaria || false,
    justificativa_extraordinaria: (modalSol as any).justificativa_extraordinaria || null,
    observacao_gerente: null,
    autorizado_por: null,
    autorizado_em: null,
    created_at: '',
    updated_at: modalSol.updated_at || '',
    bd_centros_custo: modalSol.bd_centros_custo || undefined,
    profiles: modalSol.profiles ? { ...modalSol.profiles, email: '' } : undefined,
  } : null;

  const kpiCards = [
    {
      label: "Aguardando Gerente ADM",
      value: kpis.aguardando_gerenteadm,
      icon: Clock,
      borderColor: "border-l-amber-500",
      iconColor: "text-amber-500",
      bgIcon: "bg-amber-50",
    },
    {
      label: "Aguardando Dir. Operacional",
      value: kpis.aguardando_diretor_operacional,
      icon: FileCheck,
      borderColor: "border-l-blue-500",
      iconColor: "text-blue-500",
      bgIcon: "bg-blue-50",
    },
    {
      label: "Aguardando Dir. ADM",
      value: kpis.aguardando_diretor_adm,
      icon: Shield,
      borderColor: "border-l-purple-500",
      iconColor: "text-purple-500",
      bgIcon: "bg-purple-50",
    },
    {
      label: "Finalizadas",
      value: kpis.finalizadas,
      icon: CheckCircle2,
      borderColor: "border-l-green-500",
      iconColor: "text-green-500",
      bgIcon: "bg-green-50",
    },
  ];

  return (
    <MainLayout>
    <div className="min-h-screen bg-background">
      <div className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div></div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            {hasFilters && (
              <Button variant="outline" size="sm" className="gap-2" onClick={handleClearFilters}>
                <X className="h-4 w-4" />
                Limpar filtros
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
          ) : (
            kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <Card
                  key={kpi.label}
                  className={cn(
                    "border-l-4 rounded-2xl shadow-sm hover:shadow-md hover:scale-[1.02] transition-all duration-200 cursor-default",
                    kpi.borderColor
                  )}
                >
                  <CardContent className="p-4 sm:p-6 flex items-center justify-between">
                    <div>
                      <p className="text-2xl sm:text-3xl font-bold text-foreground">{kpi.value}</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mt-1">{kpi.label}</p>
                    </div>
                    <div className={cn("p-2 sm:p-3 rounded-xl", kpi.bgIcon)}>
                      <Icon className={cn("h-5 w-5 sm:h-6 sm:w-6", kpi.iconColor)} />
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Filtros */}
        <Card className="rounded-2xl shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Filtros</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Centro de Custo</label>
                <Combobox
                  options={centrosCustoOptions}
                  value={centroCusto}
                  onChange={setCentroCusto}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar centro de custo..."
                  emptyText="Nenhum centro encontrado"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Status</label>
                <Combobox
                  options={statusOptions}
                  value={status}
                  onChange={setStatus}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar status..."
                  emptyText="Nenhum status encontrado"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Tipo de Envio</label>
                <Combobox
                  options={tipoEnvioOptions}
                  value={tipoEnvio}
                  onChange={setTipoEnvio}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar tipo..."
                  emptyText="Nenhum tipo encontrado"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Solicitante</label>
                <Combobox
                  options={solicitantesOptions}
                  value={solicitante}
                  onChange={setSolicitante}
                  placeholder="Selecione..."
                  searchPlaceholder="Buscar solicitante..."
                  emptyText="Nenhum solicitante encontrado"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Período</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !dateRange?.from && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "dd/MM/yy", { locale: ptBR })}
                            {" - "}
                            {format(dateRange.to, "dd/MM/yy", { locale: ptBR })}
                          </>
                        ) : (
                          format(dateRange.from, "dd/MM/yyyy", { locale: ptBR })
                        )
                      ) : (
                        <span>Selecione...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={isMobile ? 1 : 2}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {hasFilters && (
              <div className="flex justify-end pt-2">
                <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={handleClearFilters}>
                  <X className="h-3.5 w-3.5" />
                  Limpar todos os filtros
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabela / Cards */}
        <Card className="rounded-2xl shadow-sm overflow-hidden">
          {isLoading ? (
            isMobile ? <MobileSkeleton /> : <TableSkeleton />
          ) : isError ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="p-4 rounded-full bg-destructive/10 mb-4">
                <AlertTriangle className="h-8 w-8 text-destructive" />
              </div>
              <p className="text-base font-medium text-foreground">Erro ao carregar dados</p>
              <p className="text-sm text-muted-foreground mt-1">Não foi possível buscar as solicitações.</p>
              <Button variant="outline" size="sm" className="mt-4 gap-2" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          ) : isMobile ? (
            <GestaoAprovacoesMobileCards
              solicitacoes={solicitacoes}
              userFluxoRole={userFluxoRole}
              onVerDetalhes={(sol) => openModal(sol, 'view')}
              onAprovar={(sol) => openModal(sol, 'aprovar')}
              onReprovar={(sol) => openModal(sol, 'reprovar')}
            />
          ) : (
            <GestaoAprovacoesTabelaDesktop
              solicitacoes={solicitacoes}
              userFluxoRole={userFluxoRole}
              onVerDetalhes={(sol) => openModal(sol, 'view')}
              onAprovar={(sol) => openModal(sol, 'aprovar')}
              onReprovar={(sol) => openModal(sol, 'reprovar')}
            />
          )}
        </Card>
      </div>

      {/* Modal */}
      <FluxoAprovacaoModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        solicitacao={modalSolAsCompleta}
        etapa={modalSol ? getEtapaForStatus(modalSol.status_fluxo) : 'gerente_adm'}
        onAprovar={handleAprovar}
        onReprovar={handleReprovar}
        isLoading={isMutating}
      />
    </div>
    </MainLayout>
  );
}
