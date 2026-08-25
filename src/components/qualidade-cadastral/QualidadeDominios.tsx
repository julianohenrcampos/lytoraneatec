import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { DOMINIO_LABEL, type QcDominio } from "@/lib/qualidade-cadastral/regras";
import type { QcResumo } from "@/services/qualidadeCadastralService";
import { ScoreBar } from "./qualidadeUi";

interface Props {
  resumo?: QcResumo;
  isLoading: boolean;
  dominioAtivo?: QcDominio;
  onSelecionar: (dominio: QcDominio) => void;
}

const ORDEM: QcDominio[] = ["CENTRO_CUSTO", "FUNCIONARIO", "VEICULO_EQUIPAMENTO", "FUNCAO"];

const QualidadeDominios: React.FC<Props> = ({ resumo, isLoading, dominioAtivo, onSelecionar }) => {
  if (isLoading || !resumo) {
    return (
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {ORDEM.map((d) => (
          <Card key={d}>
            <CardContent className="p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {ORDEM.map((dominio) => {
        const d = resumo.dominios.find((x) => x.dominio === dominio);
        if (!d) return null;
        return (
          <Card
            key={dominio}
            onClick={() => onSelecionar(dominio)}
            className={cn(
              "cursor-pointer transition-colors hover:border-primary/50",
              dominioAtivo === dominio && "border-primary",
            )}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">{DOMINIO_LABEL[dominio]}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ScoreBar score={d.score} />
              <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                <span>Total: <span className="text-foreground font-medium">{d.total}</span></span>
                <span>Completos: <span className="text-foreground font-medium">{d.completos}</span></span>
                <span>Pendentes: <span className="text-foreground font-medium">{d.pendentes}</span></span>
                <span>Críticos: <span className="text-foreground font-medium">{d.criticos}</span></span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default QualidadeDominios;
