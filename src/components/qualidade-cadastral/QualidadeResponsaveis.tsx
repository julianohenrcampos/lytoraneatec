import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import type { QcResumo } from "@/services/qualidadeCadastralService";
import { ScoreBar } from "./qualidadeUi";
import { UserX } from "lucide-react";

interface Props {
  resumo?: QcResumo;
  isLoading: boolean;
  onSelecionar: (responsavel: string) => void;
  onSelecionarSemResponsavel: () => void;
}

const QualidadeResponsaveis: React.FC<Props> = ({
  resumo,
  isLoading,
  onSelecionar,
  onSelecionarSemResponsavel,
}) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Pendências por responsável</CardTitle>
    </CardHeader>
    <CardContent className="space-y-2">
      {isLoading || !resumo ? (
        [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)
      ) : (
        <>
          {resumo.ranking_responsaveis.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhum responsável pôde ser relacionado às pendências dos filtros atuais.
            </p>
          )}
          {resumo.ranking_responsaveis.map((r) => (
            <button
              key={`${r.responsavel}-${r.papel}`}
              onClick={() => onSelecionar(r.responsavel)}
              className="w-full rounded-md border border-border p-3 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{r.responsavel}</p>
                  <p className="text-xs text-muted-foreground">{r.papel ?? "Papel não definido"}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold tabular-nums">{r.pendencias} pendências</p>
                  <p className="text-xs text-muted-foreground">{r.criticas} críticas</p>
                </div>
              </div>
              <div className="mt-2"><ScoreBar score={r.score} /></div>
            </button>
          ))}

          {resumo.sem_responsavel > 0 && (
            <button
              onClick={onSelecionarSemResponsavel}
              className="w-full rounded-md border border-dashed border-border p-3 text-left transition-colors hover:border-primary/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <UserX className="h-4 w-4 text-muted-foreground" />
                  Pendências sem responsável identificável
                </div>
                <Badge variant="outline">{resumo.sem_responsavel}</Badge>
              </div>
            </button>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

export default QualidadeResponsaveis;
