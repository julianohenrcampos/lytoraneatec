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
import { formatarDataBR } from "@/components/planejamento-macro/shared/formatData";
import type { LinhaEQ } from "@/lib/planejamentoMacro/planoSemanal/tipos";
import type { DisponibilidadePorTipo } from "@/hooks/planejamentoMacro/useEquipamentosDisponiveisNoCC";

interface Props {
  rows: LinhaEQ[];
  alocadoMap?: Map<string, DisponibilidadePorTipo> | null;
}

function chaveTipo(r: LinhaEQ) {
  return (r.descricao || "").trim().toUpperCase();
}

const TabelaEquipamentosSemanal: React.FC<Props> = ({ rows, alocadoMap }) => {
  if (rows.length === 0) {
    return (
      <div className="border rounded-md p-6 text-center text-sm text-muted-foreground bg-muted/30">
        Sem equipamentos operacionais (EQ) previstos para esta semana.
      </div>
    );
  }
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tipo</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Grupo / Família</TableHead>
            <TableHead className="text-right">Pico semana</TableHead>
            <TableHead className="text-right">Disponível</TableHead>
            <TableHead className="text-right">Alocado</TableHead>
            <TableHead className="text-right">Sol. abertas</TableHead>
            <TableHead className="text-right">Gap</TableHead>
            <TableHead>Janela necessária</TableHead>
            <TableHead>Atividades</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const k = chaveTipo(r);
            const disp = alocadoMap?.get(k);
            const disponivel = disp?.disponivel ?? 0;
            const alocado = disp?.alocado ?? 0;
            const solAb = disp?.solicitacoesAbertas ?? 0;
            const cobertura = alocado + disponivel + solAb;
            const gap = Math.max(0, Math.ceil(r.picoSemana) - cobertura);
            return (
              <TableRow key={r.chave}>
                <TableCell>
                  <Badge variant="default" className="text-[10px]">
                    EQ
                  </Badge>
                </TableCell>
                <TableCell className="font-medium">
                  {r.descricao}
                  {r.unidade ? (
                    <span className="text-xs text-muted-foreground ml-1">({r.unidade})</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {[r.grupo, r.familia].filter(Boolean).join(" / ") || "—"}
                </TableCell>
                <TableCell className="text-right font-semibold">{r.picoSemana}</TableCell>
                <TableCell className="text-right">{disp ? disponivel : "—"}</TableCell>
                <TableCell className="text-right">{disp ? alocado : "—"}</TableCell>
                <TableCell className="text-right">{disp ? solAb : "—"}</TableCell>
                <TableCell className="text-right font-semibold">
                  {disp ? gap : "—"}
                </TableCell>
                <TableCell>
                  {formatarDataBR(r.inicioNecessario)} → {formatarDataBR(r.fimNecessario)}
                </TableCell>
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

export default TabelaEquipamentosSemanal;
