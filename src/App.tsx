import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import GlobalErrorBoundary from "@/components/error/GlobalErrorBoundary";
import { useBodyPointerEvents } from "@/hooks/useBodyPointerEvents";
import { PageTitleProvider } from "@/contexts/PageTitleContext";

// Síncrono: somente o estritamente necessário ao boot
import SimpleAuthGuard from "@/components/routing/SimpleAuthGuard";
import SimplePermissionGuard from "@/components/routing/SimplePermissionGuard";
import SecureRouteGuard from "@/components/routing/SecureRouteGuard";
import SimpleLogin from "@/pages/SimpleLogin";
import Portal from "@/pages/Portal";
import NotFound from "@/pages/NotFound";

// Tudo o resto: lazy (só carrega quando o usuário entrar na rota)
const WaitingApproval = lazy(() => import("@/pages/WaitingApproval"));
const Register = lazy(() => import("@/pages/Register"));
const ForgotPassword = lazy(() => import("@/pages/ForgotPassword"));
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));

const DashboardRH = lazy(() => import("@/pages/DashboardRH"));
const GestaoEmpresas = lazy(() => import("@/pages/GestaoEmpresas"));
const GestaoDepartamentos = lazy(() => import("@/pages/GestaoDepartamentos"));
const GestaoCentrosCusto = lazy(() => import("@/pages/GestaoCentrosCusto"));
const GestaoFuncoes = lazy(() => import("@/pages/GestaoFuncoes"));
const GestaoFuncionarios = lazy(() => import("@/pages/GestaoFuncionarios"));
const GestaoEquipes = lazy(() => import("@/pages/GestaoEquipes"));
const GestaoDiretorias = lazy(() => import("@/pages/GestaoDiretorias"));
const GestaoDesligamentos = lazy(() => import("@/pages/GestaoDesligamentos"));
const ArquivoMorto = lazy(() => import("@/pages/ArquivoMorto"));

const DashboardMaquinas = lazy(() => import("@/pages/DashboardMaquinas"));
const GestaoCaminhoes = lazy(() => import("@/pages/GestaoCaminhoes"));
const GestaoUsinas = lazy(() => import("@/pages/GestaoUsinas"));
const RelatorioMedicao = lazy(() => import("@/pages/RelatorioMedicao"));
const GestaoSolicitacoesEquipamento = lazy(() => import("@/pages/GestaoSolicitacoesEquipamento"));
const GestaoDisponibilidade = lazy(() => import("@/pages/GestaoDisponibilidade"));
const GestaoPortfolio = lazy(() => import("@/pages/GestaoPortfolio"));
const LinhasOperacionaisPage = lazy(() => import("@/pages/LinhasOperacionaisPage"));
const CentralTransporte = lazy(() => import("@/pages/CentralTransporte"));
const ChecklistSaida = lazy(() => import("@/pages/ChecklistSaida"));
const Abastecimento = lazy(() => import("@/pages/GestaoAbastecimento"));

const TestePonto = lazy(() => import("@/pages/dev/TestePonto"));
const PontoDireto = lazy(() => import("@/pages/PontoDireto"));
const PontoTotemLogin = lazy(() => import("@/pages/PontoTotemLogin"));
const PontoTotem = lazy(() => import("@/pages/PontoTotem"));
// FROZEN: frente "Ponto Dispositivo de Obra" pausada — retomar plano real (timeout em Funcionários).
// Arquivo src/pages/PontoDispositivo.tsx e edge function registrar-ponto-dispositivo-obra preservados.
// const PontoDispositivo = lazy(() => import("@/pages/PontoDispositivo"));
const BiometriaFacial = lazy(() => import("@/pages/admin/BiometriaFacial"));
const AuditoriaBiometria = lazy(() => import("@/pages/admin/AuditoriaBiometria"));
const GestaoPonto = lazy(() => import("@/pages/admin/GestaoPonto"));

const DashboardRequisicoes = lazy(() => import("@/pages/DashboardRequisicoes"));
const GestaoRequisicoes = lazy(() => import("@/pages/GestaoRequisicoes"));
const ProgramacaoEntrega = lazy(() => import("@/pages/ProgramacaoEntrega"));
const RegistroCargas = lazy(() => import("@/pages/RegistroCargas"));
const RegistroAplicacao = lazy(() => import("@/pages/RegistroAplicacao"));
const ApontamentoEquipe = lazy(() => import("@/pages/ApontamentoEquipe"));
const ApontamentoCaminhoes = lazy(() => import("@/pages/ApontamentoCaminhoes"));
const ChamadosOS = lazy(() => import("@/pages/ChamadosOS"));
const GestaoOrdemServico = lazy(() => import("@/pages/GestaoOrdemServico"));
const RelatorioAplicacaoDiaria = lazy(() => import("@/pages/RelatorioAplicacaoDiaria"));

