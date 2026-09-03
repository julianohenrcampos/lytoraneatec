/**
 * CT-3E — Grade leve de mini-cards de ativos candidatos.
 *
 * Substitui a tabela pesada na etapa "Atender". Mantém a diferenciação
 * Recomendados (departamento preferencial) × Alternativas usando o MESMO
 * agrupador já validado (`agruparCandidatosPorDepartamento`), sem filtrar
 * nenhum candidato elegível.
 */
import React, { useMemo, useState } from "react";
import { RefreshCw, Search } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  filtrarAtivosPorBusca,
  type AnaliseOperacional,
  type AtivoAnalise,
} from "@/services/centralTransporteService";
import type { CtCandidateOrigem, CtCandidateSelection } from "@/types/centralTransporteCT2";
import type {
  CtEstadoConsultaStatus,
  CtEstadoEfetivoMap,
} from "@/types/centralTransporteEstadoEfetivo";
import { agruparCandidatosPorDepartamento } from "@/utils/central-transporte/agruparCandidatosPorDepartamento";
import { toCandidateSelection } from "@/utils/central-transporte/ctCandidateAdapter";
import AtivoMiniCard from "./AtivoMiniCard";

/** Origem canônica de cada bloco da análise (contrato CT-2 preservado). */
const ORIGENS: { chave: keyof AnaliseOperacional; origem: CtCandidateOrigem }[] = [
  { chave: "disponibilidadePropria", origem: "PROPRIA" },
  { chave: "disponibilidadeGrupo", origem: "GRUPO" },
  { chave: "equipamentosComPrevisao", origem: "PREVISAO" },
  { chave: "externoLocado", origem: "PREVISAO" },
  { chave: "naoClassificado", origem: "PROPRIA" },
];

interface Props {
  analise: AnaliseOperacional;
  estados: CtEstadoEfetivoMap;
  estadoStatus?: CtEstadoConsultaStatus;
  estadoErro?: { code: string | null; message: string | null; hint: string | null } | null;
  onRetryEstados?: () => void;
  selectedId: string | null;
  departamentoPreferencialId?: string | null;
  departamentoPreferencialNome?: string | null;
  podeOperar: boolean;
  onSelect: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  /** Fallback sem drag: vincula imediatamente o ativo ao item em foco. */
  onVincular?: (ativo: AtivoAnalise, origem: CtCandidateOrigem) => void;
  /**
   * CT-9 — modo RAIL: coluna única, altura herdada do rail (sem max-h fixo) e
   * placeholder curto. Apresentação apenas: fonte e elegibilidade inalteradas.
   */
  compacto?: boolean;
}

export const AtivosCandidatosCards: React.FC<Props> = ({
  analise,
  estados,
  estadoStatus,
  estadoErro = null,
  onRetryEstados,
  selectedId,
  departamentoPreferencialId = null,
  departamentoPreferencialNome = null,
  podeOperar,
  onSelect,
  onVincular,
  compacto = false,
}) => {
  const [busca, setBusca] = useState("");

  /** origem por equipamento — preserva a semântica dos blocos da análise. */
  const origemPorId = useMemo(() => {
    const m = new Map<string, CtCandidateOrigem>();
    for (const { chave, origem } of ORIGENS) {
      const lista = (analise[chave] ?? []) as AtivoAnalise[];
      for (const a of lista) if (!m.has(a.equipamento_id)) m.set(a.equipamento_id, origem);
    }
    return m;
  }, [analise]);

  const todos = useMemo(() => {
    const vistos = new Set<string>();
    const out: AtivoAnalise[] = [];
    for (const { chave } of ORIGENS) {
      for (const a of ((analise[chave] ?? []) as AtivoAnalise[])) {
        if (vistos.has(a.equipamento_id)) continue;
        vistos.add(a.equipamento_id);
        out.push(a);
      }
    }
    return out;
  }, [analise]);

  const grupos = useMemo(
    () =>
      agruparCandidatosPorDepartamento(
        filtrarAtivosPorBusca(todos, busca),
        departamentoPreferencialId,
        departamentoPreferencialNome,
      ),
    [todos, busca, departamentoPreferencialId, departamentoPreferencialNome],
  );

  const candidatoDe = (a: AtivoAnalise): CtCandidateSelection | null =>
    toCandidateSelection(
      a,
      origemPorId.get(a.equipamento_id) ?? "PROPRIA",
      estados.get(a.equipamento_id) ?? null,
    );

  return (
    <div
      className={
        compacto
          ? "flex h-full min-h-0 flex-col gap-2"
          : "space-y-2"
      }
      data-testid="ct3e-candidatos-cards"
    >
      {/* Busca FORA da área rolável — nunca sai de vista. */}
      <div className="flex flex-wrap items-center gap-2" data-testid="ct8-busca-fixa">
        <div className={compacto ? "relative min-w-0 flex-1" : "relative min-w-[14rem] flex-1"}>
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder={
              compacto ? "Buscar frota/placa..." : "Buscar por frota, placa, modelo ou centro de custo"
            }
            className="h-8 pl-7 text-xs"
            data-testid="ct3e-busca-ativos"
          />
        </div>
        <span className="text-[11px] text-muted-foreground">
          {todos.length} ativo(s) compatível(is)
        </span>
      </div>

      {estadoStatus === "ERRO" && (
        <Alert variant="destructive" data-testid="ct3e-estado-erro">
          <AlertTitle className="text-xs">Compromisso dos ativos não consultado</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-2 text-xs">
            <span>
              {estadoErro?.message ?? "Falha ao consultar o compromisso efetivo dos ativos."}
            </span>
            {onRetryEstados && (
              <Button size="sm" variant="outline" className="gap-2" onClick={onRetryEstados}>
                <RefreshCw className="h-3.5 w-3.5" /> Tentar novamente
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Painel com scroll INTERNO: a página não cresce com a lista. */}
      <div
        className={
          compacto
            ? "min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain rounded-md border p-2"
            : "space-y-3 overflow-y-auto overscroll-contain rounded-md border p-2 max-h-[calc(100vh-280px)]"
        }
        data-testid="ct8-lista-rolavel"
      >
        {grupos.length === 0 ? (
          <p className="text-xs text-muted-foreground" data-testid="ct3e-sem-candidatos">
            Nenhum ativo compatível para os critérios deste item.
          </p>
        ) : (
          grupos.map((g) => (
            <section key={g.id} className="space-y-2">
              <h4
                className="sticky top-0 z-10 bg-background/95 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur"
                data-testid={`ct3e-grupo-${g.id}`}
              >
                {g.titulo} ({g.candidatos.length})
              </h4>
              <div
                className={
                  compacto ? "grid gap-2 grid-cols-1" : "grid gap-2 grid-cols-2 xl:grid-cols-3"
                }
                data-testid={`ct7-grade-${g.id}`}
              >
                {g.candidatos.map((a) => {
                  const cand = candidatoDe(a);
                  return (
                    <AtivoMiniCard
                      key={a.equipamento_id}
                      ativo={a}
                      candidato={cand}
                      selecionado={selectedId === a.equipamento_id}
                      desabilitado={!podeOperar}
                      onSelecionar={() => onSelect(a, origemPorId.get(a.equipamento_id) ?? "PROPRIA")}
                      onVincular={
                        onVincular && podeOperar
                          ? () => onVincular(a, origemPorId.get(a.equipamento_id) ?? "PROPRIA")
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );

};

export default AtivosCandidatosCards;
