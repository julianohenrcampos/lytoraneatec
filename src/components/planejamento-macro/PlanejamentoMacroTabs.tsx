import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import VisaoGeralTab from "./abas/VisaoGeralTab";
import PlanoSemanalTab from "./abas/PlanoSemanalTab";
import AtividadesTab from "./abas/AtividadesTab";
import MaoObraTab from "./abas/MaoObraTab";
import EquipamentosTab from "./abas/EquipamentosTab";
import MateriaisTab from "./abas/MateriaisTab";
import PendenciasTab from "./abas/PendenciasTab";
import OrdemDiariaTab from "./abas/OrdemDiariaTab";
import EmptyState from "./shared/EmptyState";
import TabIntro from "./shared/TabIntro";
import type { AtividadePlanejada } from "@/types/planejamentoMacro";
import { MapPin } from "lucide-react";

interface Props {
  centroCustoId: string | null;
  dataInicio: string;
  dataFim: string;
  onDataInicioChange: (v: string) => void;
  onDataFimChange: (v: string) => void;
  atividades?: AtividadePlanejada[];
  hasPlanejamentoReal: boolean;
  planejamentoId?: string | null;
  isSuperAdmin?: boolean;
  planejamentoStatus?: "rascunho" | "vigente" | "arquivado" | null;
  planVigenteInicio?: string | null;
  planVigenteFim?: string | null;
  onEditarAtividade?: (id: string) => void;
  onPlanejarRecursos?: (id: string) => void;
  onAbrirNaSemana?: (atividadeId: string, dataInicioIso: string | null) => void;
  tabAtiva?: string;
  onTabChange?: (tab: string) => void;
  semanaAlvoIso?: string | null;
  onSemanaAlvoConsumida?: () => void;
  ccLabel?: string | null;
  // Fase 1C-2A — rastreabilidade do Saneamento
  semanaSelecionadaIso?: string | null;
  onSemanaSelecionadaChange?: (inicioIso: string) => void;
  atividadeAlvoId?: string | null;
  onAtividadeAlvoConsumida?: () => void;
  onAbrirNoCronograma?: (atividadeId: string) => void;
  // Fase 1C-2B — correção assistida
  onCorrigirQuantidade?: (atividadeId: string) => void;
  canCorrigirQuantidade?: boolean;
  onDesignarEquipe?: (atividadeId: string) => void;
  canDesignarEquipe?: boolean;
}

