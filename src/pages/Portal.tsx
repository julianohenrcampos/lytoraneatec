import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalCard } from "@/components/portal/PortalCard";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import { useOrdemDiariaCampoAccess } from "@/hooks/ordemDiariaCampo/useOrdemDiariaCampoAccess";
import {
  Truck,
  Users,
  Package,
  CalendarDays,
  Gavel,
  ShieldCheck,
  Settings,
  Clock,
  HardHat,
} from "lucide-react";

interface ModuleTarget {
  route: string;
  permission: string;
}

interface PortalModule {
  id: string;
  title: string;
  description: string;
  icon: typeof Users;
  color: string;
  targets: ModuleTarget[];
}

const portalModules: PortalModule[] = [
  {
    id: "gestao-rh",
    title: "Gestão de RH",
    description: "Funcionários, Equipes e Empresas",
    icon: Users,
    color: "hsl(262, 83%, 58%)",
    targets: [
      { route: "/dashboard-rh", permission: "dashboard_rh_view" },
      { route: "/gestao-rh/funcionarios", permission: "gestao_rh_funcionarios_view" },
      { route: "/gestao-rh/equipes", permission: "gestao_rh_equipes_view" },
      { route: "/gestao-rh/empresas", permission: "gestao_rh_empresas_view" },
      { route: "/gestao-rh/departamentos", permission: "gestao_rh_departamentos_view" },
      { route: "/gestao-rh/centros-custo", permission: "gestao_rh_centros_custo_view" },
      { route: "/gestao-rh/funcoes", permission: "gestao_rh_funcoes_view" },
      { route: "/gestao-rh/diretorias", permission: "gestao_rh_diretorias_view" },
    ],
  },
  {
    id: "gestao-maquinas",
    title: "Gestão Veíc/Equip",
    description: "Caminhões, Equipamentos e Disponibilidade",
    icon: Truck,
    color: "hsl(174, 72%, 40%)",
    targets: [
      { route: "/dashboard-maquinas", permission: "dashboard_maquinas_view" },
      { route: "/gestao-maquinas/caminhoes", permission: "gestao_maquinas_caminhoes_view" },
      { route: "/gestao-maquinas/usinas", permission: "gestao_maquinas_usinas_view" },
      { route: "/gestao-maquinas/relatorio-medicao", permission: "gestao_maquinas_relatorio_medicao_view" },
    ],
  },
  {
    id: "requisicoes",
    title: "Requisições e Logística",
    description: "Cadastro, Programação e Produção",
    icon: Package,
    color: "hsl(25, 95%, 53%)",
    targets: [
      { route: "/dashboard-cbuq", permission: "dashboard_cbuq_view" },
      { route: "/requisicoes/cadastro", permission: "requisicoes_cadastro_view" },
      { route: "/programacao-entrega", permission: "requisicoes_programacao_entrega_view" },
      { route: "/requisicoes/registro-cargas", permission: "requisicoes_registro_cargas_view" },
      { route: "/registro-aplicacao", permission: "requisicoes_registro_aplicacao_view" },
      { route: "/requisicoes/apontamento-equipe", permission: "requisicoes_apontamento_equipe_view" },
      { route: "/requisicoes/apontamento-caminhoes", permission: "requisicoes_apontamento_caminhoes_view" },
      { route: "/requisicoes/chamados-os", permission: "requisicoes_chamados_os_view" },
      { route: "/requisicoes/gestao-os", permission: "requisicoes_gestao_os_view" },
    ],
  },
  {
    id: "engenharia",
    title: "Engenharia",
    description: "Planejamento Macro da Obra — cronograma, ordem do dia e execução",
    icon: HardHat,
    color: "hsl(15, 90%, 45%)",
    targets: [
      { route: "/engenharia/planejamento-macro", permission: "engenharia_planejamento_macro_view" },
      { route: "/engenharia/ordem-do-dia", permission: "engenharia_ordem_diaria_campo_view" },
    ],
  },
  {
    id: "diarias",
    title: "Diárias",
    description: "Solicitações e Apontamentos",
    icon: CalendarDays,
    color: "hsl(35, 85%, 50%)",
    targets: [
      { route: "/requisicoes/diarias/dashboard", permission: "diarias_dashboard_view" },
      { route: "/requisicoes/diarias/solicitacoes", permission: "diarias_solicitacoes_view" },
      { route: "/requisicoes/diarias/solicitacoes", permission: "diarias_view" },
      { route: "/requisicoes/diarias/apontamento-campo", permission: "diarias_apontamento_view" },
      { route: "/requisicoes/diarias/relatorio", permission: "diarias_relatorio_view" },
      // Central de Aprovações (Fase 1): entrada mantida no card de Diárias com nova permissão + legada.
      { route: "/gestao-rh/central-aprovacoes", permission: "central_aprovacoes_view" },
      { route: "/gestao-rh/central-aprovacoes", permission: "acesso_gestao_aprovacoes" },
    ],
  },
  {
    id: "licitacoes",
    title: "Licitações",
    description: "Monitoramento de Oportunidades",
    icon: Gavel,
    color: "hsl(280, 65%, 50%)",
    targets: [
      { route: "/licitacoes/monitoramento-pncp", permission: "acesso_monitoramento_pncp" },
      { route: "/licitacoes/configuracoes-pncp", permission: "configuracoes_pncp_view" },
      { route: "/licitacoes/relatorio", permission: "relatorio_licitacoes_view" },
    ],
  },
  {
    id: "sso",
    title: "SSO - Segurança",
    description: "Inspeções e Exames Ocupacionais",
    icon: ShieldCheck,
    color: "hsl(0, 72%, 51%)",
    targets: [
      { route: "/sso/checklists/dashboard", permission: "acesso_sso_dashboard" },
      { route: "/sso/checklists", permission: "acesso_sso_checklists" },
      { route: "/sso/desvios", permission: "acesso_sso_desvios" },
      { route: "/sso/ver-e-agir", permission: "acesso_sso_ver_agir" },
      { route: "/sso/clinicas", permission: "acesso_sso_clinica" },
    ],
  },
  {
    id: "ponto-eletronico",
    title: "Ponto Eletrônico",
    description: "Registro de ponto e gestão",
    icon: Clock,
    color: "hsl(200, 80%, 45%)",
    targets: [
      { route: "/ponto", permission: "ponto_registrar" },
    ],
  },
  {
    id: "admin",
    title: "Administração",
    description: "Gestão de Permissões",
    icon: Settings,
    color: "hsl(215, 16%, 47%)",
    targets: [
      { route: "/admin/permissoes", permission: "admin_permissoes_view" },
      { route: "/admin/gestao-fluxos", permission: "admin_gestao_fluxos_view" },
    ],
  },
];


