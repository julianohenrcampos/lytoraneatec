
import {
  Home,
  Fuel,
  FileText,
  Truck,
  Users,
  CalendarDays,
  Wrench,
  ClipboardList,
  Building2,
  UserCheck,
  Settings,
  BarChart3,
  Package,
  Map,
  ShieldCheck,
  Gavel,
  Calendar,
  ClipboardCheck
} from "lucide-react";

export const menuStructure = [
  {
    title: "Dashboard",
    items: [
      {
        name: "Dashboard RH",
        href: "/dashboard-rh",
        icon: BarChart3,
        requiredPermission: "dashboard_rh_view"
      },
      {
        name: "Dashboard Máquinas",
        href: "/dashboard-maquinas",
        icon: Truck,
        requiredPermission: "dashboard_maquinas_view"
      },
      {
        name: "Dashboard CBUQ",
        href: "/dashboard-cbuq",
        icon: BarChart3,
        requiredPermission: "dashboard_cbuq_view"
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
        icon: Building2,
        requiredPermission: "gestao_rh_departamentos_view"
      },
      {
        name: "Centros de Custo",
        href: "/gestao-rh/centros-custo",
        icon: Package,
        requiredPermission: "gestao_rh_centros_custo_view"
      },
      {
        name: "Diretorias",
        href: "/gestao-rh/diretorias",
        icon: Building2,
        requiredPermission: "gestao_rh_diretorias_view"
      },
      {
        name: "Funções",
        href: "/gestao-rh/funcoes",
        icon: UserCheck,
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
      },
      {
        name: "Desligamentos",
        href: "/gestao-rh/desligamentos",
        icon: Users,
        requiredPermission: "gestao_rh_funcionarios_view"
      }
    ]
  },
  {
    title: "Gestão de Máquinas",
    items: [
      {
        name: "Caminhões e Equipamentos",
        href: "/gestao-maquinas/caminhoes",
        icon: Truck,
        requiredPermission: "gestao_maquinas_caminhoes_view"
      },
      {
        name: "Usinas",
        href: "/gestao-maquinas/usinas",
        icon: Building2,
        requiredPermission: "gestao_maquinas_usinas_view"
      },
      {
        name: "Relatório de Medição",
        href: "/gestao-maquinas/relatorio-medicao",
        icon: BarChart3,
        requiredPermission: "gestao_maquinas_relatorio_medicao_view"
        
      }
      ,
      {
        name: "Relatório de Abastecimento",
        href: "/gestao-maquinas/abastecimento",
        icon: Fuel,
        requiredPermission: "gestao_maquinas_relatorio_medicao_view"
        
      }
    ]
  },
  {
    title: "Requisições",
    items: [
      {
        name: "Cadastro de Requisições",
        href: "/requisicoes/cadastro",
        icon: FileText,
        requiredPermission: "requisicoes_cadastro_view"
      },
      {
        name: "Programação de Entrega",
        href: "/programacao-entrega",
        icon: CalendarDays,
        requiredPermission: "requisicoes_programacao_entrega_view"
      },
      {
        name: "Registro de Aplicação",
        href: "/registro-aplicacao",
        icon: FileText,
        requiredPermission: "requisicoes_registro_aplicacao_view"
      },
      {
        name: "Registro de Cargas",
        href: "/requisicoes/registro-cargas",
        icon: Package,
        requiredPermission: "requisicoes_registro_cargas_view"
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
        name: "Chamados e OS",
        href: "/requisicoes/chamados-os",
        icon: Wrench,
        requiredPermission: "requisicoes_chamados_os_view"
      },
      {
        name: "Gestão de OS",
        href: "/requisicoes/gestao-os",
        icon: ClipboardList,
        requiredPermission: "requisicoes_gestao_os_view"
      },
      {
        name: "Relatório de Aplicação Diária",
        href: "/relatorio-aplicacao-diaria",
        icon: BarChart3,
        requiredPermission: "relatorio_aplicacao_view"
      }
    ]
  },
  {
    title: "Diárias",
    items: [
      {
        name: "Dashboard Diárias",
        href: "/requisicoes/diarias/dashboard",
        icon: BarChart3,
        requiredPermission: "diarias_dashboard_view"
      },
      {
        name: "Solicitações",
        href: "/requisicoes/diarias/solicitacoes",
        icon: FileText,
        requiredPermission: "diarias_solicitacoes_view"
      },
      {
        name: "Apontamento de Campo",
        href: "/requisicoes/diarias/apontamento-campo",
        icon: ClipboardCheck,
        requiredPermission: "diarias_apontamento_view"
      },
      {
        name: "Relatório/Folha",
        href: "/requisicoes/diarias/relatorio",
        icon: BarChart3,
        requiredPermission: "diarias_relatorio_view"
      }
    ]
  },
  {
    title: "Licitações",
    items: [
      {
        name: "Dashboard Licitações",
        href: "/licitacoes/dashboard",
        icon: BarChart3,
        requiredPermission: "dashboard_licitacoes_view"
      },
      {
        name: "Monitoramento PNCP",
        href: "/licitacoes/monitoramento-pncp",
        icon: Gavel,
        requiredPermission: "acesso_monitoramento_pncp"
      },
      {
        name: "Configurações PNCP",
        href: "/licitacoes/configuracoes-pncp",
        icon: Settings,
        requiredPermission: "configuracoes_pncp_view"
      }
    ]
  },
  {
    title: "SSO - Segurança",
    items: [
      {
        name: "CHECK LIST - MTE_TAC",
        href: "/sso/checklists",
        icon: ShieldCheck,
        requiredPermission: "acesso_sso_checklists"
      },
      {
        name: "Registro de Desvios",
        href: "/sso/desvios",
        icon: ShieldCheck,
        requiredPermission: "acesso_sso_desvios"
      },
      {
        name: "Ver e Agir",
        href: "/sso/ver-e-agir",
        icon: ClipboardCheck,
        requiredPermission: "acesso_sso_ver_agir"
      },
      {
        name: "Agendamento de Exames",
        href: "/sso/agendamento-exames",
        icon: Calendar,
        requiredPermission: "acesso_sso_agendamento_exames"
      },
      {
        name: "Clínicas",
        href: "/sso/clinicas",
        icon: Building2,
        requiredPermission: "acesso_sso_agendamento_exames"
      },
      {
        name: "Dashboard SSO",
        href: "/sso/checklists/dashboard",
        icon: BarChart3,
        requiredPermission: "acesso_sso_dashboard"
      }
    ]
  },
  {
    title: "Administração",
    items: [
      {
        name: "Gestão de Permissões",
        href: "/admin/permissoes",
        icon: Settings,
        requiredPermission: "admin_permissoes_view"
      }
    ]
  }
];
