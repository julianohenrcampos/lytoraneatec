import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import GlobalErrorBoundary from "@/components/error/GlobalErrorBoundary";

// Simple Auth Components
import SimpleAuthGuard from "@/components/routing/SimpleAuthGuard";
import SimplePermissionGuard from "@/components/routing/SimplePermissionGuard";

// Pages
import SimpleLogin from "@/pages/SimpleLogin";
import Portal from "@/pages/Portal";
import WaitingApproval from "@/pages/WaitingApproval";
import Register from "@/pages/Register";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import NotFound from "@/pages/NotFound";

// Gestão RH - using correct file names
import DashboardRH from "@/pages/DashboardRH";
import GestaoEmpresas from "@/pages/GestaoEmpresas";
import GestaoDepartamentos from "@/pages/GestaoDepartamentos";
import GestaoCentrosCusto from "@/pages/GestaoCentrosCusto";
import GestaoFuncoes from "@/pages/GestaoFuncoes";
import GestaoFuncionarios from "@/pages/GestaoFuncionarios";
import GestaoEquipes from "@/pages/GestaoEquipes";

// Gestão Máquinas - using correct file names
import DashboardMaquinas from "@/pages/DashboardMaquinas";
import GestaoCaminhoes from "@/pages/GestaoCaminhoes";
import GestaoUsinas from "@/pages/GestaoUsinas";
import RelatorioMedicao from "@/pages/RelatorioMedicao";
import Abastecimento from "@/pages/GestaoAbastecimento"; // Fixed casing

// Dashboard CBUQ
import DashboardRequisicoes from "@/pages/DashboardRequisicoes";

// Requisições - using correct file names
import GestaoRequisicoes from "@/pages/GestaoRequisicoes";
import ProgramacaoEntrega from "@/pages/ProgramacaoEntrega";
import RegistroCargas from "@/pages/RegistroCargas";
import RegistroAplicacao from "@/pages/RegistroAplicacao";
import ApontamentoEquipe from "@/pages/ApontamentoEquipe";
import ApontamentoCaminhoes from "@/pages/ApontamentoCaminhoes";
import ChamadosOS from "@/pages/ChamadosOS";
import GestaoOrdemServico from "@/pages/GestaoOrdemServico";
import RelatorioAplicacaoDiaria from "@/pages/RelatorioAplicacaoDiaria";

// Admin - using correct file names
import GestaoPermissoes from "@/pages/GestaoPermissoes";

// SSO - Saúde e Segurança Ocupacional
import SSOChecklistList from "@/pages/SSOChecklistList";
import SSODashboard from "@/pages/SSODashboard";
import SSODesviosList from "@/pages/SSODesviosList";

// Licitações PNCP
import MonitoramentoPNCP from "@/pages/MonitoramentoPNCP";
import ConfiguracoesPNCP from "@/pages/ConfiguracoesPNCP";
import RelatorioLicitacoes from "@/pages/RelatorioLicitacoes";

// Security Components
import SecureRouteGuard from "@/components/routing/SecureRouteGuard";

// PWA Components
import { PWAUpdateNotification } from "@/components/pwa/PWAUpdateNotification";
import { PWAInstallBanner } from "@/components/pwa/PWAInstallBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    },
  },
});

const App = () => {
  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <Routes>
                {/* Rotas públicas */}
                <Route path="/login" element={<SimpleLogin />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/waiting-approval" element={<WaitingApproval />} />
                
                {/* Portal - Página inicial */}
                <Route path="/" element={
                  <SimpleAuthGuard>
                    <Portal />
                  </SimpleAuthGuard>
                } />
            
            <Route path="/dashboard-rh" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DashboardRH />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            <Route path="/dashboard-maquinas" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DashboardMaquinas />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            <Route path="/dashboard-cbuq" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DashboardRequisicoes />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Gestão RH */}
            <Route path="/gestao-rh/empresas" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_rh_empresas_view">
                    <GestaoEmpresas />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-rh/departamentos" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_rh_departamentos_view">
                    <GestaoDepartamentos />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-rh/centros-custo" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_rh_centros_custo_view">
                    <GestaoCentrosCusto />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-rh/funcoes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_rh_funcoes_view">
                    <GestaoFuncoes />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-rh/funcionarios" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_rh_funcionarios_view">
                    <GestaoFuncionarios />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-rh/equipes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoEquipes />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Gestão Máquinas */}
            <Route path="/gestao-maquinas/caminhoes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoCaminhoes />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-maquinas/usinas" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoUsinas />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-maquinas/relatorio-medicao" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <RelatorioMedicao />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* NOVA ROTA ADICIONADA */}
            <Route path="/gestao-maquinas/abastecimento" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_maquinas_abastecimento_view">
                    <Abastecimento />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Requisições - Rota única de Programação de Entrega */}
            <Route path="/programacao-entrega" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="requisicoes_programacao_entrega_view">
                    <ProgramacaoEntrega />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            <Route path="/registro-aplicacao" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="requisicoes_registro_aplicacao_view">
                    <RegistroAplicacao />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            <Route path="/requisicoes/cadastro" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoRequisicoes />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/registro-cargas" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <RegistroCargas />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/apontamento-equipe" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <ApontamentoEquipe />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/apontamento-caminhoes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <ApontamentoCaminhoes />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/chamados-os" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <ChamadosOS />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/gestao-os" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoOrdemServico />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Relatório de Aplicação Diária */}
            <Route path="/relatorio-aplicacao-diaria" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="relatorio_aplicacao_view">
                    <RelatorioAplicacaoDiaria />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Admin */}
            <Route path="/admin/permissoes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="admin_permissoes_view">
                    <GestaoPermissoes />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* SSO - Saúde e Segurança Ocupacional */}
            <Route path="/sso/checklists" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_sso_checklists">
                    <SSOChecklistList />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* SSO - Registro de Desvios */}
            <Route path="/sso/desvios" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_sso_desvios">
                    <SSODesviosList />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            <Route path="/sso/checklists/dashboard" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_sso_dashboard">
                    <SSODashboard />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
                </SimpleAuthGuard>
            } />
            
            {/* Licitações PNCP */}
            <Route path="/licitacoes/dashboard" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="dashboard_licitacoes_view">
                    <RelatorioLicitacoes />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/licitacoes/monitoramento-pncp" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_monitoramento_pncp">
                    <MonitoramentoPNCP />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/licitacoes/configuracoes-pncp" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="configuracoes_pncp_view">
                    <ConfiguracoesPNCP />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Catch-all route para 404 */}
            <Route path="*" element={<NotFound />} />
              </Routes>
              <PWAUpdateNotification />
              <PWAInstallBanner />
            </BrowserRouter>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;