export default function Portal() {
  const { permissions, isSuperAdmin, isLoading, permissionsError, clearCache } = usePermission();
  const { data: hasOrdemCampoAccess } = useOrdemDiariaCampoAccess();
  const [userName, setUserName] = useState<string>("");
  const [slowMessage, setSlowMessage] = useState<string>("Carregando...");

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase.
        from("profiles").
        select("nome_completo").
        eq("id", user.id).
        single();

        if (profile?.nome_completo) {
          setUserName(profile.nome_completo.split(" ")[0]);
        }
      }
    };

    fetchUserName();
  }, []);

  // Mensagem progressiva durante carregamento das permissões
  useEffect(() => {
    if (!isLoading) {
      setSlowMessage("Carregando...");
      return;
    }
    const t1 = setTimeout(() => setSlowMessage("Carregando permissões..."), 4000);
    const t2 = setTimeout(
      () => setSlowMessage("Está demorando mais que o normal. Aguarde ou tente recarregar."),
      10000
    );
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isLoading]);

  const hasWildcard = permissions.includes('*');

  // Log único de diagnóstico
  useEffect(() => {
    if (!isLoading) {
      console.log('🏠 [Portal] Estado consolidado:', {
        isSuperAdmin,
        permissionsCount: permissions.length,
        hasWildcard,
        permissionsError,
      });
    }
  }, [isLoading, isSuperAdmin, permissions, hasWildcard, permissionsError]);

  const resolveTarget = (
    module: PortalModule
  ): { accessible: boolean; route: string } => {
    const { targets } = module;
    if (targets.length === 0) return { accessible: false, route: "/" };
    if (isSuperAdmin || hasWildcard) {
      return { accessible: true, route: targets[0].route };
    }
    const match = targets.find((t) => permissions.includes(t.permission));
    if (match) {
      return { accessible: true, route: match.route };
    }
    // Override Engenharia: responsabilidade operacional (responsável principal/
    // de item de ordem emitida) libera apenas a rota Ordem do Dia. Nunca
    // abre Planejamento Macro administrativo.
    if (module.id === "engenharia" && hasOrdemCampoAccess === true) {
      return { accessible: true, route: "/engenharia/ordem-do-dia" };
    }
    return { accessible: false, route: targets[0].route };
  };

  if (isLoading) {
    return (
      <PortalLayout userName={userName}>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">{slowMessage}</p>
        </div>
      </PortalLayout>
    );
  }

  if (permissionsError && !isSuperAdmin) {
    return (
      <PortalLayout userName={userName}>
        <div className="flex items-center justify-center min-h-[60vh] px-4">
          <div className="max-w-md w-full rounded-lg border border-destructive/30 bg-destructive/5 p-6 space-y-4 text-center">
            <h2 className="text-lg font-semibold text-foreground">
              Não foi possível carregar suas permissões
            </h2>
            <p className="text-sm text-muted-foreground">
              Tente novamente em alguns instantes. Se o problema persistir, entre em contato com o TI.
            </p>
            <button
              type="button"
              onClick={() => clearCache()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout userName={userName}>
      <div className="space-y-8">
        {/* Welcome section */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground">
            Bem-vindo ao LYTOTEC
          </h1>
          <p className="text-muted-foreground text-lg">
            Selecione um módulo para começar
          </p>
        </div>

        {/* Modules grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {portalModules.map((module) => {
            const { accessible, route } = resolveTarget(module);
            return (
              <div key={module.id}>
                <PortalCard
                  title={module.title}
                  description={module.description}
                  icon={module.icon}
                  route={route}
                  color={module.color}
                  hasPermission={accessible} />
              </div>
            );
          })}
        </div>
      </div>
    </PortalLayout>);

}
