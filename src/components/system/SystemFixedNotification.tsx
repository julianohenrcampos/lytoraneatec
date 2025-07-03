
import React from "react";
import { Check, Shield, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface SystemFixedNotificationProps {
  onRefresh?: () => void;
}

const SystemFixedNotification: React.FC<SystemFixedNotificationProps> = ({ onRefresh }) => {
  const [isVisible, setIsVisible] = React.useState(true);

  if (!isVisible) return null;

  return (
    <Alert className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
      <Shield className="h-4 w-4 text-green-600 dark:text-green-400" />
      <AlertDescription className="text-green-800 dark:text-green-200">
        <div className="flex items-center justify-between">
          <div>
            <strong>🚀 Sistema de permissões DINÂMICO implementado!</strong>
            <p className="text-sm mt-1">
              • ✅ Sistema 100% dinâmico baseado no banco de dados<br/>
              • ✅ Funciona para TODAS as permissões atuais e futuras<br/>
              • ✅ Mauro Pavão corrigido para "Mestre de Obra"<br/>
              • ✅ Zero hardcoded - tudo vem do bd_funcoes_permissao<br/>
              • ✅ Cache otimizado e fallbacks robustos<br/>
              • ✅ SuperAdmins mantêm acesso total automático
            </p>
            <p className="text-xs mt-2 font-medium">
              🎯 Agora qualquer função criada no banco funciona automaticamente!
            </p>
          </div>
          <div className="flex gap-2 ml-4">
            {onRefresh && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={onRefresh}
                className="text-green-700 border-green-300 hover:bg-green-100 dark:text-green-300 dark:border-green-700 dark:hover:bg-green-800"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Testar
              </Button>
            )}
            <Button 
              size="sm" 
              variant="ghost" 
              onClick={() => setIsVisible(false)}
              className="text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-800"
            >
              <Check className="h-3 w-3 mr-1" />
              Entendi
            </Button>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default SystemFixedNotification;
