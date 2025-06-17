
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import RouteProtection from "@/components/routing/RouteProtection";
import AuthGuard from "@/components/routing/AuthGuard";
import { OfflineStatusIndicator } from "@/components/offline/OfflineStatusIndicator";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { useEffect } from "react";

// Import all pages
import Dashboard from "./pages/Dashboard";
import Dashboard1 from "./pages/Dashboard1";
import DashboardRH from "./pages/DashboardRH";
import DashboardMaquinas from "./pages/DashboardMaquinas";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import GestaoEmpresas from "./pages/GestaoEmpresas";
import GestaoDepartamentos from "./pages/GestaoDepartamentos";
import GestaoCentrosCusto from "./pages/GestaoCentrosCusto";
import GestaoFuncoes from "./pages/GestaoFuncoes";
import GestaoFuncionarios from "./pages/GestaoFuncionarios";
import GestaoEquipes from "./pages/GestaoEquipes";
import GestaoCaminhoes from "./pages/GestaoCaminhoes";
import GestaoUsinas from "./pages/GestaoUsinas";
import GestaoRequisicoes from "./pages/GestaoRequisicoes";
import ProgramacaoEntrega from "./pages/ProgramacaoEntrega";
import RegistroCargas from "./pages/RegistroCargas";
import RegistroAplicacao from "@/pages/RegistroAplicacao";
import ApontamentoEquipe from "@/pages/ApontamentoEquipe";
import ApontamentoCaminhoes from "@/pages/ApontamentoCaminhoes";
import ChamadosOS from "@/pages/ChamadosOS";
import GestaoOrdemServico from "@/pages/GestaoOrdemServico";
import GestaoPermissoes from "@/pages/GestaoPermissoes";
import RelatorioMedicao from "@/pages/RelatorioMedicao";

// Create a new query client with better retry settings
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30000,
    },
  },
});

// Componente para gerenciar sincronização offline global
const OfflineSyncManager: React.FC = () => {
  const { isSupabaseConnected } = useConnectionStatus();
  const { syncStatus } = useOfflineSync();

  useEffect(() => {
    if (isSupabaseConnected && syncStatus.pendingCount > 0) {
      console.log('🔄 Conexão detectada, sincronização automática será iniciada...');
    }
  }, [isSupabaseConnected, syncStatus.pendingCount]);

  return null;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TimezoneProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            {/* Componentes para gestão offline global */}
            <OfflineSyncManager />
            <OfflineStatusIndicator />
            
            <Routes>
              {/* PUBLIC ROUTES - No authentication required */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              
              {/* PRIVATE ROUTES - Authentication required */}
              <Route path="/" element={
                <AuthGuard>
                  <Dashboard />
                </AuthGuard>
              } />
              
              <Route path="/dashboard" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="dashboard_view">
                    <Dashboard />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              <Route path="/gestao-rh/dashboard" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="dashboard_rh_view">
                    <DashboardRH />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              <Route path="/gestao-maquinas/dashboard" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="dashboard_maquinas_view">
                    <DashboardMaquinas />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              <Route path="/dashboard1" element={
                <AuthGuard>
                  <Dashboard1 />
                </AuthGuard>
              } />
              
              {/* Gestão RH routes */}
              <Route path="/gestao-rh/empresas" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_rh_empresas_view">
                    <GestaoEmpresas />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-rh/departamentos" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_rh_departamentos_view">
                    <GestaoDepartamentos />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-rh/centros-custo" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_rh_centros_custo_view">
                    <GestaoCentrosCusto />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-rh/funcoes" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_rh_funcoes_view">
                    <GestaoFuncoes />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-rh/funcionarios" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_rh_funcionarios_view">
                    <GestaoFuncionarios />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-rh/equipes" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_rh_equipes_view">
                    <GestaoEquipes />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              {/* Gestão Máquinas routes */}
              <Route path="/gestao-maquinas/caminhoes-equipamentos" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_maquinas_caminhoes_view">
                    <GestaoCaminhoes />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-maquinas/usinas" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_maquinas_usinas_view">
                    <GestaoUsinas />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/gestao-maquinas/relatorio-medicao" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="gestao_maquinas_relatorio_medicao_view">
                    <RelatorioMedicao />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              {/* Requisições routes */}
              <Route path="/requisicoes/cadastro" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_cadastro_view">
                    <GestaoRequisicoes />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/programacao-entrega" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_programacao_entrega_view">
                    <ProgramacaoEntrega />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/registro-cargas" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_registro_cargas_view">
                    <RegistroCargas />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/registro-aplicacao" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_registro_aplicacao_view">
                    <RegistroAplicacao />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/apontamento-equipe" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_apontamento_equipe_view">
                    <ApontamentoEquipe />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/apontamento-caminhoes" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_apontamento_caminhoes_view">
                    <ApontamentoCaminhoes />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/chamados-os" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_chamados_os_view">
                    <ChamadosOS />
                  </RouteProtection>
                </AuthGuard>
              } />
              <Route path="/requisicoes/gestao-os" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="requisicoes_gestao_os_view">
                    <GestaoOrdemServico />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              {/* Admin routes */}
              <Route path="/admin/permissoes" element={
                <AuthGuard>
                  <RouteProtection requiredPermission="admin_permissoes_view">
                    <GestaoPermissoes />
                  </RouteProtection>
                </AuthGuard>
              } />
              
              {/* Fallback route for any unknown paths */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </TimezoneProvider>
    </QueryClientProvider>
  );
};

export default App;
