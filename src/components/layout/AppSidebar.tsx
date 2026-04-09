
import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { usePermission } from "@/hooks/usePermission";
import { menuStructure } from "@/constants/menuStructure";
import { useDiariasPendentes } from "@/hooks/diarias/useDiariasPendentes";
import { ChevronRight } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { APP_VERSION } from "@/lib/version";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const location = useLocation();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { isSuperAdmin, userRole, permissions, isLoading } = usePermission();
  const { count: pendentesCount } = useDiariasPendentes();

  const canAccessItem = (item: any) => {
    if (isSuperAdmin) return true;
    if (!item.requiredPermission && !item.requiredPermissions?.length) return true;
    if (item.requiredPermission) return permissions.includes(item.requiredPermission);
    if (item.requiredPermissions?.length) {
      return item.requiredPermissions.some((perm: string) => permissions.includes(perm));
    }
    return false;
  };

  const getVisibleGroups = () => {
    return menuStructure
      .map((group) => ({
        ...group,
        items: group.items.filter(canAccessItem),
      }))
      .filter((group) => group.items.length > 0);
  };

  const visibleGroups = getVisibleGroups();

  if (isLoading) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarContent>
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sidebar-primary"></div>
          </div>
        </SidebarContent>
      </Sidebar>
    );
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Header */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/colorida.ico"
            alt="Lytorânea"
            className="h-8 w-8 shrink-0 rounded-md block dark:hidden"
          />
          <img
            src="/branca.ico"
            alt="Lytorânea"
            className="h-8 w-8 shrink-0 rounded-md hidden dark:block"
          />
          {!isCollapsed && (
            <span className="text-sm font-semibold text-sidebar-foreground truncate">
              Lytorânea
            </span>
          )}
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent className="px-2 py-2">
        {visibleGroups.map((group, index) => {
          const GroupIcon = group.groupIcon;
          const hasActiveChild = group.items.some(
            (item) => location.pathname === item.href
          );

          // Mini mode: show only group icon with tooltip
          if (isCollapsed) {
            return (
              <SidebarGroup key={index} className="p-0">
                <SidebarMenu>
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <SidebarMenuButton
                          asChild
                          isActive={hasActiveChild}
                          className="h-9 w-9 p-0 flex items-center justify-center mx-auto"
                        >
                          <Link to={group.items[0]?.href || "#"}>
                            {GroupIcon && (
                              <GroupIcon className={cn(
                                "h-4 w-4",
                                hasActiveChild && "text-sidebar-primary"
                              )} />
                            )}
                          </Link>
                        </SidebarMenuButton>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {group.title}
                      </TooltipContent>
                    </Tooltip>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            );
          }

          // Expanded mode: collapsible accordion groups
          return (
            <Collapsible key={index} defaultOpen={hasActiveChild} className="group/collapsible">
              <SidebarGroup className="p-0">
                <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
                  {GroupIcon && <GroupIcon className="h-4 w-4 shrink-0" />}
                  <span className="flex-1 text-left truncate">{group.title}</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu className="mt-1 ml-2 border-l border-sidebar-border/50 pl-2">
                      {group.items.map((item) => {
                        const isActive = location.pathname === item.href;
                        const isPendente =
                          item.href === "/requisicoes/diarias/solicitacoes" &&
                          pendentesCount > 0;

                        return (
                          <SidebarMenuItem key={item.name}>
                            <SidebarMenuButton
                              asChild
                              isActive={isActive}
                              className={cn(
                                "text-sm h-8",
                                isActive && "border-l-2 border-sidebar-primary -ml-[calc(0.5rem+1px)] pl-[calc(0.5rem+1px)] bg-sidebar-accent text-sidebar-foreground font-medium",
                                isPendente && "animate-pulse"
                              )}
                            >
                              <Link to={item.href}>
                                <span className={cn(
                                  "truncate",
                                  isPendente && "text-destructive font-semibold"
                                )}>
                                  {item.name}
                                </span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center justify-center py-2 px-3">
          <span className="text-xs text-sidebar-foreground/40">
            v{APP_VERSION}
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
