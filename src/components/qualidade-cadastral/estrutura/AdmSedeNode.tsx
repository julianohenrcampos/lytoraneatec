/**
 * Nós compactos do organograma de responsabilidade.
 * Somente apresentação: todos os indicadores vêm agregados da RPC.
 */
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, UserX } from "lucide-react";
import { scoreClass, scoreBarClass } from "../qualidadeUi";
import type {
  QcEstruturaCc,
  QcEstruturaObra,
  QcEstruturaSede,
} from "@/services/qualidadeCadastralService";

const ATIVOS = ["Ativo", "Ativo sem Registro"];
export const responsavelInativo = (status: string | null | undefined) =>
  !!status && !ATIVOS.includes(status);

function ScoreChip({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("h-1.5 w-6 rounded-full", scoreBarClass(score))} />
      <span className={cn("text-xs font-semibold tabular-nums", scoreClass(score))}>{score}%</span>
    </span>
  );
}

function Metrica({ label, valor, critico }: { label: string; valor: number; critico?: boolean }) {
  return (
    <span className="text-[11px] text-muted-foreground">
      <span className={cn("font-semibold tabular-nums", critico && valor > 0 && "text-destructive")}>
        {valor}
      </span>{" "}
      {label}
    </span>
  );
}

export function CentroCustoNode({
  cc,
  onSelecionar,
}: {
  cc: QcEstruturaCc;
  onSelecionar: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelecionar}
      aria-label={`Centro de custo ${cc.codigo ?? ""} — ${cc.score}% de qualidade`}
      className="flex w-full items-center justify-between gap-2 rounded border border-border/70 bg-background px-2 py-1 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate text-[11px]">
        <span className="font-medium">{cc.codigo ?? "—"}</span>
        <span className="text-muted-foreground"> · {cc.nome ?? "Sem nome"}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {cc.criticas > 0 && (
          <span className="text-[11px] font-semibold text-destructive tabular-nums">
            {cc.criticas} crít.
          </span>
        )}
        <ScoreChip score={cc.score} />
      </span>
    </button>
  );
}

export function AdmObraNode({
  obra,
  onSelecionarObra,
  onSelecionarCc,
}: {
  obra: QcEstruturaObra;
  onSelecionarObra: () => void;
  onSelecionarCc: (cc: QcEstruturaCc) => void;
}) {
  const [aberto, setAberto] = useState(true);
  const semObra = !obra.obra_id;
  return (
    <div className="rounded-md border border-border/70 bg-muted/20 p-2">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSelecionarObra}
          disabled={semObra}
          className={cn(
            "min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded",
            !semObra && "hover:underline",
          )}
        >
          <p className="truncate text-xs font-medium">
            {obra.obra_nome ?? "ADM OBRA não definido"}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ADM Obra</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {responsavelInativo(obra.obra_status) && (
            <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
              Inativo
            </Badge>
          )}
          <ScoreChip score={obra.score} />
          <button
            type="button"
            aria-label={aberto ? "Recolher centros de custo" : "Expandir centros de custo"}
            onClick={() => setAberto((a) => !a)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {aberto ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <Metrica label="CCs" valor={obra.total_cc} />
        <Metrica label="pendências" valor={obra.pendencias} />
        <Metrica label="críticas" valor={obra.criticas} critico />
      </div>
      {aberto && (
        <div className="mt-2 space-y-1 border-l border-border/70 pl-2">
          {obra.centros_custo.map((cc) => (
            <CentroCustoNode key={cc.cc_id} cc={cc} onSelecionar={() => onSelecionarCc(cc)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdmSedeNode({
  sede,
  onSelecionarSede,
  onSelecionarObra,
  onSelecionarCc,
}: {
  sede: QcEstruturaSede;
  onSelecionarSede: () => void;
  onSelecionarObra: (obra: QcEstruturaObra) => void;
  onSelecionarCc: (cc: QcEstruturaCc) => void;
}) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSelecionarSede}
          className="min-w-0 flex-1 rounded text-left hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <p className="truncate text-sm font-semibold">{sede.sede_nome ?? "—"}</p>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ADM Sede</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {responsavelInativo(sede.sede_status) && (
            <Badge variant="outline" className="border-destructive/40 text-[10px] text-destructive">
              Inativo
            </Badge>
          )}
          <ScoreChip score={sede.score} />
          <button
            type="button"
            aria-label={aberto ? "Recolher estrutura" : "Expandir estrutura"}
            onClick={() => setAberto((a) => !a)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3">
        <Metrica label="ADM Obra" valor={sede.total_obras} />
        <Metrica label="CCs" valor={sede.total_cc} />
        <Metrica label="pendências" valor={sede.pendencias} />
        <Metrica label="críticas" valor={sede.criticas} critico />
      </div>
      {aberto && (
        <div className="mt-2 space-y-2 border-l border-border pl-2">
          {sede.adm_obras.map((obra) => (
            <AdmObraNode
              key={obra.obra_id ?? "sem-obra"}
              obra={obra}
              onSelecionarObra={() => onSelecionarObra(obra)}
              onSelecionarCc={onSelecionarCc}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SemResponsabilidadeNode({
  totalCc,
  pendencias,
  criticas,
  centros,
  onSelecionarCc,
  onFiltrar,
}: {
  totalCc: number;
  pendencias: number;
  criticas: number;
  centros: QcEstruturaCc[];
  onSelecionarCc: (cc: QcEstruturaCc) => void;
  onFiltrar: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  if (totalCc === 0) return null;
  return (
    <div className="rounded-lg border border-dashed border-destructive/40 bg-destructive/5 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <UserX className="h-4 w-4 text-destructive" /> Responsabilidade não definida
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-3">
            <Metrica label="CCs sem ADM Sede" valor={totalCc} />
            <Metrica label="pendências" valor={pendencias} />
            <Metrica label="críticas" valor={criticas} critico />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onFiltrar}>
            Filtrar
          </Button>
          <button
            type="button"
            aria-label={aberto ? "Recolher lista" : "Expandir lista"}
            onClick={() => setAberto((a) => !a)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {aberto ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {aberto && (
        <div className="mt-2 space-y-1">
          {centros.map((cc) => (
            <CentroCustoNode key={cc.cc_id} cc={cc} onSelecionar={() => onSelecionarCc(cc)} />
          ))}
        </div>
      )}
    </div>
  );
}
