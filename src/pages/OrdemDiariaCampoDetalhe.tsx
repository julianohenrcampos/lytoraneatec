import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, AlertTriangle, FileText } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  useOrdemCampoDetalhe,
  useItemCampoDetalhe,
} from "@/hooks/ordemDiariaCampo/useOrdemCampoDetalhe";
import { CampoEquipeList } from "@/components/ordem-diaria-campo/CampoEquipeList";
import { CampoRecursoList } from "@/components/ordem-diaria-campo/CampoRecursoList";
import { CampoPendenciasList } from "@/components/ordem-diaria-campo/CampoPendenciasList";
import { CampoApontamentoPlaceholder } from "@/components/ordem-diaria-campo/CampoApontamentoPlaceholder";
import { formatBrazilianDateForDisplay } from "@/utils/timezoneUtils";

export default function OrdemDiariaCampoDetalhe() {
  usePageTitle("Ordem do Dia");
  const navigate = useNavigate();
  const { ordemId, itemId } = useParams<{ ordemId: string; itemId: string }>();

  const { data: ordem, isLoading: loadingOrdem } = useOrdemCampoDetalhe(ordemId);
  const { data: itemDireto, isLoading: loadingItem } = useItemCampoDetalhe(itemId);

  const item =
    itemDireto ?? ordem?.itens.find((it) => it.id === itemId) ?? null;

  const loading = loadingOrdem || loadingItem;

  const VoltarBtn = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => navigate(-1)}
      className="gap-1 -ml-2"
    >
      <ArrowLeft className="h-4 w-4" /> Voltar
    </Button>
  );

  if (loading) {
    return (
      <MainLayout>
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!item) {
    return (
      <MainLayout>
        <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 py-4 space-y-4">
          {VoltarBtn}
          <Card className="p-6 text-center space-y-2">
            <AlertTriangle className="h-6 w-6 mx-auto text-amber-500" />
            <p className="text-sm font-semibold">Tarefa não encontrada</p>
            <p className="text-xs text-muted-foreground">
              Você pode não ter permissão para visualizar este item ou ele foi
              removido.
            </p>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const perc = Math.max(0, Math.min(100, item.percentual_snapshot ?? 0));
  const qtd = item.atividade_quantidade_planejada_snapshot;
  const unidade = item.atividade_unidade_medida_snapshot;
  const dataLabel = ordem ? formatBrazilianDateForDisplay(ordem.data_ordem) : "";

  return (
    <MainLayout>
      <div className="w-full max-w-5xl mx-auto px-2 sm:px-4 pb-24 md:pb-6 space-y-4">
        {VoltarBtn}

        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-foreground">
            {item.nome_atividade_snapshot}
          </h1>
          {(dataLabel || item.codigo_eap_snapshot) && (
            <p className="text-xs text-muted-foreground">
              {dataLabel}
              {dataLabel && item.codigo_eap_snapshot ? " · " : ""}
              {item.codigo_eap_snapshot ? `EAP ${item.codigo_eap_snapshot}` : ""}
            </p>
          )}
        </div>

        <Card className="p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {item.atividade_is_critica_snapshot && (
              <Badge variant="destructive" className="gap-1 text-[10px]">
                <AlertTriangle className="h-3 w-3" /> Crítica
              </Badge>
            )}
            {item.status_atividade_snapshot && (
              <Badge variant="outline" className="text-[10px]">
                {item.status_atividade_snapshot}
              </Badge>
            )}
            {item.frente_servico_snapshot && (
              <Badge variant="secondary" className="text-[10px]">
                {item.frente_servico_snapshot}
              </Badge>
            )}
          </div>

          {(qtd != null || unidade) && (
            <p className="text-xs text-muted-foreground">
              Quantidade prevista:{" "}
              <span className="font-medium text-foreground">
                {qtd != null ? qtd : "—"} {unidade ?? ""}
              </span>
            </p>
          )}

          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span>Progresso ({item.fonte_progresso_snapshot ?? "—"})</span>
              <span>{perc}%</span>
            </div>
            <Progress value={perc} className="h-1.5" />
          </div>

          {item.responsavel_item_nome_snapshot && (
            <p className="text-xs text-muted-foreground">
              Responsável da tarefa:{" "}
              <span className="text-foreground font-medium">
                {item.responsavel_item_nome_snapshot}
              </span>
              {item.responsavel_item_funcao_snapshot
                ? ` · ${item.responsavel_item_funcao_snapshot}`
                : ""}
            </p>
          )}
        </Card>

        {(ordem?.observacao_geral || item.observacao_item) && (
          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <FileText className="h-3.5 w-3.5" /> Observações
            </div>
            {ordem?.observacao_geral && (
              <div>
                <p className="text-[11px] text-muted-foreground">Ordem</p>
                <p className="text-sm whitespace-pre-wrap">
                  {ordem.observacao_geral}
                </p>
              </div>
            )}
            {item.observacao_item && (
              <div>
                <p className="text-[11px] text-muted-foreground">Item</p>
                <p className="text-sm whitespace-pre-wrap">
                  {item.observacao_item}
                </p>
              </div>
            )}
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Equipe
            </h2>
            <CampoEquipeList equipe={item.equipe_snapshot ?? []} />
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Equipamentos
            </h2>
            <CampoRecursoList
              recursos={item.equipamentos_snapshot ?? []}
              emptyLabel="Sem equipamentos no snapshot."
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Materiais
            </h2>
            <CampoRecursoList
              recursos={item.materiais_snapshot ?? []}
              emptyLabel="Sem materiais no snapshot."
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Pendências
            </h2>
            <CampoPendenciasList pendencias={item.pendencias_snapshot ?? []} />
          </section>
        </div>

        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Checklist do executor
          </h2>
          <Card className="p-3 text-xs text-muted-foreground space-y-1.5">
            <p>• Confirme equipe, equipamentos e materiais no campo.</p>
            <p>• Verifique condições de segurança antes de iniciar.</p>
            <p>• Use o apontamento (em breve) para registrar produção real.</p>
          </Card>
        </section>

        <CampoApontamentoPlaceholder />
      </div>
    </MainLayout>
  );
}
