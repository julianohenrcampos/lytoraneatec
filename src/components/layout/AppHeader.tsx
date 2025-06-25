import React from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import UserMenu from "@/components/user/UserMenu";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { useLocation } from "react-router-dom";
import { OfflineStatusBadge } from "@/components/pwa/OfflineStatusBadge";

interface AppHeaderProps {
  user: any;
  updateUserImage: (file: File) => Promise<void>;
}

const AppHeader: React.FC<AppHeaderProps> = ({ user, updateUserImage }) => {
  const location = useLocation();

  const getPageTitle = (pathname: string) => {
    const routes: Record<string, string> = {
      '/': 'Dashboard',
      '/dashboard': 'Dashboard',
      '/gestao-funcionarios': 'Gestão de Funcionários',
      '/gestao-equipes': 'Gestão de Equipes',
      '/gestao-veiculos': 'Gestão de Veículos',
      '/gestao-centros-custo': 'Gestão de Centros de Custo',
      '/gestao-usinas': 'Gestão de Usinas',
      '/gestao-funcoes': 'Gestão de Funções',
      '/gestao-departamentos': 'Gestão de Departamentos',
      '/gestao-empresas': 'Gestão de Empresas',
      '/gestao-requisicoes': 'Gestão de Requisições',
      '/apontamento-equipe': 'Apontamento de Equipe',
      '/apontamento-caminhoes': 'Apontamento de Caminhões',
      '/programacao-entrega': 'Programação de Entrega',
      '/registro-cargas': 'Registro de Cargas',
      '/registro-aplicacao': 'Registro de Aplicação',
      '/chamados-os': 'Chamados e OS',
      '/gestao-ordem-servico': 'Gestão de Ordem de Serviço',
      '/relatorio-medicao': 'Relatório de Medição',
      '/gestao-permissoes': 'Gestão de Permissões',
      '/dashboard-rh': 'Dashboard RH',
      '/dashboard-maquinas': 'Dashboard Máquinas',
      '/dashboard-requisicoes': 'Dashboard Requisições'
    };
    
    return routes[pathname] || 'Sistema';
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background px-4">
      <div className="flex items-center gap-2 flex-1">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage className="font-medium text-foreground">
                {getPageTitle(location.pathname)}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      
      <div className="flex items-center gap-3">
        <OfflineStatusBadge />
        <UserMenu 
          userImage={user?.imagem_url}
          userName={user?.nome_completo || "Usuário"}
          onImageClick={() => {
            // Handle image click - could open modal for image upload
            console.log("Image click handler");
          }}
        />
      </div>
    </header>
  );
};

export default AppHeader;
