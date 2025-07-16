
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const FuncaoPermissaoList: React.FC = () => {
  const { data: funcoes, isLoading, error } = useQuery({
    queryKey: ['funcoes-permissao'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_funcoes_permissao')
        .select(`
          *,
          bd_permissoes!inner(nome_permissao, rota)
        `)
        .order('nome_funcao');
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando funções...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Erro ao carregar funções: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {funcoes?.map((funcao) => (
          <Card key={funcao.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                {funcao.nome_funcao}
              </CardTitle>
              {funcao.descricao && (
                <CardDescription>
                  {funcao.descricao}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  Permissões Associadas:
                </p>
                <div className="flex flex-wrap gap-2">
                  {funcao.permissoes?.length ? (
                    funcao.permissoes.map((permissaoId, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        Permissão ID: {permissaoId}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      Nenhuma permissão associada
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {!funcoes?.length && (
        <div className="text-center py-8 text-muted-foreground">
          <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma função encontrada no sistema</p>
        </div>
      )}
    </div>
  );
};

export default FuncaoPermissaoList;
