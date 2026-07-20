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
import { CalendarIcon, Info, RotateCcw, Search, Stamp, X } from "lucide-react";
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
} from "@/hooks/relatorio-aps/useRelatorioApsIndice";
import { useRelatorioApsState } from "@/hooks/relatorio-aps/useRelatorioApsState";
import { extrairObservacoesLimpas } from "@/lib/relatorio-aps/limparObservacoes";
import RelatorioApsBuilderContent from "./RelatorioApsBuilderContent";
import RelatorioApsExportDropdown from "./RelatorioApsExportDropdown";
import RelatorioApsCarimboSelector from "./RelatorioApsCarimboSelector";
import RelatorioApsCarimboDialog from "./RelatorioApsCarimboDialog";
import { useCarimboPadrao } from "@/hooks/relatorio-aps/useRelatorioApsCarimbos";
import { usePermission } from "@/hooks/usePermission";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
        searchText: r.searchText,
      })),
    [ruasVisiveis],
  );

  const nomeRuaSelecionada = useMemo(
    () => ruasVisiveis.find((r) => r.chave === ruaChave)?.nome || "",
    [ruasVisiveis, ruaChave],
  );

  // Rastreia o CC usado na última montagem para decidir se preserva o cabeçalho
  // administrativo (5 campos) ao remontar. Rastreia também o CC atualmente aplicado
  // para proteção contra respostas assíncronas obsoletas.
  const ccUltimaMontagemRef = useRef<string>("");
  const ccAtualRef = useRef<string>("");
  useEffect(() => {
    ccAtualRef.current = centroCustoId;
  }, [centroCustoId]);

  const executarMontagem = async () => {
    if (!centroCustoId) return;
    const input: RelatorioApsFiltrosInput = {
      centroCustoId,
      dataInicio,
      dataFim,
      logradouroChave: ruaChave || "__all__",
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
    const exibicoesUnicas = Array.from(
      new Set(
        resultado.detalhes
          .map((d) => (d.logradouroExibicao || "").trim())
          .filter(Boolean),
      ),
    );
    const ruaSugerida =
      exibicoesUnicas.length === 1
        ? exibicoesUnicas[0]
        : registro?.logradouro_aplicado || nomeRuaSelecionada || "";

    const mesmoCc = ccUltimaMontagemRef.current === centroCustoId;
    ccUltimaMontagemRef.current = centroCustoId;

    const mapaAtividade: Record<string, string | null> = {};
    for (const r of resultado.registros) {
      mapaAtividade[r.id] = r.atividade ?? null;
    }

    relatorioCtrl.carregarDeSelecao({
      detalhes: resultado.detalhes,
      situacaoDefault,
      cabecalhoOverride: {
        rua: ruaSugerida,
        observacoes: extrairObservacoesLimpas(registro?.observacoes_gerais),
      },
      preservarCabecalhoAdmin: mesmoCc,
      mapaAtividadePorRegistro: mapaAtividade,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrosHook.resultado, filtrosHook.buscouAlgumaVez, filtrosHook.carregando]);

  // ============ Carimbo padrão do CC (auto-aplicação) ============
  const padraoQuery = useCarimboPadrao(centroCustoId || null);
  const padraoAplicadoRef = useRef<string>(""); // "ccId::carimboId" já aplicado
  useEffect(() => {
    if (!centroCustoId) return;
    // Anti-race: só aplica se o resultado corresponde ao CC atualmente selecionado
    if (ccAtualRef.current !== centroCustoId) return;
    const row = padraoQuery.data;
    if (!row) return;
    // Não sobrescreve se já existe carimbo selecionado
    if (relatorioCtrl.carimboAtual) return;
    // Não sobrescreve se o usuário mexeu nos campos administrativos
    if (relatorioCtrl.carimboDirty) return;
    const chave = `${centroCustoId}::${row.id}`;
    if (padraoAplicadoRef.current === chave) return;
    padraoAplicadoRef.current = chave;
    relatorioCtrl.aplicarCarimbo(row);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [padraoQuery.data, centroCustoId]);

  // Ao trocar CC manualmente, zera a marca do padrão aplicado do CC anterior.
  useEffect(() => {
    padraoAplicadoRef.current = "";
  }, [centroCustoId]);

  // Interceptação da troca de CC quando há alterações não salvas.
  const [pendingCcChange, setPendingCcChange] = useState<string | null>(null);
  const trocarCentroCusto = (novoCc: string) => {
    if (novoCc === centroCustoId) return;
    if (relatorioCtrl.carimboDirty) {
      setPendingCcChange(novoCc);
      return;
    }
    setCentroCustoId(novoCc);
  };
  const confirmarDescarteCcChange = () => {
    if (pendingCcChange !== null) {
      setCentroCustoId(pendingCcChange);
      setPendingCcChange(null);
    }
  };

  const handleLimpar = () => {
    setCentroCustoId("");
    setRuaChave("");
    setDataInicio(trintaDiasAtras);
    setDataFim(hoje);
    filtrosHook.resetar();
    relatorioCtrl.resetar();
    relatorioCtrl.limparCarimboAtual();
    ccUltimaMontagemRef.current = "";
    padraoAplicadoRef.current = "";
  };

  const { erro, carregando, buscouAlgumaVez, resultado } = filtrosHook;

  const { hasActionPermission } = usePermission();
  const podeCriarCarimbo = hasActionPermission("relatorio_aplicacao_view", "criar");
  const [novoCarimboOpen, setNovoCarimboOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Ações no topo direito da aba */}
      <div className="flex flex-wrap justify-end items-center gap-2">
        {podeCriarCarimbo && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setNovoCarimboOpen(true)}
            className="gap-2"
          >
            <Stamp className="h-4 w-4" />
            Novo carimbo
          </Button>
        )}
        <RelatorioApsExportDropdown
          state={relatorioCtrl.state}
          mapaRef={mapaRef}
          centroCustoCodigo={
            centrosCusto.find((c) => c.id === centroCustoId)?.codigo_centro_custo || ""
          }
        />

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
                onChange={trocarCentroCusto}
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

          {/* Carimbo do Relatório AP's */}
          <RelatorioApsCarimboSelector
            centroCustoId={centroCustoId || null}
            centrosCusto={centrosCusto}
            cabecalho={{
              obra: relatorioCtrl.state.cabecalho.obra,
              empresa: relatorioCtrl.state.cabecalho.empresa,
              cliente: relatorioCtrl.state.cabecalho.cliente,
              rua: relatorioCtrl.state.cabecalho.rua,
              bairro: relatorioCtrl.state.cabecalho.bairro,
              revisao: relatorioCtrl.state.cabecalho.revisao,
              observacoes: relatorioCtrl.state.cabecalho.observacoes,
            }}
            carimboAtual={relatorioCtrl.carimboAtual}
            isDirty={relatorioCtrl.carimboDirty}
            onAplicar={(row) => relatorioCtrl.aplicarCarimbo(row)}
            onLimparSelecao={() => relatorioCtrl.limparCarimboAtual()}
            onLimparCabecalho={() => relatorioCtrl.limparCabecalhoAdmin()}
            onRestaurar={() => relatorioCtrl.restaurarCarimbo()}
            onSnapshotAtualizado={(row) => relatorioCtrl.atualizarSnapshotComRow(row)}
          />


          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={handleLimpar} disabled={carregando} className="gap-2">
              <X className="h-4 w-4" />
              Limpar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={pendingCcChange !== null} onOpenChange={(v) => !v && setPendingCcChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Descartar alterações do carimbo?</AlertDialogTitle>
            <AlertDialogDescription>
              Há alterações não salvas nos campos administrativos. Ao trocar o Centro de Custo,
              essas alterações serão perdidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarDescarteCcChange}>
              Descartar e continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      <RelatorioApsCarimboDialog
        open={novoCarimboOpen}
        onOpenChange={setNovoCarimboOpen}
        mode="criar"
        centroCustoId={centroCustoId || null}
        centrosCusto={centrosCusto}
        initial={{
          obra: relatorioCtrl.state.cabecalho.obra,
          empresa: relatorioCtrl.state.cabecalho.empresa,
          cliente: relatorioCtrl.state.cabecalho.cliente,
          bairro: relatorioCtrl.state.cabecalho.bairro,
          revisao: relatorioCtrl.state.cabecalho.revisao || "00",
          observacoes: relatorioCtrl.state.cabecalho.observacoes,
        }}
        podeEditarPadrao={hasActionPermission("relatorio_aplicacao_view", "editar")}
        onSalvo={(row) => relatorioCtrl.aplicarCarimbo(row)}
      />
    </div>

  );
};

export default RelatorioApsAba;
