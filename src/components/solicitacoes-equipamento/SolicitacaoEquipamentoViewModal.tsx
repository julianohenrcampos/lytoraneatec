import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatItemDisplay, isNaoCadastrado } from "@/utils/solicitacaoItemDisplay";
import { formatDateBR } from "@/utils/formatDateBR";
import { getStatusBadgeConfig } from "@/utils/solicitacaoStatus";
import type { SolicitacaoEquipamento } from "@/services/solicitacaoEquipamentoService";

interface Props {
  solicitacao: SolicitacaoEquipamento | null;
  isOpen: boolean;
  onClose: () => void;
}

const CANCEL_MARKER_RE = /\[CANCELADO em ([^\]]+)\]:\s*([\s\S]*)$/m;

const SolicitacaoEquipamentoViewModal: React.FC<Props> = ({ solicitacao, isOpen, onClose }) => {
  if (!solicitacao) return null;
  const s = solicitacao;
  const statusCfg = getStatusBadgeConfig(s.status_fluxo);
  const cancelMatch =
    String(s.status_fluxo) === "CANCELADO" ? CANCEL_MARKER_RE.exec(s.justificativa || "") : null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes da solicitação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <div className="text-muted-foreground">Centro de Custo</div>
              <div className="font-medium">
                {s.codigo_centro_custo
                  ? `${s.codigo_centro_custo}${s.nome_centro_custo ? ` - ${s.nome_centro_custo}` : ""}`
                  : s.nome_centro_custo || "-"}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Engenheiro</div>
              <div className="font-medium">{s.engenheiro_nome || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Apontador</div>
              <div className="font-medium">{s.apontador_nome || "-"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Quantidade</div>
              <div className="font-medium">{s.quantidade}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Prioridade</div>
              <div className="font-medium">{s.prioridade}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Status Fluxo</div>
              <div>
                <Badge variant="outline" className={statusCfg.className}>
                  {statusCfg.label}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Data da Solicitação</div>
              <div className="font-medium">{formatDateBR(s.created_at)}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Data Início</div>
              <div className="font-medium">{formatDateBR(s.data_inicio)}</div>
            </div>
          </div>

          <div className="border rounded-md p-3 bg-muted/20">
            <div className="text-sm font-semibold mb-2">
              Itens ({s.itens?.length ?? 0})
            </div>
            {!s.itens || s.itens.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                {s.descricao_tipo_equipamento || "Sem itens detalhados."}
              </div>
            ) : (
              <ul className="space-y-1.5">
                {s.itens.map((it) => (
                  <li key={it.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{formatItemDisplay(it)}</span>
                    <span className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant="outline" className="text-[10px]">
                        Qtd: {it.quantidade}
                      </Badge>
                      {isNaoCadastrado(it) && (
                        <Badge variant="destructive" className="text-[10px]">
                          Não cadastrado
                        </Badge>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Justificativa</div>
            <div className="text-sm whitespace-pre-wrap border rounded-md p-3 bg-background">
              {s.justificativa?.trim() || "-"}
            </div>
          </div>

          {cancelMatch && (
            <div className="border border-destructive/40 rounded-md p-3 bg-destructive/5 text-sm">
              <div className="font-semibold text-destructive mb-1">Cancelamento</div>
              <div><span className="text-muted-foreground">Registro:</span> {cancelMatch[1]}</div>
              <div className="mt-1 whitespace-pre-wrap"><span className="text-muted-foreground">Motivo:</span> {cancelMatch[2].trim()}</div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SolicitacaoEquipamentoViewModal;
