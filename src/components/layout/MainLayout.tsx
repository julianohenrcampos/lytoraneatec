
import React, { useEffect } from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import AppSidebar from "./AppSidebar";
import AppHeader from "./AppHeader";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const { openGroups, setOpenGroups, toggleGroup } = useSidebarState();
  const { user, isLoading, updateUserImage } = useUserProfile();
  const isMobile = useIsMobile();

  // Update document title
  useEffect(() => {
    document.title = "Lytorânea Construtora - Sistema ERP";
  }, []);

  // Meta viewport para garantir escala correta em dispositivos móveis
  useEffect(() => {
    // Buscar ou criar meta viewport
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    
    // Configurar o meta viewport para garantir responsividade adequada
    viewportMeta.setAttribute(
      'content', 
      'width=device-width, initial-scale=1.0, maximum-scale=1.2, user-scalable=yes, viewport-fit=cover'
    );
    
    return () => {
      // Restaurar viewport padrão ao desmontar
      viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0');
    };
  }, []);

  console.log("MainLayout rendering, user:", user ? "loaded" : "not loaded");

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar 
          openGroups={openGroups} 
          setOpenGroups={setOpenGroups} 
          toggleGroup={toggleGroup}
        />
        
        <SidebarInset>
          <div className="flex flex-col h-full">
            <AppHeader 
              user={!isLoading ? user : null}
              updateUserImage={updateUserImage}
            />
            
            <main className="flex-1 overflow-auto p-2 sm:p-4 md:p-6">
              {children}
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
