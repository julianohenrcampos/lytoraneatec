import { useState, useCallback, useMemo, useEffect } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import { usePageTitle } from '@/contexts/PageTitleContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Alert, AlertDescription } from '@/components/ui/alert';

import CentralHeader from '@/components/central-aprovacoes/CentralHeader';
import CentralIndicadoresCards from '@/components/central-aprovacoes/CentralIndicadoresCards';
import CentralFiltros from '@/components/central-aprovacoes/CentralFiltros';
import CentralListaDesktop from '@/components/central-aprovacoes/CentralListaDesktop';
import CentralCardsMobile from '@/components/central-aprovacoes/CentralCardsMobile';
import CentralDetalhePanel from '@/components/central-aprovacoes/CentralDetalhePanel';
import CentralEquipamentoDecisionDialog from '@/components/central-aprovacoes/CentralEquipamentoDecisionDialog';
import CentralDesmobilizacaoDecisionDialog from '@/components/central-aprovacoes/CentralDesmobilizacaoDecisionDialog';

import { useCentralAprovacoes } from '@/hooks/useCentralAprovacoes';
import type { CentralApprovalItem, CentralModulo, CentralView } from '@/services/central-aprovacoes/types';
import CentralEquipamentoPostDecisionDialog from '@/components/central-aprovacoes/CentralEquipamentoPostDecisionDialog';

import { useConfiguracaoSistema } from '@/hooks/useConfiguracaoSistema';

import FluxoAprovacaoModal from '@/components/diarias/FluxoAprovacaoModal';
import type { SolicitacaoGestao } from '@/hooks/diarias/useGestaoAprovacoesDiarias';
import {
  useAprovarGerenteAdm, useReprovarGerenteAdm,
  useAprovarDiretorOperacional, useReprovarDiretorOperacional,
  useAprovarDiretorAdm, useReprovarDiretorAdm,
} from '@/hooks/diarias/useFluxoAprovacao';
import { useAssinaturaDigital } from '@/hooks/useAssinaturaDigital';
import { useEtapasExecucao, useAprovarEtapaDinamica, useRejeitarEtapaDinamica } from '@/hooks/useFluxoExecucao';
import type { DiariaSolicitacao } from '@/types/diarias';

function getEtapaForStatus(statusFluxo: string | null): 'gerente_adm' | 'diretor_operacional' | 'diretor_adm' {
  if (statusFluxo === 'aguardando_aprovacao_gerenteadm') return 'gerente_adm';
  if (statusFluxo === 'aguardando_aprovacao_diretor_operacional') return 'diretor_operacional';
  return 'diretor_adm';
}

