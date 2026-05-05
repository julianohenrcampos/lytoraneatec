
import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MainLayout from "@/components/layout/MainLayout";
import EntregasTable from "@/components/registro-cargas/EntregasTable";
import RegistroCargaForm from "@/components/registro-cargas/RegistroCargaForm";
import RegistroCargaFiltersComponent from "@/components/registro-cargas/RegistroCargaFilters";
import { fetchListaProgramacaoEntregaByDate, fetchListaProgramacaoEntregaFiltered, fetchRegistroCargaByListaEntregaId } from "@/services/registroCargaService";
import { fetchCaminhoes } from "@/services/caminhoesService";
import { useRegistroCargaForm } from "@/hooks/useRegistroCargaForm";
import { useToast } from "@/hooks/use-toast";
import { ListaProgramacaoEntrega } from "@/types/programacaoEntrega";
import { RegistroCarga, RegistroCargaFilters } from "@/types/registroCargas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { usePermission } from "@/hooks/usePermission";

const RegistroCargas: React.FC = () => {
  usePageTitle("Registro de Cargas");
  const { toast } = useToast();
  const { isSuperAdmin, hasActionPermission } = usePermission();
  const canExportRegistroCargas =
    isSuperAdmin || hasActionPermission("requisicoes_registro_cargas_view", "visualizar");
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedEntrega, setSelectedEntrega] = useState<ListaProgramacaoEntrega | null>(null);
  const [existingRegistro, setExistingRegistro] = useState<RegistroCarga | null>(null);
  const [filters, setFilters] = useState<RegistroCargaFilters>({});
  const [isFiltered, setIsFiltered] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [modoRetorno, setModoRetorno] = useState<{
    ativo: boolean;
    entregaId: string;
    massaEsperada: number;
  } | null>(null);

  // Verificar parâmetros de URL para modo retorno
  useEffect(() => {
    const retornoParam = searchParams.get('retorno');
    const massaParam = searchParams.get('massa');
    
    if (retornoParam && massaParam) {
      console.log('🔄 Modo Retorno de Massa ativado:', { entregaId: retornoParam, massa: massaParam });
      
      setModoRetorno({
        ativo: true,
        entregaId: retornoParam,
        massaEsperada: parseFloat(massaParam)
      });

      toast({
        title: "Modo Retorno de Massa",
        description: `${massaParam}t aguardando pesagem de retorno`,
        variant: "default",
      });

      // Limpar parâmetros da URL após processar
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, toast]);

  useEffect(() => {
    const hasFilters = Object.values(filters).some(value => value !== undefined && value !== '' && value !== 'all');
    setIsFiltered(hasFilters);

    if (filters.data_inicio) {
      const novaData = new Date(filters.data_inicio);
      setSelectedDate((prev) =>
        prev.getTime() === novaData.getTime() ? prev : novaData
      );
    }
    // Importante: NÃO resetar a data para `new Date()` quando filters muda de referência,
    // pois isso instabiliza o queryKey e causa loops de re-render/refetch.
  }, [filters]);

  // Chave estável para o React Query (string em vez de instância de Date)
  const selectedDateKey = format(selectedDate, "yyyy-MM-dd");

  const { data: entregas = [], isLoading: isLoadingEntregas } = useQuery({
    queryKey: ['listaProgramacaoEntregas', selectedDateKey, isFiltered, filters, refreshTrigger],
    queryFn: () => {
      return isFiltered 
        ? fetchListaProgramacaoEntregaFiltered(filters)
        : fetchListaProgramacaoEntregaByDate(selectedDate);
    },
    refetchOnWindowFocus: false,
    staleTime: 30_000,
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
    try {
      setSelectedEntrega(entrega);
      
      // For both "Pendente" and "Enviada" status, try to get existing registro
      const registro = await fetchRegistroCargaByListaEntregaId(entrega.id);
      setExistingRegistro(registro);
      
      await initializeFromListaEntrega(entrega);
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

  // Auto-abrir formulário se estiver em modo retorno
  useEffect(() => {
    if (!modoRetorno?.ativo) return;
    const entregaRetorno = entregas.find(e => e.id === modoRetorno.entregaId);
    if (entregaRetorno) {
      console.log('🎯 Auto-abrindo formulário para retorno de massa');
      setModoRetorno(null); // Limpar antes de abrir para evitar re-disparo
      handleEntregaClick(entregaRetorno);
    }
    // Dependência intencional apenas em modoRetorno: ao mudar entregas (refetch),
    // não reabrir o formulário automaticamente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoRetorno]);

  const handleFilter = (filterData: RegistroCargaFilters) => {
    console.log("[RegistroCargas] Applying filters:", filterData);
    setFilters(filterData);
  };

  const handleExport = () => {
    if (!canExportRegistroCargas) {
      toast({
        title: "Sem permissão",
        description: "Você não tem permissão para esta ação.",
        variant: "destructive",
      });
      return;
    }
    try {
      const exportData = entregas.map(entrega => ({
        'Centro de Custo': entrega.centro_custo_nome || entrega.logradouro,
        'Quantidade de Caminhão (t)': entrega.quantidade_massa,
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
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <p className="text-muted-foreground">
            Visualize e gerencie as entregas programadas.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport} disabled={!canExportRegistroCargas}>
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
            modelo: caminhao.nome_subcategoria || ""
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
            onClose={() => {
              setIsFormOpen(false);
              setModoRetorno(null); // Limpar modo retorno ao fechar
            }}
            form={form}
            isLoading={isLoading}
            onSubmit={onSubmit}
            ticketSaidaPreview={ticketSaidaPreview}
            ticketRetornoPreview={ticketRetornoPreview}
            handleTicketSaidaChange={handleTicketSaidaChange}
            handleTicketRetornoChange={handleTicketRetornoChange}
            currentEntrega={selectedEntrega}
            existingRegistro={existingRegistro}
            modoRetorno={modoRetorno}
          />
        )}
      </div>
    </MainLayout>
  );
};

export default RegistroCargas;
