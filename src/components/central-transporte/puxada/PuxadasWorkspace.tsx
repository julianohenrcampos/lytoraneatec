/**
 * CT-5 — painel operacional das Puxadas da Central do Transporte.
 *
 * Mesma composição já madura das Movimentações: resumo + filtros client-side +
 * mapa em tela cheia do card com a lista flutuando por cima + wizard em modal.
 *
 * Leitura única: `fn_ct_puxada_listar` (nenhuma RPC paralela, nenhuma chamada
 * à Directions API no carregamento).
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
import { useCtPuxadas } from "@/hooks/central-transporte/useCtPuxada";
import useCentralTransporteCapabilities from "@/hooks/central-transporte/useCentralTransporteCapabilities";
import {
  contarResumoPuxadas,
  filtrarPuxadas,
  filtroPuxadaVazio,
  type PuxadaFiltroState,
} from "@/lib/central-transporte/puxadasWorkspace";
import PuxadaCard from "./PuxadaCard";
import PuxadasFiltros from "./PuxadasFiltros";
import PuxadasMapa from "./PuxadasMapa";
import PuxadaWizard from "./PuxadaWizard";

const hojeIso = (): string => {
  const agora = new Date();
  const utc3 = new Date(agora.getTime() - 3 * 60 * 60 * 1000);
  return utc3.toISOString().slice(0, 10);
};

const PuxadasWorkspace: React.FC = () => {
  const capabilities = useCentralTransporteCapabilities();
  const { puxadas, isLoading, error, refetch } = useCtPuxadas();
  const [filtros, setFiltros] = useState<PuxadaFiltroState>(filtroPuxadaVazio);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{ puxadaId: string | null } | null>(null);
  const [painelVisivel, setPainelVisivel] = useState(true);
  const cardsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const filtradas = useMemo(() => filtrarPuxadas(puxadas, filtros), [puxadas, filtros]);
  const resumo = useMemo(() => contarResumoPuxadas(puxadas, hojeIso()), [puxadas]);

  /** Centros de custo do próprio conjunto carregado — nenhuma query adicional. */
  const centrosCusto = useMemo(() => {
    const m = new Map<string, string>();
    puxadas.forEach((p) => {
      if (p.centroCustoId) {
        m.set(
          p.centroCustoId,
          [p.ccCodigo, p.ccNome].filter(Boolean).join(" — ") || "Centro de custo",
        );
      }
    });
    return Array.from(m.entries()).map(([value, label]) => ({ value, label }));
  }, [puxadas]);

  useEffect(() => {
    if (selecionadoId && !filtradas.some((p) => p.id === selecionadoId)) {
      setSelecionadoId(null);
    }
  }, [filtradas, selecionadoId]);

  useEffect(() => {
    if (!selecionadoId) return;
    cardsRef.current[selecionadoId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selecionadoId]);

  const fecharWizard = () => {
    setWizard(null);
    void refetch();
  };

  const semPuxadas = !isLoading && !error && puxadas.length === 0;

  return (
    <div className="space-y-4" data-testid="ct5-workspace">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Puxadas de material: N caminhões com N motoristas, de um ponto de coleta a um ponto de
          descarga.
        </p>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs"
            onClick={() => refetch()}
            data-testid="ct5-atualizar"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Atualizar
          </Button>
          {capabilities.canCriar && (
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setWizard({ puxadaId: null })}
              data-testid="ct5-nova-puxada"
            >
              <Plus className="h-3.5 w-3.5" /> Planejar puxada
            </Button>
          )}
        </div>
      </div>

      {!semPuxadas && (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4" data-testid="ct5-resumo">
          {[
            { rotulo: "Rascunhos", valor: resumo.rascunhos },
            { rotulo: "Programadas", valor: resumo.programadas },
            { rotulo: "Em execução", valor: resumo.emExecucao },
            { rotulo: "Caminhões hoje", valor: resumo.caminhoesHoje },
          ].map((c) => (
            <div key={c.rotulo} className="rounded-md border bg-card px-3 py-2">
              <p className="text-[11px] text-muted-foreground">{c.rotulo}</p>
              <p className="text-lg font-semibold leading-tight">{c.valor}</p>
            </div>
          ))}
        </div>
      )}

      {!semPuxadas && (
        <PuxadasFiltros filtros={filtros} onChange={setFiltros} centrosCusto={centrosCusto} />
      )}

      {isLoading && <Skeleton className="h-64 w-full" />}

      {!isLoading && error && (
        <Alert variant="destructive" data-testid="ct5-lista-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Não foi possível carregar as puxadas</AlertTitle>
          <AlertDescription className="text-xs">
            {error instanceof Error ? error.message : "Erro inesperado."}
          </AlertDescription>
        </Alert>
      )}

      {semPuxadas && (
        <Alert data-testid="ct5-lista-vazia">
          <AlertTitle className="text-xs">Nenhuma puxada planejada</AlertTitle>
          <AlertDescription className="text-xs">
            Use "Planejar puxada" para criar a primeira.
          </AlertDescription>
        </Alert>
      )}

      {!isLoading && !error && puxadas.length > 0 && (
        <div className="relative h-[320px] overflow-hidden rounded-md border md:h-[460px] xl:h-[620px]">
          <PuxadasMapa
            puxadas={filtradas}
            selecionadoId={selecionadoId}
            onSelecionar={setSelecionadoId}
          />

          {!painelVisivel && (
            <Button
              size="sm"
              variant="secondary"
              className="absolute left-3 top-3 z-10 h-8 gap-1 text-xs shadow"
              aria-label="Mostrar puxadas"
              onClick={() => setPainelVisivel(true)}
              data-testid="ct5-mostrar-painel"
            >
              <PanelRightOpen className="h-3.5 w-3.5" /> Mostrar puxadas
            </Button>
          )}

          {painelVisivel && (
            <div
              className="absolute bottom-0 left-0 right-0 z-20 flex max-h-[55%] flex-col rounded-t-md border bg-card/95 shadow-xl backdrop-blur-sm md:bottom-3 md:left-auto md:right-3 md:top-3 md:max-h-none md:w-[340px] md:rounded-md"
              data-testid="ct5-painel-puxadas"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2">
                <h2 className="text-sm font-semibold">Puxadas ({filtradas.length})</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Ocultar painel de puxadas"
                  onClick={() => setPainelVisivel(false)}
                  data-testid="ct5-ocultar-painel"
                >
                  <PanelRightClose className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {filtradas.length === 0 && (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="ct5-filtro-sem-resultado"
                  >
                    Nenhuma puxada para os filtros aplicados.
                  </p>
                )}
                {filtradas.map((p) => (
                  <PuxadaCard
                    key={p.id}
                    ref={(el) => {
                      cardsRef.current[p.id] = el;
                    }}
                    puxada={p}
                    selecionado={p.id === selecionadoId}
                    onAbrir={() => {
                      setSelecionadoId(p.id);
                      setWizard({ puxadaId: p.id });
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog open={!!wizard} onOpenChange={(o) => !o && fecharWizard()}>
        {/* Altura fixa e sem scroll do Dialog: header/stepper/footer sempre visíveis. */}
        <DialogContent className="flex h-[92vh] max-h-[92vh] max-w-[min(1200px,96vw)] flex-col overflow-hidden p-0">
          <DialogHeader className="shrink-0 border-b px-4 py-3">
            <DialogTitle className="text-sm">
              {wizard?.puxadaId ? "Puxada" : "Planejar puxada"}
            </DialogTitle>
          </DialogHeader>
          {wizard && (
            <div className="min-h-0 flex-1">
              <PuxadaWizard puxadaId={wizard.puxadaId} onFechar={fecharWizard} />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PuxadasWorkspace;
