import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Loader2 } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import {
  getCurrentBrazilianDate,
  formatBrazilianDateForDisplay,
} from "@/utils/timezoneUtils";
import { useAuth } from "@/hooks/useAuth";
import {
  useOrdensCampoDoDia,
  useProximasOrdensCampo,
} from "@/hooks/ordemDiariaCampo/useOrdensCampoDoDia";
import { CampoResumoCards } from "@/components/ordem-diaria-campo/CampoResumoCards";
import { CampoTarefaCard } from "@/components/ordem-diaria-campo/CampoTarefaCard";
import { CampoBottomNav } from "@/components/ordem-diaria-campo/CampoBottomNav";
import { CampoEquipeList } from "@/components/ordem-diaria-campo/CampoEquipeList";
import { CampoApontamentoPlaceholder } from "@/components/ordem-diaria-campo/CampoApontamentoPlaceholder";
import EmptyState from "@/components/planejamento-macro/shared/EmptyState";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  CampoTabId,
  OrdemDiariaItem,
} from "@/types/ordemDiariaCampo";
import type { EquipeSnapshotItem } from "@/types/ordemDiariaObra";

export default function OrdemDiariaCampo() {
  usePageTitle("Ordem do Dia");
  const navigate = useNavigate();
  const { user } = useAuth();
  const hojeBrt = getCurrentBrazilianDate();
  const [tab, setTab] = useState<CampoTabId>("hoje");

  const { data: ordensHoje = [], isLoading: loadingHoje } =
    useOrdensCampoDoDia(hojeBrt);
  const { data: ordensProx = [], isLoading: loadingProx } =
    useProximasOrdensCampo(hojeBrt);

  const greetingName = (user?.user_metadata as any)?.full_name?.split(" ")?.[0]
    ?? (user?.email?.split("@")?.[0] ?? "");

  const todosItensHoje: OrdemDiariaItem[] = useMemo(
    () => ordensHoje.flatMap((o) => o.itens),
    [ordensHoje]
  );

  const dataLabelByOrdem = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of [...ordensHoje, ...ordensProx]) {
      m.set(o.id, formatBrazilianDateForDisplay(o.data_ordem));
    }
    return m;
  }, [ordensHoje, ordensProx]);

  const criticas = todosItensHoje.filter(
    (i) => i.atividade_is_critica_snapshot
  );
  const comPendencias = todosItensHoje.filter(
    (i) => (i.pendencias_snapshot?.length ?? 0) > 0 && !i.atividade_is_critica_snapshot
  );
  const liberadas = todosItensHoje.filter(
    (i) =>
      !i.atividade_is_critica_snapshot &&
      (i.pendencias_snapshot?.length ?? 0) === 0
  );

  const equipeHoje: EquipeSnapshotItem[] = useMemo(() => {
    const dedup = new Map<string, EquipeSnapshotItem>();
    for (const it of todosItensHoje) {
      for (const p of it.equipe_snapshot ?? []) {
        const k = p.funcionario_id ?? `${p.nome ?? ""}-${p.funcao ?? ""}`;
        if (!dedup.has(k)) dedup.set(k, p);
      }
    }
    return Array.from(dedup.values());
  }, [todosItensHoje]);

  const totaisHoje = {
    atividades: todosItensHoje.length,
    equipe: equipeHoje.length,
    criticas: criticas.length,
    pendencias: todosItensHoje.reduce(
      (acc, it) => acc + (it.pendencias_snapshot?.length ?? 0),
      0
    ),
    equipamentos: todosItensHoje.reduce(
      (acc, it) => acc + (it.equipamentos_snapshot?.length ?? 0),
      0
    ),
  };

  const openItem = (item: OrdemDiariaItem) =>
    navigate(`/engenharia/ordem-do-dia/${item.ordem_id}/item/${item.id}`);

  const renderListaSecao = (
    titulo: string,
    items: OrdemDiariaItem[],
    emptyMsg: string
  ) => (
    <section className="space-y-2">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {titulo}
      </h2>
      {items.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground italic">{emptyMsg}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {items.map((it) => (
            <CampoTarefaCard
              key={it.id}
              item={it}
              ordemDataLabel={dataLabelByOrdem.get(it.ordem_id)}
              onAbrir={() => openItem(it)}
            />
          ))}
        </div>
      )}
    </section>
  );

  const ordemHeader = ordensHoje[0];

  return (
    <MainLayout>
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 pb-24 md:pb-6 space-y-4">
        {/* Cabeçalho próprio (subtítulo + saudação) — AppHeader exibe o título */}
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            Tarefas emitidas para campo a partir da Ordem Diária da Obra.
          </p>
          <p className="text-xs text-muted-foreground">
            {greetingName ? `Olá, ${greetingName} · ` : ""}
            {formatBrazilianDateForDisplay(hojeBrt)}
          </p>
        </div>

        {/* Abas — visíveis em md+, mobile usa CampoBottomNav */}
        <div className="hidden md:block">
          <Tabs value={tab} onValueChange={(v) => setTab(v as CampoTabId)}>
            <TabsList>
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
              <TabsTrigger value="equipe">Equipe</TabsTrigger>
              <TabsTrigger value="diario">Diário</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === "hoje" && (
          <div className="space-y-4">
            {loadingHoje ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ordensHoje.length === 0 ? (
              <Card className="p-6">
                <EmptyState
                  icon={<ClipboardList className="h-5 w-5" />}
                  title="Nenhuma Ordem do Dia emitida para você hoje."
                  description="Quando uma Ordem Diária for emitida pela Engenharia, as tarefas aparecerão aqui."
                />
              </Card>
            ) : (
              <>
                {ordemHeader && (
                  <Card className="p-3 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Responsável principal
                    </p>
                    <p className="text-sm font-semibold">
                      {ordemHeader.responsavel_nome_snapshot ?? "—"}
                    </p>
                    {ordemHeader.responsavel_funcao_snapshot && (
                      <p className="text-xs text-muted-foreground">
                        {ordemHeader.responsavel_funcao_snapshot}
                      </p>
                    )}
                  </Card>
                )}

                <CampoResumoCards
                  itens={[
                    { label: "Atividades", value: totaisHoje.atividades },
                    { label: "Equipe", value: totaisHoje.equipe },
                    { label: "Equip.", value: totaisHoje.equipamentos },
                    {
                      label: "Críticas",
                      value: totaisHoje.criticas,
                      destaque: totaisHoje.criticas > 0 ? "danger" : "default",
                    },
                    {
                      label: "Pendências",
                      value: totaisHoje.pendencias,
                      destaque: totaisHoje.pendencias > 0 ? "warn" : "default",
                    },
                    { label: "Ordens", value: ordensHoje.length },
                  ]}
                />

                {renderListaSecao(
                  "Prioridade do dia",
                  criticas,
                  "Sem atividades críticas hoje."
                )}
                {renderListaSecao(
                  "Outras tarefas liberadas",
                  liberadas,
                  "Sem outras tarefas liberadas."
                )}
                {renderListaSecao(
                  "Tarefas com pendências",
                  comPendencias,
                  "Sem pendências registradas."
                )}
              </>
            )}
          </div>
        )}

        {tab === "tarefas" && (
          <div className="space-y-4">
            {loadingProx ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : ordensProx.length === 0 ? (
              <Card className="p-6">
                <EmptyState
                  icon={<ClipboardList className="h-5 w-5" />}
                  title="Nenhuma Ordem Diária emitida nos próximos dias."
                  description="As próximas ordens emitidas aparecerão aqui."
                />
              </Card>
            ) : (
              ordensProx.map((o) => (
                <section key={o.id} className="space-y-2">
                  <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {formatBrazilianDateForDisplay(o.data_ordem)}
                    {o.responsavel_nome_snapshot
                      ? ` · ${o.responsavel_nome_snapshot}`
                      : ""}
                  </h2>
                  {o.itens.length === 0 ? (
                    <p className="px-1 text-sm text-muted-foreground italic">
                      Nenhum item visível.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      {o.itens.map((it) => (
                        <CampoTarefaCard
                          key={it.id}
                          item={it}
                          ordemDataLabel={formatBrazilianDateForDisplay(o.data_ordem)}
                          onAbrir={() => openItem(it)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        )}

        {tab === "equipe" && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Equipe alocada hoje
            </h2>
            <CampoEquipeList equipe={equipeHoje} />
          </div>
        )}

        {tab === "diario" && (
          <div className="space-y-4">
            <Card className="p-6 text-center space-y-2">
              <p className="text-sm font-semibold">
                Apontamento e Diário de Obra
              </p>
              <p className="text-xs text-muted-foreground">
                Disponíveis nas próximas fases (2B → 2D).
              </p>
            </Card>
            <CampoApontamentoPlaceholder label="Registrar produção" />
          </div>
        )}

        <CampoBottomNav active={tab} onChange={setTab} />
      </div>
    </MainLayout>
  );
}
