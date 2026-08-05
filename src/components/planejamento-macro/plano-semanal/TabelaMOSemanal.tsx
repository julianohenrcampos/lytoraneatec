import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { LinhaMO } from "@/lib/planejamentoMacro/planoSemanal/tipos";
import type { AlocadoNoCC } from "@/hooks/planejamentoMacro/useMaoObraAlocadaNoCC";

type StatusMO = "OK" | "Falta" | "Sobra" | "Sem mapeamento";

function statusFor(planejado: number, alocado: number | null): StatusMO {
  if (alocado === null) return "Sem mapeamento";
  if (alocado < planejado) return "Falta";
  if (alocado === planejado) return "OK";
  return "Sobra";
}

const STATUS_VARIANT: Record<StatusMO, "default" | "secondary" | "destructive" | "outline"> = {
  OK: "default",
  Falta: "destructive",
  Sobra: "secondary",
  "Sem mapeamento": "outline",
};

function normFn(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

interface Props {
  rows: LinhaMO[];
  alocadoMap?: Map<string, AlocadoNoCC> | null;
}

const TabelaMOSemanal: React.FC<Props> = ({ rows, alocadoMap }) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        Nenhuma demanda de mão de obra para esta semana.
      </p>
    );
  }
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Função</TableHead>
            <TableHead className="text-right">Planejado (pico)</TableHead>
            <TableHead className="text-right">Alocado no CC</TableHead>
            <TableHead className="text-right">Gap</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Horas semana</TableHead>
            <TableHead className="text-right">Dias-homem</TableHead>
            <TableHead>Atividades</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const planejado = r.planejadoPico;
            const chave = normFn(r.funcao);
            const aloc = alocadoMap?.get(chave) ?? null;
            const alocado = aloc ? aloc.alocados : null;
            const status = statusFor(planejado, alocado);
            const gap = alocado === null ? null : planejado - alocado;
            return (
              <TableRow key={r.funcao}>
                <TableCell className="font-medium">{r.funcao}</TableCell>
                <TableCell className="text-right font-semibold">{planejado}</TableCell>
                <TableCell className="text-right">{alocado ?? "—"}</TableCell>
                <TableCell className="text-right">{gap ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[status]} className="text-[10px]">
                    {status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{r.horasSemana.toFixed(1)}</TableCell>
                <TableCell className="text-right">{r.diasHomem.toFixed(2)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {r.atividades
                    .slice(0, 3)
                    .map((a) => (a.wbs ? `${a.wbs} ${a.nome}` : a.nome))
                    .join("; ")}
                  {r.atividades.length > 3 ? ` (+${r.atividades.length - 3})` : ""}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TabelaMOSemanal;
