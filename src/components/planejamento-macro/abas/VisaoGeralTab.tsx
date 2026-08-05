import React, { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import type {
  AtividadePlanejada,
  MarcoPlanejamento,
} from "@/types/planejamentoMacro";
import { formatarDataBR } from "../shared/formatData";
import { CalendarRange, Users } from "lucide-react";
import { useRecursosPorPlanejamento } from "@/hooks/planejamentoMacro/useRecursosPorPlanejamento";

interface Props {
  marcos?: MarcoPlanejamento[];
  atividades?: AtividadePlanejada[];
  hasPlanejamentoReal?: boolean;
  planejamentoId?: string | null;
}

const VisaoGeralTab: React.FC<Props> = ({
  marcos = [],
  atividades = [],
  hasPlanejamentoReal,
  planejamentoId = null,
}) => {

  const recursosMO = useRecursosPorPlanejamento(planejamentoId, "mao_obra");

  const resumoMO = useMemo(() => {
    const data = recursosMO.data ?? [];
    if (data.length === 0) return null;
    const funcoes = new Set<string>();
    let qtd = 0;
    let horas = 0;
    for (const r of data) {
      funcoes.add(r.funcao?.nome_funcao ?? r.descricao);
      qtd += Number(r.quantidade_prevista) || 0;
      horas += r.horas_previstas != null ? Number(r.horas_previstas) : 0;
    }
    return { funcoes: funcoes.size, qtd, horas, total: data.length };
  }, [recursosMO.data]);

  const resumo = useMemo(() => {
    if (!hasPlanejamentoReal || atividades.length === 0) return null;
    let minIni: string | null = null;
    let maxFim: string | null = null;
    for (const a of atividades) {
      const ini = a.inicio ?? null;
      const fim = a.fim ?? null;
      if (ini && (!minIni || ini < minIni)) minIni = ini;
      if (fim && (!maxFim || fim > maxFim)) maxFim = fim;
    }
    return {
      total: atividades.length,
      inicio: minIni,
      fim: maxFim,
    };
  }, [atividades, hasPlanejamentoReal]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <TabHeader
          title="Resumo da Obra"
          description="Resumo consolidado das atividades do planejamento vigente. A estrutura EAP fica disponível no cabeçalho."
        />

        {resumo && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <ResumoCard
              label="Atividades planejadas"
              value={String(resumo.total)}
            />
            <ResumoCard
              label="Primeira data"
              value={resumo.inicio ? formatarDataBR(resumo.inicio) : "—"}
            />
            <ResumoCard
              label="Última data"
              value={resumo.fim ? formatarDataBR(resumo.fim) : "—"}
            />
          </div>
        )}

        {hasPlanejamentoReal && (
          <div className="rounded-md border border-border p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold">Mão de obra planejada</h4>
            </div>
            {recursosMO.isLoading ? (
              <div className="text-xs text-muted-foreground">Carregando...</div>
            ) : resumoMO ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ResumoCard label="Linhas planejadas" value={String(resumoMO.total)} />
                <ResumoCard label="Funções distintas" value={String(resumoMO.funcoes)} />
                <ResumoCard label="Σ Quantidade" value={String(resumoMO.qtd)} />
                <ResumoCard label="Σ Horas" value={String(resumoMO.horas)} />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Nenhuma mão de obra planejada. Use a aba Atividades para planejar funções por atividade.
              </p>
            )}
          </div>
        )}

        {marcos.length === 0 ? (
          <EmptyState
            icon={<CalendarRange className="h-5 w-5" />}
            title={
              hasPlanejamentoReal
                ? "Marcos serão tratados em fase futura"
                : "Nenhum planejamento importado"
            }
            description={
              hasPlanejamentoReal
                ? "Os marcos da obra (entregas, etapas-chave) serão derivados do planejamento em fase posterior."
                : "Importe um cronograma para visualizar as atividades e os marcos da obra."
            }
          />
        ) : (
          <ul className="space-y-3">
            {marcos.map((m, i) => (
              <li
                key={i}
                className="flex items-center gap-3 border-l-2 border-primary pl-3"
              >
                <Badge variant="outline">{formatarDataBR(m.data)}</Badge>
                <span className="text-sm">{m.titulo}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

const ResumoCard: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="rounded-md border border-border p-3">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="text-lg font-semibold mt-1">{value}</div>
  </div>
);

export default VisaoGeralTab;