const GestaoPermissoes = lazy(() => import("@/pages/GestaoPermissoes"));
const GestaoFluxos = lazy(() => import("@/pages/admin/GestaoFluxos"));
const ConfiguracoesSistema = lazy(() => import("@/pages/admin/ConfiguracoesSistema"));
const PontoDispositivos = lazy(() => import("@/pages/admin/PontoDispositivos"));
const AuditoriaSistema = lazy(() => import("@/pages/admin/AuditoriaSistema"));

const DashboardDiarias = lazy(() => import("@/pages/DashboardDiarias"));
const DiariasSolicitacoes = lazy(() => import("@/pages/DiariasSolicitacoes"));
const DiariasRelatorio = lazy(() => import("@/pages/DiariasRelatorio"));
const DiariasApontamentoCampo = lazy(() => import("@/pages/DiariasApontamentoCampo"));
const GestaoAprovacoesDiarias = lazy(() => import("@/pages/diarias/GestaoAprovacoesDiarias"));

const SSOChecklistList = lazy(() => import("@/pages/SSOChecklistList"));
const SSODashboard = lazy(() => import("@/pages/SSODashboard"));
const SSODesviosList = lazy(() => import("@/pages/SSODesviosList"));
const SSOAgendamentoExames = lazy(() => import("@/pages/SSOAgendamentoExames"));
const SSOClinicas = lazy(() => import("@/pages/SSOClinicas"));
const SSOVerAgir = lazy(() => import("@/pages/SSOVerAgir"));

