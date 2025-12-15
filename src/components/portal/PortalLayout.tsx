import { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { NotificationBell } from "@/components/notifications/NotificationBell";

interface PortalLayoutProps {
  children: ReactNode;
  userName?: string;
}

export function PortalLayout({ children, userName }: PortalLayoutProps) {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Logout realizado com sucesso");
      navigate("/login");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4 md:px-8">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src="/icons/maskable-icon1.png"
              alt="Logo"
              className="h-10 w-10 rounded-lg"
            />
            <span className="text-xl font-bold text-foreground hidden sm:inline">
              Lytorânea Construtora
            </span>
          </div>

          {/* User info and actions */}
          <div className="flex items-center gap-4">
            {userName && (
              <span className="text-sm text-muted-foreground hidden md:inline">
                Olá, <span className="font-medium text-foreground">{userName}</span>
              </span>
            )}
            
            {/* Notifications */}
            <NotificationBell />

            {/* Logout button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sair</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container px-4 md:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
