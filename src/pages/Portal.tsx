import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalCard } from "@/components/portal/PortalCard";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  Users,
  Package,
  CalendarDays,
  Gavel,
  ShieldCheck,
  Settings,
} from "lucide-react";

const portalModules = [
  {
    id: "gestao-rh",
    title: "Gestão de RH",
    description: "Funcionários, Equipes e Empresas",
    icon: Users,
    route: "/dashboard-rh",
    permission: ["dashboard_rh_view", "gestao_rh_funcionarios_view"],
    color: "hsl(262, 83%, 58%)",
  },
  {
    id: "gestao-maquinas",
    title: "Gestão Veíc/Equip",
    description: "Caminhões, Equipamentos e Disponibilidade",
    icon: Truck,
    route: "/dashboard-maquinas",
    permission: ["dashboard_maquinas_view", "gestao_maquinas_caminhoes_view"],
    color: "hsl(174, 72%, 40%)",
  },
  {
    id: "requisicoes",
    title: "Requisições e Logística",
    description: "Cadastro, Programação e Produção",
    icon: Package,
    route: "/dashboard-cbuq",
    permission: ["dashboard_cbuq_view", "requisicoes_cadastro_view"],
    color: "hsl(25, 95%, 53%)",
  },
  {
    id: "diarias",
    title: "Diárias",
    description: "Solicitações e Apontamentos",
    icon: CalendarDays,
    route: "/requisicoes/diarias/solicitacoes",
    permission: ["diarias_view", "diarias_solicitacoes_view", "diarias_dashboard_view"],
    color: "hsl(35, 85%, 50%)",
  },
  {
    id: "licitacoes",
    title: "Licitações",
    description: "Monitoramento de Oportunidades",
    icon: Gavel,
    route: "/licitacoes/monitoramento-pncp",
    permission: ["dashboard_licitacoes_view", "acesso_monitoramento_pncp", "configuracoes_pncp_view"],
    color: "hsl(280, 65%, 50%)",
  },
  {
    id: "sso",
    title: "SSO - Segurança",
    description: "Inspeções e Exames Ocupacionais",
    icon: ShieldCheck,
    route: "/sso/checklists",
    permission: ["acesso_sso_checklists", "acesso_sso_dashboard", "acesso_sso_agendamento_exames"],
    color: "hsl(0, 72%, 51%)",
  },
  {
    id: "admin",
    title: "Administração",
    description: "Gestão de Permissões",
    icon: Settings,
    route: "/admin/permissoes",
    permission: "admin_permissoes_view",
    color: "hsl(215, 16%, 47%)",
  },
];


export default function Portal() {
  const { permissions, isSuperAdmin, isLoading } = useAuthPermissions();
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
          // Get first name only
          setUserName(profile.nome_completo.split(" ")[0]);
        }
      }
    };

    fetchUserName();
  }, []);

  const hasPermission = (permission: string | string[]) => {
    if (isSuperAdmin) return true;
    if (Array.isArray(permission)) {
      return permission.some((p) => permissions.includes(p));
    }
    return permissions.includes(permission);
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
          {portalModules.map((module, index) =>
          <div key={module.id} className={index === portalModules.length - 1 ? "lg:col-start-2" : ""}>
            <PortalCard
              title={module.title}
              description={module.description}
              icon={module.icon}
              route={module.route}
              color={module.color}
              hasPermission={hasPermission(module.permission)} />
          </div>
          )}
        </div>
      </div>
    </PortalLayout>);

}