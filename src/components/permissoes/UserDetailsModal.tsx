
import React from "react";
import { User, Mail, Calendar, Shield, AlertCircle, Trash2, Globe, Building2, Loader2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { ProfileType } from "@/types/permissao";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { validateCanonicalRoleRemoval } from "@/utils/permissionValidation";
import { getDepartmentDisplay } from "@/utils/departmentDisplay";
import {
  fetchUserOverrides,
  setUserOverride,
  removeUserOverride,
  type Acao,
} from "@/services/rbac/actionPermissionsCRUD";
import { removeUserRoleSecure, updateManagedProfileAccessScope } from "@/services/rbac/permissionAdminSecure";
import {
  canManageDepartmentScope,
  getCanonicalPrimaryRole,
  getCanonicalRoleNames,
  hasCanonicalPermissionProfile,
} from "@/utils/adminPermissionProfile";

const ACOES: { key: Acao; label: string }[] = [
  { key: 'visualizar', label: 'Ver' },
  { key: 'criar', label: 'Criar' },
  { key: 'editar', label: 'Editar' },
  { key: 'excluir', label: 'Excluir' },
  { key: 'aprovar', label: 'Aprovar' },
];

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
  const [savingOverride, setSavingOverride] = React.useState<string | null>(null);

  // Fetch user overrides
  const { data: overrides, refetch: refetchOverrides } = useQuery({
    queryKey: ['user-overrides', profile?.id],
    queryFn: () => fetchUserOverrides(profile!.id),
    enabled: isOpen && !!profile?.id,
  });

  // Fetch user's role actions (inherited)
  const { data: roleActions } = useQuery({
    queryKey: ['user-role-actions', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data: userRoles } = await supabase
        .from('bd_user_roles')
        .select('role_id')
        .eq('user_id', profile.id);
      if (!userRoles?.length) return [];
      
      const roleIds = userRoles.map(ur => ur.role_id);
      const { data: actions } = await supabase
        .from('bd_role_permission_actions')
        .select('permission_id, acao, bd_permissions(id, codigo, descricao)')
        .in('role_id', roleIds);
      return actions || [];
    },
    enabled: isOpen && !!profile?.id,
  });

  // Fetch all permissions for display
  const { data: allPermissions } = useQuery({
    queryKey: ['all-permissions-list'],
    queryFn: async () => {
      const { data } = await supabase.from('bd_permissions').select('id, codigo, descricao').order('codigo');
      return data || [];
    },
    enabled: isOpen,
  });

  // Build consolidated view: inherited + overrides
  const consolidatedPermissions = React.useMemo(() => {
    if (!allPermissions || !profile) return [];

    const result: {
      permissionId: string;
      codigo: string;
      descricao: string;
      acao: Acao;
      permitido: boolean;
      origem: 'funcao' | 'override';
    }[] = [];

    const inheritedSet = new Set<string>();
    (roleActions || []).forEach((ra: any) => {
      const key = `${ra.permission_id}:${ra.acao}`;
      if (!inheritedSet.has(key)) {
        inheritedSet.add(key);
        const perm = allPermissions.find(p => p.id === ra.permission_id);
        if (perm) {
          result.push({
            permissionId: ra.permission_id,
            codigo: perm.codigo,
            descricao: perm.descricao || perm.codigo,
            acao: ra.acao,
            permitido: true,
            origem: 'funcao',
          });
        }
      }
    });

    (overrides || []).forEach((ov: any) => {
      const existing = result.find(r => r.permissionId === ov.permission_id && r.acao === ov.acao);
      if (existing) {
        existing.permitido = ov.permitido;
        existing.origem = 'override';
      } else {
        const perm = allPermissions.find(p => p.id === ov.permission_id) || 
                     (ov.bd_permissions ? { id: ov.permission_id, codigo: ov.bd_permissions.codigo, descricao: ov.bd_permissions.descricao } : null);
        if (perm) {
          result.push({
            permissionId: ov.permission_id,
            codigo: perm.codigo,
            descricao: perm.descricao || perm.codigo,
            acao: ov.acao,
            permitido: ov.permitido,
            origem: 'override',
          });
        }
      }
    });

    result.sort((a, b) => a.codigo.localeCompare(b.codigo) || a.acao.localeCompare(b.acao));
    return result;
  }, [allPermissions, roleActions, overrides, profile]);

  if (!profile) return null;

  const currentRoleNames = getCanonicalRoleNames(profile as any);
  const currentPrimaryRole = getCanonicalPrimaryRole(profile as any);
  const hasPermissions = hasCanonicalPermissionProfile(profile as any);
  const deptDisplay = getDepartmentDisplay(profile);
  const isAdmin = canManageDepartmentScope(profile as any);

  const getPermissionStatus = () => {
    if (!hasPermissions) {
      return { label: "Sem Permissão", variant: "destructive" as const, icon: AlertCircle };
    }
    return { label: "Com Permissão", variant: "default" as const, icon: Shield };
  };

  const status = getPermissionStatus();
  const StatusIcon = status.icon;

  const handleToggleOverride = async (permissionId: string, acao: Acao, currentPermitido: boolean, currentOrigem: string) => {
    const key = `${permissionId}:${acao}`;
    setSavingOverride(key);
    try {
      if (currentOrigem === 'override') {
        // Remove override (revert to inherited)
        await removeUserOverride(profile.id, permissionId, acao);
      } else {
        // Create override toggling the current value
        await setUserOverride(profile.id, permissionId, acao, !currentPermitido);
      }
      await refetchOverrides();
      toast({ title: "Override atualizado" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar override", description: err.message, variant: "destructive" });
    } finally {
      setSavingOverride(null);
    }
  };

  const handleToggleAcessoGlobal = async (enabled: boolean) => {
    setIsTogglingAccess(true);
    try {
      await updateManagedProfileAccessScope(profile.id, enabled);
      toast({
        title: enabled ? "Acesso global ativado" : "Acesso departamental ativado",
        description: enabled 
          ? `${profile.nome_completo} agora tem acesso a todos os departamentos.`
          : `${profile.nome_completo} agora tem acesso apenas ao departamento ${deptDisplay.departmentName || 'vinculado'}.`,
      });
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
    } catch (error: any) {
      toast({ title: "Erro ao alterar acesso", description: error.message, variant: "destructive" });
    } finally {
      setIsTogglingAccess(false);
    }
  };

  const handleRemoveFunction = async (funcaoToRemove: string) => {
    setIsRemoving(true);
    try {
      const validation = validateCanonicalRoleRemoval(currentRoleNames, funcaoToRemove);
      if (!validation.isValid) {
        toast({ title: "Erro de validação", description: validation.message, variant: "destructive" });
        return;
      }
      const roleIndex = currentRoleNames.findIndex(role => role === funcaoToRemove);
      const roleId = roleIndex >= 0 ? (roleActions as any[])?.find(action => action?.bd_roles?.nome === funcaoToRemove)?.role_id : undefined;

      if (!roleId) {
        const { data: roleData, error: roleError } = await supabase
          .from('bd_roles')
          .select('id')
          .eq('nome', funcaoToRemove)
          .maybeSingle();
        if (roleError || !roleData?.id) throw roleError || new Error('Função não encontrada');
        await removeUserRoleSecure(profile.id, roleData.id);
      } else {
        await removeUserRoleSecure(profile.id, roleId);
      }
      toast({ title: "Função removida com sucesso", description: `A função "${funcaoToRemove}" foi removida do usuário.` });
      queryClient.invalidateQueries({ queryKey: ['all-profiles-corrected'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['availableFunctions'] });
    } catch (error: any) {
      toast({ title: "Erro ao remover função", description: error.message, variant: "destructive" });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Detalhes do Usuário
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[75vh] pr-4">
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

            {/* Escopo de Acesso */}
            {profile.funcionario_id && isAdmin && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Escopo de Acesso
                  </h4>
                  <div className="p-4 bg-muted/50 rounded-lg border space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">Departamento:</span>
                      </div>
                      <Badge variant="outline" className="bg-background">
                        {deptDisplay.departmentName || 'Não vinculado'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Acesso Global</p>
                          <p className="text-xs text-muted-foreground">
                            {profile.acesso_global ? 'Vê todos os departamentos' : 'Vê apenas seu departamento'}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={profile.acesso_global || false}
                        onCheckedChange={handleToggleAcessoGlobal}
                        disabled={isTogglingAccess}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Funções atribuídas */}
            {hasPermissions && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h4 className="font-medium">Funções Atribuídas</h4>
                  <div className="space-y-2">
                    {currentRoleNames.map((funcao, index) => (
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
                </div>
              </>
            )}

            {/* Permissões por Ação (granular) */}
            <Separator />
            <div className="space-y-3">
              <h4 className="font-medium flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Permissões por Ação
              </h4>
              
              {consolidatedPermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma permissão granular configurada.</p>
              ) : (
                <Card className="p-3">
                  <div className="space-y-0">
                    {/* Header */}
                    <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 text-xs font-medium text-muted-foreground pb-2 border-b">
                      <span>Permissão</span>
                      <span className="text-center">Ação</span>
                      <span className="text-center">Permitido</span>
                      <span className="text-center">Origem</span>
                    </div>
                    
                    {consolidatedPermissions.map((item) => {
                      const key = `${item.permissionId}:${item.acao}`;
                      const isSaving = savingOverride === key;
                      return (
                        <div
                          key={key}
                          className="grid grid-cols-[1fr_80px_80px_80px] gap-2 items-center py-2 border-b border-border/30 last:border-0 text-sm"
                        >
                          <span className="truncate" title={item.descricao}>
                            {item.descricao}
                          </span>
                          <span className="text-center text-xs capitalize">{item.acao}</span>
                          <div className="flex justify-center">
                            {isSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Checkbox
                                checked={item.permitido}
                                onCheckedChange={() => handleToggleOverride(item.permissionId, item.acao, item.permitido, item.origem)}
                              />
                            )}
                          </div>
                          <div className="flex justify-center">
                            <Badge 
                              variant={item.origem === 'override' ? 'default' : 'secondary'} 
                              className={`text-[10px] px-1.5 py-0 ${item.origem === 'override' ? 'bg-orange-500/90 hover:bg-orange-500' : ''}`}
                            >
                              {item.origem === 'override' ? 'Override' : 'Herdado'}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              )}
              
              <p className="text-xs text-muted-foreground">
                💡 Clique no checkbox para criar/remover um override individual. Overrides substituem a permissão herdada da função.
              </p>
            </div>

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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;
