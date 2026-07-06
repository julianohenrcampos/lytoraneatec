import React, { useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, CheckSquare, LogOut } from "lucide-react";
import ColaboradorCard from "./ColaboradorCard";
import AdicionarFuncionarioPopover from "./AdicionarFuncionarioPopover";
import { UseFormReturn } from "react-hook-form";

interface ColaboradoresSectionProps {
  form: UseFormReturn<any>;
  equipeId: string;
  isLoadingMembers: boolean;
  equipeMembers: any[];
  onAvaliarColaborador?: (colaboradorId: string, nomeColaborador: string, equipeId: string) => void;
  avaliacoesCompletas: Set<string>;
  avaliacaoStatusMap: Map<string, { canCreate: boolean; daysRemaining: number }>;
  alertMessage: {
    colaboradorId: string;
    message: string;
    type: "error" | "info";
  } | null;
  isEditing: boolean;
  // Fase 2/3/4
  onLiberar: (originalIndex: number) => void;
  onAdicionarAvulso: (func: { id: string; nome_completo: string; funcao_nome?: string | null }) => void;
  onSelecionarTodos: (ids: string[]) => void;
  onSaidaTodos: (ids: string[], horaAtual: string) => void;
}

const normalizar = (s: string) =>
  (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

const nowHHmm = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const ColaboradoresSection: React.FC<ColaboradoresSectionProps> = ({
  form,
  equipeId,
  isLoadingMembers,
  equipeMembers,
  onAvaliarColaborador,
  avaliacoesCompletas,
  avaliacaoStatusMap,
  alertMessage,
  isEditing,
  onLiberar,
  onAdicionarAvulso,
  onSelecionarTodos,
  onSaidaTodos,
}) => {
  const [filtro, setFiltro] = useState("");

  // Assina o array para re-render quando muda (setValue "colaboradores")
  const colaboradores: any[] = form.watch("colaboradores") || [];

  const getAvaliacaoStatus = (colaboradorId: string | undefined) => {
    if (!colaboradorId) return { canEvaluate: false, daysRemaining: 0, isEvaluated: false };
    const isEvaluated = avaliacoesCompletas.has(colaboradorId);
    const avaliacaoStatus = avaliacaoStatusMap.get(colaboradorId);
    const canEvaluate = avaliacaoStatus?.canCreate ?? true;
    const daysRemaining = avaliacaoStatus?.daysRemaining ?? 0;
    return { canEvaluate, daysRemaining, isEvaluated };
  };

  // Preserva o índice original ANTES de filtrar
  const indexado = useMemo(
    () => colaboradores.map((c, originalIndex) => ({ colaborador: c, originalIndex })),
    [colaboradores]
  );

  const visiveis = useMemo(() => {
    const q = normalizar(filtro);
    if (!q) return indexado;
    return indexado.filter(({ colaborador }) =>
      normalizar(colaborador.nome_colaborador || "").includes(q)
    );
  }, [indexado, filtro]);

  const daComposicao = visiveis.filter((v) => !v.colaborador._avulso);
  const avulsosVisiveis = visiveis.filter((v) => v.colaborador._avulso);

  const total = colaboradores.length;
  const presentes = colaboradores.filter((c) => c.presente).length;
  const avulsosCount = colaboradores.filter((c) => c._avulso).length;

  const idsJaNoForm = useMemo(
    () => colaboradores.map((c) => c.colaborador_id).filter(Boolean),
    [colaboradores]
  );

  const handleSelecionarTodos = () => {
    const ids = visiveis
      .map((v) => v.colaborador.colaborador_id)
      .filter(Boolean) as string[];
    if (ids.length > 0) onSelecionarTodos(ids);
  };

  const handleSaidaTodos = () => {
    const ids = visiveis
      .map((v) => v.colaborador.colaborador_id)
      .filter(Boolean) as string[];
    if (ids.length > 0) onSaidaTodos(ids, nowHHmm());
  };

  const renderCard = (colaborador: any, originalIndex: number) => {
    const { canEvaluate, daysRemaining, isEvaluated } = getAvaliacaoStatus(colaborador.colaborador_id);
    return (
      <ColaboradorCard
        key={`${colaborador.colaborador_id || "sem-id"}-${originalIndex}`}
        colaborador={colaborador}
        originalIndex={originalIndex}
        form={form}
        onAvaliarColaborador={onAvaliarColaborador}
        equipeId={equipeId}
        isEvaluated={isEvaluated}
        canEvaluate={canEvaluate}
        daysRemaining={daysRemaining}
        alertMessage={alertMessage}
        isEditing={isEditing}
        onLiberar={onLiberar}
      />
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-medium">Colaboradores</h3>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">
            Presentes {presentes} / {total}
          </Badge>
          {avulsosCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-200">
              Avulsos {avulsosCount}
            </Badge>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar colaborador..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="pl-8"
            disabled={colaboradores.length === 0}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSelecionarTodos}
            disabled={visiveis.length === 0}
          >
            <CheckSquare className="h-4 w-4 mr-1" />
            Selecionar todos
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaidaTodos}
            disabled={visiveis.length === 0}
          >
            <LogOut className="h-4 w-4 mr-1" />
            Saída todos
          </Button>
          <AdicionarFuncionarioPopover
            jaAdicionadosIds={idsJaNoForm}
            onAdicionar={onAdicionarAvulso}
            disabled={!equipeId}
          />
        </div>
      </div>

      {isLoadingMembers ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : colaboradores.length > 0 ? (
        <ScrollArea className="h-[420px] border rounded-md p-4">
          <div className="space-y-4">
            {daComposicao.length === 0 && avulsosVisiveis.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-8">
                Nenhum colaborador encontrado para "{filtro}".
              </div>
            )}

            {daComposicao.map(({ colaborador, originalIndex }) =>
              renderCard(colaborador, originalIndex)
            )}

            {avulsosVisiveis.length > 0 && (
              <>
                <div className="pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 flex items-center gap-2">
                  <span className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                  Fora da composição atual
                  <span className="h-px flex-1 bg-amber-200 dark:bg-amber-800" />
                </div>
                {avulsosVisiveis.map(({ colaborador, originalIndex }) =>
                  renderCard(colaborador, originalIndex)
                )}
              </>
            )}
          </div>
        </ScrollArea>
      ) : equipeId ? (
        <div className="text-center py-6 text-muted-foreground">
          Esta equipe não possui membros. Use "Adicionar funcionário" para incluir avulsos.
        </div>
      ) : (
        <div className="text-center py-6 text-muted-foreground">
          Selecione uma equipe para ver os colaboradores.
        </div>
      )}
    </div>
  );
};

export default ColaboradoresSection;