const PlanejamentoMacroTabs: React.FC<Props> = ({
  centroCustoId,
  dataInicio,
  dataFim,
  onDataInicioChange,
  onDataFimChange,
  atividades,
  hasPlanejamentoReal,
  planejamentoId = null,
  isSuperAdmin = false,
  planejamentoStatus = null,
  planVigenteInicio = null,
  planVigenteFim = null,
  onEditarAtividade,
  onPlanejarRecursos,
  onAbrirNaSemana,
  tabAtiva,
  onTabChange,
  semanaAlvoIso = null,
  onSemanaAlvoConsumida,
  ccLabel = null,
  semanaSelecionadaIso = null,
  onSemanaSelecionadaChange,
  atividadeAlvoId = null,
  onAtividadeAlvoConsumida,
  onAbrirNoCronograma,
  onCorrigirQuantidade,
  canCorrigirQuantidade = false,
  onDesignarEquipe,
  canDesignarEquipe = false,
}) => {
  if (!centroCustoId) {
    return (
      <div className="border rounded-md bg-card">
        <EmptyState
          icon={<MapPin className="h-5 w-5" />}
          title="Comece selecionando o Centro de Custo da obra"
          description="Depois, importe ou ative uma versão do cronograma para liberar as demais abas."
        />
      </div>
    );
  }

  const canEditarAtividade =
    !!isSuperAdmin && planejamentoStatus !== "arquivado" && !!onEditarAtividade;

  return (
    <Tabs
      value={tabAtiva}
      defaultValue={tabAtiva ? undefined : "visao-geral"}
      onValueChange={onTabChange}
      className="w-full"
    >
      <div className="overflow-x-auto">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="visao-geral">Resumo da Obra</TabsTrigger>
          <TabsTrigger value="plano-semanal">Planejamento Semanal</TabsTrigger>
          <TabsTrigger value="atividades">Atividades do Cronograma</TabsTrigger>
          <TabsTrigger value="mao-obra">Mão de Obra Total Planejada</TabsTrigger>
          <TabsTrigger value="equipamentos">Equipamentos Planejados</TabsTrigger>
          <TabsTrigger value="materiais">Materiais Planejados</TabsTrigger>
          <TabsTrigger value="pendencias">Saneamento / Pendências</TabsTrigger>
          <TabsTrigger value="ordem-diaria">Ordem Diária</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="visao-geral" className="mt-4">
        <TabIntro text="Visão consolidada da versão vigente: atividades, datas-limite e totais de mão de obra planejada." />
        <VisaoGeralTab
          marcos={[]}
          atividades={atividades ?? []}
          hasPlanejamentoReal={hasPlanejamentoReal}
          planejamentoId={planejamentoId}
        />
      </TabsContent>
      <TabsContent value="plano-semanal" className="mt-4">
        <TabIntro text="Recorte operacional da semana: tarefas, equipe, equipamentos, materiais e pendências do período selecionado." />
        <PlanoSemanalTab
          planejamentoId={planejamentoId}
          hasPlanejamentoReal={hasPlanejamentoReal}
          centroCustoId={centroCustoId}
          planVigenteInicio={planVigenteInicio}
          planVigenteFim={planVigenteFim}
          onPlanejarRecursos={onPlanejarRecursos}
          canPlanejarRecursos={
            !!isSuperAdmin &&
            planejamentoStatus !== "arquivado" &&
            !!onPlanejarRecursos
          }
          onDesignarEquipe={onDesignarEquipe}
          canDesignarEquipe={canDesignarEquipe}
          onEditarAtividade={onEditarAtividade}
          canEditarAtividade={canEditarAtividade}
          semanaAlvoIso={semanaAlvoIso}
          onSemanaAlvoConsumida={onSemanaAlvoConsumida}
          onSemanaSelecionadaChange={onSemanaSelecionadaChange}
        />
      </TabsContent>

      <TabsContent value="atividades" className="mt-4">
        <TabIntro text="Lista completa das atividades importadas do MS Project. Visão macro de consulta — ações operacionais (editar atividade e recursos) ficam em Planejamento Semanal → Tarefas da Semana." />
        <AtividadesTab
          atividades={atividades ?? []}
          isSuperAdmin={isSuperAdmin}
          planejamentoStatus={planejamentoStatus}
          planejamentoId={planejamentoId}
          onAbrirNaSemana={onAbrirNaSemana}
          atividadeAlvoId={atividadeAlvoId}
          onAtividadeAlvoConsumida={onAtividadeAlvoConsumida}
        />
      </TabsContent>
      <TabsContent value="mao-obra" className="mt-4">
        <TabIntro text="Visão gerencial: quanto de mão de obra a obra exige no total, agrupado por função." />
        <MaoObraTab
          planejamentoId={planejamentoId}
          hasPlanejamentoReal={hasPlanejamentoReal}
          atividades={atividades ?? []}
        />
      </TabsContent>
      <TabsContent value="equipamentos" className="mt-4">
        <TabIntro text="Equipamentos planejados importados do cronograma, comparados à disponibilidade no Centro de Custo e às solicitações reais do período." />
        <EquipamentosTab
          centroCustoId={centroCustoId}
          dataInicio={dataInicio}
          dataFim={dataFim}
          onDataInicioChange={onDataInicioChange}
          onDataFimChange={onDataFimChange}
          planejamentoId={planejamentoId}
          planVigenteInicio={planVigenteInicio}
          planVigenteFim={planVigenteFim}
        />
      </TabsContent>
      <TabsContent value="materiais" className="mt-4">
        <MateriaisTab />
      </TabsContent>
      <TabsContent value="pendencias" className="mt-4">
        <PendenciasTab
          planejamentoId={planejamentoId}
          semanaSelecionadaIso={semanaSelecionadaIso}
          onAbrirNoCronograma={onAbrirNoCronograma}
          onAbrirNaSemana={(id, ini) => onAbrirNaSemana?.(id, ini)}
          onCorrigirQuantidade={onCorrigirQuantidade}
          canCorrigirQuantidade={canCorrigirQuantidade}
          onDesignarEquipe={onDesignarEquipe}
          canDesignarEquipe={canDesignarEquipe}
        />
      </TabsContent>
      <TabsContent value="ordem-diaria" className="mt-4">
        <OrdemDiariaTab
          centroCustoId={centroCustoId}
          planejamentoId={planejamentoId}
          ccLabel={ccLabel}
        />
      </TabsContent>
    </Tabs>
  );
};

export default PlanejamentoMacroTabs;
