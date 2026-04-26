import React, { useState } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { useListarConfiguracoes, useUpdateConfiguracao } from "@/hooks/useConfiguracaoSistema";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Loader2 } from "lucide-react";
import { usePageTitle } from "@/contexts/PageTitleContext";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

// Chaves que exigem confirmação ao ATIVAR (defesa contra ativação acidental).
const CHAVES_COM_CONFIRMACAO_ATIVACAO: Record<string, { titulo: string; descricao: string }> = {
  ponto_integracao_diaria_ativa: {
    titulo: "Ativar integração automática Ponto → Diária?",
    descricao:
      "A partir desta ativação, cada batida de ponto poderá gerar/atualizar automaticamente o apontamento de diária do funcionário convocado. Antes de prosseguir, confirme: biometria cadastrada, usuários treinados, centros de custo revisados, convocações validadas e apontadores instruídos.",
  },
};

const ConfiguracoesSistema: React.FC = () => {
  usePageTitle("Configurações do Sistema");
  const { canAccess, isLoading: guardLoading } = usePermissionGuard({
    requiredPermission: "admin_permissoes_view",
  });

  const { data: configs, isLoading } = useListarConfiguracoes();
  const updateMutation = useUpdateConfiguracao();

  const [pendingAtivacao, setPendingAtivacao] = useState<{ chave: string } | null>(null);

  if (guardLoading) return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (!canAccess) return null;

  const handleToggle = (chave: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    // Confirmação obrigatória somente ao ATIVAR chaves sensíveis
    if (newValue === 'true' && CHAVES_COM_CONFIRMACAO_ATIVACAO[chave]) {
      setPendingAtivacao({ chave });
      return;
    }
    updateMutation.mutate({ chave, valor: newValue });
  };

  const confirmarAtivacao = () => {
    if (!pendingAtivacao) return;
    updateMutation.mutate(
      { chave: pendingAtivacao.chave, valor: 'true' },
      { onSettled: () => setPendingAtivacao(null) }
    );
  };

  const dialogContent = pendingAtivacao
    ? CHAVES_COM_CONFIRMACAO_ATIVACAO[pendingAtivacao.chave]
    : null;

  return (
    <MainLayout>
      <div className="space-y-6">



        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {configs?.map((config) => (
              <Card key={config.id} className="border border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle className="text-base font-semibold text-foreground">
                        {config.chave}
                      </CardTitle>
                      <Badge variant={config.ativo ? "default" : "secondary"}>
                        {config.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <Switch
                      checked={config.valor === 'true'}
                      onCheckedChange={() => handleToggle(config.chave, config.valor)}
                      disabled={!config.ativo || updateMutation.isPending}
                    />
                  </div>
                  {config.descricao && (
                    <CardDescription className="text-sm text-muted-foreground mt-1">
                      {config.descricao}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Valor atual: <strong className={config.valor === 'true' ? 'text-green-600' : 'text-destructive'}>{config.valor}</strong></span>
                    {config.updated_at && (
                      <span>Última alteração: {new Date(config.updated_at).toLocaleString('pt-BR')}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            {configs?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                Nenhuma configuração encontrada.
              </div>
            )}
          </div>
        )}
      </div>

      {dialogContent && (
        <ConfirmDialog
          isOpen={!!pendingAtivacao}
          onClose={() => setPendingAtivacao(null)}
          onConfirm={confirmarAtivacao}
          title={dialogContent.titulo}
          description={dialogContent.descricao}
          confirmText="Ativar"
          cancelText="Cancelar"
          variant="warning"
          isLoading={updateMutation.isPending}
        />
      )}
    </MainLayout>
  );
};

export default ConfiguracoesSistema;
