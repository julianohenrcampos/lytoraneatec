import React, { useState, useEffect } from "react";
import { addDays, format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileDown, FileText, BarChart3, X, Download } from "lucide-react";
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
import RelatorioMedicaoDetalhado from "@/components/relatorio-medicao/RelatorioMedicaoDetalhado";
import RelatorioMedicaoPlaceholder from "@/components/relatorio-medicao/RelatorioMedicaoPlaceholder";
import RelatorioMedicaoLoadingState from "@/components/relatorio-medicao/RelatorioMedicaoLoadingState";
import RelatorioMedicaoEmptyState from "@/components/relatorio-medicao/RelatorioMedicaoEmptyState";
import { formatBrazilianDateToString } from "@/utils/timezoneUtils";
import { EquipmentReportData, TruckReportData, ManutencaoEquipmentData, ManutencaoTruckData } from "@/types/relatorioMedicao";
import { downloadRelatorioMedicaoExcel } from "@/lib/excel";
import { generateReportPDF } from "@/services/pdfService";

interface VehicleInfo {
  id: string;
  label: string;
  tipo_veiculo: string;
  aluguel: number;
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

// Type for grouped data structure
interface GroupedDataItem {
  veiculo: any;
  centroCusto: any;
  registros: any[];
  diasTrabalhados: number;
  quilometragemTotal: number;
  abastecimentoTotal: number;
}

const RelatorioMedicao: React.FC = () => {
  const [vehicleType, setVehicleType] = useState<string>("");
  const [selectedVehicle, setSelectedVehicle] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(2025, 1, 21), // 21/02/2025
    to: new Date(2025, 2, 20)   // 20/03/2025
  });
  
  const [reportData, setReportData] = useState<(EquipmentReportData | TruckReportData)[]>([]);
  const [manutencaoData, setManutencaoData] = useState<ManutencaoEquipmentData | ManutencaoTruckData | null>(null);
  const [vehicleOptions, setVehicleOptions] = useState<VehicleInfo[]>([]);
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [selectedVehicleDetails, setSelectedVehicleDetails] = useState<VehicleInfo | null>(null);
  const [situacaoData, setSituacaoData] = useState<SituacaoData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);
  
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
    
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("bd_caminhoes_equipamentos")
        .select("id, placa, modelo, frota, numero_frota, tipo_veiculo, aluguel, imagem_url")
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
        aluguel: parseFloat(vehicle.aluguel || '0'),
        imagem_url: vehicle.imagem_url,
        label: `${vehicle.frota || ""}${vehicle.numero_frota || ""} - ${vehicle.placa || ""} ${vehicle.modelo ? `(${vehicle.modelo})` : ""}`
      }));
      
      setVehicleOptions(options);
      
      if (options.length === 0) {
        toast({
          title: "Nenhum veículo encontrado",
          description: `Não há veículos do tipo "${vehicleType}" cadastrados.`,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error:", error);
      toast({
        title: "Erro ao carregar veículos",
        description: "Ocorreu um erro ao buscar os veículos. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
  
  const fetchReportData = async (): Promise<(EquipmentReportData | TruckReportData)[]> => {
    if (!selectedVehicle || !dateRange?.from || !dateRange?.to) return [];
    
    try {
      const fromDate = formatBrazilianDateToString(dateRange.from);
      const toDate = formatBrazilianDateToString(dateRange.to);
      
      console.log("=== DEBUG RELATÓRIO MEDIÇÃO ===");
      console.log("Período:", fromDate, "à", toDate);
      console.log("Veículo ID:", selectedVehicle);
      console.log("Tipo de Veículo:", vehicleType);
      
      // Buscar dados de "Operando" e "Disponível" para a tabela principal
      const { data: operandoData, error: operandoError } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          caminhao_equipamento_id,
          centro_custo_id(id, nome_centro_custo, codigo_centro_custo),
          data,
          horimetro_inicial,
          horimetro_final,
          abastecimento,
          situacao,
          bd_caminhoes_equipamentos!inner(
            id,
            frota,
            numero_frota,
            placa,
            modelo,
            tipo_veiculo,
            aluguel
          )
        `)
        .eq("caminhao_equipamento_id", selectedVehicle)
        .gte("data", fromDate)
        .lte("data", toDate)
        .in("situacao", ["Operando", "Disponível"])
        .not("centro_custo_id", "is", null)
        .order("data", { ascending: true });
      
      if (operandoError) {
        console.error("Error fetching operando data:", operandoError);
        throw operandoError;
      }

      // Buscar dados de "Em Manutenção" para os descontos
      console.log("Buscando dados de manutenção...");
      const { data: manutencaoDataResult, error: manutencaoError } = await supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(`
          caminhao_equipamento_id,
          data,
          situacao,
          bd_caminhoes_equipamentos!inner(
            id,
            aluguel
          )
        `)
        .eq("caminhao_equipamento_id", selectedVehicle)
        .gte("data", fromDate)
        .lte("data", toDate)
        .eq("situacao", "Em Manutenção")
        .order("data", { ascending: true });
      
      if (manutencaoError) {
        console.error("Error fetching manutenção data:", manutencaoError);
      }

      console.log("Dados Operando/Disponível:", operandoData?.length || 0, "registros");
      console.log("Dados Manutenção:", manutencaoDataResult?.length || 0, "registros");

      if (!operandoData || operandoData.length === 0) {
        console.log("Nenhum dado 'Operando/Disponível' encontrado para os filtros aplicados");
        return [];
      }

      // Obter aluguel mensal do veículo
      const veiculo = Array.isArray(operandoData[0].bd_caminhoes_equipamentos) 
        ? operandoData[0].bd_caminhoes_equipamentos[0] 
        : operandoData[0].bd_caminhoes_equipamentos;
      
      const aluguelMensal = parseFloat(veiculo?.aluguel || '0');

      // IMPLEMENTAÇÃO DAS 4 PARTES CONFORME ESPECIFICADO
      const totalDiasOperandoDisponiveis = operandoData.length;
      const diasManutencao = manutencaoDataResult?.length || 0;
      
      console.log("=== FÓRMULA CAMINHÃO (4 PARTES) ===");
      console.log("1º parte - Aluguel mensal:", aluguelMensal);
      console.log("1º parte - Dias em manutenção:", diasManutencao);
      
      // 2º parte: Calcular valor da manutenção = (VALOR MENSAL / 30) * dias Em Manutenção
      const valorDiarioAluguel = aluguelMensal / 30;
      const valorManutencao = valorDiarioAluguel * diasManutencao;
      
      console.log("2º parte - Valor diário aluguel (VALOR MENSAL / 30):", valorDiarioAluguel);
      console.log("2º parte - Valor manutenção:", valorManutencao);
      
      // 3º parte: Valor restante = aluguel - valor manutenção
      const valorRestante = aluguelMensal - valorManutencao;
      
      console.log("3º parte - Valor restante (aluguel - manutenção):", valorRestante);
      
      // 4º parte: Valor diário para divisão = valor restante / total dias Operando+Disponível
      const valorDiarioParaDivisao = totalDiasOperandoDisponiveis > 0 ? valorRestante / totalDiasOperandoDisponiveis : 0;
      
      console.log("4º parte - Total dias Operando+Disponível:", totalDiasOperandoDisponiveis);
      console.log("4º parte - Valor diário para divisão:", valorDiarioParaDivisao);

      // CALCULAR TOTAIS DO PERÍODO PARA CAMINHÕES (NOVAS FÓRMULAS)
      let totalKmPeriodo = 0;
      let totalLitrosPeriodo = 0;
      let totalDiasPeriodo = 0;

      if (vehicleType === "Caminhão") {
        // Calcular totais de quilometragem e abastecimento de TODOS os registros
        operandoData.forEach(item => {
          totalDiasPeriodo += 1;
          
          // Calcular quilometragem apenas se ambos os valores existirem
          if (item.horimetro_inicial !== null && item.horimetro_inicial !== undefined && 
              item.horimetro_final !== null && item.horimetro_final !== undefined) {
            const quilometragem = item.horimetro_final - item.horimetro_inicial;
            if (quilometragem > 0) {
              totalKmPeriodo += quilometragem;
            }
          }
          
          // Somar abastecimento real
          if (item.abastecimento && item.abastecimento > 0) {
            totalLitrosPeriodo += item.abastecimento;
          }
        });

        console.log("=== TOTAIS DO PERÍODO (CAMINHÃO) ===");
        console.log("Total KM período:", totalKmPeriodo);
        console.log("Total Litros período:", totalLitrosPeriodo);
        console.log("Total dias período:", totalDiasPeriodo);
      }

      // Processar dados de manutenção para exibição
      let calculatedManutencaoData: any = null;
      if (vehicleType === "Caminhão") {
        calculatedManutencaoData = {
          valorMensal: aluguelMensal,
          qtdDia: diasManutencao,
          valor: valorManutencao
        };
      } else if (vehicleType === "Equipamento") {
        // Manter lógica original para equipamentos
        if (manutencaoDataResult && manutencaoDataResult.length > 0) {
          const horasManutencao = diasManutencao * 8; // Assumindo 8h por dia
          const valorUnitarioHora = aluguelMensal / 200; // 200h mensais
          const valorDescontoEquipamento = valorUnitarioHora * horasManutencao;
          
          calculatedManutencaoData = {
            valorUnitario: valorUnitarioHora,
            qtdHoras: horasManutencao,
            valor: valorDescontoEquipamento
          };
        } else {
          calculatedManutencaoData = {
            valorUnitario: aluguelMensal / 200,
            qtdHoras: 0,
            valor: 0
          };
        }
      }
      
      setManutencaoData(calculatedManutencaoData);

      // Agrupar dados por centro de custo
      const groupedData: Record<string, any> = operandoData.reduce((acc, item) => {
        const veiculo = Array.isArray(item.bd_caminhoes_equipamentos) 
          ? item.bd_caminhoes_equipamentos[0] 
          : item.bd_caminhoes_equipamentos;
        
        const centroCusto = Array.isArray(item.centro_custo_id) 
          ? item.centro_custo_id[0] 
          : item.centro_custo_id;
        
        if (!veiculo || !centroCusto) {
          console.log("Registro ignorado - dados incompletos:", { veiculo: !!veiculo, centroCusto: !!centroCusto });
          return acc;
        }
        
        const key = `${veiculo.id}_${centroCusto.id}`;
        
        if (!acc[key]) {
          acc[key] = {
            veiculo,
            centroCusto,
            registros: [],
            diasTrabalhados: 0,
            quilometragemTotal: 0,
            abastecimentoTotal: 0
          };
        }
        
        acc[key].registros.push(item);
        acc[key].diasTrabalhados += 1;
        
        // Calcular quilometragem apenas se ambos os valores existirem
        if (item.horimetro_inicial !== null && item.horimetro_inicial !== undefined && 
            item.horimetro_final !== null && item.horimetro_final !== undefined) {
          const quilometragem = item.horimetro_final - item.horimetro_inicial;
          if (quilometragem > 0) {
            acc[key].quilometragemTotal += quilometragem;
          }
        }
        
        // Somar abastecimento real
        if (item.abastecimento && item.abastecimento > 0) {
          acc[key].abastecimentoTotal += item.abastecimento;
        }
        
        return acc;
      }, {} as Record<string, any>);

      console.log("Dados agrupados por centro de custo:", Object.keys(groupedData).length, "grupos");

      // Gerar dados específicos baseado no tipo de veículo
      const reportData: (EquipmentReportData | TruckReportData)[] = Object.values(groupedData).map((group: any) => {
        const veiculo = group.veiculo;
        const centroCusto = group.centroCusto;
        
        const descricaoServico = `${veiculo.tipo_veiculo?.toUpperCase() || 'VEÍCULO'} - ${veiculo.frota || ''}${veiculo.numero_frota || ''} - ${centroCusto.codigo_centro_custo || centroCusto.nome_centro_custo}`;
        
        if (vehicleType === "Equipamento") {
          // Manter lógica original para equipamentos
          const totalDiasTrabalhados = Object.values(groupedData).reduce((total: number, g: any) => {
            return total + g.diasTrabalhados;
          }, 0);

          const totalAbastecimentoPeriodo = Object.values(groupedData).reduce((total: number, g: any) => {
            return total + g.abastecimentoTotal;
          }, 0);

          const horasManutencaoTotal = calculatedManutencaoData ? calculatedManutencaoData.qtdHoras : 0;
          const horasRestantes = 200 - horasManutencaoTotal;

          const quantidadeHoras = 200;
          const valorUnitarioHora = aluguelMensal / 200;
          
          const horasDisponiveis = totalDiasTrabalhados > 0 
            ? (horasRestantes / totalDiasTrabalhados) * group.diasTrabalhados 
            : 0;
          
          const valorPeriodo = valorUnitarioHora * horasDisponiveis;
          const produtividade = horasDisponiveis;
          
          const abastecimentoProporcional = totalDiasTrabalhados > 0
            ? (totalAbastecimentoPeriodo / totalDiasTrabalhados) * group.diasTrabalhados
            : 0;
          
          const mediaAbastecimento = horasDisponiveis > 0 ? abastecimentoProporcional / horasDisponiveis : 0;
          
          return {
            id: `${veiculo.id}_${centroCusto.id}`,
            label: descricaoServico,
            tipo_veiculo: veiculo.tipo_veiculo,
            centro_custo: centroCusto.codigo_centro_custo || centroCusto.nome_centro_custo,
            diasTrabalhados: group.diasTrabalhados,
            totalMensal: aluguelMensal,
            quantidadeHoras,
            valorUnitarioHora,
            horasDisponiveis,
            valorPeriodo,
            produtividade,
            abastecimento: abastecimentoProporcional,
            mediaAbastecimento,
            rastreador: produtividade
          } as EquipmentReportData;
        } else {
          // NOVAS FÓRMULAS PARA CAMINHÃO CONFORME ESPECIFICADO
          console.log(`=== CÁLCULOS CAMINHÃO (NOVAS FÓRMULAS) - ${centroCusto.codigo_centro_custo} ===`);
          console.log("Dias trabalhados neste centro:", group.diasTrabalhados);
          console.log("Valor diário para divisão:", valorDiarioParaDivisao);
          
          // QTD/DIA: Dias trabalhados específicos deste centro de custo
          const qtdDia = group.diasTrabalhados;
          
          // VALOR (R$): Valor diário para divisão × Dias trabalhados no centro de custo
          const valor = valorDiarioParaDivisao * qtdDia;
          
          // PRODUTIVIDADE: (Total KM do período ÷ Total dias) × QTD/DIA
          const produtividadeKmDia = totalDiasPeriodo > 0 ? totalKmPeriodo / totalDiasPeriodo : 0;
          const produtividade = produtividadeKmDia * qtdDia;
          
          // ABASTECIMENTO: (Total L do período ÷ Total dias) × QTD/DIA
          const abastecimentoLDia = totalDiasPeriodo > 0 ? totalLitrosPeriodo / totalDiasPeriodo : 0;
          const abastecimento = abastecimentoLDia * qtdDia;
          
          // MÉDIA ABAST.: PRODUTIVIDADE ÷ ABASTECIMENTO (KM/L) - CORRIGIDO
          const mediaAbastecimento = abastecimento > 0 ? produtividade / abastecimento : 0;
          
          console.log("Produtividade Km/dia total:", produtividadeKmDia);
          console.log("Produtividade calculada (item):", produtividade);
          console.log("Abastecimento L/dia total:", abastecimentoLDia);
          console.log("Abastecimento calculado (item):", abastecimento);
          console.log("Valor calculado (4 partes):", valor);
          console.log("Média abastecimento (KM/L):", mediaAbastecimento);
          
          return {
            id: `${veiculo.id}_${centroCusto.id}`,
            label: descricaoServico,
            tipo_veiculo: veiculo.tipo_veiculo,
            centro_custo: centroCusto.codigo_centro_custo || centroCusto.nome_centro_custo,
            diasTrabalhados: group.diasTrabalhados,
            totalMensal: aluguelMensal,
            qtdDia: qtdDia,
            valor: valor,
            quilometragem: produtividade, // PRODUTIVIDADE conforme nova fórmula
            abastecimento: abastecimento, // ABASTECIMENTO conforme nova fórmula
            mediaAbastecimento: mediaAbastecimento, // MÉDIA ABAST. conforme nova fórmula CORRIGIDA
            rastreador: produtividade // Usar a produtividade calculada
          } as TruckReportData;
        }
      });

      console.log("Dados finais do relatório:", reportData.length, "itens");
      return reportData;
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
  
  const resetFilters = () => {
    setVehicleType("");
    setSelectedVehicle("");
    setDateRange({
      from: new Date(2025, 1, 21),
      to: new Date(2025, 2, 20)
    });
    setShowReport(false);
    setShowEmptyState(false);
  };

  const handleTryDifferentPeriod = () => {
    setShowEmptyState(false);
    setShowReport(false);
    setDateRange({
      from: new Date(2025, 1, 21),
      to: new Date(2025, 2, 20)
    });
  };

  const generateReport = async () => {
    if (!vehicleType || !selectedVehicle || !dateRange?.from || !dateRange?.to) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios para gerar o relatório.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setShowEmptyState(false);
    
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
        setShowEmptyState(true);
        setShowReport(false);
        return;
      }
      
      setReportData(reportData);
      setShowReport(true);
      setShowEmptyState(false);
      
      toast({
        title: "Relatório gerado",
        description: `Relatório gerado com ${reportData.length} registros encontrados.`,
      });
      
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
    if (!reportData.length || !selectedVehicleDetails || !dateRange?.from || !dateRange?.to) {
      toast({
        title: "Sem dados para exportar",
        description: "Gere um relatório primeiro.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      console.log("=== INICIANDO EXPORTAÇÃO EXCEL ===");
      console.log("Report data:", reportData.length, "registros");
      console.log("Vehicle details:", selectedVehicleDetails);
      console.log("Date range:", dateRange);
      console.log("Vehicle type:", vehicleType);
      console.log("Manutenção data:", manutencaoData);
      
      downloadRelatorioMedicaoExcel(
        reportData,
        manutencaoData,
        selectedVehicleDetails,
        { from: dateRange.from, to: dateRange.to },
        vehicleType
      );
      
      toast({
        title: "Exportação concluída",
        description: "Os dados foram exportados para Excel com múltiplas abas.",
      });
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      toast({
        title: "Erro na exportação",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao exportar para Excel.",
        variant: "destructive",
      });
    }
  };

  const handleExportToPDF = async () => {
    if (!reportData.length || !selectedVehicleDetails || !dateRange?.from || !dateRange?.to) {
      toast({
        title: "Sem dados para exportar",
        description: "Gere um relatório primeiro.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const periodo = `${format(dateRange.from, 'dd-MM-yyyy')}_${format(dateRange.to, 'dd-MM-yyyy')}`;
      
      await generateReportPDF(
        selectedVehicleDetails.label,
        periodo
      );
      
      toast({
        title: "PDF gerado com sucesso",
        description: "O relatório foi exportado em PDF.",
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Erro ao gerar PDF",
        description: "Ocorreu um erro ao gerar o PDF. Tente novamente.",
        variant: "destructive",
      });
    }
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
                <label htmlFor="tipo" className="font-medium flex items-center gap-1">
                  Tipo de Veículo
                  <span className="text-red-500">*</span>
                </label>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className={!vehicleType ? "border-red-200" : ""}>
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
                <label htmlFor="identificacao" className="font-medium flex items-center gap-1">
                  Identificação
                  <span className="text-red-500">*</span>
                </label>
                <Select 
                  value={selectedVehicle} 
                  onValueChange={setSelectedVehicle} 
                  disabled={!vehicleType || isLoading}
                >
                  <SelectTrigger className={!selectedVehicle ? "border-red-200" : ""}>
                    <SelectValue 
                      placeholder={
                        !vehicleType 
                          ? "Selecione o tipo primeiro" 
                          : isLoading 
                            ? "Carregando veículos..." 
                            : vehicleOptions.length === 0 
                              ? "Nenhum veículo disponível" 
                              : "Selecione o veículo"
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleOptions.map((vehicle) => (
                      <SelectItem key={vehicle.id} value={vehicle.id}>
                        {vehicle.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {vehicleType && vehicleOptions.length === 0 && !isLoading && (
                  <p className="text-sm text-orange-600">
                    Nenhum veículo do tipo "{vehicleType}" encontrado
                  </p>
                )}
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
                      Gerando...
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
        
        {isLoading && <RelatorioMedicaoLoadingState />}
        
        {showEmptyState && (
          <RelatorioMedicaoEmptyState
            vehicleName={selectedVehicleDetails?.label}
            periodo={dateRange?.from && dateRange?.to ? 
              `${format(dateRange.from, 'dd/MM/yyyy')} à ${format(dateRange.to, 'dd/MM/yyyy')}` : 
              undefined
            }
            onTryDifferentPeriod={handleTryDifferentPeriod}
          />
        )}
        
        {!showReport && !showEmptyState && !isLoading && <RelatorioMedicaoPlaceholder />}
        
        {showReport && reportData.length > 0 && dateRange?.from && dateRange?.to && !isLoading && (
          <div>
            <div className="flex justify-end gap-2 mb-4">
              <Button variant="outline" onClick={handleExportToExcel}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
              <Button variant="outline" onClick={handleExportToPDF}>
                <Download className="mr-2 h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
            <RelatorioMedicaoDetalhado
              vehicleData={reportData}
              dateRange={{ from: dateRange.from, to: dateRange.to }}
              manutencaoData={manutencaoData}
              tipoVeiculo={vehicleType as "Caminhão" | "Equipamento"}
            />
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default RelatorioMedicao;
