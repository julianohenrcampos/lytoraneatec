import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalCard } from "@/components/portal/PortalCard";
import { usePermission } from "@/hooks/usePermission";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  Users,
  Package,
  CalendarDays,
  Gavel,
  ShieldCheck,
  Settings,
  Clock,
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
      { route: "/gestao-aprovacoes-diarias", permission: "acesso_gestao_aprovacoes" },
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
      { route: "/sso/agendamento-exames", permission: "acesso_sso_agendamento_exames" },
      { route: "/sso/ver-e-agir", permission: "acesso_sso_ver_agir" },
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
  const { permissions, isSuperAdmin, isLoading } = usePermission();
  const [userName, setUserName] = useState<string>("");

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

  const resolveTarget = (targets: ModuleTarget[]): { accessible: boolean; route: string } => {
    if (targets.length === 0) return { accessible: false, route: "/" };
    if (isSuperAdmin) {
      return { accessible: true, route: targets[0].route };
    }
    const match = targets.find((t) => permissions.includes(t.permission));
    if (match) {
      return { accessible: true, route: match.route };
    }
    return { accessible: false, route: targets[0].route };
  };

  if (isLoading) {
    return (
      <PortalLayout userName={userName}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </PortalLayout>);

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
            const { accessible, route } = resolveTarget(module.targets);
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
