import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { QcResumo } from "@/services/qualidadeCadastralService";
import { Truck } from "lucide-react";

interface Props {
  resumo?: QcResumo;
  isLoading: boolean;
  onFiltrarFrotaDesatualizada: (diasMin: number) => void;
}

const QualidadeFrota: React.FC<Props> = ({ resumo, isLoading, onFiltrarFrotaDesatualizada }) => {
  const f = resumo?.frota;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" /> Qualidade cadastral da frota
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading || !resumo ? (
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        ) : !f || f.monitorados === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum ativo monitorado nos filtros atuais.</p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              {[
                { label: "Ativos monitorados", valor: f.monitorados },
                { label: "Cadastro completo", valor: f.completos },
                { label: "Sem centro de custo", valor: f.sem_cc },
                { label: "Sem departamento", valor: f.sem_departamento },
                { label: "Sem classificação", valor: f.sem_classificacao },
                { label: "Identificação incompleta", valor: f.identificacao_incompleta },
                { label: "Informação operacional divergente", valor: f.divergencia_operacional },
              ].map((item) => (
                <div key={item.label} className="rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground leading-tight">{item.label}</p>
                  <p className="mt-1 text-xl font-semibold tabular-nums">{item.valor}</p>
                </div>
              ))}
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                Tempo sem atualização da alocação (centro_custo_atualizado_em, com fallback em updated_at)
              </p>
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {[
                  { label: "Até 30 dias", valor: f.ate_30, dias: 0 },
                  { label: "31–60 dias", valor: f.de_31_60, dias: 31 },
                  { label: "61–90 dias", valor: f.de_61_90, dias: 61 },
                  { label: "+90 dias", valor: f.mais_90, dias: 90 },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => onFiltrarFrotaDesatualizada(item.dias)}
                    className="rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50"
                  >
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 text-xl font-semibold tabular-nums">{item.valor}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QualidadeFrota;
