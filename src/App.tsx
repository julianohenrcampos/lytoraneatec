import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { TimezoneProvider } from "@/contexts/TimezoneContext";
import RouteProtection from "@/components/routing/RouteProtection";
import MainLayout from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard"; // Direct import for Dashboard
import Dashboard1 from "./pages/Dashboard1";
import DashboardRH from "./pages/DashboardRH"; // Import for DashboardRH
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

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TimezoneProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <RouteProtection>
              <Routes>
                {/* Directly render Dashboard at root path */}
                <Route path="/" element={<Dashboard />} />
                
                {/* Keep dashboard route */}
                <Route path="/dashboard" element={<Dashboard />} />
                
                {/* Dashboard RH route */}
                <Route path="/gestao-rh/dashboard" element={<DashboardRH />} />
                
                {/* Dashboard1 route - deprecated, but keep for backwards compatibility */}
                <Route path="/dashboard1" element={<Dashboard1 />} />
                
                {/* Auth routes */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                
                {/* Gestão RH routes */}
                <Route path="/gestao-rh/empresas" element={<GestaoEmpresas />} />
                <Route path="/gestao-rh/departamentos" element={<GestaoDepartamentos />} />
                <Route path="/gestao-rh/centros-custo" element={<GestaoCentrosCusto />} />
                <Route path="/gestao-rh/funcoes" element={<GestaoFuncoes />} />
                <Route path="/gestao-rh/funcionarios" element={<GestaoFuncionarios />} />
                <Route path="/gestao-rh/equipes" element={<GestaoEquipes />} />
                
                {/* Gestão Máquinas routes - Removed Frotas route */}
                <Route path="/gestao-maquinas/caminhoes-equipamentos" element={<GestaoCaminhoes />} />
                <Route path="/gestao-maquinas/usinas" element={<GestaoUsinas />} />
                <Route path="/gestao-maquinas/relatorio-medicao" element={<RelatorioMedicao />} />
                
                {/* Requisições routes */}
                <Route path="/requisicoes/cadastro" element={<GestaoRequisicoes />} />
                <Route path="/requisicoes/programacao-entrega" element={<ProgramacaoEntrega />} />
                <Route path="/requisicoes/registro-cargas" element={<RegistroCargas />} />
                <Route path="/requisicoes/registro-aplicacao" element={<RegistroAplicacao />} />
                <Route path="/requisicoes/apontamento-equipe" element={<ApontamentoEquipe />} />
                <Route path="/requisicoes/apontamento-caminhoes" element={<ApontamentoCaminhoes />} />
                <Route path="/requisicoes/chamados-os" element={<ChamadosOS />} />
                <Route path="/requisicoes/gestao-os" element={<GestaoOrdemServico />} />
                
                {/* Admin routes */}
                <Route path="/admin/permissoes" element={<GestaoPermissoes />} />
                
                {/* Redirect any unknown paths to NotFound */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </RouteProtection>
          </BrowserRouter>
        </TooltipProvider>
      </TimezoneProvider>
    </QueryClientProvider>
  );
};

export default App;
