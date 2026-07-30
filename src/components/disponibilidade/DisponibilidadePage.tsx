import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  fetchAtivosReconciliados,
  filtrarAtivosReconciliados,
  type AtivoReconciliado,
  type FiltrosAtivosReconciliados,
} from "@/services/disponibilidadeEquipamentoService";
import DisponibilidadeTable from "./DisponibilidadeTable";
import DisponibilidadeFiltersBar from "./DisponibilidadeFilters";
import DisponibilidadeAtivoModal from "./DisponibilidadeAtivoModal";
import { Card, CardContent } from "@/components/ui/card";
import { usePermission } from "@/hooks/usePermission";

const DisponibilidadePage: React.FC = () => {
  const [filters, setFilters] = useState<FiltrosAtivosReconciliados>({});
  const [alvo, setAlvo] = useState<AtivoReconciliado | null>(null);

  const { hasActionPermission, isLoading: permissoesCarregando } = usePermission();
  // Enquanto as permissões carregam, a ação não é renderizada (sem flash).
  const podeEditar =
    !permissoesCarregando &&
    hasActionPermission("gestao_maquinas_central_transporte_view", "editar");

  // Universo completo (paginado) — filtros são aplicados em memória para que
  // ativos sem status ou sem CC permaneçam sempre contabilizados.
  const { data: universo, isLoading, isError, error } = useQuery({
    queryKey: ["ativos-reconciliados"],
    queryFn: fetchAtivosReconciliados,
    retry: false,
  });

  const ativosFiltrados = useMemo(
    () => filtrarAtivosReconciliados(universo?.ativos ?? [], filters),
    [universo, filters],
  );

  return (
    <div className="space-y-6">
      {isError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-sm font-medium text-destructive">
              Falha ao carregar o universo de ativos.
            </p>
            <p className="text-xs text-muted-foreground">
              {(error as Error)?.message ||
                "A listagem não é exibida parcialmente para evitar dados incompletos."}
            </p>
          </CardContent>
        </Card>
      )}

      {universo && (
        <Card>
          <CardContent className="grid grid-cols-2 gap-4 pt-6 md:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Ativos cadastrados</p>
              <p className="text-2xl font-semibold">{universo.totalAtivos}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem status operacional</p>
              <p className="text-2xl font-semibold">{universo.totalSemStatus}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sem Centro de Custo</p>
              <p className="text-2xl font-semibold">{universo.totalSemCentroCusto}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conflitos cadastrais</p>
              <p className="text-2xl font-semibold">{universo.totalConflitoCadastral}</p>
            </div>
            <p className="col-span-2 text-xs text-muted-foreground md:col-span-4">
              Exibindo {ativosFiltrados.length} de {universo.totalAtivos} ativos · carregados{" "}
              {universo.totalCarregados} · reconciliados {universo.totalReconciliados} em{" "}
              {universo.paginasCarregadas} lote(s). Ativos sem status operacional ou sem Centro de
              Custo permanecem visíveis e sinalizados.
            </p>
          </CardContent>
        </Card>
      )}

      <DisponibilidadeFiltersBar filters={filters} onFiltersChange={setFilters} />
      <DisponibilidadeTable
        data={ativosFiltrados}
        isLoading={isLoading}
        isError={isError}
        podeEditar={podeEditar}
        onEdit={setAlvo}
      />

      {alvo && (
        <DisponibilidadeAtivoModal
          open
          onClose={() => setAlvo(null)}
          equipamentoId={alvo.equipamentoId}
          identificacao={`${alvo.frota ?? ""}${alvo.numeroFrota ? `-${alvo.numeroFrota}` : ""}` || alvo.equipamentoId}
          situacaoCadastral={alvo.situacaoCadastral}
          centroCustoIdSugerido={alvo.centroCustoAtualId}
        />
      )}
    </div>
  );
};

export default DisponibilidadePage;
