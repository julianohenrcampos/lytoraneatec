import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import GlobalErrorBoundary from "@/components/error/GlobalErrorBoundary";
import { useBodyPointerEvents } from "@/hooks/useBodyPointerEvents";
import { PageTitleProvider } from "@/contexts/PageTitleContext";

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
import GestaoDiretorias from "@/pages/GestaoDiretorias";
import GestaoDesligamentos from "@/pages/GestaoDesligamentos";
import ArquivoMorto from "@/pages/ArquivoMorto";

// Gestão Máquinas - using correct file names
import DashboardMaquinas from "@/pages/DashboardMaquinas";
import GestaoCaminhoes from "@/pages/GestaoCaminhoes";
import GestaoUsinas from "@/pages/GestaoUsinas";
import RelatorioMedicao from "@/pages/RelatorioMedicao";
import GestaoSolicitacoesEquipamento from "@/pages/GestaoSolicitacoesEquipamento";

import GestaoDisponibilidade from "@/pages/GestaoDisponibilidade";
import GestaoPortfolio from "@/pages/GestaoPortfolio";
import LinhasOperacionaisPage from "@/pages/LinhasOperacionaisPage";
import CentralTransporte from "@/pages/CentralTransporte";
import ChecklistSaida from "@/pages/ChecklistSaida";
import Abastecimento from "@/pages/GestaoAbastecimento"; // Fixed casing

// Dev
import TestePonto from "@/pages/dev/TestePonto";
import PontoDireto from "@/pages/PontoDireto";

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

import GestaoPermissoes from "@/pages/GestaoPermissoes";
import GestaoFluxos from "@/pages/admin/GestaoFluxos";
import ConfiguracoesSistema from "@/pages/admin/ConfiguracoesSistema";
import PontoDispositivos from "@/pages/admin/PontoDispositivos";

// Diárias (Fim de Semana/Feriado)
import DashboardDiarias from "@/pages/DashboardDiarias";
import DiariasSolicitacoes from "@/pages/DiariasSolicitacoes";
import DiariasRelatorio from "@/pages/DiariasRelatorio";
import DiariasApontamentoCampo from "@/pages/DiariasApontamentoCampo";
import GestaoAprovacoesDiarias from "@/pages/diarias/GestaoAprovacoesDiarias";

// SSO - Saúde e Segurança Ocupacional
import SSOChecklistList from "@/pages/SSOChecklistList";
import SSODashboard from "@/pages/SSODashboard";
import SSODesviosList from "@/pages/SSODesviosList";
import SSOAgendamentoExames from "@/pages/SSOAgendamentoExames";
import SSOClinicas from "@/pages/SSOClinicas";
import SSOVerAgir from "@/pages/SSOVerAgir";

// Licitações PNCP
import MonitoramentoPNCP from "@/pages/MonitoramentoPNCP";
import ConfiguracoesPNCP from "@/pages/ConfiguracoesPNCP";
import OrgaosPendentes from "@/pages/OrgaosPendentes";
import RelatorioLicitacoes from "@/pages/RelatorioLicitacoes";
import ConfiguracoesMatching from "@/pages/ConfiguracoesMatching";

// Security Components
import SecureRouteGuard from "@/components/routing/SecureRouteGuard";

// PWA Components
import { PWAUpdateNotification } from "@/components/pwa/PWAUpdateNotification";


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      retry: 1,
    },
  },
});

const App = () => {
  useBodyPointerEvents();

  return (
    <GlobalErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <TooltipProvider>
            <Sonner />
            <PageTitleProvider>
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
            <Route path="/gestao-rh/diretorias" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="gestao_rh_diretorias_view">
                    <GestaoDiretorias />
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
            <Route path="/gestao-rh/desligamentos" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoDesligamentos />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-rh/arquivo-morto" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <ArquivoMorto />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
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
            
            {/* Solicitações de Equipamento */}
            <Route path="/gestao-maquinas/solicitacoes-equipamentos" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoSolicitacoesEquipamento />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Disponibilidade Operacional */}
            <Route path="/gestao-maquinas/disponibilidade" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoDisponibilidade />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Portfólio de Empresas */}
            <Route path="/gestao-maquinas/portfolio-empresas" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoPortfolio />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />


            {/* Central do Transporte */}
            <Route path="/gestao-maquinas/central-transporte" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <CentralTransporte />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Checklist de Saída */}
            <Route path="/gestao-maquinas/checklist-saida/:movimentacaoId" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <ChecklistSaida />
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
            <Route path="/admin/gestao-fluxos" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="admin_gestao_fluxos_view">
                    <GestaoFluxos />
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
            
            {/* SSO - Agendamento de Exames */}
            <Route path="/sso/agendamento-exames" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_sso_agendamento_exames">
                    <SSOAgendamentoExames />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* SSO - Clínicas/Locais de Atendimento */}
            <Route path="/sso/clinicas" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_sso_agendamento_exames">
                    <SSOClinicas />
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
            
            {/* SSO - Ver e Agir */}
            <Route path="/sso/ver-e-agir" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_sso_ver_agir">
                    <SSOVerAgir />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            {/* Diárias (Fim de Semana/Feriado) - Fluxo simplificado */}
            <Route path="/requisicoes/diarias/dashboard" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DashboardDiarias />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/diarias/solicitacoes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DiariasSolicitacoes />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/diarias/relatorio" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DiariasRelatorio />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/requisicoes/diarias/apontamento-campo" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <DiariasApontamentoCampo />
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/gestao-aprovacoes-diarias" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <GestaoAprovacoesDiarias />
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
            <Route path="/licitacoes/orgaos-pendentes" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_monitoramento_pncp">
                    <OrgaosPendentes />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            <Route path="/licitacoes/configuracoes-matching" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="acesso_monitoramento_pncp">
                    <ConfiguracoesMatching />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            
            
            {/* Admin - Configurações do Sistema */}
            <Route path="/admin/configuracoes-sistema" element={
              <SimpleAuthGuard>
                <SimplePermissionGuard>
                  <SecureRouteGuard requiredPermission="admin_permissoes_view">
                    <ConfiguracoesSistema />
                  </SecureRouteGuard>
                </SimplePermissionGuard>
              </SimpleAuthGuard>
            } />
            {/* Admin - Dispositivos de Ponto (SuperAdm) */}
            <Route path="/admin/ponto-dispositivos" element={
              <SimpleAuthGuard>
                <PontoDispositivos />
              </SimpleAuthGuard>
            } />
            {/* Dev / Teste */}
            <Route path="/dev/teste-ponto" element={
              <SimpleAuthGuard>
                <TestePonto />
              </SimpleAuthGuard>
            } />
            {/* Ponto Operacional */}
            <Route path="/ponto" element={
              <SimpleAuthGuard>
                <PontoDireto />
              </SimpleAuthGuard>
            } />
            {/* Catch-all route para 404 */}
            <Route path="*" element={<NotFound />} />
              </Routes>
              <PWAUpdateNotification />
              
            </BrowserRouter>
            </PageTitleProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;