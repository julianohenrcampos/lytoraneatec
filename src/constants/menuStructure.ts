
import {
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
  ShieldCheck,
  Gavel,
  Calendar,
  ClipboardCheck,
  FileCheck,
  
  Activity,
  Briefcase,
  FileSearch,
  Clock,
  ScanFace,
  HardHat
} from "lucide-react";

export const menuStructure = [
  {
    groupIcon: Users,
    title: "Gestão de RH",
    items: [
      {
        name: "Dashboard RH",
        href: "/dashboard-rh",
        icon: BarChart3,
        requiredPermission: "dashboard_rh_view"
      },
      {
        name: "Empresas",
        href: "/gestao-rh/empresas",
        icon: Building2,
        requiredPermission: "gestao_rh_empresas_view"
      },
      {
        name: "Diretorias",
        href: "/gestao-rh/diretorias",
        icon: Building2,
        requiredPermission: "gestao_rh_diretorias_view"
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
        name: "Arquivo Morto",
        href: "/gestao-rh/arquivo-morto",
        icon: Users,
        requiredPermission: "gestao_rh_arquivo_morto_view"
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
        requiredPermission: "acesso_sso_clinica"
      }
    ]
  },
  {
    groupIcon: HardHat,
    title: "Engenharia",
    items: [
      {
        name: "Planejamento Macro da Obra",
        href: "/engenharia/planejamento-macro",
        icon: ClipboardList,
        requiredPermission: "engenharia_planejamento_macro_view"
      },
      {
        name: "Ordem do Dia",
        href: "/engenharia/ordem-do-dia",
        icon: ClipboardCheck,
        requiredPermissions: [
          "engenharia_ordem_diaria_view",
          "engenharia_ordem_diaria_campo_view"
        ],
        // Marcador consumido pelo AppSidebar para liberar o item também via
        // responsabilidade operacional (responsável principal/de item) sem
        // exigir permissão administrativa explícita.
        customAccessKey: "ordemDiariaCampo"
      }
    ]
  },
  {
    groupIcon: Truck,
    title: "Gestão Veic/Equip",
    items: [
      {
        name: "Dashboard Máquinas",
        href: "/dashboard-maquinas",
        icon: BarChart3,
        requiredPermission: "dashboard_maquinas_view"
      },
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
        name: "Apontamento de Caminhões",
        href: "/requisicoes/apontamento-caminhoes",
        icon: Truck,
        requiredPermission: "requisicoes_apontamento_caminhoes_view"
      },
      {
        name: "Relatório de Medição",
        href: "/gestao-maquinas/relatorio-medicao",
        icon: BarChart3,
        requiredPermission: "gestao_maquinas_relatorio_medicao_view"
      },
      {
        name: "Relatório de Abastecimento",
        href: "/gestao-maquinas/abastecimento",
        icon: Fuel,
        requiredPermission: "gestao_maquinas_relatorio_medicao_view"
      },
      {
        name: "Disponibilidade",
        href: "/gestao-maquinas/disponibilidade",
        icon: Activity,
        requiredPermission: "gestao_maquinas_caminhoes_view"
      },
      {
        name: "Portfólio de Empresas / Veic. e Equip.",
        href: "/gestao-maquinas/portfolio-empresas",
        icon: Briefcase,
        requiredPermission: "gestao_maquinas_caminhoes_view"
      },
      {
        name: "Solicitações de Equipamento",
        href: "/gestao-maquinas/solicitacoes-equipamentos",
        icon: FileSearch,
        requiredPermission: "gestao_maquinas_caminhoes_view"
      },
      {
        name: "Central do Transporte",
        href: "/gestao-maquinas/central-transporte",
        icon: Truck,
        requiredPermission: "gestao_maquinas_caminhoes_view"
      }
    ]
  },
  {
    groupIcon: Package,
    title: "Requisições e Logística",
    items: [
      {
        name: "Dashboard Logística",
        href: "/dashboard-cbuq",
        icon: BarChart3,
        requiredPermission: "dashboard_cbuq_view"
      },
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
        name: "Registro de Cargas",
        href: "/requisicoes/registro-cargas",
        icon: Package,
        requiredPermission: "requisicoes_registro_cargas_view"
      },
      {
        name: "Registro de Aplicação",
        href: "/registro-aplicacao",
        icon: FileText,
        requiredPermission: "requisicoes_registro_aplicacao_view"
      },
      {
        name: "Apontamento de Equipe",
        href: "/requisicoes/apontamento-equipe",
        icon: Users,
        requiredPermission: "requisicoes_apontamento_equipe_view"
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
    groupIcon: CalendarDays,
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
      },
      {
        name: "Gestão de Aprovações",
        href: "/gestao-aprovacoes-diarias",
        icon: ClipboardCheck,
        requiredPermission: "acesso_gestao_aprovacoes"
      }
      // Removido do menu operacional: "Auditoria Ponto × Diárias (Shadow)".
      // Rota /requisicoes/diarias/auditoria-ponto-shadow segue acessível
      // apenas a SuperAdm como ferramenta de diagnóstico (sem botões operacionais).
    ]
  },
  {
    groupIcon: Gavel,
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
    groupIcon: ShieldCheck,
    title: "SSO - Segurança",
    items: [
      {
        name: "Dashboard SSO",
        href: "/sso/checklists/dashboard",
        icon: BarChart3,
        requiredPermission: "acesso_sso_dashboard"
      },
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
        name: "Atestados Médicos",
        href: "/sso/atestados",
        icon: FileCheck,
        requiredPermission: "saude_atestados_view"
      }
    ]
  },
  {
    groupIcon: Settings,
    title: "Administração",
    items: [
      {
        name: "Gestão de Permissões",
        href: "/admin/permissoes",
        icon: Settings,
        requiredPermission: "admin_permissoes_view"
      },
      {
        name: "Gestão de Fluxos",
        href: "/admin/gestao-fluxos",
        icon: Settings,
        requiredPermission: "admin_gestao_fluxos_view"
      },
      {
        name: "Configurações do Sistema",
        href: "/admin/configuracoes-sistema",
        icon: Settings,
        requiredPermission: "admin_permissoes_view"
      },
      {
        name: "Dispositivos de Ponto",
        href: "/admin/ponto-dispositivos",
        icon: Settings,
        requiredPermission: "admin_permissoes_view"
      },
      {
        name: "Central de Auditoria",
        href: "/admin/auditoria",
        icon: ShieldCheck,
        requiredPermission: "admin_auditoria_view"
      },
      {
        name: "Biometria Facial",
        href: "/admin/biometria-facial",
        icon: ScanFace,
        requiredPermission: "biometria_facial_gerenciar"
      }
    ]
  },
  {
    groupIcon: Clock,
    title: "Ponto Eletrônico",
    items: [
      {
        name: "Registrar Ponto",
        href: "/ponto",
        icon: Clock,
        requiredPermission: "ponto_registrar"
      },
      {
        name: "Gestão de Ponto",
        href: "/admin/gestao-ponto",
        icon: ClipboardList,
        requiredPermission: "biometria_facial_gerenciar"
      }
    ]
  }
];
