import React, { useMemo, useState } from "react";
import { useCentrosCustoQuery } from "@/hooks/useCentrosCustoQuery";
import { usePlanejamentoScopeCentrosCusto } from "@/hooks/planejamentoMacro/usePlanejamentoScopeCentrosCusto";
import { useAuthPermissionsStable } from "@/hooks/useAuthPermissionsStable";
import { usePermission } from "@/hooks/usePermission";
import { usePageTitle } from "@/contexts/PageTitleContext";
import PlanejamentoMacroHeader from "./PlanejamentoMacroHeader";
import PlanejamentoMacroResumoCards from "./PlanejamentoMacroResumoCards";
import PlanejamentoMacroTabs from "./PlanejamentoMacroTabs";
import FluxoStepper from "./shared/FluxoStepper";
import PlanejamentoFormDialog from "./modals/PlanejamentoFormDialog";
import PlanejamentoArchiveDialog from "./modals/PlanejamentoArchiveDialog";
import PlanejamentoDeleteDialog from "./modals/PlanejamentoDeleteDialog";
import ImportarPlanejamentoInfoDialog from "./modals/ImportarPlanejamentoInfoDialog";
import ImportarPlanejamentoDialog from "./modals/ImportarPlanejamentoDialog";
import PlanejamentosVersoesDialog from "./modals/PlanejamentosVersoesDialog";
import EditarAtividadeDialog from "./modals/EditarAtividadeDialog";
import PlanejarRecursosDialog from "./modals/PlanejarRecursosDialog";
import EstruturaWbsDialog from "./modals/EstruturaWbsDialog";

import { usePlanejamentoMacroReal } from "@/hooks/usePlanejamentoMacroReal";
import { usePlanejamentosObraPorCentroCusto } from "@/hooks/planejamentoMacro/usePlanejamentosObraPorCentroCusto";
import { useRecursosPorPlanejamento } from "@/hooks/planejamentoMacro/useRecursosPorPlanejamento";
import { useSolicitacoesEquipamentoPlanejamento } from "@/hooks/useSolicitacoesEquipamentoPlanejamento";
import { usePendenciasOperacionais } from "@/hooks/planejamentoMacro/usePendenciasOperacionais";
import {
  isAtividadeOperacional,
  isEquipamentoOperacional,
  isMaoDeObraOperacional,
  isMaterialOperacional,
} from "@/lib/planejamentoMacro/planoSemanal/classificarRecurso";
import { useCriarPlanejamentoObra } from "@/hooks/planejamentoMacro/useCriarPlanejamentoObra";
import { useAtualizarPlanejamentoObra } from "@/hooks/planejamentoMacro/useAtualizarPlanejamentoObra";
import { useArquivarPlanejamentoObra } from "@/hooks/planejamentoMacro/useArquivarPlanejamentoObra";
import { useExcluirPlanejamentoObra } from "@/hooks/planejamentoMacro/useExcluirPlanejamentoObra";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Upload, MoreVertical, FilePlus2 } from "lucide-react";
import type { PlanejamentoObraRow } from "@/services/planejamentoMacro/planejamentoMacroService";
import type { PlanejamentoFormValues } from "./modals/schemas";
import { toast } from "sonner";

