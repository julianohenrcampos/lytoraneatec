/**
 * CT-2 / M4 — Painel de atendimentos do item (listagem + contadores).
 * Contadores vêm exclusivamente da RPC; nada é calculado localmente.
 */
import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Ban, Undo2, Replace } from "lucide-react";
import { formatDateBR } from "@/utils/formatDateBR";
import {
  CT_ATENDIMENTO_STATUS_LABELS,
  CT_MODALIDADE_LABELS,
  type CtAtendimento,
  type CtContadores,
} from "@/types/centralTransporteCT2";

interface Props {
  loading: boolean;
  contadores: CtContadores | null;
  atendimentos: CtAtendimento[];
  canEditar: boolean;
  canCriar: boolean;
  onEncerrar: (a: CtAtendimento) => void;
  onSubstituir: (a: CtAtendimento) => void;
  bloqueioMotivo?: string | null;
}

const CONTADOR_LABELS: Array<{ key: keyof CtContadores; label: string }> = [
  { key: "pendentes", label: "Pendentes" },
  { key: "comprometidos", label: "Comprometidos" },
  { key: "reservado", label: "Reservado" },
  { key: "em_transporte", label: "Em transporte" },
  { key: "entregue", label: "Entregue" },
  { key: "cancelado", label: "Cancelado" },
  { key: "liberado", label: "Liberado" },
  { key: "historico", label: "Histórico" },
];

const AtendimentosItemPanel: React.FC<Props> = ({
  loading,
  contadores,
  atendimentos,
  canEditar,
  canCriar,
  onEncerrar,
  onSubstituir,
  bloqueioMotivo,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin h-5 w-5 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {contadores && (
        <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
          {CONTADOR_LABELS.map(({ key, label }) => (
            <div key={key} className="rounded-md border p-2 text-center bg-muted/30">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="text-sm font-semibold" data-testid={`ct2-contador-${key}`}>
                {contadores[key]}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border overflow-auto max-h-[320px]">
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
            {atendimentos.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-xs text-muted-foreground py-6">
                  Nenhum atendimento registrado para este item.
                </TableCell>
              </TableRow>
            ) : (
              atendimentos.map((a) => {
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
                      <Badge variant="outline" className="text-[10px]">
                        {CT_ATENDIMENTO_STATUS_LABELS[a.status] || a.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {a.periodo_inicio ? formatDateBR(a.periodo_inicio) : "—"}
                      {a.periodo_fim ? ` → ${formatDateBR(a.periodo_fim)}` : ""}
                    </TableCell>
                    <TableCell className="text-xs">{a.match_tipo || "—"}</TableCell>
                    <TableCell className="text-right space-x-1 whitespace-nowrap">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        disabled={!canEditar || !reservado || !!bloqueioMotivo}
                        title={bloqueioMotivo || undefined}
                        onClick={() => onEncerrar(a)}
                      >
                        <Ban className="h-3 w-3" /> Cancelar / Liberar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 h-7 text-xs"
                        disabled={!canEditar || !canCriar || !reservado || !!bloqueioMotivo}
                        title={bloqueioMotivo || undefined}
                        onClick={() => onSubstituir(a)}
                      >
                        <Replace className="h-3 w-3" /> Substituir
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {atendimentos.length > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Undo2 className="h-3 w-3" />
          Cancelar e Liberar dependem apenas de permissão de edição e de atendimento reservado.
        </p>
      )}
    </div>
  );
};

export default AtendimentosItemPanel;
