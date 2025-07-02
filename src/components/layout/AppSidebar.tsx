
import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"
import { useRobustPermissions } from "@/hooks/useRobustPermissions"
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
  const { isSuperAdmin, userRole, permissions, isLoading } = useRobustPermissions()

  console.log('🎯 SIDEBAR DEBUG - Estado atual:', {
    isLoading,
    isSuperAdmin,
    userRole,
    permissions,
    permissionsCount: permissions?.length || 0,
    currentPath: location.pathname
  })

  // Função para verificar se pode acessar um item baseado nas permissões reais
  const canAccessItem = (item: any) => {
    console.log(`🔍 Verificando acesso para: ${item.name}`)
    
    // 🚀 REGRA ABSOLUTA: SuperAdmin pode ver TUDO
    if (isSuperAdmin) {
      console.log(`🔓 SuperAdmin - Acesso TOTAL para: ${item.name}`)
      return true
    }

    // 🔓 Se não há permissão requerida, permitir acesso (itens públicos como Dashboard)
    if (!item.requiredPermission && !item.requiredPermissions?.length) {
      console.log(`🔓 Item público - Acesso para: ${item.name}`)
      return true
    }

    // Verificar permissão específica requerida
    if (item.requiredPermission) {
      const hasPermission = permissions.includes(item.requiredPermission)
      console.log(`${hasPermission ? '✅' : '❌'} Permissão "${item.requiredPermission}" para "${item.name}": ${hasPermission}`)
      return hasPermission
    }

    // Verificar múltiplas permissões (se pelo menos uma for atendida)
    if (item.requiredPermissions?.length) {
      const hasAnyPermission = item.requiredPermissions.some((perm: string) => permissions.includes(perm))
      console.log(`${hasAnyPermission ? '✅' : '❌'} Alguma permissão de ${JSON.stringify(item.requiredPermissions)} para "${item.name}": ${hasAnyPermission}`)
      return hasAnyPermission
    }

    console.log(`❌ Sem critério de acesso definido para: ${item.name}`)
    return false
  }

  const getVisibleItems = (items: any[]) => {
    const visibleItems = items.filter(canAccessItem)
    console.log(`📋 Itens visíveis no grupo:`, visibleItems.map(item => item.name))
    return visibleItems
  }

  const getVisibleGroups = () => {
    const visibleGroups = menuStructure
      .map(group => ({
        ...group,
        items: getVisibleItems(group.items)
      }))
      .filter(group => group.items.length > 0)
    
    console.log(`📋 Grupos visíveis:`, visibleGroups.map(g => `${g.title} (${g.items.length} itens)`))
    return visibleGroups
  }

  // Loading state
  if (isLoading) {
    return (
      <Sidebar {...props}>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Carregando...</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span className="ml-2 text-sm">Carregando menu...</span>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    )
  }

  const visibleGroups = getVisibleGroups()

  console.log('🎯 RESULTADO FINAL - Renderizando sidebar:', {
    isSuperAdmin,
    userRole,
    totalGroups: visibleGroups.length,
    groupDetails: visibleGroups.map(g => `${g.title}: ${g.items.length} itens`)
  })

  // Se não tem grupos visíveis, mostrar apenas Dashboard básico
  if (visibleGroups.length === 0) {
    console.log('⚠️ Nenhum grupo visível - aplicando fallback básico')
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
      </Sidebar>
    )
  }

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
      </SidebarContent>
    </Sidebar>
  )
}
