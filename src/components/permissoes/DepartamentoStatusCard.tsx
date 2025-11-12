import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Globe, Users } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { userHasAnyPermission } from "@/utils/hybridPermissions";
const DepartamentoStatusCard: React.FC = () => {
  const {
    data: statusData,
    isLoading
  } = useQuery({
    queryKey: ['departamento-status-summary'],
    queryFn: async () => {
      // Buscar todos os profiles com suas funções e departamentos
      const {
        data: profiles,
        error
      } = await supabase.from('profiles').select(`
          id,
          nome_completo,
          funcao_sistema,
          funcoes,
          funcionario_id,
          acesso_global,
          bd_funcionarios(
            id,
            nome_completo,
            departamento_id,
            bd_departamentos(
              id,
              nome_departamento
            )
          )
        `).order('nome_completo');
      if (error) {
        console.error('❌ Erro ao buscar status departamental:', error);
        throw error;
      }

      // Filtrar apenas usuários que têm permissões administrativas REAIS
      const adminProfiles = (profiles || []).filter(profile => userHasAnyPermission(profile));

      // Processar dados
      const acessoGlobal: Array<{
        nome: string;
        departamento?: string;
      }> = [];
      const porDepartamento: Record<string, string[]> = {};
      adminProfiles.forEach(profile => {
        const departamento = profile.bd_funcionarios?.bd_departamentos?.nome_departamento;
        const nomeUsuario = profile.nome_completo || profile.id;

        // Se tem acesso_global=true, vai para lista de acesso global
        if (profile.acesso_global) {
          acessoGlobal.push({
            nome: nomeUsuario,
            departamento
          });
        }
        // Se não tem departamento E não tem acesso_global, também vai para global
        else if (!departamento) {
          acessoGlobal.push({
            nome: nomeUsuario
          });
        }
        // Senão, agrupa por departamento
        else {
          if (!porDepartamento[departamento]) {
            porDepartamento[departamento] = [];
          }
          porDepartamento[departamento].push(nomeUsuario);
        }
      });
      return {
        acessoGlobal,
        porDepartamento,
        total: adminProfiles.length
      };
    }
  });
  if (isLoading) {
    return <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Resumo de Acessos Departamentais
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </CardContent>
      </Card>;
  }
  if (!statusData) return null;
  return <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Resumo de Acessos Departamentais
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="font-medium">Total de Administradores</span>
          </div>
          <Badge variant="secondary">{statusData.total}</Badge>
        </div>

        <div className="space-y-2">
          {/* Acesso Global */}
          {statusData.acessoGlobal.length > 0 && <div className="p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-green-600 dark:text-green-400" />
                  <span className="text-sm font-medium text-green-900 dark:text-green-100">
                    Acesso Global
                  </span>
                </div>
                <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                  {statusData.acessoGlobal.length}
                </Badge>
              </div>
              
              {/* Lista de usuários com acesso global */}
              <div className="pl-6 space-y-1">
                {statusData.acessoGlobal.map((usuario, idx) => <div key={idx} className="text-xs text-green-800 dark:text-green-200 flex items-center gap-1">
                    <span>• {usuario.nome}</span>
                    {usuario.departamento && <span className="text-green-600 dark:text-green-400 italic">
                        (vinculado: {usuario.departamento})
                      </span>}
                  </div>)}
              </div>
            </div>}

          {/* Por Departamento */}
          {Object.entries(statusData.porDepartamento).map(([departamento, usuarios]) => (
            <div key={departamento} className="p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                    {departamento}
                  </span>
                </div>
                <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700">
                  {usuarios.length}
                </Badge>
              </div>
              
              <div className="pl-6 space-y-1">
                {usuarios.map((usuario, idx) => (
                  <div key={idx} className="text-xs text-blue-800 dark:text-blue-200">
                    • {usuario}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {statusData.acessoGlobal.length === 0 && Object.keys(statusData.porDepartamento).length === 0 && <div className="text-center text-sm text-muted-foreground p-4">
              Nenhum administrador com acesso departamental configurado
            </div>}
        </div>
      </CardContent>
    </Card>;
};
export default DepartamentoStatusCard;