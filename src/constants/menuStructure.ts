
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
  FileSpreadsheet
} from "lucide-react";

export type MenuItem = {
  icon: React.ComponentType<any>;
  label: string;
  path: string;
};

export type MenuGroup = {
  label: string;
  items: MenuItem[];
};

export type MenuStructure = Record<string, MenuGroup>;

// Define main menu structure with consistent naming and paths to eliminate duplicates
export const MENU_STRUCTURE: MenuStructure = {
  Dashboard: {
    label: "Dashboard",
    items: [
      { icon: LayoutDashboard, label: "Página Inicial", path: "/" }
    ]
  },
  GestaoRH: {
    label: "Gestão de RH",
    items: [
      { icon: PieChart, label: "Dashboard RH", path: "/gestao-rh/dashboard" },
      { icon: Building2, label: "Cadastro de Empresas", path: "/gestao-rh/empresas" },
      { icon: Building, label: "Cadastro de Departamentos", path: "/gestao-rh/departamentos" },
      { icon: HardHat, label: "Cadastro de Centros de Custo", path: "/gestao-rh/centros-custo" },
      { icon: Bookmark, label: "Cadastro de Funções", path: "/gestao-rh/funcoes" },
      { icon: UserCircle, label: "Gestão de Funcionários", path: "/gestao-rh/funcionarios" },
      { icon: Users, label: "Cadastro de Equipes", path: "/gestao-rh/equipes" }
    ]
  },
  GestaoMaquinas: {
    label: "Gestão de Máquinas/Equipamentos",
    items: [
      { icon: Truck, label: "Cadastro de C/E", path: "/gestao-maquinas/caminhoes-equipamentos" },
      { icon: Factory, label: "Cadastro de Usinas", path: "/gestao-maquinas/usinas" },
      { icon: FileSpreadsheet, label: "Relatório de Medição", path: "/gestao-maquinas/relatorio-medicao" }
    ]
  },
  Requisicoes: {
    label: "Requisições e Logística",
    items: [
      { icon: FileText, label: "Cadastro de Requisições", path: "/requisicoes/cadastro" },
      { icon: Package, label: "Programação de Entrega", path: "/requisicoes/programacao-entrega" },
      { icon: BarChart3, label: "Registro de Cargas - Balança", path: "/requisicoes/registro-cargas" },
      { icon: Building, label: "Registro de Aplicação", path: "/requisicoes/registro-aplicacao" },
      { icon: ClipboardList, label: "Apontamento de Equipe", path: "/requisicoes/apontamento-equipe" },
      { icon: Truck, label: "Apontamento de C&E", path: "/requisicoes/apontamento-caminhoes" },
      { icon: Wrench, label: "Abertura de Chamado para OS", path: "/requisicoes/chamados-os" },
      { icon: PackageOpen, label: "Gestão de Ordens de Serviço", path: "/requisicoes/gestao-os" }
    ]
  },
  Administracao: {
    label: "Administração",
    items: [
      { icon: Shield, label: "Gestão de Permissões", path: "/admin/permissoes" }
    ]
  }
};
