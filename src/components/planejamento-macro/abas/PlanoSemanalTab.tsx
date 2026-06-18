import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CalendarRange, FileText } from "lucide-react";
import EmptyState from "../shared/EmptyState";
import SeletorSemana from "../plano-semanal/SeletorSemana";
import ResumoSemanaCards from "../plano-semanal/ResumoSemanaCards";
import TabelaAtividadesSemanal from "../plano-semanal/TabelaAtividadesSemanal";
import TabelaMOSemanal from "../plano-semanal/TabelaMOSemanal";
import TabelaEquipamentosSemanal from "../plano-semanal/TabelaEquipamentosSemanal";
import TabelaMateriaisSemanal from "../plano-semanal/TabelaMateriaisSemanal";
import PendenciasSemanaList from "../plano-semanal/PendenciasSemanaList";
import TabIntro from "../shared/TabIntro";
import { useDemandaSemanal } from "@/hooks/planejamentoMacro/useDemandaSemanal";
import { useMaoObraAlocadaNoCC } from "@/hooks/planejamentoMacro/useMaoObraAlocadaNoCC";
import { useEquipamentosDisponiveisNoCC } from "@/hooks/planejamentoMacro/useEquipamentosDisponiveisNoCC";

interface Props {
  planejamentoId: string | null;
  hasPlanejamentoReal: boolean;
  centroCustoId: string | null;
  /** Fase 7B — limites da semana = período do planejamento vigente. */
  planVigenteInicio: string | null;
  planVigenteFim: string | null;
  onPlanejarRecursos?: (atividadeId: string) => void;
  canPlanejarRecursos?: boolean;
}

const PlanoSemanalTab: React.FC<Props> = ({
  planejamentoId,
  hasPlanejamentoReal,
  centroCustoId,
  planVigenteInicio,
  planVigenteFim,
  onPlanejarRecursos,
  canPlanejarRecursos = false,
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
                  Ordem Diária — fase futura. Será habilitada após validação do Plano Semanal.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="text-xs text-muted-foreground">
              Ordem Diária — fase futura.
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
          <TabsContent value="atividades" className="mt-3">
            <TabIntro text="Tarefas do cronograma que cruzam a semana selecionada. A ação 'Recursos' ajusta os recursos planejados da atividade como um todo (não exclusivamente da semana)." />
            <TabelaAtividadesSemanal
              rows={atividadesSemana}
              onPlanejarRecursos={onPlanejarRecursos}
              canPlanejarRecursos={canPlanejarRecursos}
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
    </div>
  );
};

export default PlanoSemanalTab;
