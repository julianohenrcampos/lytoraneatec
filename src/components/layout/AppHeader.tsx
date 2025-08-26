import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Bell,
  Maximize,
  ChevronDown,
  User,
  Settings,
  LogOut,
  Menu,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import UserProfileModal from "@/components/user/UserProfileModal";
import UserImageUploadModal from "@/components/user/UserImageUploadModal";
import { PWAInstallButton } from "@/components/pwa/PWAInstallButton";
import { useIsMobile } from "@/hooks/use-mobile";

interface AppHeaderProps {
  user: any;
  updateUserImage: (file: File) => Promise<string>;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  user,
  updateUserImage,
}) => {
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isImageUploadModalOpen, setIsImageUploadModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const displayUser = user || {
    nome_completo: "Usuário",
    email: "usuario@email.com",
    funcoes: [],
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      navigate("/login");
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso.",
      });
    } catch (error) {
      console.error("Erro no logout:", error);
      toast({
        title: "Erro no logout",
        description: "Não foi possível fazer logout. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const UserDropdown = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 px-2">
          <Avatar className="h-8 w-8">
            {displayUser.imagem_url ? (
              <AvatarImage src={displayUser.imagem_url} />
            ) : (
              <>
                <AvatarImage
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(displayUser.nome_completo)}&background=random`}
                />
                <AvatarFallback>
                  {displayUser.nome_completo?.[0] || 'U'}
                </AvatarFallback>
              </>
            )}
          </Avatar>
          <div className="hidden sm:block text-left">
            <div className="text-sm font-medium">{displayUser.nome_completo}</div>
            <div className="text-xs text-muted-foreground">{displayUser.email}</div>
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => setIsProfileModalOpen(true)}>
          <User className="mr-2 h-4 w-4" />
          <span>Perfil</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsImageUploadModal(true)}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Alterar Foto</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={toggleFullScreen}>
          <Maximize className="mr-2 h-4 w-4" />
          <span>Tela Cheia</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-2">
          <SidebarTrigger />
          <span className="font-semibold text-lg hidden sm:block">Sistema</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          
          <Button variant="ghost" size="icon">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
          
          <PWAInstallButton />
          <UserDropdown />
        </div>
      </div>
      
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        user={displayUser}
      />
      <UserImageUploadModal
        isOpen={isImageUploadModalOpen}
        onClose={() => setIsImageUploadModal(false)}
        currentImage={displayUser.imagem_url}
        onImageUpdated={updateUserImage}
      />
    </header>
  );
};

export default AppHeader;