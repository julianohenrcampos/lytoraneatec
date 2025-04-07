
import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { MENU_STRUCTURE } from "@/constants/menuStructure";
import { 
  Sidebar, 
  SidebarContent, 
  SidebarHeader, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton 
} from "@/components/ui/sidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouteAccess } from "@/hooks/useRouteAccess";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

interface AppSidebarProps {
  openGroups: Record<string, boolean>;
  setOpenGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleGroup: (group: string) => void;
}

const AppSidebar: React.FC<AppSidebarProps> = ({
  openGroups,
  setOpenGroups,
  toggleGroup
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { 
    isLoading, 
    isSuperAdmin,
    userRoles,
    userPermissions
  } = useUserPermissions();
  
  const {
    canAccessRoute,
    canAccessGroup,
    debugPermissions
  } = useRouteAccess();

  // Debug permissions on initial load and on route change
  useEffect(() => {
    if (!isLoading) {
      console.log("=== AppSidebar Permission Debug ===");
      console.log("Current path:", location.pathname);
      console.log("Can access current path:", canAccessRoute(location.pathname));
      
      // Special debug for Relatório de Medição
      if (location.pathname === "/gestao-maquinas/relatorio-medicao" || 
          location.pathname.includes("relatorio-medicao")) {
        console.log("=== RELATÓRIO DE MEDIÇÃO DEBUG ===");
        console.log("User roles:", userRoles);
        console.log("Has AdmEquipamentos:", userRoles.includes("AdmEquipamentos"));
        console.log("Has permission:", userPermissions.includes("gestao_maquinas_relatorio_medicao_view"));
        console.log("==============================");
      }
      
      debugPermissions();
    }
  }, [isLoading, debugPermissions, location.pathname, canAccessRoute, userRoles, userPermissions]);

  // Função simplificada para verificar se uma rota está ativa
  const isRouteActive = (path: string) => {
    return location.pathname === path;
  };

  // Função para lidar com cliques nos itens do menu
  const handleMenuItemClick = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    
    console.log(`Menu item clicked: ${path}`);
    
    // Special debug for Relatório de Medição
    if (path === "/gestao-maquinas/relatorio-medicao") {
      console.log("=== RELATÓRIO DE MEDIÇÃO CLICK ===");
      console.log("User roles:", userRoles);
      console.log("Has AdmEquipamentos:", userRoles.includes("AdmEquipamentos"));
      console.log("Has permission:", userPermissions.includes("gestao_maquinas_relatorio_medicao_view"));
    }
    
    // Sempre verifica permissão antes de navegar
    const hasAccess = canAccessRoute(path);
    console.log(`Access check for ${path}: ${hasAccess}`);
    
    if (hasAccess) {
      navigate(path);
    } else {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para acessar esta página.",
        variant: "destructive",
      });
    }
  };

  // Função para verificar o acesso a uma rota para controle visual
  const checkRouteAccess = (path: string): boolean => {
    // SuperAdmin tem acesso a tudo
    if (isSuperAdmin) return true;
    
    // Dashboard routes are accessible to everyone
    if (path === '/' || path === '/dashboard') {
      return true;
    }
    
    // Special case for Relatório de Medição
    if (path === '/gestao-maquinas/relatorio-medicao') {
      return userRoles.includes('AdmEquipamentos') || 
             userRoles.includes('AdmLogistica') || 
             userRoles.includes('Encarregado') ||
             userPermissions.includes('gestao_maquinas_relatorio_medicao_view');
    }
    
    // Dashboard RH special case
    if (path === '/gestao-rh/dashboard') {
      return userRoles.includes('AdmRH') || userPermissions.includes('acesso_dashboard_rh');
    }
    
    return canAccessRoute(path);
  };

  return (
    <Sidebar>
      <SidebarHeader className="h-16 px-6 flex items-center justify-center border-b my-[5px]">
        <div className="flex items-center justify-center w-full">
          <img src="/lovable-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png" alt="Lytorânea Construtora" className="h-10 object-contain" />
        </div>
      </SidebarHeader>
      
      <SidebarContent className="p-0">
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="px-2 py-2 my-0">
            {Object.keys(MENU_STRUCTURE).map(key => {
              const group = MENU_STRUCTURE[key];
              const groupItems = group.items;
              const groupLabel = group.label;
              
              const hasGroupAccess = canAccessGroup(groupLabel);
              
              return (
                <SidebarGroup key={key} className="my-[11px] py-0">
                  <SidebarGroupLabel 
                    onClick={() => toggleGroup(groupLabel)} 
                    className={cn(
                      "flex justify-between items-center cursor-pointer my-[10px]",
                      !hasGroupAccess && "opacity-50"
                    )}
                  >
                    <span className="font-extrabold my-0 text-base">{groupLabel}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${openGroups[groupLabel] ? 'transform rotate-180' : ''}`} />
                  </SidebarGroupLabel>
                  
                  {openGroups[groupLabel] && (
                    <SidebarMenu>
                      {groupItems.map(item => {
                        const hasItemAccess = checkRouteAccess(item.path);
                        
                        // Special debug for Relatório de Medição menu item
                        if (item.path === "/gestao-maquinas/relatorio-medicao") {
                          console.log(`Menu item: ${item.label}, Path: ${item.path}, Access: ${hasItemAccess}`);
                          console.log(`Has AdmEquipamentos role:`, userRoles.includes("AdmEquipamentos"));
                          console.log(`Has specific permission:`, userPermissions.includes("gestao_maquinas_relatorio_medicao_view"));
                        }
                        
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton 
                              asChild 
                              isActive={isRouteActive(item.path)}
                              className={cn(
                                !hasItemAccess && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <a 
                                href={item.path} 
                                onClick={(e) => handleMenuItemClick(e, item.path)}
                                className="w-full"
                              >
                                <item.icon className="h-4 w-4" />
                                <span>{item.label}</span>
                              </a>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  )}
                </SidebarGroup>
              );
            })}
          </div>
        </ScrollArea>
      </SidebarContent>
    </Sidebar>
  );
};

export default AppSidebar;