export default function CentralAprovacoes() {
  usePageTitle('Central de Aprovações');
  const isMobile = useIsMobile();

  const equipamentosConfig = useConfiguracaoSistema('central_aprovacoes_equipamentos_ativo');
  const equipamentosToggle = equipamentosConfig.isSuccess && equipamentosConfig.data === 'true';

  // ── Filtros ──
  const [modulo, setModulo] = useState('todos');
  const [centroCusto, setCentroCusto] = useState('');
  const [status, setStatus] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [busca, setBusca] = useState('');
  const [apenasMinhas, setApenasMinhas] = useState(false);
  const [view, setView] = useState<CentralView>('pendentes');


  const modulosFiltro = useMemo<CentralModulo[] | undefined>(
    () => (modulo === 'todos' ? undefined : [modulo as CentralModulo]),
    [modulo],
  );

  const {
    itens, indicadores, isLoading, isError, refetch,
    centrosCustoOptions, solicitantesOptions, statusOptions,
    moduleStates, hasMore, isLoadingMore, loadMore,
  } = useCentralAprovacoes({
    modulos: modulosFiltro,
    centroCustoId: centroCusto || undefined,
    status: status || undefined,
    solicitanteId: solicitante || undefined,
    apenasMinhas,
    busca: busca || undefined,
    view,
  });


  const moduloOptions = useMemo(() => {
    const base = [
      { value: 'todos', label: 'Todos' },
      { value: 'diarias', label: 'Diárias' },
    ];
    if (equipamentosToggle) base.push({ value: 'equipamentos', label: 'Equipamentos' });
    return base;
  }, [equipamentosToggle]);

  // ── Seleção ──
  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (isLoading || itens.length === 0) return;
    setSelectedId((prev) => {
      if (prev && itens.some((i) => i.id === prev)) return prev;
      return itens[0].id;
    });
  }, [itens, isLoading]);
  const selectedItem = useMemo(
    () => itens.find((i) => i.id === selectedId) ?? null,
    [itens, selectedId],
  );

  // ── Mobile Sheet ──
  const [sheetOpen, setSheetOpen] = useState(false);
  const openMobile = (item: CentralApprovalItem) => { setSelectedId(item.id); setSheetOpen(true); };

  // ── Fluxo Diárias ──
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'aprovar' | 'reprovar'>('view');
  const modalSol = selectedItem?.modulo === 'diarias' ? (selectedItem.raw as SolicitacaoGestao) : null;

  // ── Fluxo Equipamentos ──
  const [equipDecisionOpen, setEquipDecisionOpen] = useState(false);
  const [equipDecisionMode, setEquipDecisionMode] = useState<'aprovar' | 'reprovar'>('aprovar');
  const [equipPosDecOpen, setEquipPosDecOpen] = useState(false);
  const [equipPosDecAcao, setEquipPosDecAcao] = useState<'REVERTER' | 'CANCELAR'>('REVERTER');
  const openEquipPosDec = (acao: 'REVERTER' | 'CANCELAR') => {
    if (!selectedItem || selectedItem.modulo !== 'equipamentos') return;
    setEquipPosDecAcao(acao);
    setEquipPosDecOpen(true);
  };


  // ── Fluxo Desmobilização ──
  const [desmobDecisionOpen, setDesmobDecisionOpen] = useState(false);
  const [desmobDecisionMode, setDesmobDecisionMode] = useState<'aprovar' | 'reprovar'>('aprovar');

  const aprovarGerente = useAprovarGerenteAdm();
  const reprovarGerente = useReprovarGerenteAdm();
  const aprovarDirOp = useAprovarDiretorOperacional();
  const reprovarDirOp = useReprovarDiretorOperacional();
  const aprovarDirAdm = useAprovarDiretorAdm();
  const reprovarDirAdm = useReprovarDiretorAdm();
  const aprovarDinamica = useAprovarEtapaDinamica();
  const rejeitarDinamica = useRejeitarEtapaDinamica();
  const { assinatura, hasAssinatura } = useAssinaturaDigital();

  const isDinamico = modalSol?.motor_aprovacao === 'dinamico';
  const etapasExecQuery = useEtapasExecucao(isDinamico && modalSol ? modalSol.id : null);
  const etapaAtualDinamicaFallback = etapasExecQuery.data?.find((e) => e.pode_aprovar && e.status === 'pendente');
  const etapaExecIdEfetivo =
    selectedItem?.currentStageExecId ?? etapaAtualDinamicaFallback?.id ?? null;

  const openModal = (mode: 'view' | 'aprovar' | 'reprovar') => {
    if (!selectedItem) return;
    setSheetOpen(false);
    if (selectedItem.modulo === 'desmobilizacao') {
      if (mode === 'view') return; // detalhe já inline
      setDesmobDecisionMode(mode);
      setDesmobDecisionOpen(true);
      return;
    }
    if (selectedItem.modulo === 'equipamentos') {
      if (mode === 'view') return; // detalhe já inline
      setEquipDecisionMode(mode);
      setEquipDecisionOpen(true);
      return;
    }
    setModalMode(mode);
    setModalOpen(true);
  };

  const handleAprovar = useCallback(() => {
    if (!modalSol || !selectedItem) return;
    if (!selectedItem.canApprove) { toast.error('Você não pode aprovar esta solicitação.'); return; }
    if (!hasAssinatura || !assinatura) {
      toast.error('Você precisa cadastrar sua assinatura digital antes de aprovar.');
      return;
    }
    if (modalSol.motor_aprovacao === 'dinamico') {
      if (!etapaExecIdEfetivo) { toast.error('Nenhuma etapa disponível para aprovação.'); return; }
      aprovarDinamica.mutate(
        { solicitacaoId: modalSol.id, etapaExecId: etapaExecIdEfetivo },
        { onSuccess: () => { setModalOpen(false); refetch(); } },
      );
      return;
    }
    const data = {
      solicitacao_id: modalSol.id,
      assinatura_png: assinatura.assinatura_url,
      nome_usuario: assinatura.nome_completo,
      cargo: assinatura.cargo || '',
      cpf: assinatura.cpf,
    };
    const etapa = getEtapaForStatus(modalSol.status_fluxo);
    const opts = { onSuccess: () => { setModalOpen(false); refetch(); } };
    if (etapa === 'gerente_adm') aprovarGerente.mutate(data, opts);
    else if (etapa === 'diretor_operacional') aprovarDirOp.mutate(data, opts);
    else aprovarDirAdm.mutate(data, opts);
  }, [modalSol, selectedItem, hasAssinatura, assinatura, etapaExecIdEfetivo, aprovarDinamica, aprovarGerente, aprovarDirOp, aprovarDirAdm, refetch]);

  const handleReprovar = useCallback((observacao?: string) => {
    if (!modalSol || !selectedItem) return;
    if (!selectedItem.canReject) { toast.error('Você não pode reprovar esta solicitação.'); return; }
    if (modalSol.motor_aprovacao === 'dinamico') {
      if (!etapaExecIdEfetivo) { toast.error('Nenhuma etapa disponível para rejeição.'); return; }
      rejeitarDinamica.mutate(
        { solicitacaoId: modalSol.id, etapaExecId: etapaExecIdEfetivo, observacao },
        { onSuccess: () => { setModalOpen(false); refetch(); } },
      );
      return;
    }
    const etapa = getEtapaForStatus(modalSol.status_fluxo);
    const payload = { solicitacaoId: modalSol.id, observacao };
    const opts = { onSuccess: () => { setModalOpen(false); refetch(); } };
    if (etapa === 'gerente_adm') reprovarGerente.mutate(payload, opts);
    else if (etapa === 'diretor_operacional') reprovarDirOp.mutate(payload, opts);
    else reprovarDirAdm.mutate(payload, opts);
  }, [modalSol, selectedItem, etapaExecIdEfetivo, rejeitarDinamica, reprovarGerente, reprovarDirOp, reprovarDirAdm, refetch]);

  const handleEquipDecisionSuccess = useCallback(() => {
    moduleStates.equipamentos?.refetch();
    // Avança para o próximo item disponível
    setSelectedId((prev) => {
      if (!prev) return prev;
      const idx = itens.findIndex((i) => i.id === prev);
      const next = itens.find((i, k) => k !== idx && i.id !== prev);
      return next?.id ?? null;
    });
  }, [moduleStates.equipamentos, itens]);

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

  const hasFilters = !!(modulo !== 'todos' || centroCusto || status || solicitante || busca || apenasMinhas);
  const clearFilters = () => {
    setModulo('todos'); setCentroCusto(''); setStatus(''); setSolicitante(''); setBusca(''); setApenasMinhas(false);
  };

  const ListaSkeleton = (
    <div className="p-4 space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );

  const partialErrors = Object.entries(moduleStates).filter(([, s]) => s?.enabled && s.isError);

  return (
    <MainLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-[1500px] mx-auto px-4 md:px-8 py-6 space-y-6">
          <CentralHeader
            onRefresh={refetch}
            onClearFilters={hasFilters ? clearFilters : undefined}
            hasFilters={hasFilters}
            isRefreshing={isLoading}
          />

          <CentralIndicadoresCards indicadores={indicadores} isLoading={isLoading} />

          <CentralFiltros
            modulo={modulo} setModulo={setModulo} moduloOptions={moduloOptions}
            centroCusto={centroCusto} setCentroCusto={setCentroCusto}
            centrosCustoOptions={centrosCustoOptions}
            status={status} setStatus={setStatus}
            statusOptions={statusOptions}
            solicitante={solicitante} setSolicitante={setSolicitante}
            solicitantesOptions={solicitantesOptions}
            apenasMinhas={apenasMinhas} setApenasMinhas={setApenasMinhas}
            busca={busca} setBusca={setBusca}
            view={view} setView={setView}
          />


          {partialErrors.length > 0 && !isError && (
            <div className="space-y-2">
              {partialErrors.map(([key, s]) => (
                <Alert key={key} variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between gap-2">
                    <span>Não foi possível carregar {key === 'diarias' ? 'Diárias' : 'Equipamentos'}.</span>
                    <Button size="sm" variant="outline" onClick={s?.refetch}>
                      Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

          {isError ? (
            <Card className="rounded-2xl shadow-sm">
              <CardContent className="flex flex-col items-center py-16 text-center gap-3">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="font-medium">Erro ao carregar dados</p>
                <Button variant="outline" size="sm" className="gap-2" onClick={refetch}>
                  <RefreshCw className="h-4 w-4" /> Tentar novamente
                </Button>
              </CardContent>
            </Card>
          ) : isMobile ? (
            <>
              {isLoading ? (
                <Card className="rounded-2xl">{ListaSkeleton}</Card>
              ) : itens.length === 0 ? (
                <Card className="rounded-2xl"><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhuma solicitação encontrada.</CardContent></Card>
              ) : (
                <>
                  <CentralCardsMobile itens={itens} onSelect={openMobile} />
                  {hasMore && (
                    <div className="pt-2 flex justify-center">
                      <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
                        {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                        Carregar mais solicitações de Equipamentos
                      </Button>
                    </div>
                  )}
                </>
              )}
              <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
                <SheetContent side="bottom" className="h-[92vh] overflow-y-auto">
                  <SheetHeader><SheetTitle>Detalhes</SheetTitle></SheetHeader>
                  <div className="mt-4">
                    <CentralDetalhePanel
                      item={selectedItem}
                      onVer={() => openModal('view')}
                      onAprovar={() => openModal('aprovar')}
                      onReprovar={() => openModal('reprovar')}
                      onReverter={() => openEquipPosDec('REVERTER')}
                      onCancelar={() => openEquipPosDec('CANCELAR')}
                    />

                  </div>
                </SheetContent>
              </Sheet>
            </>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_420px] gap-4">
              <Card className="rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? ListaSkeleton
                  : itens.length === 0
                    ? <div className="py-16 text-center text-sm text-muted-foreground">Nenhuma solicitação encontrada.</div>
                    : (
                      <>
                        <CentralListaDesktop itens={itens} selectedId={selectedId} onSelect={(i) => setSelectedId(i.id)} />
                        {hasMore && (
                          <div className="p-3 border-t flex justify-center">
                            <Button variant="outline" size="sm" onClick={loadMore} disabled={isLoadingMore}>
                              {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                              Carregar mais solicitações de Equipamentos
                            </Button>
                          </div>
                        )}
                      </>
                    )}
              </Card>
              <div>
                <CentralDetalhePanel
                  item={selectedItem}
                  onVer={() => openModal('view')}
                  onAprovar={() => openModal('aprovar')}
                  onReprovar={() => openModal('reprovar')}
                  onReverter={() => openEquipPosDec('REVERTER')}
                  onCancelar={() => openEquipPosDec('CANCELAR')}
                />

              </div>
            </div>
          )}
        </div>

        <FluxoAprovacaoModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          solicitacao={modalSolAsCompleta}
          etapa={modalSol ? getEtapaForStatus(modalSol.status_fluxo) : 'gerente_adm'}
          onAprovar={handleAprovar}
          onReprovar={handleReprovar}
          isLoading={isMutating}
        />

        <CentralDesmobilizacaoDecisionDialog
          open={desmobDecisionOpen}
          onOpenChange={setDesmobDecisionOpen}
          item={selectedItem?.modulo === 'desmobilizacao' ? selectedItem : null}
          mode={desmobDecisionMode}
          onSuccess={() => moduleStates.desmobilizacao?.refetch()}
        />

        <CentralEquipamentoDecisionDialog
          open={equipDecisionOpen}
          onOpenChange={setEquipDecisionOpen}
          item={selectedItem?.modulo === 'equipamentos' ? selectedItem : null}
          mode={equipDecisionMode}
          onSuccess={handleEquipDecisionSuccess}
        />

        <CentralEquipamentoPostDecisionDialog
          open={equipPosDecOpen}
          onOpenChange={setEquipPosDecOpen}
          item={selectedItem?.modulo === 'equipamentos' ? selectedItem : null}
          acao={equipPosDecAcao}
          onSuccess={handleEquipDecisionSuccess}
        />
      </div>

    </MainLayout>
  );
}
