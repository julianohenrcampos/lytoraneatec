import MainLayout from '@/components/layout/MainLayout';
import { Card } from '@/components/ui/card';

const SSODashboard = () => {
  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard SSO</h1>
          <p className="text-muted-foreground">
            Análise de conformidade e tendências
          </p>
        </div>

        <Card className="p-6">
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-2">Dashboard em construção</p>
            <p className="text-sm">
              KPIs, gráficos e análises serão implementados
            </p>
          </div>
        </Card>
      </div>
    </MainLayout>
  );
};

export default SSODashboard;
