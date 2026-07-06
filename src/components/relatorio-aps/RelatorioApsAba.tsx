/**
 * Aba "Relatório AP's" em /relatorio-aplicacao-diaria (E3.2).
 * Fluxo: filtros → "Montar relatório" → montagem final embutida.
 * Combobox de Centro de Custo (código+nome) e Rua (com/sem acento).
 * Filtro cruzado bidirecional CC ↔ Rua via useRelatorioApsIndice.
 * Zero escrita no Supabase.
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { RelatorioApsMapaHandle } from "./RelatorioApsMapa";
import { format } from "date-fns";
import { CalendarIcon, Info, RotateCcw, Search } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import {
  useRelatorioApsFiltros,
  type RelatorioApsFiltrosInput,
} from "@/hooks/relatorio-aps/useRelatorioApsFiltros";
import {
  useRelatorioApsIndice,
  stripDiacritics,
} from "@/hooks/relatorio-aps/useRelatorioApsIndice";
import { useRelatorioApsState } from "@/hooks/relatorio-aps/useRelatorioApsState";
import { extrairObservacoesLimpas } from "@/lib/relatorio-aps/limparObservacoes";
import RelatorioApsBuilderContent from "./RelatorioApsBuilderContent";
import RelatorioApsExportDropdown from "./RelatorioApsExportDropdown";

interface CentroCusto {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo: string;
}

interface Props {
  centrosCusto: CentroCusto[];
}

const hoje = new Date();
const trintaDiasAtras = new Date();
trintaDiasAtras.setDate(hoje.getDate() - 30);

const RelatorioApsAba: React.FC<Props> = ({ centrosCusto }) => {
  const [centroCustoId, setCentroCustoId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<Date>(trintaDiasAtras);
  const [dataFim, setDataFim] = useState<Date>(hoje);
  const [ruaChave, setRuaChave] = useState<string>("");
  const mapaRef = useRef<RelatorioApsMapaHandle | null>(null);

  const indice = useRelatorioApsIndice(dataInicio, dataFim);
  const filtrosHook = useRelatorioApsFiltros();
  const relatorioCtrl = useRelatorioApsState(null);

  // Filtro cruzado: opções de Rua limitadas pelo CC (se houver)
  const ruasVisiveis = useMemo(
    () => indice.ruasFiltradasPorCc(centroCustoId || null),
    [indice, centroCustoId],
  );
  // Se a rua atualmente selecionada não pertence ao novo CC, limpa
  useEffect(() => {
    if (ruaChave && !ruasVisiveis.some((r) => r.chave === ruaChave)) {
      setRuaChave("");
    }
  }, [ruasVisiveis, ruaChave]);

  // Filtro cruzado: opções de CC limitadas pela Rua (se houver)
  const ccsPermitidos = useMemo(
    () => indice.ccsFiltradosPorRua(ruaChave || null),
    [indice, ruaChave],
  );
  const centrosVisiveis = useMemo(
    () => centrosCusto.filter((c) => ccsPermitidos.has(c.id)),
    [centrosCusto, ccsPermitidos],
  );
  useEffect(() => {
    if (centroCustoId && !ccsPermitidos.has(centroCustoId)) {
      setCentroCustoId("");
    }
  }, [ccsPermitidos, centroCustoId]);

  const ccOptions: ComboboxOption[] = useMemo(
    () =>
      centrosVisiveis.map((c) => ({
        value: c.id,
        label: `${c.codigo_centro_custo} - ${c.nome_centro_custo}`,
        searchText: `${c.codigo_centro_custo} ${c.nome_centro_custo}`,
      })),
    [centrosVisiveis],
  );

  const ruaOptions: ComboboxOption[] = useMemo(
    () =>
      ruasVisiveis.map((r) => ({
        value: r.chave,
        label: r.nome,
        searchText: `${r.nome} ${stripDiacritics(r.nome)}`,
      })),
    [ruasVisiveis],
  );

  const nomeRuaSelecionada = useMemo(
    () => ruasVisiveis.find((r) => r.chave === ruaChave)?.nome || "",
    [ruasVisiveis, ruaChave],
  );

  const executarMontagem = async () => {
    if (!centroCustoId) return;
    relatorioCtrl.resetar();
    const input: RelatorioApsFiltrosInput = {
      centroCustoId,
      dataInicio,
      dataFim,
      logradouro: nomeRuaSelecionada || "__all__",
    };
    await filtrosHook.buscar(input);
  };

  // Auto-montagem debounced quando CC + datas estiverem preenchidos.
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!centroCustoId || !dataInicio || !dataFim) return;
    debounceRef.current = setTimeout(() => {
      void executarMontagem();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centroCustoId, dataInicio, dataFim, ruaChave]);

  // Após a busca terminar, carrega TODOS os detalhes retornados no builder.
  useEffect(() => {
    const { resultado, buscouAlgumaVez, carregando } = filtrosHook;
    if (!buscouAlgumaVez || carregando) return;
    if (resultado.detalhes.length === 0) return;

    const primeiroRegistroId = resultado.detalhes[0].registro_aplicacao_id;
    const registro = resultado.registros.find((r) => r.id === primeiroRegistroId);
    const situacaoDefault = registro?.status_aplicacao || "";
    const ruasUnicas = Array.from(
      new Set(
        resultado.detalhes
          .map((d) => (d.logradouro_nome || "").trim())
          .filter(Boolean),
      ),
    );
    const ruaSugerida =
      ruasUnicas.length === 1
        ? ruasUnicas[0]
        : registro?.logradouro_aplicado || nomeRuaSelecionada || "";

    relatorioCtrl.carregarDeSelecao({
      detalhes: resultado.detalhes,
      situacaoDefault,
      cabecalhoOverride: {
        rua: ruaSugerida,
        observacoes: extrairObservacoesLimpas(registro?.observacoes_gerais),
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosHook.resultado, filtrosHook.buscouAlgumaVez, filtrosHook.carregando]);

  const handleLimpar = () => {
    setCentroCustoId("");
    setRuaChave("");
    setDataInicio(trintaDiasAtras);
    setDataFim(hoje);
    filtrosHook.resetar();
    relatorioCtrl.resetar();
  };

  const { erro, carregando, buscouAlgumaVez, resultado } = filtrosHook;

  return (
    <div className="space-y-4">
      {/* Exportar no topo direito da aba */}
      <div className="flex justify-end">
        <RelatorioApsExportDropdown state={relatorioCtrl.state} mapaRef={mapaRef} />
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Search className="h-4 w-4 text-primary" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Centro de Custo *</Label>
              <Combobox
                options={ccOptions}
                value={centroCustoId}
                onChange={setCentroCustoId}
                placeholder="Selecione (código ou nome)"
                emptyText="Nenhum centro no período"
                searchPlaceholder="Buscar por código ou nome..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data inicial *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataInicio, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataInicio}
                    onSelect={(d) => d && setDataInicio(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Data final *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(dataFim, "dd/MM/yyyy")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dataFim}
                    onSelect={(d) => d && setDataFim(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Rua / Logradouro</Label>
              <Combobox
                options={ruaOptions}
                value={ruaChave}
                onChange={setRuaChave}
                placeholder="Todas as ruas"
                emptyText={
                  indice.carregando
                    ? "Carregando..."
                    : ruaOptions.length === 0
                      ? "Sem ruas no período"
                      : "Nenhuma rua encontrada"
                }
                searchPlaceholder="Buscar rua (aceita sem acento)..."
              />
            </div>
          </div>

          {erro && (
            <Alert variant="destructive">
              <AlertDescription>{erro}</AlertDescription>
            </Alert>
          )}
          {indice.erro && (
            <Alert variant="destructive">
              <AlertDescription>{indice.erro}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {buscouAlgumaVez && !carregando && resultado.detalhes.length === 0 && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Nenhum registro manual encontrado para os filtros informados.
          </AlertDescription>
        </Alert>
      )}

      {/* Builder inline */}
      {(relatorioCtrl.state.carregando ||
        relatorioCtrl.state.linhas.length > 0 ||
        relatorioCtrl.state.erro) && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">
              Montagem do Relatório AP's
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <RelatorioApsBuilderContent ctrl={relatorioCtrl} mapaRef={mapaRef} />
            <div className="flex justify-end pt-2 border-t">
              <Button variant="outline" onClick={handleLimpar} disabled={carregando}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Limpar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RelatorioApsAba;
