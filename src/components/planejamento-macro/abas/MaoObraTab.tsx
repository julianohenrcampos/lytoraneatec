// Fase 6H.1 / 6H.1.4 — Mão de obra planejada (visão gerencial enxuta).
// Resumo por função apenas. Detalhe por atividade vive na aba Atividades
// (botão "Ver / ajustar recursos").

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Search, Users } from "lucide-react";
import TabHeader from "../shared/TabHeader";
import EmptyState from "../shared/EmptyState";
import PaginationFooter from "../shared/PaginationFooter";
import { usePagination } from "@/hooks/usePagination";
import { useRecursosPorPlanejamento } from "@/hooks/planejamentoMacro/useRecursosPorPlanejamento";
import type { AtividadePlanejada } from "@/types/planejamentoMacro";

interface Props {
  planejamentoId?: string | null;
  hasPlanejamentoReal?: boolean;
  atividades?: AtividadePlanejada[];
}

interface LinhaMO {
  id: string;
  atividadeId: string;
  funcaoNome: string;
  funcaoKey: string;
  frente: string;
  wbs: string;
  quantidade: number;
  horas: number | null;
  dias: number | null;
}

interface ResumoFuncao {
  funcaoKey: string;
  funcaoNome: string;
  qtdTotal: number;
  horasTotais: number;
  diasHomem: number;
  atividadesDistintas: number;
  inicio: string | null;
  fim: string | null;
}

const PAGE_SIZE = 10;

const fmtData = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
};

const fmtNum = (n: number) =>
  n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