const PlanejamentoMacroPage: React.FC = () => {
  const ccQuery = useCentrosCustoQuery({ queryKey: "planejamento-macro-cc" });
  const escopoPlan = usePlanejamentoScopeCentrosCusto();
  const { isSuperAdmin } = useAuthPermissionsStable();
  const { hasActionPermission } = usePermission();
  const canImportPlanejamento =
    isSuperAdmin ||
    hasActionPermission("engenharia_planejamento_macro_importar", "criar");


  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState<string>(today);
  const [dataFim, setDataFim] = useState<string>(in7);
  const [centroCustoId, setCentroCustoId] = useState<string | null>(null);

  // Estado de dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editing, setEditing] = useState<PlanejamentoObraRow | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PlanejamentoObraRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PlanejamentoObraRow | null>(null);
  const [importarInfoOpen, setImportarInfoOpen] = useState(false);
  const [importarRealOpen, setImportarRealOpen] = useState(false);
  const [versoesOpen, setVersoesOpen] = useState(false);
  const [estruturaOpen, setEstruturaOpen] = useState(false);
  const [editingAtividadeId, setEditingAtividadeId] = useState<string | null>(null);
  const [planejarRecursosId, setPlanejarRecursosId] = useState<string | null>(null);
  const [planejarRecursosTab, setPlanejarRecursosTab] =
    useState<"funcoes" | "equipe">("funcoes");
  const [tabAtiva, setTabAtiva] = useState<string>("visao-geral");
  const [semanaAlvoIso, setSemanaAlvoIso] = useState<string | null>(null);
  // Fase 1C-2A — semana ativa do usuário no Planejamento Semanal, usada pelo Saneamento.
  const [semanaSelecionadaIso, setSemanaSelecionadaIso] = useState<string | null>(null);
  // Fase 1C-2A — alvo do "Abrir no Cronograma".
  const [atividadeAlvoId, setAtividadeAlvoId] = useState<string | null>(null);
  // Fase 1C-2B — alvo do modo Saneamento do EditarAtividadeDialog.
  const [saneamentoAtividadeId, setSaneamentoAtividadeId] = useState<string | null>(null);

  const centrosCustoFiltrados = useMemo(() => {
    const all = ccQuery.data ?? [];
    if (escopoPlan.isGlobal) return all;
    const allow = new Set(escopoPlan.allowedCentroIds);
    return all.filter((cc) => allow.has(cc.id));
  }, [ccQuery.data, escopoPlan.isGlobal, escopoPlan.allowedCentroIds]);

  const real = usePlanejamentoMacroReal(centroCustoId);

  const lista = usePlanejamentosObraPorCentroCusto(centroCustoId, true);

  const planejamentoId = real.planejamento?.id ?? null;
  const recursosQ = useRecursosPorPlanejamento(planejamentoId);
  const solQ = useSolicitacoesEquipamentoPlanejamento({
    centroCustoId,
    dataInicio: real.planejamento?.periodo_inicio ?? null,
    dataFim: real.planejamento?.periodo_fim ?? null,
  });

  // Fase 7C — apenas leitura para o stepper.
  const pendenciasOp = usePendenciasOperacionais({ planejamentoId });

  const resumoCards = useMemo(() => {
    const semFonte: { valor: string; hint: string } = {
      valor: "—",
      hint: "Sem fonte real ainda",
    };
    if (!real.hasPlanejamentoReal) {
      return [
        { key: "atividades", label: "Atividades planejadas", valor: 0, hint: "Aguardando importação" },
        { key: "mao_obra", label: "Mão de obra prevista", ...semFonte },
        { key: "equipamentos", label: "Equipamentos previstos", ...semFonte },
        { key: "materiais", label: "Materiais previstos", ...semFonte },
        { key: "solicitacoes", label: "Solicitações pendentes", ...semFonte },
        { key: "producao", label: "Produção prevista", ...semFonte },
        { key: "impedimentos", label: "Impedimentos", valor: "—", hint: "Fase futura" },
      ];
    }

    const rawById = real.atividadesRawById;
    let atividadesOperacionais = 0;
    for (const id in rawById) {
      const a = rawById[id] as any;
      if (isAtividadeOperacional(a)) atividadesOperacionais += 1;
    }

    const recursos = recursosQ.data ?? [];
    let mo = 0;
    let eq = 0;
    let mat = 0;
    const unidadesProd = new Set<string>();
    let prod = 0;
    for (const r of recursos as any[]) {
      const ativ = rawById[r.atividade_id];
      if (ativ && !isAtividadeOperacional(ativ as any)) continue;
      if (isMaoDeObraOperacional(r)) mo += Number(r.quantidade_prevista) || 0;
      else if (isEquipamentoOperacional(r)) eq += Number(r.quantidade_prevista) || 0;
      else if (isMaterialOperacional(r)) {
        mat += Number(r.quantidade_prevista) || 0;
      }
    }
    for (const id in rawById) {
      const a = rawById[id] as any;
      if (!isAtividadeOperacional(a)) continue;
      if (a.quantidade_prevista != null) {
        prod += Number(a.quantidade_prevista) || 0;
        if (a.unidade) unidadesProd.add(String(a.unidade).trim().toUpperCase());
      }
    }
    const producaoCard =
      unidadesProd.size === 1
        ? { valor: `${prod} ${Array.from(unidadesProd)[0]}`, hint: "Soma operacional" }
        : { valor: "—", hint: unidadesProd.size > 1 ? "Unidades divergentes" : "Sem unidade" };

    const solPendentes = (solQ.data ?? []).filter(
      (s) => s.status_fluxo !== "CONCLUIDO" && s.status_fluxo !== "NEGADO"
    ).length;

    return [
      { key: "atividades", label: "Atividades planejadas", valor: atividadesOperacionais, hint: "Operacionais (exclui resumo/marco/cancelada)" },
      { key: "mao_obra", label: "Mão de obra prevista", valor: mo, hint: "MOD + MOI" },
      { key: "equipamentos", label: "Equipamentos previstos", valor: eq, hint: "EQ operacional" },
      { key: "materiais", label: "Materiais previstos", valor: mat, hint: "MAT" },
      { key: "solicitacoes", label: "Solicitações pendentes", valor: solPendentes, hint: "Em aberto no CC" },
      { key: "producao", label: "Produção prevista", ...producaoCard },
      { key: "impedimentos", label: "Impedimentos", valor: "—", hint: "Fase futura" },
    ];
  }, [real.hasPlanejamentoReal, real.atividadesRawById, recursosQ.data, solQ.data]);


  const criar = useCriarPlanejamentoObra();
  const atualizar = useAtualizarPlanejamentoObra();
  const arquivar = useArquivarPlanejamentoObra();
  const excluir = useExcluirPlanejamentoObra();

  const haVigente = !!real.planejamento;
  const haVigenteOutroParaForm =
    formMode === "create"
      ? haVigente
      : !!real.planejamento && real.planejamento.id !== editing?.id;

  const abrirNovo = () => {
    setEditing(null);
    setFormMode("create");
    setFormOpen(true);
  };
  const abrirEditar = (p: PlanejamentoObraRow) => {
    setEditing(p);
    setFormMode("edit");
    setFormOpen(true);
  };

  const handleSubmitForm = async (values: PlanejamentoFormValues) => {
    const pretendeVigente = values.status === "vigente";
    const seriaConflito =
      pretendeVigente &&
      haVigente &&
      (formMode === "create" || real.planejamento?.id !== editing?.id);
    if (seriaConflito) {
      toast.error(
        "Já existe um planejamento vigente para este Centro de Custo. Arquive o vigente atual antes de ativar outro."
      );
      return;
    }

    try {
      if (formMode === "create") {
        await criar.mutateAsync({
          centro_custo_id: values.centro_custo_id,
          periodo_inicio: values.periodo_inicio,
          periodo_fim: values.periodo_fim,
          versao: values.versao,
          status: values.status === "arquivado" ? "rascunho" : values.status,
          observacao: values.observacao || null,
        });
      } else if (editing) {
        await atualizar.mutateAsync({
          id: editing.id,
          patch: {
            periodo_inicio: values.periodo_inicio,
            periodo_fim: values.periodo_fim,
            versao: values.versao,
            status: values.status,
            observacao: values.observacao || null,
          },
        });
      }
      setFormOpen(false);
    } catch {
      // toast tratado nos hooks
    }
  };

  const handleTornarVigente = async (p: PlanejamentoObraRow) => {
    if (haVigente && real.planejamento?.id !== p.id) {
      toast.error(
        "Já existe um planejamento vigente para este Centro de Custo. Arquive o vigente atual antes de ativar outro."
      );
      return;
    }
    await atualizar.mutateAsync({ id: p.id, patch: { status: "vigente" } });
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    await arquivar.mutateAsync({ id: archiveTarget.id });
    setArchiveTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.status === "vigente") {
      toast.error("Arquive o planejamento antes de excluí-lo.");
      return;
    }
    await excluir.mutateAsync({
      id: deleteTarget.id,
      centro_custo_id: deleteTarget.centro_custo_id,
    });
    setDeleteTarget(null);
  };

  const ccSelecionado = useMemo(() => {
    if (!centroCustoId) return null;
    const cc = centrosCustoFiltrados.find((c) => c.id === centroCustoId);
    if (!cc) return null;
    return {
      id: cc.id,
      codigo_centro_custo: cc.codigo_centro_custo,
      nome_centro_custo: cc.nome_centro_custo,
    };
  }, [centroCustoId, centrosCustoFiltrados]);

  const ccLabel = ccSelecionado
    ? ccSelecionado.codigo_centro_custo
      ? `${ccSelecionado.codigo_centro_custo} — ${ccSelecionado.nome_centro_custo}`
      : ccSelecionado.nome_centro_custo
    : null;

  usePageTitle("Planejamento Macro da Obra");

  const abrirVersoes = () => setVersoesOpen(true);
  const abrirEstruturaEap = () => setEstruturaOpen(true);

  const podeAbrirEstruturaEap =
    !!centroCustoId &&
    real.hasPlanejamentoReal &&
    (real.atividades?.some((a) => !!a.codigo_wbs?.trim()) ?? false);

  const headerAction = centroCustoId ? (
    <>
      {canImportPlanejamento && (
        <Button size="sm" onClick={() => setImportarRealOpen(true)} className="gap-1">
          <Upload className="h-4 w-4" />
          Importar nova versão
        </Button>
      )}
      {isSuperAdmin && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ações administrativas">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={abrirNovo}>
              <FilePlus2 className="h-4 w-4 mr-2" />
              Novo planejamento manual
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setImportarInfoOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Guia de importação
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </>
  ) : null;

  return (
    <div className="space-y-6 p-4 md:p-6">
      <PlanejamentoMacroHeader
        centrosCusto={centrosCustoFiltrados}
        centroCustoId={centroCustoId}
        onCentroCustoChange={setCentroCustoId}
        loading={ccQuery.isLoading || escopoPlan.isLoading}
        headerAction={headerAction}
        tituloPrincipal={ccLabel ?? undefined}
        subtitulo={ccLabel ? "Planejamento Macro da Obra" : undefined}
        onAbrirVersoes={centroCustoId ? abrirVersoes : undefined}
        onAbrirEstruturaEap={podeAbrirEstruturaEap ? abrirEstruturaEap : undefined}
        vigenteAtivo={real.hasPlanejamentoReal}
      />

      <FluxoStepper
        hasCentroCusto={!!centroCustoId}
        hasPlanejamentoVigente={real.hasPlanejamentoReal}
        totalPendencias={pendenciasOp.pendencias.length}
      />

      <PlanejamentoMacroResumoCards cards={resumoCards} />

      <PlanejamentoMacroTabs
        centroCustoId={centroCustoId}
        dataInicio={dataInicio}
        dataFim={dataFim}
        onDataInicioChange={setDataInicio}
        onDataFimChange={setDataFim}
        atividades={real.hasPlanejamentoReal ? real.atividades : undefined}
        hasPlanejamentoReal={real.hasPlanejamentoReal}
        planejamentoId={real.planejamento?.id ?? null}
        isSuperAdmin={isSuperAdmin}
        planejamentoStatus={(real.planejamento?.status as "rascunho" | "vigente" | "arquivado" | undefined) ?? null}
        planVigenteInicio={real.planejamento?.periodo_inicio ?? null}
        planVigenteFim={real.planejamento?.periodo_fim ?? null}
        onEditarAtividade={(id) => setEditingAtividadeId(id)}
        onPlanejarRecursos={(id) => {
          setPlanejarRecursosTab("funcoes");
          setPlanejarRecursosId(id);
        }}
        onAbrirNaSemana={(_id, inicioIso) => {
          if (!inicioIso) return;
          setSemanaAlvoIso(inicioIso);
          setTabAtiva("plano-semanal");
        }}
        tabAtiva={tabAtiva}
        onTabChange={setTabAtiva}
        semanaAlvoIso={semanaAlvoIso}
        onSemanaAlvoConsumida={() => setSemanaAlvoIso(null)}
        ccLabel={ccLabel}
        semanaSelecionadaIso={semanaSelecionadaIso}
        onSemanaSelecionadaChange={setSemanaSelecionadaIso}
        atividadeAlvoId={atividadeAlvoId}
        onAtividadeAlvoConsumida={() => setAtividadeAlvoId(null)}
        onAbrirNoCronograma={(id) => {
          setAtividadeAlvoId(id);
          setTabAtiva("atividades");
        }}
        canCorrigirQuantidade={
          isSuperAdmin &&
          (real.planejamento?.status as string | undefined) !== "arquivado"
        }
        onCorrigirQuantidade={(id) => setSaneamentoAtividadeId(id)}
        canDesignarEquipe={
          isSuperAdmin &&
          (real.planejamento?.status as string | undefined) !== "arquivado"
        }
        onDesignarEquipe={(id) => {
          setPlanejarRecursosTab("equipe");
          setPlanejarRecursosId(id);
        }}
      />

      <EditarAtividadeDialog
        open={!!editingAtividadeId}
        onOpenChange={(v) => !v && setEditingAtividadeId(null)}
        atividade={editingAtividadeId ? real.atividadesRawById[editingAtividadeId] ?? null : null}
        planejamentoStatus={(real.planejamento?.status as "rascunho" | "vigente" | "arquivado" | undefined) ?? null}
      />

      <EditarAtividadeDialog
        open={!!saneamentoAtividadeId}
        onOpenChange={(v) => !v && setSaneamentoAtividadeId(null)}
        atividade={
          saneamentoAtividadeId
            ? real.atividadesRawById[saneamentoAtividadeId] ?? null
            : null
        }
        planejamentoStatus={(real.planejamento?.status as "rascunho" | "vigente" | "arquivado" | undefined) ?? null}
        modoSaneamento
      />

      <PlanejarRecursosDialog
        open={!!planejarRecursosId}
        onOpenChange={(v) => !v && setPlanejarRecursosId(null)}
        atividade={
          planejarRecursosId && real.planejamento
            ? (() => {
                const a = real.atividadesRawById[planejarRecursosId];
                if (!a) return null;
                return {
                  id: a.id,
                  nome: a.nome,
                  planejamento_id: real.planejamento!.id,
                  data_inicio: (a as any).data_inicio ?? null,
                  data_fim: (a as any).data_fim ?? null,
                };
              })()
            : null
        }
        canEdit={
          isSuperAdmin &&
          (real.planejamento?.status as string | undefined) !== "arquivado"
        }
        defaultTab={planejarRecursosTab}
      />


      <EstruturaWbsDialog
        open={estruturaOpen}
        onOpenChange={setEstruturaOpen}
        atividades={real.hasPlanejamentoReal ? real.atividades : []}
      />

      <ImportarPlanejamentoInfoDialog
        open={importarInfoOpen}
        onOpenChange={setImportarInfoOpen}
      />

      <ImportarPlanejamentoDialog
        open={importarRealOpen}
        onOpenChange={setImportarRealOpen}
        cc={ccSelecionado}
        canImport={canImportPlanejamento}
      />


      <PlanejamentosVersoesDialog
        open={versoesOpen}
        onOpenChange={setVersoesOpen}
        planejamentos={lista.data ?? []}
        isLoading={lista.isLoading}
        isSuperAdmin={isSuperAdmin}
        ccLabel={ccLabel}
        onEdit={(p) => {
          setVersoesOpen(false);
          abrirEditar(p);
        }}
        onTornarVigente={(p) => {
          handleTornarVigente(p);
        }}
        onArquivar={(p) => {
          setVersoesOpen(false);
          setArchiveTarget(p);
        }}
        onExcluir={(p) => {
          setVersoesOpen(false);
          setDeleteTarget(p);
        }}
      />


      {isSuperAdmin && (
        <>
          <PlanejamentoFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            mode={formMode}
            centrosCusto={centrosCustoFiltrados}
            centroCustoIdPadrao={centroCustoId}
            haVigenteOutro={haVigenteOutroParaForm}
            planejamento={editing}
            submitting={criar.isPending || atualizar.isPending}
            onSubmit={handleSubmitForm}
          />
          <PlanejamentoArchiveDialog
            open={!!archiveTarget}
            onOpenChange={(v) => !v && setArchiveTarget(null)}
            onConfirm={handleConfirmArchive}
            submitting={arquivar.isPending}
          />
          <PlanejamentoDeleteDialog
            open={!!deleteTarget}
            onOpenChange={(v) => !v && setDeleteTarget(null)}
            onConfirm={handleConfirmDelete}
            submitting={excluir.isPending}
          />
        </>
      )}
    </div>
  );
};

export default PlanejamentoMacroPage;
