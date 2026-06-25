import React, { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarRange, FileText, AlertTriangle } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import SeletorSemana from "../plano-semanal/SeletorSemana";
import ResumoSemanaCards from "../plano-semanal/ResumoSemanaCards";
import TabelaAtividadesSemanal from "../plano-semanal/TabelaAtividadesSemanal";
import TabelaMOSemanal from "../plano-semanal/TabelaMOSemanal";
import TabelaEquipamentosSemanal from "../plano-semanal/TabelaEquipamentosSemanal";
import TabelaMateriaisSemanal from "../plano-semanal/TabelaMateriaisSemanal";
import PendenciasSemanaList from "../plano-semanal/PendenciasSemanaList";
import TabIntro from "../shared/TabIntro";
import AtualizarAndamentoModal from "../modals/AtualizarAndamentoModal";
import GerarOrdemDiariaModal from "../modals/GerarOrdemDiariaModal";
import { useDemandaSemanal } from "@/hooks/planejamentoMacro/useDemandaSemanal";
import { useMaoObraAlocadaNoCC } from "@/hooks/planejamentoMacro/useMaoObraAlocadaNoCC";
import { useEquipamentosDisponiveisNoCC } from "@/hooks/planejamentoMacro/useEquipamentosDisponiveisNoCC";
import { usePermission } from "@/hooks/usePermission";
import type { AtividadePlanejada, StatusAtividadePlanejada } from "@/types/planejamentoMacro";

interface Props {
  planejamentoId: string | null;
  hasPlanejamentoReal: boolean;
  centroCustoId: string | null;
  planVigenteInicio: string | null;
  planVigenteFim: string | null;
  onPlanejarRecursos?: (atividadeId: string) => void;
  canPlanejarRecursos?: boolean;
  onEditarAtividade?: (atividadeId: string) => void;
  canEditarAtividade?: boolean;
  /** Quando alterado, posiciona o seletor de semana na data informada. */
  semanaAlvoIso?: string | null;
  /** Notifica o pai após consumir o semanaAlvoIso. */
  onSemanaAlvoConsumida?: () => void;
  /** Fase 1C-2A — notifica o pai da semana atualmente selecionada (ISO da segunda-feira). */
  onSemanaSelecionadaChange?: (inicioIso: string) => void;
}

