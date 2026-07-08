import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  useEmitirOrdemDiaria,
  useCancelarOrdemDiaria,
  useOrdemDiaria,
} from "@/hooks/planejamentoMacro/useOrdensDiarias";
import { generateOrdemDiariaPdf } from "@/services/pdf/ordemDiariaObraPdf";
import { usePermission } from "@/hooks/usePermission";
import { FileText, XCircle, Send, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ordemId: string | null;
  ccLabel: string | null;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(new Date(iso + (iso.length === 10 ? "T12:00:00" : "")), "dd/MM/yyyy", {
      locale: ptBR,
    });
  } catch {
    return "—";
  }
}

function statusBadge(status: string) {
  if (status === "emitida")
    return <Badge className="bg-emerald-600 hover:bg-emerald-700">Emitida</Badge>;
  if (status === "cancelada") return <Badge variant="destructive">Cancelada</Badge>;
  return <Badge variant="secondary">Rascunho</Badge>;
}

const VisualizarOrdemDiariaDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  ordemId,
  ccLabel,
}) => {
  const { data: ordem, isLoading } = useOrdemDiaria(ordemId);
  const emitir = useEmitirOrdemDiaria();
  const cancelar = useCancelarOrdemDiaria();
  const { hasActionPermission } = usePermission();
  const canEmitir = hasActionPermission("engenharia_ordem_diaria_emitir", "aprovar");

  const [confirmandoCancelar, setConfirmandoCancelar] = useState(false);
  const [motivo, setMotivo] = useState("");

  // FASE A: rascunho vencido não edita nem emite. Cancelamento permanece permitido.
  const hojeBR = getCurrentBrazilianDate();
  const rascunhoVencido = Boolean(
    ordem && ordem.status === "rascunho" && ordem.data_ordem < hojeBR,
  );

  const handleEmitir = async () => {
    if (!ordem) return;
    await emitir.mutateAsync(ordem.id);
  };
  const handleCancelar = async () => {
    if (!ordem) return;
    if (motivo.trim().length < 10) return;
    await cancelar.mutateAsync({ ordemId: ordem.id, motivo: motivo.trim() });
    setConfirmandoCancelar(false);
    setMotivo("");
  };
  const handlePdf = () => {
    if (!ordem) return;
    generateOrdemDiariaPdf(ordem, ccLabel);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Ordem Diária {ordem && `— ${fmtDate(ordem.data_ordem)}`}
            {ordem && statusBadge(ordem.status)}
          </DialogTitle>
          <DialogDescription>
            Snapshot da programação do dia. Ordens emitidas não podem ser alteradas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
        ) : !ordem ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Ordem não encontrada.</p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4 text-sm">
              {rascunhoVencido && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Ordem Diária vencida</AlertTitle>
                  <AlertDescription>
                    Não é possível editar nem emitir. Replaneje a atividade para uma data atual ou futura.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <span className="text-muted-foreground">Centro de Custo:</span>{" "}
                  <strong>{ccLabel ?? "—"}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Semana:</span>{" "}
                  {fmtDate(ordem.semana_inicio)} a {fmtDate(ordem.semana_fim)}
                </div>
                <div>
                  <span className="text-muted-foreground">Responsável:</span>{" "}
                  <strong>{ordem.responsavel_nome_snapshot ?? "—"}</strong>
                  {ordem.responsavel_funcao_snapshot ? ` (${ordem.responsavel_funcao_snapshot})` : ""}
                </div>
                {ordem.emitido_em && (
                  <div>
                    <span className="text-muted-foreground">Emitida em:</span>{" "}
                    {fmtDate(ordem.emitido_em)}
                  </div>
                )}
                {ordem.cancelado_em && (
                  <div className="md:col-span-2">
                    <span className="text-muted-foreground">Cancelada em:</span>{" "}
                    {fmtDate(ordem.cancelado_em)} — Motivo: {ordem.cancelamento_motivo ?? "—"}
                  </div>
                )}
              </div>

              {ordem.observacao_geral && (
                <div className="border rounded p-2 bg-muted/30">
                  <div className="text-xs text-muted-foreground mb-1">Observação geral</div>
                  <div>{ordem.observacao_geral}</div>
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                {ordem.itens.map((it, idx) => {
                  const critica = Boolean(it.atividade_is_critica_snapshot);
                  const qtd = it.atividade_quantidade_planejada_snapshot;
                  const un = it.atividade_unidade_medida_snapshot;
                  return (
                  <div key={it.id} className="border rounded p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          <span>
                            {idx + 1}. {it.nome_atividade_snapshot}
                          </span>
                          {critica && (
                            <Badge className="text-[10px] bg-orange-600 hover:bg-orange-700 text-white border-transparent">
                              Crítica
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {(it.codigo_eap_snapshot ?? "—") + " · " + (it.frente_servico_snapshot ?? "—")}
                          {qtd != null && un
                            ? ` · Qtd planejada: ${Number(qtd).toLocaleString("pt-BR")} ${un}`
                            : ""}
                        </div>
                      </div>
                      <div className="text-right text-xs">
                        <div>Status: {it.status_atividade_snapshot ?? "—"}</div>
                        <div>
                          %{" "}
                          {it.percentual_snapshot != null
                            ? Number(it.percentual_snapshot).toLocaleString("pt-BR", {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              })
                            : "—"}
                        </div>
                      </div>
                    </div>
                    {it.observacao_item && (
                      <div className="text-xs italic text-muted-foreground">
                        Observação: {it.observacao_item}
                      </div>
                    )}
                    {it.equipe_snapshot?.length > 0 && (
                      <div className="text-xs">
                        <strong>Equipe:</strong>{" "}
                        {it.equipe_snapshot
                          .map((e) => `${e.nome ?? "—"}${e.funcao ? ` (${e.funcao})` : ""}`)
                          .join("; ")}
                      </div>
                    )}
                    {it.equipamentos_snapshot?.length > 0 && (
                      <div className="text-xs">
                        <strong>Equipamentos:</strong>{" "}
                        {it.equipamentos_snapshot
                          .map((r) => `${r.descricao}${r.quantidade ? ` (${r.quantidade} ${r.unidade ?? ""})` : ""}`)
                          .join("; ")}
                      </div>
                    )}
                    {it.materiais_snapshot?.length > 0 && (
                      <div className="text-xs">
                        <strong>Materiais:</strong>{" "}
                        {it.materiais_snapshot
                          .map((r) => `${r.descricao}${r.quantidade ? ` (${r.quantidade} ${r.unidade ?? ""})` : ""}`)
                          .join("; ")}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>

              {confirmandoCancelar && (
                <div className="border border-destructive/40 bg-destructive/5 rounded p-3 space-y-2">
                  <div className="text-sm font-medium">Cancelar Ordem Diária</div>
                  <Textarea
                    rows={2}
                    maxLength={500}
                    placeholder="Motivo do cancelamento (mín. 10 caracteres)"
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                  <div className="flex gap-2 justify-end">
                    <Button variant="outline" size="sm" onClick={() => setConfirmandoCancelar(false)}>
                      Voltar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelar}
                      disabled={cancelar.isPending || motivo.trim().length < 10}
                    >
                      Confirmar cancelamento
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {ordem && (
            <Button variant="secondary" onClick={handlePdf}>
              <FileText className="h-4 w-4 mr-2" />
              Exportar PDF
            </Button>
          )}
          {ordem && ordem.status === "rascunho" && canEmitir && !rascunhoVencido && (
            <Button onClick={handleEmitir} disabled={emitir.isPending}>
              <Send className="h-4 w-4 mr-2" />
              {emitir.isPending ? "Emitindo..." : "Emitir"}
            </Button>
          )}
          {ordem && ordem.status !== "cancelada" && canEmitir && !confirmandoCancelar && (
            <Button variant="destructive" onClick={() => setConfirmandoCancelar(true)}>
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar ordem
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default VisualizarOrdemDiariaDialog;
