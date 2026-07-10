// Fase 6F.2 — Modal "Ver versões" do Centro de Custo.
// Reaproveita as ações de PlanejamentosListSection. SuperAdm vê ações sensíveis;
// demais usuários veem apenas leitura. RLS continua governando a consulta.
import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MoreVertical,
  Pencil,
  Archive,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatarDataBR } from "../shared/formatData";
import { StatusBadge } from "../shared/StatusBadge";
import type { PlanejamentoObraRow } from "@/services/planejamentoMacro/planejamentoMacroService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  planejamentos: PlanejamentoObraRow[];
  isLoading: boolean;
  isSuperAdmin: boolean;
  /** Deriva do RBAC: SuperAdm ou engenharia_planejamento_macro_ativar/aprovar */
  canAtivarPlanejamento?: boolean;
  ccLabel?: string | null;
  onEdit: (p: PlanejamentoObraRow) => void;
  onTornarVigente: (p: PlanejamentoObraRow) => void;
  onArquivar: (p: PlanejamentoObraRow) => void;
  onExcluir: (p: PlanejamentoObraRow) => void;
}

const Row: React.FC<{
  p: PlanejamentoObraRow;
  isSuperAdmin: boolean;
  canAtivar: boolean;
  onEdit: () => void;
  onTornarVigente: () => void;
  onArquivar: () => void;
  onExcluir: () => void;
}> = ({ p, isSuperAdmin, canAtivar, onEdit, onTornarVigente, onArquivar, onExcluir }) => {
  const isVigente = p.status === "vigente";
  const podeExcluir = p.status !== "vigente";
  const podeTornarVigente = canAtivar && p.status === "rascunho";
  // Menu aparece se pelo menos uma ação está disponível.
  const temAlgumaAcao = isSuperAdmin || podeTornarVigente;
  const ultimaAtualizacao =
    (p as any).updated_at ?? (p as any).created_at ?? null;
  const aprovadoEm = (p as any).aprovado_em ?? null;
  return (
    <div
      className={cn(
        "rounded-md border border-border px-3 py-2",
        isVigente && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr_auto] items-center gap-2 md:gap-4">
        <div className="text-sm">
          <span className="font-medium">
            {formatarDataBR(p.periodo_inicio)} → {formatarDataBR(p.periodo_fim)}
          </span>
        </div>
        <div className="text-sm text-muted-foreground">v{p.versao}</div>
        <div>
          <StatusBadge status={p.status} />
        </div>
        <div className="text-sm text-muted-foreground capitalize">{p.origem}</div>
        <div className="flex justify-end">
          {temAlgumaAcao ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Ações">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isSuperAdmin && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar informações da versão
                  </DropdownMenuItem>
                )}
                {podeTornarVigente && (
                  <DropdownMenuItem onClick={onTornarVigente}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Tornar vigente
                  </DropdownMenuItem>
                )}
                {isSuperAdmin && p.status === "vigente" && (
                  <DropdownMenuItem onClick={onArquivar}>
                    <Archive className="h-4 w-4 mr-2" />
                    Arquivar
                  </DropdownMenuItem>
                )}
                {isSuperAdmin && (
                  <DropdownMenuItem
                    onClick={onExcluir}
                    disabled={!podeExcluir}
                    className={cn(podeExcluir && "text-destructive focus:text-destructive")}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-xs text-muted-foreground italic pr-2">
              somente leitura
            </span>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
        {ultimaAtualizacao && (
          <span>
            Última atualização: {formatarDataBR(String(ultimaAtualizacao).slice(0, 10))}
          </span>
        )}
        {aprovadoEm && (
          <span>
            Aprovação: {formatarDataBR(String(aprovadoEm).slice(0, 10))}
          </span>
        )}
      </div>
      {p.observacao && (
        <p className="text-xs text-muted-foreground mt-1.5 whitespace-pre-wrap">
          {p.observacao}
        </p>
      )}
    </div>
  );
};

const PlanejamentosVersoesDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  planejamentos,
  isLoading,
  isSuperAdmin,
  canAtivarPlanejamento = false,
  ccLabel,
  onEdit,
  onTornarVigente,
  onArquivar,
  onExcluir,
}) => {
  const count = planejamentos.length;
  const podeAgirEmAlgo = isSuperAdmin || canAtivarPlanejamento;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Histórico de versões</DialogTitle>
          <DialogDescription>
            {ccLabel
              ? `Versões importadas e manuais do Centro de Custo ${ccLabel}.`
              : "Versões importadas e manuais do Centro de Custo selecionado."}
            {!podeAgirEmAlgo && " Modo somente leitura."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : count === 0 ? (
            <p className="text-sm text-muted-foreground px-1 py-6 text-center">
              Nenhum planejamento registrado para este Centro de Custo.
            </p>
          ) : (
            <>
              <div className="hidden md:grid md:grid-cols-[1.6fr_0.5fr_0.8fr_0.8fr_auto] gap-4 px-3 pb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                <div>Período</div>
                <div>Versão</div>
                <div>Status</div>
                <div>Origem</div>
                <div className="w-8" />
              </div>
              <div className="space-y-2">
                {planejamentos.map((p) => (
                  <Row
                    key={p.id}
                    p={p}
                    isSuperAdmin={isSuperAdmin}
                    canAtivar={canAtivarPlanejamento}
                    onEdit={() => onEdit(p)}
                    onTornarVigente={() => onTornarVigente(p)}
                    onArquivar={() => onArquivar(p)}
                    onExcluir={() => onExcluir(p)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanejamentosVersoesDialog;
