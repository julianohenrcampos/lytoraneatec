import { 
  LayoutDashboard,
  Building2, 
  Building, 
  HardHat, 
  Bookmark, 
  UserCircle, 
  Users,
  Truck,
  Factory,
  FileText,
  Package,
  BarChart3,
  ClipboardList,
  Wrench,
  PackageOpen,
  UserPlus,
  Shield,
  PieChart,
  FileSpreadsheet,
  Home,
  DollarSign,
  Briefcase,
  Calendar,
  ClipboardCheck,
  AlertTriangle,
  Settings,
  Activity
} from "lucide-react";

// Remove duplicate type declarations and use a single interface
interface MenuItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAny?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItem[];
}

// Estrutura do menu com permissões atualizadas
export const menuStructure: MenuGroup[] = [
  {
    title: "Dashboard",
    items: [
      {
        name: "Dashboard Principal",
        href: "/dashboard",
        icon: Home,
        requiredPermission: "dashboard_view"
      },
      {
        name: "Dashboard RH",
        href: "/gestao-rh/dashboard",
        icon: Users,
        requiredPermission: "dashboard_rh_view"
      },
      {
        name: "Dashboard de Máquinas",
        href: "/gestao-maquinas/dashboard",
        icon: BarChart3,
        requiredPermission: "dashboard_maquinas_view"
      },
      {
        name: "Dashboard CBUQ",
        href: "/dashboard/requisicoes",
        icon: Activity,
        requiredPermission: "dashboard_logistica_view"
      }
    ]
  },
  {
    title: "Gestão de RH",
    items: [
      {
        name: "Empresas",
        href: "/gestao-rh/empresas",
        icon: Building2,
        requiredPermission: "gestao_rh_empresas_view"
      },
      {
        name: "Departamentos",
        href: "/gestao-rh/departamentos",
        icon: Building,
        requiredPermission: "gestao_rh_departamentos_view"
      },
      {
        name: "Centros de Custo",
        href: "/gestao-rh/centros-custo",
        icon: DollarSign,
        requiredPermission: "gestao_rh_centros_custo_view"
      },
      {
        name: "Funções",
        href: "/gestao-rh/funcoes",
        icon: Briefcase,
        requiredPermission: "gestao_rh_funcoes_view"
      },
      {
        name: "Funcionários",
        href: "/gestao-rh/funcionarios",
        icon: Users,
        requiredPermission: "gestao_rh_funcionarios_view"
      },
      {
        name: "Equipes",
        href: "/gestao-rh/equipes",
        icon: Users,
        requiredPermission: "gestao_rh_equipes_view"
      }
    ]
  },
  {
    title: "Gestão de Máquinas",
    items: [
      {
        name: "Caminhões e Equipamentos",
        href: "/gestao-maquinas/caminhoes-equipamentos",
        icon: Truck,
        requiredPermission: "gestao_maquinas_caminhoes_view"
      },
      {
        name: "Usinas",
        href: "/gestao-maquinas/usinas",
        icon: Factory,
        requiredPermission: "gestao_maquinas_usinas_view"
      },
      {
        name: "Relatório de Medição",
        href: "/gestao-maquinas/relatorio-medicao",
        icon: FileText,
        requiredPermission: "gestao_maquinas_relatorio_medicao_view"
      }
    ]
  },
  {
    title: "Requisições e Logística",
    items: [
      {
        name: "Cadastro de Requisições",
        href: "/requisicoes/cadastro",
        icon: FileText,
        requiredPermission: "requisicoes_cadastro_view"
      },
      {
        name: "Programação de Entrega",
        href: "/requisicoes/programacao-entrega",
        icon: Calendar,
        requiredPermission: "requisicoes_programacao_entrega_view"
      },
      {
        name: "Registro de Cargas",
        href: "/requisicoes/registro-cargas",
        icon: Package,
        requiredPermission: "requisicoes_registro_cargas_view"
      },
      {
        name: "Registro de Aplicação",
        href: "/requisicoes/registro-aplicacao",
        icon: ClipboardCheck,
        requiredPermission: "requisicoes_registro_aplicacao_view"
      },
      {
        name: "Apontamento de Equipe",
        href: "/requisicoes/apontamento-equipe",
        icon: Users,
        requiredPermission: "requisicoes_apontamento_equipe_view"
      },
      {
        name: "Apontamento de Caminhões",
        href: "/requisicoes/apontamento-caminhoes",
        icon: Truck,
        requiredPermission: "requisicoes_apontamento_caminhoes_view"
      },
      {
        name: "Chamados para OS",
        href: "/requisicoes/chamados-os",
        icon: AlertTriangle,
        requiredPermission: "requisicoes_chamados_os_view"
      },
      {
        name: "Gestão de OS",
        href: "/requisicoes/gestao-os",
        icon: Settings,
        requiredPermission: "requisicoes_gestao_os_view"
      }
    ]
  },
  {
    title: "Administração",
    items: [
      {
        name: "Gestão de Permissões",
        href: "/admin/permissoes",
        icon: Shield,
        requiredPermission: "admin_permissoes_view"
      }
    ]
  }
];

export function getVisibleMenuItems(menuItems: MenuItem[], userPermissions: string[]): MenuItem[] {
  return menuItems.filter(item => {
    if (item.requiredPermission) {
      return userPermissions.includes(item.requiredPermission);
    }
    if (item.requiredPermissions) {
      return item.requiredPermissions.some(permission => userPermissions.includes(permission));
    }
    if (item.requireAny) {
      return userPermissions.some(permission => item.requiredPermissions?.includes(permission));
    }
    return true;
  });
}
