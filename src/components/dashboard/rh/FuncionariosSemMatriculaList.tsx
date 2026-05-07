import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useFuncionariosSemMatricula } from "@/hooks/dashboard/useFuncionariosSemMatricula";

interface Props {
  empresaId?: string;
  diretoriaId?: string;
  centroCustoIds?: string[];
  departamentoId?: string;
  centroCustoId?: string;
  funcaoId?: string;
  equipeId?: string;
  nomeFuncionario?: string;
  /** Mínimo de dias sem matrícula para exibir. Padrão: 14. */
  minDias?: number;
}

function diasBadgeVariant(dias: number | null): {
  className: string;
  label: string;
} {
  if (dias === null) {
    return { className: "bg-muted text-muted-foreground", label: "Sem data" };
  }
  if (dias > 14) {
    return { className: "bg-destructive text-destructive-foreground", label: `${dias} dias` };
  }
  if (dias >= 7) {
    return { className: "bg-amber-500 text-white", label: `${dias} dias` };
  }
  return { className: "bg-secondary text-secondary-foreground", label: `${dias} dias` };
}

export default function FuncionariosSemMatriculaList(props: Props) {
  const minDias = props.minDias ?? 14;
  const { data, isLoading } = useFuncionariosSemMatricula({ ...props, minDias });

  const total = data?.length ?? 0;
  const totalCritico = useMemo(
    () => (data ?? []).filter((f) => (f.dias_sem_matricula ?? 0) > 14).length,
    [data]
  );

  return (
    <Card id="alerta-sem-matricula" className="p-4 border-destructive/40 bg-destructive/5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h3 className="font-semibold text-lg">
            Funcionários Ativos sem Matrícula{minDias > 0 ? ` (> ${minDias} dias)` : ""}
          </h3>
          <Badge variant="outline" className="ml-2">{total} no total</Badge>
          {totalCritico > 0 && (
            <Badge className="bg-destructive text-destructive-foreground">
              {totalCritico} crítico{totalCritico > 1 ? "s" : ""} (&gt; 14 dias)
            </Badge>
          )}
        </div>
        {total > 0 && (
          <span className="text-xs text-muted-foreground italic">
            Lista com rolagem interna
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Carregando...</div>
      ) : total === 0 ? (
        <div className="py-8 text-center text-muted-foreground">
          Nenhum funcionário ativo sem matrícula encontrado.
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-md border bg-background">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Função</TableHead>
                <TableHead>Centro de Custo</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Data base</TableHead>
                <TableHead className="text-right">Dias sem Matrícula</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((f) => {
                const badge = diasBadgeVariant(f.dias_sem_matricula);
                const dataBaseLabel = f.data_base
                  ? format(new Date(f.data_base), "dd/MM/yyyy", { locale: ptBR })
                  : "—";
                return (
                  <TableRow key={f.id}>
                    <TableCell className="font-medium">{f.nome_completo}</TableCell>
                    <TableCell>{f.funcao_nome ?? "—"}</TableCell>
                    <TableCell>
                      {f.centro_custo_codigo
                        ? `${f.centro_custo_codigo} - ${f.centro_custo_nome ?? ""}`
                        : f.centro_custo_nome ?? "—"}
                    </TableCell>
                    <TableCell>{f.empresa_nome ?? "—"}</TableCell>
                    <TableCell>
                      {f.data_base ? dataBaseLabel : (
                        <span className="text-muted-foreground italic">data não informada</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge className={badge.className}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{f.status ?? "—"}</Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
