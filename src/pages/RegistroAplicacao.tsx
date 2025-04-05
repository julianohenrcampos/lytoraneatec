
import React, { useState, useEffect } from "react";
import MainLayout from "@/components/layout/MainLayout";
import { useToast } from "@/hooks/use-toast";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import RegistroAplicacaoFilters from "@/components/registro-aplicacao/RegistroAplicacaoFilters";
import EntregasTable from "@/components/registro-aplicacao/EntregasTable";
import RegistroAplicacaoForm from "@/components/registro-aplicacao/RegistroAplicacaoForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download } from "lucide-react";
import { fetchEntregasEnviadas, exportRegistrosAplicacaoToExcel } from "@/services/registro-aplicacao";
import { supabase } from "@/integrations/supabase/client";
import { RegistroAplicacaoFilters as RegistroAplicacaoFiltersType } from "@/types/registroAplicacao";

const RegistroAplicacao: React.FC = () => {
  const { toast } = useToast();
  const [entregas, setEntregas] = useState<ListaProgramacaoEntrega[]>([]);
  const [filteredEntregas, setFilteredEntregas] = useState<ListaProgramacaoEntrega[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [caminhoesList, setCaminhoesList] = useState<any[]>([]);
  const [centrosCustoList, setCentrosCustoList] = useState<any[]>([]);
  const [selectedEntrega, setSelectedEntrega] = useState<ListaProgramacaoEntrega | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    fetchData();
    fetchCaminhoes();
    fetchCentrosCusto();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await fetchEntregasEnviadas();
      setEntregas(data);
      setFilteredEntregas(data);
    } catch (error) {
      console.error("Error fetching entregas:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as entregas.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCaminhoes = async () => {
    try {
      const { data, error } = await supabase
        .from('bd_caminhoes_equipamentos')
        .select('id, placa, modelo');

      if (error) {
        throw error;
      }
      
      setCaminhoesList(data || []);
    } catch (error) {
      console.error("Error fetching caminhões:", error);
    }
  };

  const fetchCentrosCusto = async () => {
    try {
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo');

      if (error) {
        throw error;
      }
      
      setCentrosCustoList(data || []);
    } catch (error) {
      console.error("Error fetching centros de custo:", error);
    }
  };

  const handleFilter = (filters: RegistroAplicacaoFiltersType) => {
    let filtered = [...entregas];
    
    if (filters.centro_custo_id && filters.centro_custo_id !== 'all') {
      filtered = filtered.filter(entrega => {
        // Check if centro_custo exists and has an id that matches the filter
        return entrega.centro_custo && entrega.centro_custo.id === filters.centro_custo_id;
      });
    }
    
    if (filters.caminhao_id && filters.caminhao_id !== 'all') {
      filtered = filtered.filter(entrega => 
        entrega.caminhao_id === filters.caminhao_id
      );
    }
    
    if (filters.data_inicio) {
      const filterDate = new Date(filters.data_inicio);
      filtered = filtered.filter(entrega => {
        const entregaDate = new Date(entrega.data_entrega);
        return entregaDate >= filterDate;
      });
    }
    
    setFilteredEntregas(filtered);
  };

  const handleExport = () => {
    try {
      exportRegistrosAplicacaoToExcel(filteredEntregas);
      toast({
        title: "Sucesso",
        description: "Dados exportados com sucesso!",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro",
        description: "Não foi possível exportar os dados.",
        variant: "destructive",
      });
    }
  };

  const handleEntregaClick = (entrega: ListaProgramacaoEntrega) => {
    setSelectedEntrega(entrega);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedEntrega(null);
  };

  const handleFormSuccess = () => {
    fetchData();
    setIsFormOpen(false);
    setSelectedEntrega(null);
    toast({
      title: "Sucesso",
      description: "Registro de aplicação salvo com sucesso!",
    });
  };

  return (
    <MainLayout>
      <div className="container py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Registro de Aplicação</h1>
          <Button 
            onClick={handleExport} 
            variant="outline" 
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>

        <div className="space-y-6">
          <RegistroAplicacaoFilters 
            onFilter={handleFilter} 
            caminhoesList={caminhoesList}
            centrosCustoList={centrosCustoList}
          />

          <Card>
            <CardContent className="p-0">
              <div className="p-4 border-b">
                <h2 className="text-lg font-medium">Entregas Enviadas</h2>
              </div>
              <EntregasTable 
                entregas={filteredEntregas} 
                onEntregaClick={handleEntregaClick} 
              />
            </CardContent>
          </Card>
        </div>

        {isFormOpen && selectedEntrega && (
          <RegistroAplicacaoForm
            isOpen={isFormOpen}
            entrega={selectedEntrega}
            onClose={handleFormClose}
            onSuccess={handleFormSuccess}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default RegistroAplicacao;
