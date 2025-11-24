import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const SSODashboardEmptyState = () => {
  const navigate = useNavigate();

  return (
    <Card className="p-12 text-center">
      <AlertCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
      <h3 className="text-xl font-semibold mb-2">
        Nenhum checklist realizado ainda
      </h3>
      <p className="text-muted-foreground mb-6 max-w-md mx-auto">
        Comece criando o primeiro checklist de segurança NR-18 para visualizar 
        análises, KPIs e relatórios de conformidade.
      </p>
      <Button onClick={() => navigate('/sso/checklists')}>
        Ir para Checklists
      </Button>
    </Card>
  );
};
