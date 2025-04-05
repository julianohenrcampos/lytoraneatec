import React, { useState, useEffect } from "react";
import { addDays, format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, FileText, BarChart3, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDateRangePicker } from "@/components/ui/calendar-date-range-picker";
import { DateRange } from "react-day-picker";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import MainLayout from "@/components/layout/MainLayout";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { supabase } from "@/integrations/supabase/client";
import { downloadExcel } from "@/lib/excel";
import { CentroCusto } from "@/types/centroCusto";
import { debugLog } from "@/lib/debug";

interface ReportData {
  id: string;
  data: string;
  centro_custo: string;
  codigo_centro_custo?: string;
  descricao: string;
  situacao: string;
  horimetro_inicial?: number;
  horimetro_final?: number;
  abastecimento?: number;
}

interface VehicleInfo {
  id: string;
  label: string;
  tipo_veiculo: string;
  imagem_url?: string | null;
}

interface ReportStats {
  quilometragem: number;
  abastecimento: number;
  produtividade: number;
}

interface SituacaoData {
  name: string;
  value: number;
  color: string;
}

interface CentroCustoResponse {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo?: string;
}

// Define a type for the centro_custo_id field which can be an array or an object
interface CentroCustoItem {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo?: string;
}

interface ApontamentoItem {
  id: string;
  data: string;
  horimetro_inicial?: number;
  horimetro_final?: number;
  abastecimento?: number;
  situacao: string;
  centro_custo_id: CentroCustoItem | CentroCustoItem[] | null;
}

