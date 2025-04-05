
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MainLayout from "@/components/layout/MainLayout";
import EntregasTable from "@/components/registro-cargas/EntregasTable";
import RegistroCargaForm from "@/components/registro-cargas/RegistroCargaForm";
import RegistroCargaFiltersComponent from "@/components/registro-cargas/RegistroCargaFilters";
import { fetchListaProgramacaoEntregaByDate, fetchListaProgramacaoEntregaFiltered } from "@/services/registroCargaService";
import { fetchCaminhoes, Caminhao } from "@/services/caminhoesService";
import { useRegistroCargaForm } from "@/hooks/useRegistroCargaForm";
import { useToast } from "@/hooks/use-toast";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga, RegistroCargaFilters } from "@/types/registroCargas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download } from "lucide-react";
import * as XLSX from "xlsx";

const RegistroCargas: React.FC = () => {
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<ListaProgramacaoEntrega | null>(null);
  const [existingRegistro, setExistingRegistro] = useState<RegistroCarga | null>(null);
  const [filters, setFilters] = useState<RegistroCargaFilters>({});
  const [isFiltered, setIsFiltered] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    if (filters.data_inicio) {
      setSelectedDate(filters.data_inicio);
    } else {
      setSelectedDate(new Date());
    }
  }, [filters.data_inicio]);

  const { data: entregas = [], isLoading: isLoadingEntregas } = useQuery({
    queryKey: ['listaProgramacaoEntregas', selectedDate, isFiltered, filters, refreshTrigger],
    queryFn: () => isFiltered 
      ? fetchListaProgramacaoEntregaFiltered(filters)
      : fetchListaProgramacaoEntregaByDate(selectedDate),
  });

  const { data: caminhoes = [] } = useQuery({
    queryKey: ['caminhoes'],
    queryFn: fetchCaminhoes,
  });

  const {
    form,
    isLoading,
    ticketSaidaPreview,
    ticketRetornoPreview,
    handleTicketSaidaChange,
    handleTicketRetornoChange,
    onSubmit,
    initializeFromListaEntrega,
  } = useRegistroCargaForm(
    () => {
      setIsFormOpen(false);
      setRefreshTrigger(prev => prev + 1);
      toast({
        title: "Sucesso",
        description: "Registro salvo com sucesso",
      });
    }
  );

  const handleEntregaClick = async (entrega: ListaProgramacaoEntrega) => {
    if (entrega.status === 'Cancelada') {
      toast({
        title: "Aviso",
        description: "Entregas canceladas não podem ser registradas",
        variant: "destructive",
      });
      return;
    }
    
    try {
      setSelectedEntrega(entrega);
      const registro = await initializeFromListaEntrega(entrega);
      setExistingRegistro(registro);
      setIsFormOpen(true);
    } catch (error) {
      console.error("Error initializing form:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os dados para este registro",
        variant: "destructive",
      });
    }
  };

  const handleFilter = (filterData: RegistroCargaFilters) => {
    const hasFilters = Object.values(filterData).some(value => value !== undefined && value !== '');
    setFilters(filterData);
    setIsFiltered(hasFilters);
  };

  const handleExport = () => {
    try {
      const exportData = entregas.map(entrega => ({
        'Logradouro': entrega.logradouro,
        'Quantidade de Massa (t)': entrega.quantidade_massa,
        'Tipo de Lançamento': entrega.tipo_lancamento === 'Acabadora' ? 'Acabadora' : 'Manual',
        'Caminhão': entrega.caminhao 
          ? `${entrega.caminhao.placa} - ${entrega.caminhao.modelo}` 
          : 'N/A',
        'Equipe': entrega.equipe?.nome_equipe || 'N/A',
        'Usina': entrega.usina?.nome_usina || 'N/A',
        'Status': entrega.status || 'Pendente',
      }));
      
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(exportData);
      
      XLSX.utils.book_append_sheet(wb, ws, 'Entregas');
      
      const fileName = `registro-cargas-${format(new Date(), 'dd-MM-yyyy')}.xlsx`;
      
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Sucesso",
        description: "Arquivo exportado com sucesso",
      });
    } catch (error) {
      console.error("Error exporting data:", error);
      toast({
        title: "Erro",
        description: "Ocorreu um erro ao exportar os dados",
        variant: "destructive",
      });
    }
  };

  const formattedDate = format(selectedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });

  return (
    <MainLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Registro de Cargas</h1>
            <p className="text-muted-foreground">
              Visualize e gerencie as entregas programadas.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        <RegistroCargaFiltersComponent 
          onFilter={handleFilter}
          caminhoesList={caminhoes.map(caminhao => ({
            id: caminhao.id,
            placa: caminhao.placa || "",
            modelo: caminhao.modelo || ""
          }))}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-xl">Entregas Programadas</CardTitle>
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium capitalize">{formattedDate}</span>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingEntregas ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : (
              <EntregasTable 
                entregas={entregas} 
                onEntregaClick={handleEntregaClick} 
              />
            )}
          </CardContent>
        </Card>

        {isFormOpen && (
          <RegistroCargaForm
            isOpen={isFormOpen}
            onClose={() => setIsFormOpen(false)}
            form={form}
            isLoading={isLoading}
            onSubmit={onSubmit}
            ticketSaidaPreview={ticketSaidaPreview}
            ticketRetornoPreview={ticketRetornoPreview}
            handleTicketSaidaChange={handleTicketSaidaChange}
            handleTicketRetornoChange={handleTicketRetornoChange}
            currentEntrega={selectedEntrega}
            existingRegistro={existingRegistro}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default RegistroCargas;
