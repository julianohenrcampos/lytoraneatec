/**
 * CT-5 Builder — Rail esquerda: CAMINHÕES DISPONÍVEIS em mini-cards arrastáveis.
 *
 * Fonte ÚNICA: `fn_ct_ativos_movimentacao_listar` (via useCtAtivosMovimentacao),
 * com busca server-side. Regras invioláveis mantidas:
 *  - nenhum ativo é escondido: bloqueado aparece, porém não é arrastável;
 *  - elegibilidade NUNCA é recalculada no cliente;
 *  - erro técnico da consulta não é apresentado como "nenhum caminhão".
 * Arrastar é aceleração: existe fallback por clique em todos os cards.
 */
import React, { useEffect, useMemo, useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle, GripVertical, Plus, Truck } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCtAtivosMovimentacao } from "@/hooks/central-transporte/useCtMovDireta";
import { puxDragId } from "@/lib/central-transporte/puxadaBuilder";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
} from "@/types/centralTransporteMovDireta";

const STATUS_LABEL: Record<string, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_REGISTRO: "Sem registro",
};

interface ItemProps {
  ativo: CtAtivoMovimentacao;
  jaEscolhido: boolean;
  desabilitado: boolean;
  onAdicionar: () => void;
}

const CaminhaoMiniCard: React.FC<ItemProps> = ({
  ativo,
  jaEscolhido,
  desabilitado,
  onAdicionar,
}) => {
  const bloqueado = !ativo.elegivel;
  const arrastavel = !desabilitado && !bloqueado && !jaEscolhido;
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: puxDragId("PUX_CAMINHAO", ativo.equipamentoId),
    disabled: !arrastavel,
    /* O card carrega o ativo autoritativo do servidor para o canvas. */
    data: { ativo },
  });

  const tom = jaEscolhido
    ? "border-primary/40 bg-primary/5"
    : bloqueado
      ? "border-destructive/40 bg-destructive/5"
      : "border-emerald-600/40 bg-emerald-600/5";

  return (
    <div
      ref={setNodeRef}
      data-testid={`ct5-rail-caminhao-${ativo.equipamentoId}`}
      data-bloqueado={bloqueado ? "true" : "false"}
      data-escolhido={jaEscolhido ? "true" : "false"}
      title={ativo.bloqueioMotivo ?? undefined}
      className={cn(
        "rounded-md border p-1.5 text-[11px]",
        tom,
        isDragging && "opacity-50",
      )}
    >
      <div className="flex items-center gap-1">
        {arrastavel && (
          <button
            type="button"
            aria-label={`Arrastar ${rotuloAtivoMovimentacao(ativo)}`}
            className="cursor-grab text-muted-foreground"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        <span className="min-w-0 flex-1 truncate font-medium">
          {rotuloAtivoMovimentacao(ativo)}
        </span>
        {arrastavel && (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-5 w-5 shrink-0"
            aria-label={`Adicionar ${rotuloAtivoMovimentacao(ativo)} à puxada`}
            onClick={onAdicionar}
            data-testid={`ct5-rail-adicionar-${ativo.equipamentoId}`}
          >
            <Plus className="h-3 w-3" />
          </Button>
        )}
      </div>
      <p className="truncate text-[10px] text-muted-foreground">
        {ativo.placa || ativo.tipoAtivo || "Sem placa"}
      </p>
      <p className="truncate text-[10px] text-muted-foreground">
        {jaEscolhido
          ? "Já nesta puxada"
          : bloqueado
            ? ativo.bloqueioMotivo ?? "Indisponível"
            : STATUS_LABEL[ativo.statusOperacional] ?? ativo.statusOperacional}
      </p>
    </div>
  );
};

export interface CaminhoesRailProps {
  jaEscolhidos: Set<string>;
  desabilitado: boolean;
  onAdicionar: (ativo: CtAtivoMovimentacao) => void;
}

export const CaminhoesRail: React.FC<CaminhoesRailProps> = ({
  jaEscolhidos,
  desabilitado,
  onAdicionar,
}) => {
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermoAplicado(termo.trim()), 350);
    return () => clearTimeout(t);
  }, [termo]);

  const { ativos, isLoading, error } = useCtAtivosMovimentacao(termoAplicado || null);

  const vazio = useMemo(
    () =>
      termoAplicado
        ? `Nenhum caminhão encontrado para “${termoAplicado}”.`
        : "Nenhum ativo no seu escopo de acesso.",
    [termoAplicado],
  );

  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid="ct5-rail-caminhoes">
      <div className="flex items-center justify-between gap-1">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
          <Truck className="h-3.5 w-3.5" /> Caminhões
        </p>
        <Badge variant="outline" className="text-[10px]">
          {ativos.length}
        </Badge>
      </div>

      <Input
        value={termo}
        placeholder="Buscar frota/placa..."
        className="h-7 text-[11px]"
        onChange={(e) => setTermo(e.target.value)}
        data-testid="ct5-rail-busca"
      />

      {error && (
        <Alert variant="destructive" data-testid="ct5-rail-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Falha ao carregar o catálogo</AlertTitle>
          <AlertDescription className="text-[11px]">
            Erro técnico da consulta (não significa “nenhum caminhão”). Tente novamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
        {isLoading ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : ativos.length === 0 && !error ? (
          <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            {vazio}
          </p>
        ) : (
          ativos.map((a) => (
            <CaminhaoMiniCard
              key={a.equipamentoId}
              ativo={a}
              jaEscolhido={jaEscolhidos.has(a.equipamentoId)}
              desabilitado={desabilitado}
              onAdicionar={() => onAdicionar(a)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default CaminhoesRail;
