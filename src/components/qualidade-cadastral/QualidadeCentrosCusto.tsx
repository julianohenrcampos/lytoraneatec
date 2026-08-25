import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { QcResumo } from "@/services/qualidadeCadastralService";
import { ScoreBar } from "./qualidadeUi";

interface Props {
  resumo?: QcResumo;
  isLoading: boolean;
  onSelecionar: (centroCustoId: string) => void;
}

const QualidadeCentrosCusto: React.FC<Props> = ({ resumo, isLoading, onSelecionar }) => (
  <Card>
    <CardHeader className="pb-2">
      <CardTitle className="text-base">Centros de Custo que mais precisam de atenção</CardTitle>
    </CardHeader>
    <CardContent>
      {isLoading || !resumo ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-9 w-full" />)}</div>
      ) : resumo.ranking_cc.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum centro de custo com pendências nos filtros atuais.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Centro de custo</TableHead>
                <TableHead className="text-center">Pendências</TableHead>
                <TableHead className="text-center">Críticas</TableHead>
                <TableHead className="w-[160px]">Score</TableHead>
                <TableHead>ADM OBRA</TableHead>
                <TableHead>ADM SEDE</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {resumo.ranking_cc.map((cc) => (
                <TableRow
                  key={cc.centro_custo_id ?? cc.codigo}
                  className="cursor-pointer"
                  onClick={() => cc.centro_custo_id && onSelecionar(cc.centro_custo_id)}
                >
                  <TableCell className="font-medium">{cc.codigo ?? "—"}</TableCell>
                  <TableCell className="max-w-[220px] truncate">{cc.nome ?? "—"}</TableCell>
                  <TableCell className="text-center tabular-nums">{cc.pendencias}</TableCell>
                  <TableCell className="text-center tabular-nums">{cc.criticas}</TableCell>
                  <TableCell><ScoreBar score={cc.score} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{cc.adm_obra ?? "Não definido"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[160px] truncate">{cc.adm_sede ?? "Não definido"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </CardContent>
  </Card>
);

export default QualidadeCentrosCusto;
