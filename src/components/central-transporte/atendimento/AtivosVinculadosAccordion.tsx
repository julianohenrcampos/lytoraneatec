/**
 * CT-3B.2 — Ativos já vinculados ao item, sob demanda.
 *
 * Substitui o bloco "Atendimentos do item" na página dedicada: sem as oito
 * caixas de contadores (já presentes no cabeçalho e no resumo do item) e sem
 * tabela vazia. Se não há atendimento, o componente não renderiza nada.
 *
 * As ações Cancelar/Liberar e Substituir permanecem inalteradas (RPCs CT-2).
 */
import React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ban, Replace } from "lucide-react";
import { formatDateBR } from "@/utils/formatDateBR";
import {
  CT_ATENDIMENTO_STATUS_LABELS,
  CT_MODALIDADE_LABELS,
  type CtAtendimento,
} from "@/types/centralTransporteCT2";
import {
  AVISO_MOBILIZACAO_DERIVADA,
  LABEL_MOBILIZACAO_DERIVADA,
} from "@/utils/central-transporte/situacaoNaCentral";

interface Props {
  loading: boolean;
  atendimentos: CtAtendimento[];
  canEditar: boolean;
  canCriar: boolean;
  onEncerrar: (a: CtAtendimento) => void;
  onSubstituir: (a: CtAtendimento) => void;
  bloqueioMotivo?: string | null;
  /** Fecha o accordion ao trocar de item (chave de remontagem). */
  chaveReset?: string | null;
}

export const AtivosVinculadosAccordion: React.FC<Props> = ({
  loading,
  atendimentos,
  canEditar,
  canCriar,
  onEncerrar,
  onSubstituir,
  bloqueioMotivo,
  chaveReset,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-4" data-testid="ct3b2-vinculados-loading">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Sem atendimento: a seção simplesmente não existe.
  if (atendimentos.length === 0) return null;

  return (
    <Accordion
      type="single"
      collapsible
      key={chaveReset ?? "vinculados"}
      data-testid="ct3b2-vinculados"
    >
      <AccordionItem value="vinculados" className="rounded-md border px-3">
        <AccordionTrigger className="text-xs font-semibold" data-testid="ct3b2-vinculados-trigger">
          Ativos já vinculados ({atendimentos.length})
        </AccordionTrigger>
        <AccordionContent>
          <div className="max-h-[320px] overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Equipamento</TableHead>
                  <TableHead className="text-xs">Modalidade</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Período</TableHead>
                  <TableHead className="text-xs">Match</TableHead>
                  <TableHead className="text-xs text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {atendimentos.map((a) => {
                  const reservado = a.status === "RESERVADO";
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs">
                        {[a.equipamento_frota, a.equipamento_numero].filter(Boolean).join(" ") ||
                          a.equipamento_placa ||
                          "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {CT_MODALIDADE_LABELS[a.modalidade] || a.modalidade}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          <Badge variant="outline" className="text-[10px]">
                            {CT_ATENDIMENTO_STATUS_LABELS[a.status] || a.status}
                          </Badge>
                          {/* CT-2.4: reserva existe desde já; mobilização é derivada. */}
                          {reservado && (
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                              title={AVISO_MOBILIZACAO_DERIVADA}
                              data-testid={`ct24-vinculado-mobilizacao-${a.id}`}
                            >
                              {LABEL_MOBILIZACAO_DERIVADA}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {a.periodo_inicio ? formatDateBR(a.periodo_inicio) : "—"}
                        {a.periodo_fim ? ` → ${formatDateBR(a.periodo_fim)}` : ""}
                      </TableCell>
                      <TableCell className="text-xs">{a.match_tipo || "—"}</TableCell>
                      <TableCell className="space-x-1 whitespace-nowrap text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          data-testid={`ct3b2-vinculado-encerrar-${a.id}`}
                          disabled={!canEditar || !reservado || !!bloqueioMotivo}
                          title={bloqueioMotivo || undefined}
                          onClick={() => onEncerrar(a)}
                        >
                          <Ban className="h-3 w-3" /> Cancelar / Liberar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          data-testid={`ct3b2-vinculado-substituir-${a.id}`}
                          disabled={!canEditar || !canCriar || !reservado || !!bloqueioMotivo}
                          title={bloqueioMotivo || undefined}
                          onClick={() => onSubstituir(a)}
                        >
                          <Replace className="h-3 w-3" /> Substituir
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AtivosVinculadosAccordion;
