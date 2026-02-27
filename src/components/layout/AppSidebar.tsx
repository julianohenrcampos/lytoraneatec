
import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useDynamicPermissions } from "@/hooks/useDynamicPermissions";
import { menuStructure } from "@/constants/menuStructure";
import { useDiariasPendentes } from "@/hooks/diarias/useDiariasPendentes";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem } from
"@/components/ui/sidebar";
import { APP_VERSION } from "@/lib/version";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { isSuperAdmin, userRole, permissions, isLoading } = useDynamicPermissions();
  const { count: pendentesCount } = useDiariasPendentes();

  console.log('🎯 SIDEBAR DEBUG - Estado atual DINÂMICO:', {
    isLoading,
    isSuperAdmin,
    userRole,
    permissions,
    permissionsCount: permissions?.length || 0,
    currentPath: location.pathname
  });

  // Função para verificar se pode acessar um item baseado nas permissões dinâmicas
  const canAccessItem = (item: any) => {
    console.log(`🔍 Verificando acesso DINÂMICO para: ${item.name}`);

    // 🚀 REGRA ABSOLUTA: SuperAdmin pode ver TUDO
    if (isSuperAdmin) {
      console.log(`🔓 SuperAdmin - Acesso TOTAL para: ${item.name}`);
      return true;
    }

    // 🔓 Se não há permissão requerida, permitir acesso (itens públicos como Dashboard)
    if (!item.requiredPermission && !item.requiredPermissions?.length) {
      console.log(`🔓 Item público - Acesso para: ${item.name}`);
      return true;
    }

    // Verificar permissão específica requerida
    if (item.requiredPermission) {
      const hasPermission = permissions.includes(item.requiredPermission);
      console.log(`${hasPermission ? '✅' : '❌'} Permissão dinâmica "${item.requiredPermission}" para "${item.name}": ${hasPermission}`);
      return hasPermission;
    }

    // Verificar múltiplas permissões (se pelo menos uma for atendida)
    if (item.requiredPermissions?.length) {
      const hasAnyPermission = item.requiredPermissions.some((perm: string) => permissions.includes(perm));
      console.log(`${hasAnyPermission ? '✅' : '❌'} Alguma permissão dinâmica de ${JSON.stringify(item.requiredPermissions)} para "${item.name}": ${hasAnyPermission}`);
      return hasAnyPermission;
    }

    console.log(`❌ Sem critério de acesso definido para: ${item.name}`);
    return false;
  };

  const getVisibleItems = (items: any[]) => {
    const visibleItems = items.filter(canAccessItem);
    console.log(`📋 Itens visíveis no grupo (DINÂMICO):`, visibleItems.map((item) => item.name));
    return visibleItems;
  };

  const getVisibleGroups = () => {
    const visibleGroups = menuStructure.
    map((group) => ({
      ...group,
      items: getVisibleItems(group.items)
    })).
    filter((group) => group.items.length > 0);

    console.log(`📋 Grupos visíveis (DINÂMICO):`, visibleGroups.map((g) => `${g.title} (${g.items.length} itens)`));
    return visibleGroups;
  };

  const visibleGroups = getVisibleGroups();

  // Auto-scroll para o grupo que contém a rota ativa
  React.useEffect(() => {
    if (isLoading) return;
    const activeGroup = visibleGroups.find((group) =>
    group.items.some((item) => location.pathname === item.href)
    );
    if (activeGroup) {
      const groupElement = document.querySelector(
        `[data-sidebar-group="${activeGroup.title}"]`
      );
      if (groupElement) {
        setTimeout(() => {
          groupElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
      }
    }
  }, [location.pathname, isLoading]);

  // Loading state
  if (isLoading) {
    return (
      <Sidebar {...props}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Carregando permissões...</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm">Sistema dinâmico...</span>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>);

  }

  console.log('🎯 RESULTADO FINAL - Renderizando sidebar DINÂMICO:', {
    isSuperAdmin,
    userRole,
    totalGroups: visibleGroups.length,
    groupDetails: visibleGroups.map((g) => `${g.title}: ${g.items.length} itens`)
  });

  // Se não tem grupos visíveis, mostrar apenas Dashboard básico
  if (visibleGroups.length === 0) {
    console.log('⚠️ Nenhum grupo visível - aplicando fallback básico DINÂMICO');
    return (
      <Sidebar {...props}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Menu Básico</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/dashboard'}>
                    <Link to="/dashboard">
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>);

  }

  return (
    <Sidebar {...props}>
      <SidebarContent>
        {visibleGroups.map((group, index) =>
        <SidebarGroup key={index} data-sidebar-group={group.title}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                const isPendenteSolicitacoes = item.href === '/requisicoes/diarias/solicitacoes' && pendentesCount > 0;
                return (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                      <Link to={item.href} className={cn(
                        "relative",
                        isPendenteSolicitacoes && "animate-pulse"
                      )}>
                        
                        <span className={cn(isPendenteSolicitacoes && "text-orange-600 font-semibold")}>{item.name}</span>
                        {isPendenteSolicitacoes



                        }
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>);

              })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        <SidebarFooter className="border-t border-sidebar-border mt-auto">
          <div className="flex items-center justify-center py-2 px-3">
            <span className="text-xs text-muted-foreground">
              v{APP_VERSION}
            </span>
          </div>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>);

}