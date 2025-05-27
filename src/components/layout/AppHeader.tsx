import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Maximize, ChevronDown, User, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import UserProfileModal from "@/components/user/UserProfileModal";
import UserImageUploadModal from "@/components/user/UserImageUploadModal";
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
  const navigate = useNavigate();
  const {
    toast
  } = useToast();
  const handleLogout = async () => {
    try {
      const {
        error
      } = await supabase.auth.signOut();
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
  return <header className="border-b h-16 px-6 sticky top-0 z-10 bg-background flex items-center justify-between rounded-2xl my-[6px]">
      <div className="flex items-center h-full">
        <Button variant="ghost" size="icon" className="md:hidden mr-2">
          <SidebarTrigger />
        </Button>
        <h1 className="text-xl hidden md:block font-bold">LYTOTEC ERP</h1>
      </div>
      
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" onClick={toggleFullScreen} className="hidden sm:flex">
          <Maximize className="h-5 w-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-[10px] font-medium flex items-center justify-center text-primary-foreground">3</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <span className="font-medium">Notificações</span>
              <Button variant="ghost" size="sm" className="text-xs">Marcar todas como lidas</Button>
            </div>
            <div className="max-h-80 overflow-auto py-1">
              <DropdownMenuItem className="p-3 cursor-default">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">Atualização do Sistema</span>
                    <span className="text-xs text-muted-foreground">2h atrás</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Nova versão do sistema disponível com melhorias...</p>
                </div>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="p-3 cursor-default">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">Novo funcionário cadastrado</span>
                    <span className="text-xs text-muted-foreground">5h atrás</span>
                  </div>
                  <p className="text-sm text-muted-foreground">João Silva foi adicionado ao sistema...</p>
                </div>
              </DropdownMenuItem>
            </div>
            <div className="p-2 border-t text-center">
              <Button variant="ghost" size="sm" className="w-full text-sm">Ver todas</Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {user && <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2 hidden md:flex">
                <Avatar className="h-8 w-8">
                  {user.imagem_url ? <AvatarImage src={user.imagem_url} /> : <>
                      <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(user.nome_completo || user.email)}&background=random`} />
                      <AvatarFallback>{user.nome_completo?.[0] || user.email?.[0] || 'U'}</AvatarFallback>
                    </>}
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="text-sm font-medium">{user.nome_completo || user.email}</span>
                  <span className="text-xs text-muted-foreground">{user.funcoes?.includes('admin') ? 'Administrador' : 'Usuário'}</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
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
          </DropdownMenu>}
      </div>

      <UserProfileModal isOpen={isProfileModalOpen} onClose={() => setIsProfileModalOpen(false)} user={user} />

      <UserImageUploadModal isOpen={isImageUploadModalOpen} onClose={() => setIsImageUploadModalOpen(false)} currentImage={user?.imagem_url} onImageUpdated={file => updateUserImage(file)} />
    </header>;
};
export default AppHeader;