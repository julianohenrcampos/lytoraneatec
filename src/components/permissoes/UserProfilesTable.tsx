
import React from "react";
import { Users, Eye, Edit, UserCheck, AlertCircle, RefreshCw, Link2, Unlink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProfileType } from "@/types/permissao";
import { 
  getHybridPermissionStatus, 
  getUserDisplayFunction, 
  userHasAnyPermission,
  isUserSuperAdmin 
} from "@/utils/hybridPermissions";
import { getDepartmentDisplay } from "@/utils/departmentDisplay";

interface UserProfilesTableProps {
  profiles: ProfileType[];
  isLoading: boolean;
  onAssignPermission: (profile: ProfileType) => void;
  onEditPermission: (profile: ProfileType) => void;
  onViewDetails: (profile: ProfileType) => void;
  onLinkFuncionario?: (profileId: string) => void;
  onUnlinkFuncionario?: (profileId: string) => void;
  onRemoveAllPermissions?: (profile: ProfileType) => void;
  filters: {
    nome?: string;
    status?: string;
  };
  onFilterChange: (name: string, value: string) => void;
  onResetFilters: () => void;
  profilesError?: any;
  refetchProfiles?: () => void;
}

const UserProfilesTable: React.FC<UserProfilesTableProps> = ({
  profiles,
  isLoading,
  onAssignPermission,
  onEditPermission,
  onViewDetails,
  onLinkFuncionario,
  onUnlinkFuncionario,
  onRemoveAllPermissions,
  filters,
  onFilterChange,
  onResetFilters,
  profilesError,
  refetchProfiles,
}) => {
  // Função para detectar status de permissão usando sistema híbrido
  const getPermissionStatus = (profile: ProfileType) => {
    const hasPermission = userHasAnyPermission(profile);
    
    return hasPermission 
      ? { label: "Com Permissão", variant: "default" as const }
      : { label: "Sem Permissão", variant: "destructive" as const };
  };

  // Função para exibir as funções do usuário usando sistema híbrido
  const displayUserFunctions = (profile: ProfileType) => {
    const displayName = getUserDisplayFunction(profile);
    return displayName === 'Sem permissão' ? 'Nenhuma' : displayName;
  };

  // Mostrar erro se houver
  if (profilesError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários Cadastrados
            <AlertCircle className="h-5 w-5 text-destructive ml-auto" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">Erro ao carregar usuários</h3>
              <p className="text-muted-foreground mt-2">
                {profilesError?.message || "Erro desconhecido ao buscar dados"}
              </p>
              {refetchProfiles && (
                <Button 
                  onClick={refetchProfiles} 
                  variant="outline" 
                  className="mt-4"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários Cadastrados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando usuários...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Usuários Cadastrados
          <Badge variant="outline" className="ml-auto">
            {profiles.length} usuários
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              placeholder="Buscar por nome ou email..."
              value={filters.nome || ""}
              onChange={(e) => onFilterChange("nome", e.target.value)}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={filters.status || "todos"}
              onValueChange={(value) => {
                const statusValue = value === "todos" ? "" : value;
                onFilterChange("status", statusValue);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Status da permissão" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                <SelectItem value="sem_permissao">Sem Permissão</SelectItem>
                <SelectItem value="com_permissao">Com Permissão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" onClick={onResetFilters}>
            Limpar Filtros
          </Button>
          {refetchProfiles && (
            <Button variant="outline" onClick={refetchProfiles}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
          )}
        </div>

        {/* Informações de filtros ativos */}
        {(filters.nome || filters.status) && (
          <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
            <strong>Filtros ativos:</strong>
            {filters.nome && ` Nome: "${filters.nome}"`}
            {filters.status && ` Status: "${filters.status}"`}
          </div>
        )}

        {/* Tabela */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Funções</TableHead>
                <TableHead>Departamento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {profiles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    {filters.nome || filters.status 
                      ? "Nenhum usuário encontrado com os filtros aplicados" 
                      : "Nenhum usuário encontrado"
                    }
                  </TableCell>
                </TableRow>
              ) : (
                profiles.map((profile, index) => {
                  const status = getPermissionStatus(profile);
                  const userFunctions = displayUserFunctions(profile);
                  const hasPermissions = status.label === "Com Permissão";
                  
                  return (
                    <TableRow key={profile.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {profile.imagem_url ? (
                            <img
                              src={profile.imagem_url}
                              alt={profile.nome_completo || "Usuário"}
                              className="h-8 w-8 rounded-full object-cover"
                            />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-4 w-4 text-primary" />
                            </div>
                          )}
                          {profile.nome_completo || "Nome não informado"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {profile.email}
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${userFunctions === 'Nenhuma' ? 'text-muted-foreground' : 'font-medium'}`}>
                          {userFunctions}
                        </span>
                      </TableCell>
              <TableCell>
                {(() => {
                  const deptDisplay = getDepartmentDisplay(profile);
                  return (
                    <div className="flex flex-col gap-1">
                      {deptDisplay.isGlobalAccess ? (
                        <>
                          <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                            🌐 {deptDisplay.displayText}
                          </Badge>
                          {deptDisplay.secondaryText && (
                            <span className="text-xs text-muted-foreground">
                              {deptDisplay.secondaryText}
                            </span>
                          )}
                        </>
                      ) : deptDisplay.hasDepartment ? (
                        <Badge variant="outline" className="bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
                          🏢 {deptDisplay.displayText}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                          🌐 {deptDisplay.displayText}
                        </Badge>
                      )}
                    </div>
                  );
                })()}
              </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {profile.created_at
                          ? new Date(profile.created_at).toLocaleDateString("pt-BR")
                          : "N/A"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onViewDetails(profile)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Ver detalhes completos</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          {/* Botões de vinculação - apenas para funções administrativas */}
                          {['SuperAdm', 'Administrador', 'AdmRH', 'AdmLogistica', 'AdmEquipamentos'].includes(profile.funcao_sistema || '') && (
                            <>
                              {profile.funcionario_id ? (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onUnlinkFuncionario?.(profile.id)}
                                        className="text-orange-600 hover:text-orange-700 border-orange-300"
                                      >
                                        <Unlink className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Desvincular funcionário (acesso global)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              ) : (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onLinkFuncionario?.(profile.id)}
                                        className="text-blue-600 hover:text-blue-700 border-blue-300"
                                      >
                                        <Link2 className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Vincular funcionário (filtro departamental)</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          )}
                          
                          {!hasPermissions ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => onAssignPermission(profile)}
                                  >
                                    <UserCheck className="h-4 w-4 mr-1" />
                                    Atribuir
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Atribuir permissões administrativas</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => onEditPermission(profile)}
                                    >
                                      <Edit className="h-4 w-4 mr-1" />
                                      Editar
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Editar permissões existentes</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              {onRemoveAllPermissions && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => onRemoveAllPermissions(profile)}
                                      >
                                        <Trash2 className="h-4 w-4 mr-1" />
                                        Remover
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Remover todas as permissões administrativas</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Resumo */}
        {profiles.length > 0 && (
          <div className="text-xs text-muted-foreground text-center space-y-1">
            <div>
              Mostrando {profiles.length} usuários • 
              {profiles.filter(p => getPermissionStatus(p).label === "Com Permissão").length} com permissões • 
              {profiles.filter(p => getPermissionStatus(p).label === "Sem Permissão").length} sem permissões
            </div>
            <div className="text-green-600 font-medium">
              ✅ RLS ativo - Dados carregados com segurança
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UserProfilesTable;
