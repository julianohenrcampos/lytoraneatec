
import React, { useState, useMemo } from "react";
import { useMaquinasDashboard } from "@/hooks/dashboard/useMaquinasDashboard";
import { MaquinasFilters } from "@/types/maquinas";
import MainLayout from "@/components/layout/MainLayout";
import MaquinasKpiCards from "@/components/dashboard/maquinas/MaquinasKpiCards";
import MaquinasFiltros from "@/components/dashboard/maquinas/MaquinasFilters";
import VisaoGeralFrotaMelhorada from "@/components/dashboard/maquinas/VisaoGeralFrotaMelhorada";
import EquipamentosPorCentroCusto from "@/components/dashboard/maquinas/EquipamentosPorCentroCusto";
import UtilizacaoEficienciaRosca from "@/components/dashboard/maquinas/UtilizacaoEficienciaRosca";
import SaudeFrota from "@/components/dashboard/maquinas/SaudeFrota";
import ResumoCustos from "@/components/dashboard/maquinas/ResumoCustos";

export default function DashboardMaquinas() {
  // Estado dos filtros
  const [filters, setFilters] = useState<MaquinasFilters>(() => {
    const hoje = new Date();
    const data30d = new Date();
    data30d.setDate(hoje.getDate() - 30);
    
    // Padrão para caminhões programados: próximos 7 dias
    const proximos7d = new Date();
    proximos7d.setDate(hoje.getDate() + 7);
    
    return {
      periodStart: data30d.toISOString().split("T")[0],
      periodEnd: hoje.toISOString().split("T")[0],
      tipoVeiculo: [],
      empresaId: undefined,
      centroCustoId: undefined,
      ativoEspecifico: undefined,
      dataInicioPlanejamanento: hoje.toISOString().split("T")[0],
      dataFimPlanejamento: proximos7d.toISOString().split("T")[0]
    };
  });

  // Buscar dados do dashboard
  const {
    kpisQuery,
    tipoVeiculoQuery,
    statusOperacionalQuery,
    idadeFrotaQuery,
    equipamentosPorCentroCustoQuery,
    centroCustoQuery,
    chamadosQuery,
    tipoFalhaQuery,
    custoLocacaoQuery,
    caminhoesProgramadosQuery
  } = useMaquinasDashboard(filters);

  // Handlers dos filtros
  const handleFilterChange = (newFilters: Partial<MaquinasFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    const hoje = new Date();
    const data30d = new Date();
    data30d.setDate(hoje.getDate() - 30);
    
    // Resetar também os filtros de planejamento para o padrão
    const proximos7d = new Date();
    proximos7d.setDate(hoje.getDate() + 7);
    
    setFilters({
      periodStart: data30d.toISOString().split("T")[0],
      periodEnd: hoje.toISOString().split("T")[0],
      tipoVeiculo: [],
      empresaId: undefined,
      centroCustoId: undefined,
      ativoEspecifico: undefined,
      dataInicioPlanejamanento: hoje.toISOString().split("T")[0],
      dataFimPlanejamento: proximos7d.toISOString().split("T")[0]
    });
  };

  // Contador de filtros ativos
  const filtrosAtivos = useMemo(() => {
    let count = 0;
    if (filters.tipoVeiculo && filters.tipoVeiculo.length > 0) count++;
    if (filters.empresaId) count++;
    if (filters.centroCustoId) count++;
    if (filters.ativoEspecifico) count++;
    
    // Contar filtros de planejamento se diferentes do padrão
    const hoje = new Date().toISOString().split("T")[0];
    const proximos7d = new Date();
    proximos7d.setDate(new Date().getDate() + 7);
    const defaultDataFim = proximos7d.toISOString().split("T")[0];
    
    if (filters.dataInicioPlanejamanento !== hoje || filters.dataFimPlanejamento !== defaultDataFim) {
      count++;
    }
    
    return count;
  }, [filters]);

  const isLoading = kpisQuery.isLoading || 
                   tipoVeiculoQuery.isLoading || 
                   statusOperacionalQuery.isLoading;

  return (
    <MainLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold">Dashboard de Gestão de Máquinas</h1>
          <p className="text-muted-foreground">
            Acompanhamento completo da frota de caminhões e equipamentos
          </p>
        </div>

        {/* Filtros */}
        <MaquinasFiltros
          filters={filters}
          onFilterChange={handleFilterChange}
          onResetFilters={resetFilters}
          filtrosAtivos={filtrosAtivos}
        />

        {/* KPIs Principais */}
        <MaquinasKpiCards
          kpis={kpisQuery.data || {
            totalAtivos: 0,
            ativosOperando: 0,
            ativosDisponiveis: 0,
            ativosManutencao: 0,
            chamadosAbertos: 0,
            tempoMedioReparo: 0
          }}
          isLoading={isLoading}
        />

        {/* Seção 1: Resumo de Custos de Locação e Caminhões Programados */}
        <ResumoCustos
          custoData={custoLocacaoQuery.data || {
            valorTotal: 0,
            totalDescontos: 0,
            valorLiquido: 0,
            diasManutencao: 0,
            horasManutencao: 0
          }}
          caminhoesProgramados={caminhoesProgramadosQuery.data || []}
          isLoading={custoLocacaoQuery.isLoading || caminhoesProgramadosQuery.isLoading}
        />

        {/* Seção 2: Equipamentos por Centro de Custo (NOVO) */}
        <EquipamentosPorCentroCusto
          equipamentosData={equipamentosPorCentroCustoQuery.data || []}
          isLoading={equipamentosPorCentroCustoQuery.isLoading}
        />

        {/* Seção 3: Visão Geral da Frota (MELHORADA) */}
        <VisaoGeralFrotaMelhorada
          tipoVeiculo={tipoVeiculoQuery.data || []}
          statusOperacional={statusOperacionalQuery.data || []}
          idadeFrota={idadeFrotaQuery.data || []}
          isLoading={isLoading}
        />

        {/* Seção 4: Utilização e Eficiência (GRÁFICOS DE ROSCA) */}
        <UtilizacaoEficienciaRosca
          centroCustoData={centroCustoQuery.data || []}
          isLoading={centroCustoQuery.isLoading}
        />

        {/* Seção 5: Saúde da Frota */}
        <SaudeFrota
          chamadosData={chamadosQuery.data || []}
          tipoFalhaData={tipoFalhaQuery.data || []}
          isLoading={chamadosQuery.isLoading || tipoFalhaQuery.isLoading}
        />
      </div>
    </MainLayout>
  );
}
