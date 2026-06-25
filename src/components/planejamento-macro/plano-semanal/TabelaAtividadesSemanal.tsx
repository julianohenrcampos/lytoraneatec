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
import { Gauge, Pencil, Users2 } from "lucide-react";
import { formatarDataBR, formatarPeriodoBR } from "@/components/planejamento-macro/shared/formatData";
import ProgressoAtividadeCell from "@/components/planejamento-macro/shared/ProgressoAtividadeCell";
import { cn } from "@/lib/utils";
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
  onEditarAtividade?: (atividadeId: string) => void;
  canEditarAtividade?: boolean;
  onAtualizarAndamento?: (atividadeId: string) => void;
  canAtualizarAndamento?: boolean;
}

const TabelaAtividadesSemanal: React.FC<Props> = ({
  rows,
  onPlanejarRecursos,
  canPlanejarRecursos = false,
  onEditarAtividade,
  canEditarAtividade = false,
  onAtualizarAndamento,
  canAtualizarAndamento = false,
}) => {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground p-6 text-center">
        Nenhuma atividade cruza esta semana.
      </p>
    );
  }
  const podeRecursos = canPlanejarRecursos && !!onPlanejarRecursos;
  const podeEditar = canEditarAtividade && !!onEditarAtividade;
  const podeAndamento = canAtualizarAndamento && !!onAtualizarAndamento;
  const mostrarAcoes = podeRecursos || podeEditar || podeAndamento;
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
            <TableHead className="w-56">Progresso</TableHead>
            {mostrarAcoes && (
              <TableHead className="w-44 text-right">Ações</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const statusLow = (r.atividade.status ?? "").toLowerCase();
            const concluida = statusLow === "concluida";
            const atrasada = statusLow === "atrasada";
            const critica = Boolean(r.atividade.is_critica);
            const qtd = r.atividade.quantidade_prevista;
            const un = r.atividade.unidade;
            return (
            <TableRow
              key={r.atividade.id}
              className={cn(
                concluida && "bg-green-500/5 hover:bg-green-500/10",
                !concluida && atrasada && "bg-destructive/5 hover:bg-destructive/10",
                !concluida && !atrasada && critica && "bg-orange-500/5 hover:bg-orange-500/10",
              )}
            >
              <TableCell className="font-mono text-xs">
                {r.atividade.outline_number ?? r.atividade.codigo_wbs ?? "—"}
              </TableCell>
              <TableCell>
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span>{r.atividade.nome}</span>
                  {critica && (
                    <Badge
                      variant={atrasada ? "destructive" : concluida ? "outline" : "default"}
                      className={cn(
                        "text-[10px] py-0",
                        !atrasada && !concluida && "bg-orange-600 hover:bg-orange-700 text-white border-transparent",
                      )}
                      title="Atividade marcada como crítica no MS Project."
                    >
                      Crítica
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  Período total: {formatarPeriodoBR(r.atividade.data_inicio, r.atividade.data_fim)}
                  {qtd != null && un ? ` · Qtd planejada: ${Number(qtd).toLocaleString("pt-BR")} ${un}` : ""}
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
              <TableCell>
                <ProgressoAtividadeCell
                  status_tecnico={r.atividade.status}
                  percentual_manual={r.atividade.percentual_manual ?? null}
                  percentual_concluido_importado={r.atividade.percentual_concluido_importado ?? null}
                  observacao={r.atividade.percentual_manual_observacao ?? null}
                  atualizadoEm={r.atividade.percentual_manual_atualizado_em ?? null}
                />
              </TableCell>
              {mostrarAcoes && (
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {podeAndamento && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Atualizar andamento"
                        title="Atualizar andamento manual da atividade"
                        onClick={() => onAtualizarAndamento?.(r.atividade.id)}
                      >
                        <Gauge className="h-4 w-4" />
                      </Button>
                    )}
                    {podeEditar && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Editar atividade do cronograma"
                        title="Edita a atividade do cronograma inteira (não apenas esta semana)."
                        onClick={() => onEditarAtividade?.(r.atividade.id)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {podeRecursos && (
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
                    )}
                  </div>
                </TableCell>
              )}
            </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TabelaAtividadesSemanal;
