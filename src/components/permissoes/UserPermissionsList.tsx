
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, AlertCircle, Crown } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface FuncaoPermissaoData {
  nome_funcao: string;
  descricao?: string;
}

interface UsuarioPermissao {
  id: string;
  nome_completo?: string;
  email?: string;
  imagem_url?: string;
  funcoes?: string[];
  funcao_permissao?: string;
  bd_funcoes_permissao?: FuncaoPermissaoData | FuncaoPermissaoData[] | null;
}

const UserPermissionsList: React.FC = () => {
  const { data: usuarios, isLoading, error } = useQuery({
    queryKey: ['usuarios-permissoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          nome_completo,
          email,
          imagem_url,
          funcoes,
          funcao_permissao,
          bd_funcoes_permissao!left(nome_funcao, descricao)
        `)
        .order('nome_completo');
      
      if (error) throw error;
      return data as UsuarioPermissao[];
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando usuários...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Erro ao carregar usuários: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const getFuncaoPermissaoData = (bd_funcoes_permissao: UsuarioPermissao['bd_funcoes_permissao']) => {
    if (!bd_funcoes_permissao) return null;
    if (Array.isArray(bd_funcoes_permissao)) {
      return bd_funcoes_permissao[0] || null;
    }
    return bd_funcoes_permissao;
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {usuarios?.map((usuario) => {
          const funcaoData = getFuncaoPermissaoData(usuario.bd_funcoes_permissao);
          
          return (
            <Card key={usuario.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={usuario.imagem_url || undefined} />
                    <AvatarFallback>
                      {usuario.nome_completo?.split(' ').map(n => n[0]).join('').toUpperCase() || '??'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {usuario.nome_completo || 'Nome não definido'}
                      {usuario.funcoes?.includes('SuperAdm') && (
                        <Crown className="h-4 w-4 text-yellow-500" />
                      )}
                    </div>
                    <CardDescription className="text-sm">
                      {usuario.email || 'Email não definido'}
                    </CardDescription>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Funções do Sistema:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {usuario.funcoes?.length ? (
                        usuario.funcoes.map((funcao, index) => (
                          <Badge 
                            key={index} 
                            variant={funcao === 'SuperAdm' ? 'default' : 'secondary'}
                            className="text-xs"
                          >
                            {funcao}
                          </Badge>
                        ))
                      ) : (
                        <Badge variant="outline" className="text-xs">
                          Nenhuma função atribuída
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {funcaoData && (
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        Função de Permissão:
                      </p>
                      <Badge variant="secondary" className="text-xs">
                        {funcaoData.nome_funcao || 'N/A'}
                      </Badge>
                      {funcaoData.descricao && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {funcaoData.descricao}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {!usuarios?.length && (
        <div className="text-center py-8 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum usuário encontrado no sistema</p>
        </div>
      )}
    </div>
  );
};

export default UserPermissionsList;