const MonitoramentoPNCP = lazy(() => import("@/pages/MonitoramentoPNCP"));
const ConfiguracoesPNCP = lazy(() => import("@/pages/ConfiguracoesPNCP"));
const OrgaosPendentes = lazy(() => import("@/pages/OrgaosPendentes"));
const RelatorioLicitacoes = lazy(() => import("@/pages/RelatorioLicitacoes"));
const ConfiguracoesMatching = lazy(() => import("@/pages/ConfiguracoesMatching"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// Helpers para reduzir aninhamento e ruído
const Auth = ({ children }: { children: React.ReactNode }) => (
  <SimpleAuthGuard>{children}</SimpleAuthGuard>
);
const Perm = ({ children }: { children: React.ReactNode }) => (
  <SimpleAuthGuard>
    <SimplePermissionGuard>{children}</SimplePermissionGuard>
  </SimpleAuthGuard>
);
const Secure = ({ permission, children }: { permission: string; children: React.ReactNode }) => (
  <SimpleAuthGuard>
    <SimplePermissionGuard>
      <SecureRouteGuard requiredPermission={permission}>{children}</SecureRouteGuard>
    </SimplePermissionGuard>
  </SimpleAuthGuard>
);

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
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* Públicas */}
                    <Route path="/login" element={<SimpleLogin />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/waiting-approval" element={<WaitingApproval />} />

                    {/* Portal */}
                    <Route path="/" element={<Auth><Portal /></Auth>} />

                    {/* Dashboards */}
                    <Route path="/dashboard-rh" element={<Secure permission="dashboard_rh_view"><DashboardRH /></Secure>} />
                    <Route path="/dashboard-maquinas" element={<Secure permission="dashboard_maquinas_view"><DashboardMaquinas /></Secure>} />
                    <Route path="/dashboard-cbuq" element={<Secure permission="dashboard_cbuq_view"><DashboardRequisicoes /></Secure>} />

                    {/* Gestão RH */}
                    <Route path="/gestao-rh/empresas" element={<Secure permission="gestao_rh_empresas_view"><GestaoEmpresas /></Secure>} />
                    <Route path="/gestao-rh/departamentos" element={<Secure permission="gestao_rh_departamentos_view"><GestaoDepartamentos /></Secure>} />
                    <Route path="/gestao-rh/centros-custo" element={<Secure permission="gestao_rh_centros_custo_view"><GestaoCentrosCusto /></Secure>} />
                    <Route path="/gestao-rh/diretorias" element={<Secure permission="gestao_rh_diretorias_view"><GestaoDiretorias /></Secure>} />
                    <Route path="/gestao-rh/funcoes" element={<Secure permission="gestao_rh_funcoes_view"><GestaoFuncoes /></Secure>} />
                    <Route path="/gestao-rh/funcionarios" element={<Secure permission="gestao_rh_funcionarios_view"><GestaoFuncionarios /></Secure>} />
                    <Route path="/gestao-rh/equipes" element={<Secure permission="gestao_rh_equipes_view"><GestaoEquipes /></Secure>} />
                    <Route path="/gestao-rh/desligamentos" element={<Secure permission="gestao_rh_funcionarios_view"><GestaoDesligamentos /></Secure>} />
                    <Route path="/gestao-rh/arquivo-morto" element={<Secure permission="gestao_rh_arquivo_morto_view"><ArquivoMorto /></Secure>} />

                    {/* Gestão Máquinas */}
                    <Route path="/gestao-maquinas/caminhoes" element={<Secure permission="gestao_maquinas_caminhoes_view"><GestaoCaminhoes /></Secure>} />
                    <Route path="/gestao-maquinas/usinas" element={<Secure permission="gestao_maquinas_usinas_view"><GestaoUsinas /></Secure>} />
                    <Route path="/gestao-maquinas/relatorio-medicao" element={<Secure permission="gestao_maquinas_relatorio_medicao_view"><RelatorioMedicao /></Secure>} />
                    <Route path="/gestao-maquinas/abastecimento" element={<Secure permission="gestao_maquinas_abastecimento_view"><Abastecimento /></Secure>} />
                    <Route path="/gestao-maquinas/solicitacoes-equipamentos" element={<Secure permission="gestao_maquinas_caminhoes_view"><GestaoSolicitacoesEquipamento /></Secure>} />
                    <Route path="/gestao-maquinas/disponibilidade" element={<Secure permission="gestao_maquinas_caminhoes_view"><GestaoDisponibilidade /></Secure>} />
                    <Route path="/gestao-maquinas/portfolio-empresas" element={<Secure permission="gestao_maquinas_caminhoes_view"><GestaoPortfolio /></Secure>} />
                    <Route path="/gestao-maquinas/linhas-operacionais" element={<Perm><LinhasOperacionaisPage /></Perm>} />
                    <Route path="/gestao-maquinas/central-transporte" element={<Secure permission="gestao_maquinas_caminhoes_view"><CentralTransporte /></Secure>} />
                    <Route path="/gestao-maquinas/checklist-saida/:movimentacaoId" element={<Perm><ChecklistSaida /></Perm>} />

                    {/* Requisições */}
                    <Route path="/programacao-entrega" element={<Secure permission="requisicoes_programacao_entrega_view"><ProgramacaoEntrega /></Secure>} />
                    <Route path="/registro-aplicacao" element={<Secure permission="requisicoes_registro_aplicacao_view"><RegistroAplicacao /></Secure>} />
                    <Route path="/requisicoes/cadastro" element={<Secure permission="requisicoes_cadastro_view"><GestaoRequisicoes /></Secure>} />
                    <Route path="/requisicoes/registro-cargas" element={<Secure permission="requisicoes_registro_cargas_view"><RegistroCargas /></Secure>} />
                    <Route path="/requisicoes/apontamento-equipe" element={<Secure permission="requisicoes_apontamento_equipe_view"><ApontamentoEquipe /></Secure>} />
                    <Route path="/requisicoes/apontamento-caminhoes" element={<Secure permission="requisicoes_apontamento_caminhoes_view"><ApontamentoCaminhoes /></Secure>} />
                    <Route path="/requisicoes/chamados-os" element={<Secure permission="requisicoes_chamados_os_view"><ChamadosOS /></Secure>} />
                    <Route path="/requisicoes/gestao-os" element={<Secure permission="requisicoes_gestao_os_view"><GestaoOrdemServico /></Secure>} />
                    <Route path="/relatorio-aplicacao-diaria" element={<Secure permission="relatorio_aplicacao_view"><RelatorioAplicacaoDiaria /></Secure>} />

                    {/* Admin */}
                    <Route path="/admin/permissoes" element={<Secure permission="admin_permissoes_view"><GestaoPermissoes /></Secure>} />
                    <Route path="/admin/gestao-fluxos" element={<Secure permission="admin_gestao_fluxos_view"><GestaoFluxos /></Secure>} />
                    <Route path="/admin/auditoria" element={<Secure permission="admin_auditoria_view"><AuditoriaSistema /></Secure>} />
                    <Route path="/admin/configuracoes-sistema" element={<Secure permission="admin_permissoes_view"><ConfiguracoesSistema /></Secure>} />
                    <Route path="/admin/ponto-dispositivos" element={<Auth><Secure permission="admin_permissoes_view"><PontoDispositivos /></Secure></Auth>} />
                    <Route path="/admin/biometria-facial" element={<Auth><Secure permission="biometria_facial_gerenciar"><BiometriaFacial /></Secure></Auth>} />
                    <Route path="/admin/auditoria-biometria" element={<Auth><Secure permission="admin_auditoria_view"><AuditoriaBiometria /></Secure></Auth>} />
                    <Route path="/admin/gestao-ponto" element={<Auth><Secure permission="biometria_facial_gerenciar"><GestaoPonto /></Secure></Auth>} />

                    {/* SSO */}
                    <Route path="/sso/checklists" element={<Secure permission="acesso_sso_checklists"><SSOChecklistList /></Secure>} />
                    <Route path="/sso/desvios" element={<Secure permission="acesso_sso_desvios"><SSODesviosList /></Secure>} />
                    <Route path="/sso/agendamento-exames" element={<Secure permission="acesso_sso_agendamento_exames"><SSOAgendamentoExames /></Secure>} />
                    <Route path="/sso/clinicas" element={<Secure permission="acesso_sso_clinica"><SSOClinicas /></Secure>} />
                    <Route path="/sso/checklists/dashboard" element={<Secure permission="acesso_sso_dashboard"><SSODashboard /></Secure>} />
                    <Route path="/sso/ver-e-agir" element={<Secure permission="acesso_sso_ver_agir"><SSOVerAgir /></Secure>} />

                    {/* Diárias */}
                    <Route path="/requisicoes/diarias/dashboard" element={<Secure permission="diarias_dashboard_view"><DashboardDiarias /></Secure>} />
                    <Route path="/requisicoes/diarias/solicitacoes" element={<Secure permission="diarias_solicitacoes_view"><DiariasSolicitacoes /></Secure>} />
                    <Route path="/requisicoes/diarias/relatorio" element={<Secure permission="diarias_relatorio_view"><DiariasRelatorio /></Secure>} />
                    <Route path="/requisicoes/diarias/apontamento-campo" element={<Secure permission="diarias_apontamento_view"><DiariasApontamentoCampo /></Secure>} />
                    <Route path="/gestao-aprovacoes-diarias" element={<Secure permission="acesso_gestao_aprovacoes"><GestaoAprovacoesDiarias /></Secure>} />

                    {/* Licitações */}
                    <Route path="/licitacoes/dashboard" element={<Secure permission="dashboard_licitacoes_view"><RelatorioLicitacoes /></Secure>} />
                    <Route path="/licitacoes/monitoramento-pncp" element={<Secure permission="acesso_monitoramento_pncp"><MonitoramentoPNCP /></Secure>} />
                    <Route path="/licitacoes/configuracoes-pncp" element={<Secure permission="configuracoes_pncp_view"><ConfiguracoesPNCP /></Secure>} />
                    <Route path="/licitacoes/orgaos-pendentes" element={<Secure permission="acesso_monitoramento_pncp"><OrgaosPendentes /></Secure>} />
                    <Route path="/licitacoes/configuracoes-matching" element={<Secure permission="acesso_monitoramento_pncp"><ConfiguracoesMatching /></Secure>} />
                    <Route path="/licitacoes/relatorio" element={<Secure permission="relatorio_licitacoes_view"><RelatorioLicitacoes /></Secure>} />

                    {/* Ponto */}
                    <Route path="/ponto" element={<Secure permission="ponto_registrar"><PontoDireto /></Secure>} />
                    <Route path="/ponto-totem-login" element={<PontoTotemLogin />} />
                    <Route path="/ponto-totem" element={<PontoTotem />} />
                    {/* FROZEN: <Route path="/ponto-dispositivo" element={<PontoDispositivo />} /> */}

                    {/* Dev */}
                    <Route path="/dev/teste-ponto" element={<Auth><TestePonto /></Auth>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </PageTitleProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GlobalErrorBoundary>
  );
};

export default App;