const RelatorioMedicao: React.FC = () => {
  const [vehicleType, setVehicleType] = useState<string>("");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2025, 1, 21), // 21/02/2025
    to: new Date(2025, 2, 20)   // 20/03/2025
  });
  
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleInfo[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<VehicleInfo | null>(null);
  const [situacaoData, setSituacaoData] = useState<SituacaoData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const { toast } = useToast();
  const { userRoles, isSuperAdmin } = useUserPermissions();
  
  const canAccessPage = isSuperAdmin || 
    userRoles.includes('AdmLogistica') || 
    userRoles.includes('Encarregado') || 
    userRoles.includes('SuperAdm');

  useEffect(() => {
    fetchVehicleTypes().then(types => {
      console.log("Vehicle types:", types);
    });
  }, []);

  useEffect(() => {
    if (vehicleType) {
      fetchVehicleOptions();
    }
  }, [vehicleType]);

  const fetchVehicleOptions = async () => {
    if (!vehicleType) {
      setVehicleOptions([]);
      setSelectedVehicle("");
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, placa, modelo, frota, numero_frota, tipo_veiculo, imagem_url")
        .eq("tipo_veiculo", vehicleType);
      
      if (error) {
        console.error("Error fetching vehicles:", error);
        toast({
          title: "Erro ao carregar veículos",
          description: "Não foi possível carregar a lista de veículos.",
          variant: "destructive",
        });
        return;
      }
      
      const options = data.map(vehicle => ({
        id: vehicle.id,
        tipo_veiculo: vehicle.tipo_veiculo,
        imagem_url: vehicle.imagem_url,
        label: `${vehicle.frota || ""}${vehicle.numero_frota || ""} - ${vehicle.placa || ""} ${vehicle.modelo ? `(${vehicle.modelo})` : ""}`
      }));
      
      setVehicleOptions(options);
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro ao carregar veículos",
        description: "Ocorreu um erro ao buscar os veículos. Tente novamente.",
        variant: "destructive",
      });
    }
  };
  
  const fetchVehicleTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("tipo_veiculo")
        .not("tipo_veiculo", "is", null);
        
      if (error) throw error;
      
      const uniqueTypes = [...new Set(data.map(item => item.tipo_veiculo))];
      return uniqueTypes.filter(Boolean);
    } catch (error) {
      console.error("Error fetching vehicle types:", error);
      return ["Caminhão", "Equipamento"];
    }
  };
  
  const fetchReportData = async () => {
    if (!selectedVehicle || !dateRange?.from || !dateRange?.to) return [];
    
    try {
      const fromDate = format(dateRange.from, 'yyyy-MM-dd');
      const toDate = format(dateRange.to, 'yyyy-MM-dd');
      
      const { data, error } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          id,
          data,
          horimetro_inicial,
          horimetro_final,
          abastecimento,
          situacao,
          centro_custo_id(id, nome_centro_custo, codigo_centro_custo)
        `)
        .eq("caminhao_equipamento_id", selectedVehicle)
        .gte("data", fromDate)
        .lte("data", toDate)
        .order("data", { ascending: true });
      
      if (error) {
        console.error("Error fetching report data:", error);
        throw error;
      }
      
      return data.map((item: ApontamentoItem) => {
        debugLog("Centro custo item", item.centro_custo_id);
        
        let centroCusto: CentroCustoResponse | null = null;
        
        if (item.centro_custo_id) {
          if (Array.isArray(item.centro_custo_id)) {
            if (item.centro_custo_id.length > 0) {
              const firstItem = item.centro_custo_id[0];
              centroCusto = {
                id: firstItem?.id || '',
                nome_centro_custo: firstItem?.nome_centro_custo || '',
                codigo_centro_custo: firstItem?.codigo_centro_custo
              };
            }
          } else if (typeof item.centro_custo_id === 'object') {
            centroCusto = {
              id: item.centro_custo_id.id,
              nome_centro_custo: item.centro_custo_id.nome_centro_custo,
              codigo_centro_custo: item.centro_custo_id.codigo_centro_custo
            };
          }
        }
        
        return {
          id: item.id,
          data: format(new Date(item.data), 'dd/MM/yyyy'),
          centro_custo: centroCusto?.nome_centro_custo || "Não informado",
          codigo_centro_custo: centroCusto?.codigo_centro_custo || "",
          descricao: getSituationDescription(item.situacao),
          situacao: item.situacao || "Não informado",
          horimetro_inicial: item.horimetro_inicial,
          horimetro_final: item.horimetro_final,
          abastecimento: item.abastecimento
        };
      });
    } catch (error) {
      console.error("Error in fetchReportData:", error);
      toast({
        title: "Erro ao buscar dados",
        description: "Não foi possível carregar os dados do relatório.",
        variant: "destructive",
      });
      return [];
    }
  };
  
  const getSituationDescription = (situation: string | null): string => {
    if (!situation) return "Não informado";
    
    const descriptions: Record<string, string> = {
      "Trabalhado": "Veículo em operação",
      "Manutenção": "Veículo em manutenção",
      "À Disposição": "Veículo à disposição",
      "Falta": "Operador ausente",
      "Feriado": "Feriado",
      "Chuva": "Serviço cancelado devido à chuva",
      "Intempérie": "Serviço cancelado devido à intempérie"
    };
    
    return descriptions[situation] || situation;
  };
  
  const calculateStats = (data: ReportData[]): ReportStats => {
    let totalQuilometragem = 0;
    let totalAbastecimento = 0;
    
    data.forEach(item => {
      if (item.horimetro_inicial !== undefined && item.horimetro_final !== undefined) {
        const diff = item.horimetro_final - item.horimetro_inicial;
        if (diff > 0) totalQuilometragem += diff;
      }
      
      if (item.abastecimento !== undefined && item.abastecimento > 0) {
        totalAbastecimento += item.abastecimento;
      }
    });
    
    const produtividade = totalAbastecimento > 0 
      ? totalQuilometragem / totalAbastecimento
      : 0;
    
    return {
      quilometragem: totalQuilometragem,
      abastecimento: totalAbastecimento,
      produtividade: produtividade
    };
  };
  
  const generateSituacaoData = (data: ReportData[]): SituacaoData[] => {
    const situacoes = data.reduce<Record<string, number>>((acc, item) => {
      const situacao = item.situacao || "Desconhecido";
      acc[situacao] = (acc[situacao] || 0) + 1;
      return acc;
    }, {});
    
    const colorMap: Record<string, string> = {
      "Trabalhado": "#22c55e",
      "Manutenção": "#eab308",
      "À Disposição": "#3b82f6",
      "Falta": "#ef4444",
      "Feriado": "#f97316",
      "Chuva": "#0ea5e9",
      "Intempérie": "#a855f7"
    };
    
    return Object.entries(situacoes).map(([name, value]) => ({
      name,
      value,
      color: colorMap[name] || "#6b7280"
    }));
  };

  const resetFilters = () => {
    setVehicleType("");
    setSelectedVehicle("");
    setDateRange({
      from: new Date(2025, 1, 21),
      to: new Date(2025, 2, 20)
    });
    setShowReport(false);
  };

  const generateReport = async () => {
    if (!vehicleType || !selectedVehicle || !dateRange?.from || !dateRange?.to) {
      toast({
        title: "Campos incompletos",
        description: "Por favor, preencha todos os campos para gerar o relatório.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const vehicleDetail = vehicleOptions.find(v => v.id === selectedVehicle);
      if (!vehicleDetail) {
        toast({
          title: "Veículo não encontrado",
          description: "O veículo selecionado não foi encontrado.",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedVehicleDetails(vehicleDetail);
      
      const reportData = await fetchReportData();
      
      if (reportData.length === 0) {
        toast({
          title: "Sem dados",
          description: "Não foram encontrados registros para o período selecionado.",
          variant: "destructive",
        });
        return;
      }
      
      const calculatedStats = calculateStats(reportData);
      setStats(calculatedStats);
      
      const chartData = generateSituacaoData(reportData);
      setSituacaoData(chartData);
      
      setReportData(reportData);
      setShowReport(true);
      
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Erro ao gerar relatório",
        description: "Ocorreu um erro ao gerar o relatório. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportToExcel = () => {
    if (!reportData.length || !stats || !selectedVehicleDetails) {
      toast({
        title: "Sem dados para exportar",
        description: "Gere um relatório primeiro.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const diarioSheet = reportData.map(item => ({
        'Data': item.data,
        'Centro de Custo': item.centro_custo,
        'Código CC': item.codigo_centro_custo || 'N/A',
        'Diário de Serviços': item.descricao,
        'Situação': item.situacao,
        'Horímetro Inicial': item.horimetro_inicial || 'N/A',
        'Horímetro Final': item.horimetro_final || 'N/A',
        'Abastecimento (L)': item.abastecimento || 'N/A',
      }));
      
      const resumoSheet = [{
        'Veículo/Equipamento': selectedVehicleDetails.label,
        'Período': `${dateRange?.from ? format(dateRange.from, 'dd/MM/yyyy') : ''} à ${dateRange?.to ? format(dateRange.to, 'dd/MM/yyyy') : ''}`,
        'Quilometragem Total': stats.quilometragem.toFixed(2),
        'Abastecimento Total (L)': stats.abastecimento.toFixed(2),
        'Produtividade (km/L)': stats.produtividade.toFixed(4),
        'Tipo de Veículo': selectedVehicleDetails.tipo_veiculo
      }];
      
      const situacaoSheet = situacaoData.map(item => ({
        'Situação': item.name,
        'Quantidade de Dias': item.value,
        'Percentual': `${((item.value / reportData.length) * 100).toFixed(2)}%`
      }));
      
      const workbookData = {
        'Resumo': resumoSheet,
        'Diário de Serviços': diarioSheet,
        'Situação': situacaoSheet
      } as any;
      
      downloadExcel(
        workbookData,
        `Relatório_${selectedVehicleDetails.label}_${format(new Date(), 'dd-MM-yyyy')}`
      );
      
      toast({
        title: "Exportação concluída",
        description: "Os dados foram exportados com sucesso.",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Erro na exportação",
        description: "Ocorreu um erro ao exportar para Excel.",
        variant: "destructive",
      });
    }
  };

  const CustomSituacaoTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0];
      return (
        <div className="bg-white p-2 border rounded shadow">
          <p className="font-semibold">{item.name}</p>
          <p>{item.value} dia(s)</p>
          <p>{((item.value / reportData.length) * 100).toFixed(2)}%</p>
        </div>
      );
    }
    return null;
  };

  if (!canAccessPage) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Acesso Negado</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Você não tem permissão para acessar esta página.</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Relatório de Medição</h2>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="tipo" className="font-medium">Tipo de Veículo</label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Caminhão">Caminhão</SelectItem>
                    <SelectItem value="Equipamento">Equipamento</SelectItem>
                    <SelectItem value="Prancha">Prancha</SelectItem>
                    <SelectItem value="Van">Van</SelectItem>
                    <SelectItem value="Ônibus">Ônibus</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="identificacao" className="font-medium">Identificação</label>
                <Select value={selectedVehicle} onValueChange={setSelectedVehicle} disabled={!vehicleType || vehicleOptions.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={vehicleOptions.length === 0 ? "Sem veículos disponíveis" : "Selecione o veículo"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleOptions.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-2">
                <label htmlFor="periodo" className="font-medium">Período</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, 'dd/MM/yyyy')} -{' '}
                            {format(dateRange.to, 'dd/MM/yyyy')}
                          </>
                        ) : (
                          format(dateRange.from, 'dd/MM/yyyy')
                        )
                      ) : (
                        <span>Selecione um período</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarDateRangePicker
                      date={dateRange}
                      onDateChange={setDateRange}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              <div className="flex items-end gap-2">
                <Button
                  onClick={generateReport}
                  className="flex-1"
                  disabled={isLoading || !vehicleType || !selectedVehicle || !dateRange?.from || !dateRange?.to}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Carregando...
                    </span>
                  ) : (
                    <>
                      <FileText className="mr-2 h-4 w-4" />
                      Gerar Relatório
                    </>
                  )}
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={resetFilters}
                  disabled={isLoading}
                >
                  <X className="mr-2 h-4 w-4" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {showReport && selectedVehicleDetails && (
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Relatório de Medição</CardTitle>
                <Button variant="outline" onClick={handleExportToExcel}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Exportar para Excel
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Veículo/Equipamento</h4>
                  <p className="text-lg font-semibold">{selectedVehicleDetails.label}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Período</h4>
                  <p className="text-lg font-semibold">
                    {dateRange?.from && dateRange?.to && (
                      `${format(dateRange.from, 'dd/MM/yyyy')} à ${format(dateRange.to, 'dd/MM/yyyy')}`
                    )}
                  </p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Objeto</h4>
                  <p className="text-lg font-semibold">
                    {selectedVehicleDetails.tipo_veiculo === "Caminhão" 
                      ? "Transporte de Funcionários/Materiais" 
                      : "Operações em Obra"}
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <h3 className="font-bold mb-4 text-lg">Diário de Serviços</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Centro de Custo</TableHead>
                          <TableHead>Diário de Serviços</TableHead>
                          <TableHead>Situação</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{row.data}</TableCell>
                            <TableCell>{row.centro_custo}</TableCell>
                            <TableCell>{row.descricao}</TableCell>
                            <TableCell>{row.situacao}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                
                <div className="flex flex-col gap-6 md:col-span-1">
                  {stats && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Informações Mensais</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Quilometragem Mensal</p>
                          <p className="text-lg font-semibold">{stats.quilometragem.toFixed(2)} km</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Abastecimento Mensal</p>
                          <p className="text-lg font-semibold">{stats.abastecimento.toFixed(2)} litros</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Produtividade</p>
                          <p className="text-lg font-semibold">{stats.produtividade.toFixed(4)} km/l</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {situacaoData.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Resumo de Situação</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div style={{ width: '100%', height: 240 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={situacaoData}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}
                                outerRadius={80}
                                paddingAngle={1}
                                dataKey="value"
                              >
                                {situacaoData.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip content={<CustomSituacaoTooltip />} />
                              <Legend layout="vertical" align="right" verticalAlign="middle" />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  
                  {selectedVehicleDetails.imagem_url && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Imagem do Veículo</CardTitle>
                      </CardHeader>
                      <CardContent className="flex justify-center">
                        <img 
                          src={selectedVehicleDetails.imagem_url} 
                          alt={selectedVehicleDetails.label}
                          className="max-w-full h-auto rounded-md max-h-48 object-contain" 
                        />
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
};

export default RelatorioMedicao;
