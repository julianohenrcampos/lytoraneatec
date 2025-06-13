
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useAuthPermissions } from "@/hooks/useAuthPermissions"
import { menuStructure } from "@/constants/menuStructure"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation()
  const { isSuperAdmin, permissions, isLoading } = useAuthPermissions()

  const canAccessItem = (item: any) => {
    if (isLoading) return false
    if (isSuperAdmin) return true
    
    // Se não há permissão requerida, permitir acesso
    if (!item.requiredPermission && !item.requiredPermissions?.length) {
      return true
    }

    // Verificar permissão única
    if (item.requiredPermission) {
      return permissions.includes(item.requiredPermission)
    }

    // Verificar múltiplas permissões
    if (item.requiredPermissions?.length) {
      if (item.requireAny) {
        return item.requiredPermissions.some((perm: string) => permissions.includes(perm))
      } else {
        return item.requiredPermissions.every((perm: string) => permissions.includes(perm))
      }
    }

    return false
  }

  const getVisibleItems = (items: any[]) => {
    return items.filter(canAccessItem)
  }

  const getVisibleGroups = () => {
    return menuStructure
      .map(group => ({
        ...group,
        items: getVisibleItems(group.items)
      }))
      .filter(group => group.items.length > 0)
  }

  if (isLoading) {
    return (
      <Sidebar {...props}>
        <SidebarContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm">Carregando...</span>
          </div>
        </SidebarContent>
      </Sidebar>
    )
  }

  const visibleGroups = getVisibleGroups()

  return (
    <Sidebar {...props}>
      <SidebarContent>
        {visibleGroups.map((group, index) => (
          <SidebarGroup key={index}>
            <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.name}>
                    <SidebarMenuButton asChild isActive={location.pathname === item.href}>
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        
        {visibleGroups.length === 0 && (
          <SidebarGroup>
            <SidebarGroupContent>
              <div className="p-4 text-sm text-muted-foreground text-center">
                Nenhum menu disponível para seu perfil.
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  )
}
