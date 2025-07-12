
import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const PermissaoList: React.FC = () => {
  const { data: permissoes, isLoading, error } = useQuery({
    queryKey: ['permissoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bd_permissoes')
        .select('*')
        .order('nome_permissao');
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
        <span className="ml-2">Carregando permissões...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Erro ao carregar permissões: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {permissoes?.map((permissao) => (
          <Card key={permissao.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                {permissao.nome_permissao}
              </CardTitle>
              {permissao.rota && (
                <Badge variant="outline" className="text-xs w-fit">
                  {permissao.rota}
                </Badge>
              )}
            </CardHeader>
            {permissao.descricao && (
              <CardContent>
                <CardDescription className="text-xs">
                  {permissao.descricao}
                </CardDescription>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
      
      {!permissoes?.length && (
        <div className="text-center py-8 text-muted-foreground">
          <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhuma permissão encontrada no sistema</p>
        </div>
      )}
    </div>
  );
};

export default PermissaoList;
