/**
 * CT-4 UX — Seletor de ATIVO EXISTENTE ("+ Planejar ativo").
 *
 * Este é o ÚNICO lugar do módulo que consulta o catálogo de Caminhões e
 * Equipamentos (RPC fn_ct_ativos_movimentacao_listar, busca server-side por
 * termo). Selecionar um ativo apenas referencia o ID existente no planejamento
 * atual: nada é criado no cadastro e nenhuma disponibilidade é inventada.
 */
import React, { useEffect, useState } from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCtAtivosMovimentacao } from "@/hooks/central-transporte/useCtMovDireta";
import {
  rotuloAtivoMovimentacao,
  type CtAtivoMovimentacao,
} from "@/types/centralTransporteMovDireta";

/** Rótulos amigáveis dos status reais de bd_disponibilidade_equipamentos. */
const DISPONIBILIDADE: Record<string, string> = {
  DISPONIVEL: "Disponível",
  ALOCADO: "Alocado",
  MANUTENCAO: "Em manutenção",
  INDISPONIVEL: "Indisponível",
  SEM_REGISTRO: "Sem registro",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ativos que já participam da movimentação atual. */
  jaPlanejados: Set<string>;
  onSelecionar: (ativo: CtAtivoMovimentacao) => void;
}

const SelecionarAtivoDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  jaPlanejados,
  onSelecionar,
}) => {
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermoAplicado(termo.trim()), 350);
    return () => clearTimeout(t);
  }, [termo]);

  const { ativos, isLoading, isFetching } = useCtAtivosMovimentacao(
    termoAplicado || null,
    open,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl" data-testid="ct4-seletor-ativo">
        <DialogHeader>
          <DialogTitle className="text-sm">Selecionar ativo existente</DialogTitle>
          <DialogDescription className="text-[11px]">
            Busque um ativo já cadastrado em Caminhões e Equipamentos. Este seletor não
            cria ativos.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            autoFocus
            value={termo}
            placeholder="Buscar por frota, número, placa ou modelo..."
            className="h-9 pl-7 text-xs"
            data-testid="ct4-seletor-ativo-busca"
            onChange={(e) => setTermo(e.target.value)}
          />
        </div>

        <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : ativos.length === 0 ? (
            <p className="py-4 text-center text-[11px] text-muted-foreground">
              {termoAplicado
                ? `Nenhum ativo encontrado para "${termoAplicado}".`
                : "Nenhum ativo disponível no seu escopo."}
            </p>
          ) : (
            ativos.map((a) => {
              const planejado = jaPlanejados.has(a.equipamentoId);
              const desabilitado = planejado || !a.elegivel;
              const status = DISPONIBILIDADE[a.statusOperacional] ?? a.statusOperacional;
              return (
                <button
                  key={a.equipamentoId}
                  type="button"
                  disabled={desabilitado}
                  data-testid={`ct4-seletor-ativo-${a.equipamentoId}`}
                  className="w-full rounded-md border px-2.5 py-2 text-left leading-tight transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
                  onClick={() => {
                    onSelecionar(a);
                    onOpenChange(false);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-xs font-medium">{rotuloAtivoMovimentacao(a)}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">
                      {planejado ? "Já planejado" : status}
                    </Badge>
                  </div>
                  {(a.tipoAtivo || a.modelo) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {[a.tipoAtivo, a.modelo].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="truncate text-[11px] text-muted-foreground">
                    Placa: {a.placa ?? "—"} · CC atual: {a.centroCustoLabel ?? "não informado"}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    Disponibilidade: {status}
                    {!a.elegivel && a.bloqueioMotivo ? ` — ${a.bloqueioMotivo}` : ""}
                  </p>
                </button>
              );
            })
          )}
          {isFetching && !isLoading && (
            <p className="text-[11px] text-muted-foreground">Buscando ativos...</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SelecionarAtivoDialog;
