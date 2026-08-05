// Fase 1C-2A — Rastreabilidade do Saneamento.
// Fase 1C-2B — Correção Assistida.
// Recebe a semana ativa do usuário (Planejamento Semanal) com fallback para hoje
// e delega navegação cross-tab e correção para o pai (PlanejamentoMacroPage).

import React, { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import TabIntro from "../shared/TabIntro";
import { AlertTriangle } from "lucide-react";
import PendenciasSemanaList from "../plano-semanal/PendenciasSemanaList";
import { usePendenciasOperacionais } from "@/hooks/planejamentoMacro/usePendenciasOperacionais";
import { calcularSemanaDaData } from "@/lib/planejamentoMacro/planoSemanal/calcularSemana";

interface Props {
  planejamentoId: string | null;
  /** Semana ativa no Planejamento Semanal; fallback: hoje. */
  semanaSelecionadaIso?: string | null;
  onAbrirNoCronograma?: (atividadeId: string) => void;
  onAbrirNaSemana?: (atividadeId: string, dataInicioIso: string) => void;
  onCorrigirQuantidade?: (atividadeId: string) => void;
  canCorrigirQuantidade?: boolean;
  onDesignarEquipe?: (atividadeId: string) => void;
  canDesignarEquipe?: boolean;
}

const PendenciasTab: React.FC<Props> = ({
  planejamentoId,
  semanaSelecionadaIso = null,
  onAbrirNoCronograma,
  onAbrirNaSemana,
  onCorrigirQuantidade,
  canCorrigirQuantidade = false,
  onDesignarEquipe,
  canDesignarEquipe = false,
}) => {
  const semanaReferencia = useMemo(() => {
    const iso = semanaSelecionadaIso ?? new Date().toISOString().slice(0, 10);
    return calcularSemanaDaData(iso);
  }, [semanaSelecionadaIso]);

  const { pendencias, isLoading } = usePendenciasOperacionais({
    planejamentoId,
    semanaReferencia,
  });

  const [equipamentoInfo, setEquipamentoInfo] = useState<string | null>(null);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <TabHeader
          title="Saneamento do Planejamento"
          description="Pendências de cadastro, importação e mapeamento que impedem o planejamento de virar execução confiável."
        />
        <TabIntro text="Esta aba trata pendências do PLANEJAMENTO — quantidade/unidade ausentes, funções não mapeadas, equipamentos sem catálogo, materiais sem unidade e atividades críticas sem equipe. Impedimentos de campo (chuva, equipamento atrasado, acesso bloqueado) NÃO entram aqui — serão tratados no Diário de Obra." />
        {!planejamentoId ? (
          <EmptyState
            icon={<AlertTriangle className="h-5 w-5" />}
            title="Sem planejamento vigente"
            description="Importe ou ative um planejamento vigente para diagnosticar pendências."
          />
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground p-6 text-center">Carregando…</p>
        ) : (
          <PendenciasSemanaList
            pendencias={pendencias}
            onAbrirNoCronograma={onAbrirNoCronograma}
            onAbrirNaSemana={onAbrirNaSemana}
            onCorrigirQuantidade={onCorrigirQuantidade}
            canCorrigirQuantidade={canCorrigirQuantidade}
            onDesignarEquipe={onDesignarEquipe}
            canDesignarEquipe={canDesignarEquipe}
            onMapearEquipamento={(item) => setEquipamentoInfo(item)}
          />
        )}
      </CardContent>

      <Dialog
        open={!!equipamentoInfo}
        onOpenChange={(v) => !v && setEquipamentoInfo(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mapear equipamento</DialogTitle>
            <DialogDescription>
              Esta ação informa o nome importado para que ele seja cadastrado no
              catálogo de equipamentos pela equipe responsável.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm">
            <div className="font-medium">Nome importado</div>
            <div className="font-mono text-xs mt-1 p-2 rounded bg-muted">
              {equipamentoInfo}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Trate este item no catálogo de equipamentos. Após o cadastro, a pendência
              será removida automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEquipamentoInfo(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default PendenciasTab;
