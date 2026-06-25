import React from 'react';
import { usePageTitle } from '@/contexts/PageTitleContext';
import MainLayout from '@/components/layout/MainLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeftRight, ListChecks, Users } from 'lucide-react';
import DesligamentosSection from '@/components/desligamento/sections/DesligamentosSection';
import SolicitacoesDesligamentoSection from '@/components/desligamento/sections/SolicitacoesDesligamentoSection';
import SolicitacoesTransferenciaSection from '@/components/desligamento/sections/SolicitacoesTransferenciaSection';

const GestaoDesligamentos = () => {
  usePageTitle('Gestão de Desligamentos');
  return (
    <MainLayout>
      <div className="space-y-6">
        <Tabs defaultValue="desligamentos">
          <TabsList>
            <TabsTrigger value="desligamentos" className="gap-2">
              <ListChecks className="h-4 w-4" /> Desligamentos
            </TabsTrigger>
            <TabsTrigger value="solicitacoes" className="gap-2">
              <Users className="h-4 w-4" /> Solicitações de Desligamento
            </TabsTrigger>
            <TabsTrigger value="transferencia" className="gap-2">
              <ArrowLeftRight className="h-4 w-4" /> Solicitações de Transferência
            </TabsTrigger>
          </TabsList>
          <TabsContent value="desligamentos" className="mt-4">
            <DesligamentosSection />
          </TabsContent>
          <TabsContent value="solicitacoes" className="mt-4">
            <SolicitacoesDesligamentoSection />
          </TabsContent>
          <TabsContent value="transferencia" className="mt-4">
            <SolicitacoesTransferenciaSection />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default GestaoDesligamentos;
