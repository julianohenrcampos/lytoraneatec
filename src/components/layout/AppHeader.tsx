
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Maximize, ChevronDown, User, Settings, LogOut, Menu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import UserProfileModal from "@/components/user/UserProfileModal";
import UserImageUploadModal from "@/components/user/UserImageUploadModal";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppHeaderProps {
  user: any;
  updateUserImage: (file: File) => Promise<string>;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  updateUserImage
}) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isImageUploadModalOpen, setIsImageUploadModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      toast({
        title: "Logout realizado com sucesso",
        description: "Você foi desconectado do sistema"
      });
      navigate("/login");
    } catch (error) {
      console.error("Error during logout:", error);
      toast({
        title: "Erro ao realizar logout",
        description: "Ocorreu um erro ao tentar desconectar",
        variant: "destructive"
      });
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const NotificationDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="absolute -top-1 -right-1 h-3 w-3 sm:h-4 sm:w-4 rounded-full bg-primary text-[8px] sm:text-[10px] font-medium flex items-center justify-center text-primary-foreground">3</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 sm:w-80">
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <span className="font-medium text-sm">Notificações</span>
          <Button variant="ghost" size="sm" className="text-xs">Marcar todas como lidas</Button>
        </div>
        <div className="max-h-60 sm:max-h-80 overflow-auto py-1">
          <DropdownMenuItem className="p-3 cursor-default">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm">Atualização do Sistema</span>
                <span className="text-xs text-muted-foreground">2h atrás</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">Nova versão do sistema disponível com melhorias...</p>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="p-3 cursor-default">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm">Novo funcionário cadastrado</span>
                <span className="text-xs text-muted-foreground">5h atrás</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">João Silva foi adicionado ao sistema...</p>
            </div>
          </DropdownMenuItem>
        </div>
        <div className="p-2 border-t text-center">
          <Button variant="ghost" size="sm" className="w-full text-sm">Ver todas</Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const UserDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2 sm:px-3">
          <Avatar className="h-6 w-6 sm:h-8 sm:w-8">
            {user.imagem_url ? (
              <AvatarImage src={user.imagem_url} />
            ) : (
              <>
                <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome_completo || user.email)}&background=random`} />
                <AvatarFallback>{user.nome_completo?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
              </>
            )}
          </Avatar>
          {!isMobile && (
            <>
              <div className="flex flex-col items-start">
                <span className="text-sm font-medium truncate max-w-24 lg:max-w-32">{user.nome_completo || user.email}</span>
                <span className="text-xs text-muted-foreground">{user.funcoes?.includes('admin') ? 'Administrador' : 'Usuário'}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
          <User className="mr-2 h-4 w-4" />
          <span>Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsImageUploadModalOpen(true)}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Configurações de Conta</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const MobileMenu = () => (
    <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="sm:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-80">
        <div className="flex flex-col gap-4 pt-4">
          {user && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted">
              <Avatar className="h-10 w-10">
                {user.imagem_url ? (
                  <AvatarImage src={user.imagem_url} />
                ) : (
                  <>
                    <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome_completo || user.email)}&background=random`} />
                    <AvatarFallback>{user.nome_completo?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">{user.nome_completo || user.email}</span>
                <span className="text-sm text-muted-foreground">{user.funcoes?.includes('admin') ? 'Administrador' : 'Usuário'}</span>
              </div>
            </div>
          )}
          
          <div className="flex flex-col gap-2">
            <Button variant="ghost" className="justify-start" onClick={() => setIsProfileModalOpen(true)}>
              <User className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Button>
            <Button variant="ghost" className="justify-start" onClick={() => setIsImageUploadModalOpen(true)}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configurações</span>
            </Button>
            <Button variant="ghost" className="justify-start" onClick={toggleFullScreen}>
              <Maximize className="mr-2 h-4 w-4" />
              <span>Tela Cheia</span>
            </Button>
            <Button variant="ghost" className="justify-start text-red-600" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Sair</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );

  return (
    <header className="border-b h-14 sm:h-16 px-3 sm:px-6 sticky top-0 z-10 bg-background flex items-center justify-between rounded-xl sm:rounded-2xl my-1 sm:my-[6px]">
      <div className="flex items-center h-full gap-2">
        <div className="sm:hidden">
          <SidebarTrigger />
        </div>
        <h1 className="text-lg sm:text-xl font-bold hidden sm:block">LYTOTEC ERP</h1>
        <h1 className="text-base font-bold sm:hidden">LYTOTEC</h1>
      </div>
      
      <div className="flex items-center gap-1 sm:gap-3">
        {!isMobile && (
          <Button variant="ghost" size="icon" onClick={toggleFullScreen}>
            <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        )}
        
        <NotificationDropdown />
        
        {isMobile ? <MobileMenu /> : user && <UserDropdown />}
      </div>

      <UserProfileModal 
        isOpen={isProfileModalOpen} 
        onClose={() => setIsProfileModalOpen(false)} 
        user={user} 
      />

      <UserImageUploadModal 
        isOpen={isImageUploadModalOpen} 
        onClose={() => setIsImageUploadModalOpen(false)} 
        currentImage={user?.imagem_url} 
        onImageUpdated={file => updateUserImage(file)} 
      />
    </header>
  );
};

export default AppHeader;
