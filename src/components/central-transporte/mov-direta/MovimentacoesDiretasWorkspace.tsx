/**
 * CT-4 Fase 3 — painel operacional das Movimentações da Central do Transporte.
 *
 * Composição: resumo + filtros (client-side) + mapa de rotas persistidas +
 * lista de cards sincronizada com o mapa. O wizard da Fase 2 é aberto em modal,
 * sem sair da Central.
 *
 * Leitura única: `fn_ct_mov_direta_listar` (nenhuma RPC paralela, nenhuma
 * chamada à Directions API no carregamento).
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useCtMovDiretas } from "@/hooks/central-transporte/useCtMovDireta";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import {
  contarResumo,
  filtrarMovimentacoes,
  filtroVazio,
  type MovFiltroState,
} from "@/lib/central-transporte/movimentacoesWorkspace";
import MovimentacaoCard from "./MovimentacaoCard";
import MovimentacoesFiltros from "./MovimentacoesFiltros";
import MovimentacoesMapa from "./MovimentacoesMapa";
import CentralTransporteMovimentacaoNova from "@/pages/CentralTransporteMovimentacaoNova";

const hojeIso = (): string => {
  const agora = new Date();
  const utc3 = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return utc3.toISOString().slice(0, 10);
};

const MovimentacoesDiretasWorkspace: React.FC = () => {
  const capabilities = useCentralTransporteCapabilities();
  const { viagens, isLoading, error, refetch } = useCtMovDiretas();
  const [filtros, setFiltros] = useState<MovFiltroState>(filtroVazio);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{ viagemId: string | null } | null>(null);
  const [painelVisivel, setPainelVisivel] = useState(true);
  const cardsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const filtradas = useMemo(() => filtrarMovimentacoes(viagens, filtros), [viagens, filtros]);
  const resumo = useMemo(() => contarResumo(viagens, hojeIso()), [viagens]);

  /** Motoristas do próprio conjunto carregado — nenhuma query adicional. */
  const motoristas = useMemo(() => {
    const m = new Map<string, string>();
    viagens.forEach((v) => {
      if (v.motoristaId) m.set(v.motoristaId, v.motoristaNome ?? "Motorista");
    });
    return Array.from(m.entries()).map(([value, label]) => ({ value, label }));
  }, [viagens]);

  /* A seleção não sobrevive a um filtro que a exclua. */
  useEffect(() => {
    if (selecionadoId && !filtradas.some((v) => v.id === selecionadoId)) {
      setSelecionadoId(null);
    }
  }, [filtradas, selecionadoId]);

  /* Mapa → lista: traz o card selecionado para a área visível, sem brusquidão. */
  useEffect(() => {
    if (!selecionadoId) return;
    cardsRef.current[selecionadoId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selecionadoId]);

  const abrir = (viagemId: string | null) => setWizard({ viagemId });

  const fecharWizard = () => {
    setWizard(null);
    void refetch();
  };

  const semMovimentacoes = !isLoading && !error && viagens.length === 0;

  return (
    <div className="space-y-4" data-testid="ct4-workspace">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Movimentações planejadas sem solicitação, com uma ou várias paradas de entrega.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => refetch()}
            data-testid="ct4-atualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          {capabilities.canCriar && (
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => abrir(null)}
              data-testid="ct4-nova-movimentacao"
            >
              <Plus className="h-3.5 w-3.5" /> Planejar movimentação
            </Button>
          )}
        </div>
      </div>

      {!semMovimentacoes && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="ct4-resumo">
          {[
            { rotulo: "Rascunhos", valor: resumo.rascunhos },
            { rotulo: "Programadas", valor: resumo.programadas },
            { rotulo: "Em trânsito", valor: resumo.emTransito },
            { rotulo: "Concluídas hoje", valor: resumo.concluidasHoje },
          ].map((c) => (
            <div key={c.rotulo} className="rounded-md border bg-card px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{c.rotulo}</p>
              <p className="text-lg font-semibold leading-tight">{c.valor}</p>
            </div>
          ))}
        </div>
      )}

      {!semMovimentacoes && (
        <MovimentacoesFiltros filtros={filtros} onChange={setFiltros} motoristas={motoristas} />
      )}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && error && (
        <Alert variant="destructive" data-testid="ct4-lista-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Não foi possível carregar as movimentações</AlertTitle>
          <AlertDescription className="text-xs">
            {error instanceof Error ? error.message : "Erro inesperado."}
          </AlertDescription>
        </Alert>
      )}

      {semMovimentacoes && (
        <Alert data-testid="ct4-lista-vazia">
          <AlertTitle className="text-xs">Nenhuma movimentação planejada</AlertTitle>
          <AlertDescription className="text-xs">
            Use "Planejar movimentação" para criar a primeira.
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && viagens.length > 0 && (
        <div className="relative h-[320px] md:h-[460px] xl:h-[620px] rounded-md border overflow-hidden">
          <MovimentacoesMapa
            viagens={filtradas}
            selecionadoId={selecionadoId}
            onSelecionar={setSelecionadoId}
          />

          {!painelVisivel && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute left-3 top-3 z-10 h-8 gap-1 text-xs shadow"
              aria-label="Mostrar movimentações"
              onClick={() => setPainelVisivel(true)}
              data-testid="ct4-mostrar-painel"
            >
              <PanelRightOpen className="h-3.5 w-3.5" /> Mostrar movimentações
            </Button>
          )}

          {painelVisivel && (
            <div
              className="absolute bottom-0 left-0 right-0 z-20 flex max-h-[55%] flex-col rounded-t-md border bg-card/95 backdrop-blur-sm shadow-xl md:bottom-3 md:left-auto md:right-3 md:top-3 md:max-h-none md:w-[340px] md:rounded-md"
              data-testid="ct4-painel-movimentacoes"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <h2 className="text-sm font-semibold">Movimentações ({filtradas.length})</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Ocultar painel de movimentações"
                  onClick={() => setPainelVisivel(false)}
                  data-testid="ct4-ocultar-painel"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filtradas.length === 0 && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="ct4-filtro-sem-resultado"
                  >
                    Nenhuma movimentação para os filtros aplicados.
                  </p>
                )}
                {filtradas.map((v) => (
                  <MovimentacaoCard
                    key={v.id}
                    ref={(el) => {
                      cardsRef.current[v.id] = el;
                    }}
                    viagem={v}
                    selecionado={v.id === selecionadoId}
                    onAbrir={() => {
                      setSelecionadoId(v.id);
                      abrir(v.id);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}


      <Dialog open={!!wizard} onOpenChange={(o) => !o && fecharWizard()}>
        {/* Altura fixa e sem scroll do Dialog: header/stepper/footer do wizard ficam sempre visíveis. */}
        <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-[min(1200px,96vw)] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle className="text-sm">
              {wizard?.viagemId ? "Movimentação" : "Planejar movimentação"}
            </DialogTitle>
          </DialogHeader>
          {wizard && (
            <div className="min-h-0 flex-1">
              <CentralTransporteMovimentacaoNova
                embutido
                viagemIdProp={wizard.viagemId}
                onFechar={fecharWizard}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MovimentacoesDiretasWorkspace;
