import { useEffect, useState } from "react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { PortalCard } from "@/components/portal/PortalCard";
import { useAuthPermissions } from "@/hooks/useAuthPermissions";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart3,
  Truck,
  Users,
  FileText,
  ShieldCheck,
  Settings,
  Factory,
  ClipboardList,
  Gavel,
  Calendar,
} from "lucide-react";

// Define all modules with their permissions and colors
const portalModules = [
  {
    id: "dashboard-rh",
    title: "Dashboard RH",
    description: "Indicadores de Recursos Humanos",
    icon: BarChart3,
    route: "/dashboard-rh",
    permission: "dashboard_rh_view",
    color: "hsl(221, 83%, 53%)", // Blue
  },
  {
    id: "dashboard-maquinas",
    title: "Dashboard Máquinas",
    description: "Indicadores de Equipamentos",
    icon: Truck,
    route: "/dashboard-maquinas",
    permission: "dashboard_maquinas_view",
    color: "hsl(142, 71%, 45%)", // Green
  },
  {
    id: "dashboard-cbuq",
    title: "Dashboard CBUQ",
    description: "Indicadores de Produção",
    icon: Factory,
    route: "/dashboard-cbuq",
    permission: "dashboard_cbuq_view",
    color: "hsl(25, 95%, 53%)", // Orange
  },
  {
    id: "dashboard-sso",
    title: "Dashboard SSO",
    description: "Indicadores de Segurança",
    icon: ShieldCheck,
    route: "/sso/checklists/dashboard",
    permission: "acesso_sso_dashboard",
    color: "hsl(0, 72%, 51%)", // Red
  },
  {
    id: "gestao-rh",
    title: "Gestão de RH",
    description: "Funcionários, Equipes e Empresas",
    icon: Users,
    route: "/gestao-rh/funcionarios",
    permission: "gestao_rh_funcionarios_view",
    color: "hsl(262, 83%, 58%)", // Purple
  },
  {
    id: "gestao-maquinas",
    title: "Gestão de Máquinas",
    description: "Caminhões e Equipamentos",
    icon: Truck,
    route: "/gestao-maquinas/caminhoes",
    permission: "gestao_maquinas_caminhoes_view",
    color: "hsl(174, 72%, 40%)", // Teal
  },
  {
    id: "requisicoes",
    title: "Requisições",
    description: "Cadastro e Programação",
    icon: FileText,
    route: "/requisicoes/cadastro",
    permission: "requisicoes_cadastro_view",
    color: "hsl(45, 93%, 47%)", // Yellow/Gold
  },
  {
    id: "sso-checklists",
    title: "SSO",
    description: "Inspeções de Segurança",
    icon: ClipboardList,
    route: "/sso/checklists",
    permission: "acesso_sso_checklists",
    color: "hsl(330, 81%, 60%)", // Pink
  },
  {
    id: "sso-agendamento",
    title: "Agendamento de Exames",
    description: "Exames Ocupacionais",
    icon: Calendar,
    route: "/sso/agendamento-exames",
    permission: "acesso_sso_agendamento_exames",
    color: "hsl(200, 70%, 50%)", // Light Blue
  },
  {
    id: "licitacoes-pncp",
    title: "Licitações PNCP",
    description: "Monitoramento de Oportunidades",
    icon: Gavel,
    route: "/licitacoes/monitoramento-pncp",
    permission: ["dashboard_licitacoes_view", "acesso_monitoramento_pncp", "configuracoes_pncp_view"],
    color: "hsl(280, 65%, 50%)", // Purple
  },
  {
    id: "admin",
    title: "Administração",
    description: "Gestão de Permissões",
    icon: Settings,
    route: "/admin/permissoes",
    permission: "admin_permissoes_view",
    color: "hsl(215, 16%, 47%)", // Gray
  },
];

export default function Portal() {
  const { permissions, isSuperAdmin, isLoading } = useAuthPermissions();
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const fetchUserName = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("nome_completo")
          .eq("id", user.id)
          .single();
        
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
      return permission.some(p => permissions.includes(p));
    }
    return permissions.includes(permission);
  };

  if (isLoading) {
    return (
      <PortalLayout userName={userName}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
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
            Bem-vindo ao Sistema
          </h1>
          <p className="text-muted-foreground text-lg">
            Selecione um módulo para começar
          </p>
        </div>

        {/* Modules grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {portalModules.map((module) => (
            <PortalCard
              key={module.id}
              title={module.title}
              description={module.description}
              icon={module.icon}
              route={module.route}
              color={module.color}
              hasPermission={hasPermission(module.permission)}
            />
          ))}
        </div>
      </div>
    </PortalLayout>
  );
}
