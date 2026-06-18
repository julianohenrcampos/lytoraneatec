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
import { Button } from "@/components/ui/button";
import { Users2 } from "lucide-react";
import { formatarDataBR, formatarPeriodoBR } from "@/components/planejamento-macro/shared/formatData";
import type {
  AtividadeNaSemana,
  ClassificacaoSemanaAtividade,
} from "@/lib/planejamentoMacro/planoSemanal/tipos";

const FLAG_LABEL: Record<ClassificacaoSemanaAtividade, string> = {
  inicia_semana: "Inicia na semana",
  termina_semana: "Termina na semana",
  em_andamento: "Em andamento",
  atrasada: "Atrasada",
  reprogramada: "Reprogramada",
  antecipavel: "Antecipável",
  marco: "Marco",
};

function variantForFlag(flag: ClassificacaoSemanaAtividade): "default" | "secondary" | "destructive" | "outline" {
  switch (flag) {
    case "atrasada":
      return "destructive";
    case "marco":
      return "default";
    case "inicia_semana":
    case "termina_semana":
      return "secondary";
    default:
      return "outline";
  }
}

interface Props {
  rows: AtividadeNaSemana[];
  onPlanejarRecursos?: (atividadeId: string) => void;
  canPlanejarRecursos?: boolean;
}

const TabelaAtividadesSemanal: React.FC<Props> = ({
  rows,
  onPlanejarRecursos,
  canPlanejarRecursos = false,
}) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        Nenhuma atividade cruza esta semana.
      </p>
    );
  }
  const mostrarAcoes = canPlanejarRecursos && !!onPlanejarRecursos;
  return (
    <div className="border rounded-md overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead title="EAP corresponde ao código WBS importado do MS Project.">EAP</TableHead>
            <TableHead>Atividade</TableHead>
            <TableHead>Frente de Serviço</TableHead>
            <TableHead>Início na semana</TableHead>
            <TableHead>Fim na semana</TableHead>
            <TableHead className="text-right">Dias úteis</TableHead>
            {mostrarAcoes && (
              <TableHead className="w-32 text-right">Ações</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.atividade.id}>
              <TableCell className="font-mono text-xs">
                {r.atividade.outline_number ?? r.atividade.codigo_wbs ?? "—"}
              </TableCell>
              <TableCell>
                <div className="font-medium">{r.atividade.nome}</div>
                <div className="text-xs text-muted-foreground">
                  Período total: {formatarPeriodoBR(r.atividade.data_inicio, r.atividade.data_fim)}
                </div>
                {r.flags && r.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {r.flags.map((f) => (
                      <Badge key={f} variant={variantForFlag(f)} className="text-[10px] py-0">
                        {FLAG_LABEL[f]}
                      </Badge>
                    ))}
                  </div>
                )}
              </TableCell>
              <TableCell>{r.atividade.frente_servico ?? "—"}</TableCell>
              <TableCell>{formatarDataBR(r.inicioNaSemana)}</TableCell>
              <TableCell>{formatarDataBR(r.fimNaSemana)}</TableCell>
              <TableCell className="text-right">{r.diasUteisNaSemana}</TableCell>
              {mostrarAcoes && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1"
                    aria-label="Ajustar recursos da atividade"
                    title="Os recursos planejados pertencem à atividade como um todo. Não há ajuste por semana nesta fase."
                    onClick={() => onPlanejarRecursos?.(r.atividade.id)}
                  >
                    <Users2 className="h-4 w-4" />
                    <span className="text-xs">Recursos</span>
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default TabelaAtividadesSemanal;