const MaoObraTab: React.FC<Props> = ({
  planejamentoId = null,
  hasPlanejamentoReal = false,
  atividades = [],
}) => {
  const recursos = useRecursosPorPlanejamento(planejamentoId, "mao_obra");

  const atividadesById = useMemo(() => {
    const map: Record<string, AtividadePlanejada> = {};
    for (const a of atividades) map[a.id] = a;
    return map;
  }, [atividades]);

  const linhas: LinhaMO[] = useMemo(() => {
    const data = recursos.data ?? [];
    return data.map((r) => {
      const ativ = atividadesById[r.atividade_id];
      const funcaoNome = r.funcao?.nome_funcao ?? r.descricao;
      return {
        id: r.id,
        atividadeId: r.atividade_id,
        funcaoNome,
        funcaoKey: (funcaoNome ?? "").toUpperCase().trim(),
        frente: ativ?.frente ?? "—",
        wbs: ativ?.codigo_wbs ?? "—",
        quantidade: Number(r.quantidade_prevista),
        horas: r.horas_previstas != null ? Number(r.horas_previstas) : null,
        dias: r.dias_previstos != null ? Number(r.dias_previstos) : null,
      };
    });
  }, [recursos.data, atividadesById]);

  const [busca, setBusca] = useState("");
  const [frenteFiltro, setFrenteFiltro] = useState<string>("todas");

  const frentes = useMemo(() => {
    const set = new Set<string>();
    for (const a of atividades) if (a.frente) set.add(a.frente);
    return Array.from(set).sort();
  }, [atividades]);

  const linhasFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return linhas.filter((l) => {
      if (frenteFiltro !== "todas" && l.frente !== frenteFiltro) return false;
      if (!q) return true;
      return (
        l.funcaoNome.toLowerCase().includes(q) ||
        l.wbs.toLowerCase().includes(q)
      );
    });
  }, [linhas, busca, frenteFiltro]);

  const resumoPorFuncao: ResumoFuncao[] = useMemo(() => {
    const agg = new Map<
      string,
      {
        funcaoKey: string;
        funcaoNome: string;
        qtdTotal: number;
        horasTotais: number;
        diasHomem: number;
        atividades: Set<string>;
        inicio: string | null;
        fim: string | null;
      }
    >();
    for (const l of linhasFiltradas) {
      const cur =
        agg.get(l.funcaoKey) ?? {
          funcaoKey: l.funcaoKey,
          funcaoNome: l.funcaoNome,
          qtdTotal: 0,
          horasTotais: 0,
          diasHomem: 0,
          atividades: new Set<string>(),
          inicio: null as string | null,
          fim: null as string | null,
        };
      cur.qtdTotal += l.quantidade;
      cur.horasTotais += l.horas ?? 0;
      const diasItem =
        l.dias != null ? l.dias : l.horas != null ? l.horas / 8 : 0;
      cur.diasHomem += diasItem;
      cur.atividades.add(l.atividadeId);
      const ativ = atividadesById[l.atividadeId];
      if (ativ?.inicio) {
        if (!cur.inicio || ativ.inicio < cur.inicio) cur.inicio = ativ.inicio;
      }
      if (ativ?.fim) {
        if (!cur.fim || ativ.fim > cur.fim) cur.fim = ativ.fim;
      }
      agg.set(l.funcaoKey, cur);
    }
    return Array.from(agg.values())
      .map((g) => ({
        funcaoKey: g.funcaoKey,
        funcaoNome: g.funcaoNome,
        qtdTotal: g.qtdTotal,
        horasTotais: g.horasTotais,
        diasHomem: g.diasHomem,
        atividadesDistintas: g.atividades.size,
        inicio: g.inicio,
        fim: g.fim,
      }))
      .sort((a, b) => a.funcaoNome.localeCompare(b.funcaoNome, "pt-BR"));
  }, [linhasFiltradas, atividadesById]);

  const pagResumo = usePagination<ResumoFuncao>(resumoPorFuncao, {
    pageSize: PAGE_SIZE,
  });

  useEffect(() => {
    pagResumo.goToFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, frenteFiltro]);

  if (!hasPlanejamentoReal) {
    return (
      <Card>
        <CardContent className="pt-6">
          <TabHeader
            title="Mão de obra prevista"
            description="Visão gerencial: quanto de mão de obra a obra exige no total, agrupado por função."
          />
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nenhum planejamento vigente"
            description="Importe ou ative um planejamento para visualizar a mão de obra planejada."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <TabHeader
          title="Mão de obra prevista"
          description="Visão gerencial: quanto de mão de obra a obra exige no total, agrupado por função."
        />

        <p className="text-xs text-muted-foreground">
          Para detalhar por atividade, abra a aba <strong>Atividades</strong> e use <strong>Ver / ajustar recursos</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por função ou EAP..."
              className="pl-8"
            />
          </div>
          <Select value={frenteFiltro} onValueChange={setFrenteFiltro}>
            <SelectTrigger>
              <SelectValue placeholder="Frente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as frentes</SelectItem>
              {frentes.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {recursos.isLoading ? (
          <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Carregando mão de obra planejada...
          </div>
        ) : linhas.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="Nenhuma mão de obra planejada"
            description="Use a aba Atividades para planejar funções por atividade."
          />
        ) : linhasFiltradas.length === 0 ? (
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title="Nenhum resultado para os filtros"
            description="Ajuste a busca ou a frente."
          />
        ) : (
          <div className="space-y-3">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Função</TableHead>
                    <TableHead className="text-right w-24">Qtd total</TableHead>
                    <TableHead className="text-right w-28">Horas totais</TableHead>
                    <TableHead
                      className="text-right w-32"
                      title="Soma de (dias previstos) ou (horas / 8) quando dias não informado"
                    >
                      Dias-homem totais
                    </TableHead>
                    <TableHead className="text-right w-28">Atividades</TableHead>
                    <TableHead className="w-28">Início</TableHead>
                    <TableHead className="w-28">Fim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagResumo.paginatedData.map((g) => (
                    <TableRow key={g.funcaoKey}>
                      <TableCell className="font-medium">{g.funcaoNome}</TableCell>
                      <TableCell className="text-right">{fmtNum(g.qtdTotal)}</TableCell>
                      <TableCell className="text-right">{fmtNum(g.horasTotais)}</TableCell>
                      <TableCell className="text-right">{fmtNum(g.diasHomem)}</TableCell>
                      <TableCell className="text-right">{g.atividadesDistintas}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtData(g.inicio)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{fmtData(g.fim)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <PaginationFooter
              totalItems={pagResumo.totalItems}
              startIndex={pagResumo.startIndex}
              endIndex={pagResumo.endIndex}
              currentPage={pagResumo.currentPage}
              totalPages={pagResumo.totalPages}
              canPreviousPage={pagResumo.canPreviousPage}
              canNextPage={pagResumo.canNextPage}
              onPrevious={pagResumo.previousPage}
              onNext={pagResumo.nextPage}
              itemLabel="funções"
              pageSize={pagResumo.pageSize}
              onPageSizeChange={pagResumo.setPageSize}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MaoObraTab;
