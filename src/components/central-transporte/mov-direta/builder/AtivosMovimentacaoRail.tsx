/**
 * CT-4 Builder — Rail esquerda: ATIVOS DISPONÍVEIS.
 *
 * Fonte ÚNICA: `fn_ct_ativos_movimentacao_listar` (uma consulta, busca
 * server-side, cache React Query). Ativos já vinculados a paradas aparecem
 * primeiro; bloqueados continuam visíveis e não vinculáveis.
 */
import React, { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useCtAtivosMovimentacao } from "@/hooks/central-transporte/useCtMovDireta";
import type { CtAtivoMovimentacao } from "@/types/centralTransporteMovDireta";
import MovAtivoMiniCard from "./MovAtivoMiniCard";

export interface AtivosMovimentacaoRailProps {
  /** Metadados já conhecidos (hidratação após F5) — mesclados ao catálogo. */
  conhecidos: Map<string, CtAtivoMovimentacao>;
  /** Parada de cada ativo já vinculado. */
  vinculos: Map<string, string>;
  paradas: { chaveLocal: string; rotulo: string }[];
  desabilitado: boolean;
  onVincular: (equipamentoId: string, chaveLocal: string, ativo: CtAtivoMovimentacao) => void;
  onRetirar: (equipamentoId: string) => void;
}

export const AtivosMovimentacaoRail: React.FC<AtivosMovimentacaoRailProps> = ({
  conhecidos,
  vinculos,
  paradas,
  desabilitado,
  onVincular,
  onRetirar,
}) => {
  const [termo, setTermo] = useState("");
  const [termoAplicado, setTermoAplicado] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setTermoAplicado(termo.trim()), 350);
    return () => clearTimeout(t);
  }, [termo]);

  const { ativos, isLoading, error } = useCtAtivosMovimentacao(termoAplicado || null);

  /** Catálogo do servidor + ativos já vinculados que a janela atual não trouxe. */
  const lista = useMemo(() => {
    const mapa = new Map<string, CtAtivoMovimentacao>();
    for (const a of ativos) mapa.set(a.equipamentoId, a);
    for (const [id, a] of conhecidos) if (vinculos.has(id) && !mapa.has(id)) mapa.set(id, a);
    return Array.from(mapa.values()).sort((a, b) => {
      const va = vinculos.has(a.equipamentoId) ? 0 : 1;
      const vb = vinculos.has(b.equipamentoId) ? 0 : 1;
      if (va !== vb) return va - vb;
      return 0;
    });
  }, [ativos, conhecidos, vinculos]);

  return (
    <div className="flex min-h-0 flex-col gap-2" data-testid="ct4-rail-ativos">
      <div className="flex items-center justify-between gap-1">
        <p className="flex items-center gap-1 text-[11px] font-semibold uppercase text-muted-foreground">
          <Boxes className="h-3.5 w-3.5" /> Ativos
        </p>
        <Badge variant="outline" className="text-[10px]">
          {lista.length}
        </Badge>
      </div>

      <Input
        value={termo}
        placeholder="Buscar frota/placa..."
        className="h-7 text-[11px]"
        onChange={(e) => setTermo(e.target.value)}
        data-testid="ct4-rail-busca"
      />

      {error && (
        <Alert variant="destructive" data-testid="ct4-rail-erro">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle className="text-xs">Falha ao carregar o catálogo</AlertTitle>
          <AlertDescription className="text-[11px]">
            Erro técnico da consulta (não significa “nenhum ativo”). Tente novamente.
          </AlertDescription>
        </Alert>
      )}

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
        {isLoading && lista.length === 0 ? (
          <>
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </>
        ) : lista.length === 0 && !error ? (
          <p className="rounded-md border border-dashed p-3 text-center text-[11px] text-muted-foreground">
            {termoAplicado
              ? `Nenhum ativo encontrado para “${termoAplicado}”.`
              : "Nenhum ativo no seu escopo de acesso."}
          </p>
        ) : (
          lista.map((a) => (
            <MovAtivoMiniCard
              key={a.equipamentoId}
              ativo={a}
              paradaRotulo={vinculos.get(a.equipamentoId) ?? null}
              desabilitado={desabilitado}
              paradas={paradas}
              onVincular={(chave) => onVincular(a.equipamentoId, chave, a)}
              onRetirar={() => onRetirar(a.equipamentoId)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default AtivosMovimentacaoRail;