const PlanoSemanalTab: React.FC<Props> = ({
  planejamentoId,
  hasPlanejamentoReal,
  centroCustoId,
  planVigenteInicio,
  planVigenteFim,
  onPlanejarRecursos,
  canPlanejarRecursos = false,
  onEditarAtividade,
  canEditarAtividade = false,
  semanaAlvoIso = null,
  onSemanaAlvoConsumida,
  onSemanaSelecionadaChange,
}) => {
  if (!hasPlanejamentoReal || !planejamentoId) {
    return (
      <div className="border rounded-md bg-card">
        <EmptyState
          icon={<CalendarRange className="h-5 w-5" />}
          title="Nenhuma versão vigente"
          description="Importe um cronograma ou marque uma versão como vigente em 'Ver versões' para abrir o Planejamento Semanal."
        />
      </div>
    );
  }

  const {
    semana,
    semanaAnterior,
    proximaSemana,
    semanaAtual,
    irPara,
    atividadesSemana,
    demandaMO,
    demandaEQ,
    demandaMAT,
    pendencias,
    frentes,
    isLoading,
  } = useDemandaSemanal({
    planejamentoId,
    planInicio: planVigenteInicio,
    planFim: planVigenteFim,
  });

  // Sincroniza com semana alvo enviada pelo pai (ex.: ação "Abrir no Planejamento Semanal").
  const ultimaSemanaAlvoRef = useRef<string | null>(null);
  useEffect(() => {
    if (semanaAlvoIso && semanaAlvoIso !== ultimaSemanaAlvoRef.current) {
      ultimaSemanaAlvoRef.current = semanaAlvoIso;
      irPara(semanaAlvoIso);
      onSemanaAlvoConsumida?.();
    }
  }, [semanaAlvoIso, irPara, onSemanaAlvoConsumida]);

  // Fase 1C-2A — propaga semana ativa para o pai (Saneamento usa como referência).
  useEffect(() => {
    onSemanaSelecionadaChange?.(semana.inicio);
  }, [semana.inicio, onSemanaSelecionadaChange]);

  const moAlocadaQ = useMaoObraAlocadaNoCC({
    centroCustoId,
    semanaInicio: semana.inicio,
    semanaFim: semana.fim,
  });

  const eqDispQ = useEquipamentosDisponiveisNoCC({
    centroCustoId,
    semanaInicio: semana.inicio,
    semanaFim: semana.fim,
  });

  const picoEQ = demandaEQ.reduce((m, l) => (l.picoSemana > m ? l.picoSemana : m), 0);

  // Fase C — Atualização de progresso manual da atividade.
  const { hasActionPermission } = usePermission();
  const canAtualizarAndamento = hasActionPermission(
    "engenharia_planejamento_progresso_manual",
    "editar"
  );
  const canGerarOrdemDiaria = hasActionPermission(
    "engenharia_ordem_diaria_manage",
    "criar"
  );
  const [atividadeEditando, setAtividadeEditando] = useState<AtividadePlanejada | null>(null);
  const [gerarOrdemOpen, setGerarOrdemOpen] = useState(false);
  // Fase 1C — filtro "Somente críticas".
  const [somenteCriticas, setSomenteCriticas] = useState(false);

  const atividadesSemanaFiltradas = useMemo(
    () =>
      somenteCriticas
        ? atividadesSemana.filter((r) => Boolean(r.atividade.is_critica))
        : atividadesSemana,
    [atividadesSemana, somenteCriticas]
  );
  const totalCriticasSemana = useMemo(
    () => atividadesSemana.filter((r) => Boolean(r.atividade.is_critica)).length,
    [atividadesSemana]
  );

  const STATUS_TECNICO_TO_LABEL: Record<string, StatusAtividadePlanejada> = useMemo(
    () => ({
      planejada: "Planejada",
      em_andamento: "Em andamento",
      concluida: "Concluída",
      atrasada: "Atrasada",
      cancelada: "Cancelada",
    }),
    []
  );

  const abrirModalAtividade = (atividadeId: string) => {
    const row = atividadesSemana.find((r) => r.atividade.id === atividadeId);
    if (!row) return;
    const b = row.atividade;
    setAtividadeEditando({
      id: b.id,
      planejamento_id: b.planejamento_id,
      nome: b.nome,
      frente: b.frente_servico ?? "—",
      inicio: b.data_inicio,
      fim: b.data_fim,
      status: STATUS_TECNICO_TO_LABEL[(b.status ?? "").toLowerCase()] ?? "Planejada",
      status_tecnico: b.status,
      codigo_wbs: b.codigo_wbs,
      percentual_concluido_importado: b.percentual_concluido_importado ?? null,
      percentual_manual: b.percentual_manual ?? null,
      percentual_manual_observacao: b.percentual_manual_observacao ?? null,
      percentual_manual_atualizado_em: b.percentual_manual_atualizado_em ?? null,
      fonte_progresso: b.fonte_progresso ?? null,
    });
  };


  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
          <SeletorSemana
            semana={semana}
            onAnterior={semanaAnterior}
            onProxima={proximaSemana}
            onAtual={semanaAtual}
          />
          <div className="flex flex-col items-end gap-1">
            {canGerarOrdemDiaria ? (
              <Button
                variant="default"
                onClick={() => setGerarOrdemOpen(true)}
                disabled={atividadesSemana.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Gerar Ordem Diária
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button disabled variant="default">
                        <FileText className="h-4 w-4 mr-2" />
                        Gerar Ordem Diária
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Sem permissão para gerar Ordem Diária.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <span className="text-xs text-muted-foreground">
              Cria rascunho a partir das tarefas da semana selecionada.
            </span>
          </div>
        </CardContent>
      </Card>

      <ResumoSemanaCards
        totalAtividades={atividadesSemana.length}
        totalFrentes={frentes.length}
        totalFuncoes={demandaMO.length}
        picoEquipamentos={picoEQ}
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground p-6 text-center">Carregando…</p>
      ) : (
        <Tabs defaultValue="atividades">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="atividades">Tarefas da Semana ({atividadesSemana.length})</TabsTrigger>
            <TabsTrigger value="mo">Equipe da Semana ({demandaMO.length})</TabsTrigger>
            <TabsTrigger value="eq">Equipamentos da Semana ({demandaEQ.length})</TabsTrigger>
            <TabsTrigger value="mat">Materiais da Semana ({demandaMAT.length})</TabsTrigger>
            <TabsTrigger value="pend">Pendências da Semana ({pendencias.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="atividades" className="mt-3 space-y-3">
            <TabIntro text="Tarefas do cronograma que cruzam a semana selecionada. A ação 'Recursos' ajusta os recursos planejados da atividade como um todo (não exclusivamente da semana)." />
            <div className="flex flex-wrap items-center justify-between gap-3 border rounded-md px-3 py-2 bg-card">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span>
                  <strong>{totalCriticasSemana}</strong> atividade(s) crítica(s) nesta semana
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="filtro-criticas"
                  checked={somenteCriticas}
                  onCheckedChange={setSomenteCriticas}
                />
                <Label htmlFor="filtro-criticas" className="text-sm cursor-pointer">
                  Somente críticas
                </Label>
              </div>
            </div>
            <TabelaAtividadesSemanal
              rows={atividadesSemanaFiltradas}
              onPlanejarRecursos={onPlanejarRecursos}
              canPlanejarRecursos={canPlanejarRecursos}
              onEditarAtividade={onEditarAtividade}
              canEditarAtividade={canEditarAtividade}
              onAtualizarAndamento={abrirModalAtividade}
              canAtualizarAndamento={canAtualizarAndamento}
            />
          </TabsContent>
          <TabsContent value="mo" className="mt-3">
            <TabIntro text="Equipe necessária na semana, por função, comparada ao que está alocado no Centro de Custo." />
            <TabelaMOSemanal rows={demandaMO} alocadoMap={moAlocadaQ.data ?? null} />
          </TabsContent>
          <TabsContent value="eq" className="mt-3">
            <TabIntro text="Equipamentos necessários na semana, com pico de demanda e disponibilidade no Centro de Custo." />
            <TabelaEquipamentosSemanal rows={demandaEQ} alocadoMap={eqDispQ.data ?? null} />
          </TabsContent>
          <TabsContent value="mat" className="mt-3">
            <TabIntro text="Materiais previstos para a semana, agregados por descrição e unidade." />
            <TabelaMateriaisSemanal rows={demandaMAT} />
          </TabsContent>
          <TabsContent value="pend" className="mt-3">
            <TabIntro text="Pendências de saneamento que impactam o planejamento desta semana." />
            <PendenciasSemanaList pendencias={pendencias} />
          </TabsContent>
        </Tabs>
      )}
      <AtualizarAndamentoModal
        open={!!atividadeEditando}
        onOpenChange={(open) => !open && setAtividadeEditando(null)}
        atividade={atividadeEditando}
      />
      <GerarOrdemDiariaModal
        open={gerarOrdemOpen}
        onOpenChange={setGerarOrdemOpen}
        planejamentoId={planejamentoId}
        centroCustoId={centroCustoId}
        semanaInicio={semana.inicio}
        semanaFim={semana.fim}
        atividadesSemana={atividadesSemana}
        pendencias={pendencias}
      />
    </div>
  );
};

export default PlanoSemanalTab;
