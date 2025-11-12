
import React from "react";
import { User, Mail, Calendar, Shield, AlertCircle, Trash2, Globe, Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ProfileType } from "@/types/permissao";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { validateFunctionRemoval, cleanFunctionArray } from "@/utils/permissionValidation";
import { getDepartmentDisplay } from "@/utils/departmentDisplay";

interface UserDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: ProfileType | null;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({
  isOpen,
  onClose,
  profile,
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isRemoving, setIsRemoving] = React.useState(false);
  const [isTogglingAccess, setIsTogglingAccess] = React.useState(false);

  if (!profile) return null;

  const currentFunctions = profile.funcoes || [];
  const hasPermissions = currentFunctions.length > 0 && 
    (currentFunctions.length > 1 || (currentFunctions.length === 1 && currentFunctions[0] !== 'user'));
  const deptDisplay = getDepartmentDisplay(profile);
  const isAdmin = currentFunctions.some(f => 
    ['SuperAdm', 'Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'].includes(f)
  );

  const getPermissionStatus = () => {
    if (!hasPermissions) {
      return { label: "Sem Permissão", variant: "destructive" as const, icon: AlertCircle };
    }
    return { label: "Com Permissão", variant: "default" as const, icon: Shield };
  };

  const status = getPermissionStatus();
  const StatusIcon = status.icon;

  const handleToggleAcessoGlobal = async (enabled: boolean) => {
    setIsTogglingAccess(true);
    try {
      console.log('🌐 Alternando acesso global:', enabled, 'para usuário:', profile.id);
      
      const { error } = await supabase
        .from('profiles')
        .update({ acesso_global: enabled })
        .eq('id', profile.id);

      if (error) throw error;

      toast({
        title: enabled ? "Acesso global ativado" : "Acesso departamental ativado",
        description: enabled 
          ? `${profile.nome_completo} agora tem acesso a todos os departamentos.`
          : `${profile.nome_completo} agora tem acesso apenas ao departamento ${deptDisplay.departmentName || 'vinculado'}.`,
      });

      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      
    } catch (error: any) {
      console.error('❌ Erro ao alternar acesso:', error);
      toast({
        title: "Erro ao alterar acesso",
        description: error.message || "Não foi possível alterar o tipo de acesso.",
        variant: "destructive",
      });
    } finally {
      setIsTogglingAccess(false);
    }
  };

  const handleRemoveFunction = async (funcaoToRemove: string) => {
    setIsRemoving(true);
    try {
      console.log('🗑️ Removendo função:', funcaoToRemove, 'do usuário:', profile.id);
      console.log('📋 Funções atuais:', currentFunctions);
      
      // Validar remoção
      const validation = validateFunctionRemoval(currentFunctions, funcaoToRemove);
      if (!validation.isValid) {
        toast({
          title: "Erro de validação",
          description: validation.message,
          variant: "destructive",
        });
        return;
      }
      
      const newFuncoes = currentFunctions.filter(f => f !== funcaoToRemove);
      const finalFuncoes = cleanFunctionArray(newFuncoes);
      
      console.log('✅ Funções finais para salvar:', finalFuncoes);

      const { error } = await supabase
        .from('profiles')
        .update({ funcoes: finalFuncoes })
        .eq('id', profile.id);

      if (error) {
        console.error('❌ Erro ao remover função:', error);
        throw error;
      }

      console.log('✅ Função removida com sucesso');
      
      toast({
        title: "Função removida com sucesso",
        description: `A função "${funcaoToRemove}" foi removida do usuário.`,
        variant: "default",
      });

      // Atualizar múltiplos caches para garantir sincronização
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['availableFunctions'] });
      
    } catch (error: any) {
      console.error('❌ Erro ao remover função:', error);
      toast({
        title: "Erro ao remover função",
        description: error.message || "Não foi possível remover a função.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Usuário
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Avatar e informações básicas */}
          <div className="flex items-center gap-4">
            {profile.imagem_url ? (
              <img
                src={profile.imagem_url}
                alt={profile.nome_completo || "Usuário"}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-8 w-8 text-primary" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold">
                {profile.nome_completo || "Nome não informado"}
              </h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {profile.email}
              </div>
            </div>
          </div>

          <Separator />

          {/* Status de permissão */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Status de Permissão
            </h4>
            <div className="flex items-center gap-3">
              <Badge variant={status.variant} className="flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Escopo de Acesso Departamental */}
          {profile.funcionario_id && isAdmin && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Escopo de Acesso
                </h4>
                
                <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                  {/* Departamento vinculado */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Departamento:</span>
                    </div>
                    <Badge variant="outline" className="bg-background">
                      {deptDisplay.departmentName || 'Não vinculado'}
                    </Badge>
                  </div>

                  {/* Toggle de Acesso Global */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Acesso Global</p>
                        <p className="text-xs text-muted-foreground">
                          {profile.acesso_global 
                            ? 'Vê todos os departamentos' 
                            : 'Vê apenas seu departamento'}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={profile.acesso_global || false}
                      onCheckedChange={handleToggleAcessoGlobal}
                      disabled={isTogglingAccess}
                    />
                  </div>

                  {/* Explicação */}
                  <div className="pt-2 border-t">
                    <p className="text-xs text-muted-foreground">
                      💡 Com acesso global, o usuário continua vinculado ao departamento <strong>{deptDisplay.departmentName}</strong> para fins de folha de pagamento, mas pode visualizar e gerenciar dados de todos os departamentos.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Funções do usuário */}
          {hasPermissions && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="font-medium">Funções Atribuídas</h4>
                <div className="space-y-2">
                  {currentFunctions
                    .filter(funcao => funcao !== 'user')
                    .map((funcao, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <Badge variant="outline" className="font-medium">
                          {funcao}
                        </Badge>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveFunction(funcao)}
                                disabled={isRemoving}
                                className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remover esta função</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    ))}
                </div>
                
                {/* Dica sobre remoção total */}
                <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs text-muted-foreground">
                    💡 <strong>Dica:</strong> Você também pode remover todas as permissões de uma vez pela tabela principal usando o botão <span className="text-destructive font-medium">"Remover"</span>.
                  </p>
                </div>
              </div>
            </>
          )}

          <Separator />

          {/* Informações de cadastro */}
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Informações de Cadastro
            </h4>
            <div className="grid grid-cols-1 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Data de cadastro:</span>
                <span>
                  {profile.created_at
                    ? new Date(profile.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "N/A"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ID do usuário:</span>
                <span className="font-mono text-xs">{profile.id}</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;
