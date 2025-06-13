import React, { useState, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { EquipmentReportData, TruckReportData, ManutencaoEquipmentData, ManutencaoTruckData } from "@/types/relatorioMedicao";

interface RelatorioMedicaoDetalhadoProps {
  vehicleData: (EquipmentReportData | TruckReportData)[];
  dateRange: {
    from: Date;
    to: Date;
  };
  manutencaoData?: ManutencaoEquipmentData | ManutencaoTruckData | null;
  tipoVeiculo: "Caminhão" | "Equipamento";
}

const RelatorioMedicaoDetalhado: React.FC<RelatorioMedicaoDetalhadoProps> = ({
  vehicleData,
  dateRange,
  manutencaoData,
  tipoVeiculo
}) => {
  const [observacoes, setObservacoes] = useState("");
  const [rastreadorValues, setRastreadorValues] = useState<Record<string, number>>(() => {
    const initialValues: Record<string, number> = {};
    vehicleData.forEach(vehicle => {
      initialValues[vehicle.id] = 0; // CORRIGIDO: Sempre iniciar com 0
    });
    return initialValues;
  });

  const mesReferencia = format(dateRange.from, 'MMMM', {
    locale: ptBR
  }).toUpperCase();

  const periodo = `${format(dateRange.from, 'dd/MM/yyyy')} à ${format(dateRange.to, 'dd/MM/yyyy')}`;

  const obra = [...new Set(vehicleData.map(v => v.centro_custo))].join('/');

  const handleRastreadorChange = useCallback((id: string, value: string) => {
    const numericValue = parseFloat(value) || 0;
    setRastreadorValues(prev => ({
      ...prev,
      [id]: numericValue
    }));
  }, []);

  const formatCurrency = (value: number | undefined | null) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(safeValue);
  };

  const formatNumber = (value: number | undefined | null, decimals: number = 2) => {
    const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
    return safeValue.toFixed(decimals);
  };

  // Renderizar tabela para Equipamento
  const renderEquipmentTable = () => {
    const equipmentData = vehicleData as EquipmentReportData[];
    
    // CORRIGIDO: Calcular totais conforme mostrado na imagem
    const totais = {
      totalMensal: equipmentData.reduce((acc, item) => acc + (item.totalMensal || 0), 0),
      valorPeriodo: equipmentData.reduce((acc, item) => acc + (item.valorPeriodo || 0), 0),
      horasDisponiveis: equipmentData.reduce((acc, item) => acc + (item.horasDisponiveis || 0), 0),
      produtividade: equipmentData.reduce((acc, item) => acc + (item.produtividade || 0), 0),
      abastecimento: equipmentData.reduce((acc, item) => acc + (item.abastecimento || 0), 0),
      rastreador: Object.values(rastreadorValues).reduce((acc, value) => acc + (value || 0), 0)
    };

    return (
      <table className="w-full text-xs border border-gray-300">
        <thead className="bg-gray-100">
          <tr className="text-left">
            <th className="border border-gray-300 px-2 py-1" rowSpan={2}>DESCRIÇÃO DOS SERVIÇOS</th>
            <th className="border border-gray-300 px-2 py-1 text-center" colSpan={3}>CONTRATO</th>
            <th className="border border-gray-300 px-2 py-1 text-center" colSpan={6}>NO PERÍODO</th>
          </tr>
          <tr className="text-left">
            <th className="border border-gray-300 px-2 py-1">QUANTIDADE (HORAS)</th>
            <th className="border border-gray-300 px-2 py-1">VALOR UNIT. (R$/h)</th>
            <th className="border border-gray-300 px-2 py-1">TOTAL MENSAL (R$)</th>
            <th className="border border-gray-300 px-2 py-1">HORAS DISPONÍVEIS</th>
            <th className="border border-gray-300 px-2 py-1">VALOR (R$)</th>
            <th className="border border-gray-300 px-2 py-1">PRODUTIVIDADE</th>
            <th className="border border-gray-300 px-2 py-1">ABASTECIMENTO</th>
            <th className="border border-gray-300 px-2 py-1">MÉDIA ABAST.</th>
            <th className="border border-gray-300 px-2 py-1">RASTREADOR</th>
          </tr>
        </thead>
        <tbody>
          {equipmentData.map((item, i) => (
            <tr key={i}>
              <td className="border border-gray-300 px-2 py-1">{item.label}</td>
              <td className="border border-gray-300 px-2 py-1">{item.quantidadeHoras || 0} H</td>
              <td className="border border-gray-300 px-2 py-1">{formatCurrency(item.valorUnitarioHora)}</td>
              <td className="border border-gray-300 px-2 py-1">{formatCurrency(item.totalMensal)}</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.horasDisponiveis)} H</td>
              <td className="border border-gray-300 px-2 py-1">{formatCurrency(item.valorPeriodo)}</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.produtividade)} H</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.abastecimento)} L</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.mediaAbastecimento)} L/H</td>
              <td className="border border-gray-300 px-2 py-1">
                <input
                  type="number"
                  step="0.01"
                  value={rastreadorValues[item.id] || 0}
                  onChange={e => handleRastreadorChange(item.id, e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs text-right"
                  style={{ minWidth: '60px' }}
                />
              </td>
            </tr>
          ))}
          {/* CORRIGIDO: Linha de totais com valores conforme imagem */}
          <tr className="font-bold bg-gray-50">
            <td className="border border-gray-300 px-2 py-1 text-right">TOTAIS</td>
            <td className="border border-gray-300 px-2 py-1">-</td>
            <td className="border border-gray-300 px-2 py-1">-</td>
            <td className="border border-gray-300 px-2 py-1">{formatCurrency(totais.totalMensal)}</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.horasDisponiveis)} H</td>
            <td className="border border-gray-300 px-2 py-1">{formatCurrency(totais.valorPeriodo)}</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.produtividade)} H</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.abastecimento)} L</td>
            <td className="border border-gray-300 px-2 py-1">-</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.rastreador)} H</td>
          </tr>
        </tbody>
      </table>
    );
  };

  // Renderizar tabela para Caminhão (manter estrutura atual)
  const renderTruckTable = () => {
    const truckData = vehicleData as TruckReportData[];
    
    // CORRIGIDO: Calcular totais conforme necessário para caminhões
    const totais = {
      qtdDia: truckData.reduce((acc, item) => acc + (item.qtdDia || 0), 0),
      valor: truckData.reduce((acc, item) => acc + (item.valor || 0), 0),
      quilometragem: truckData.reduce((acc, item) => acc + (item.quilometragem || 0), 0),
      abastecimento: truckData.reduce((acc, item) => acc + (item.abastecimento || 0), 0),
      rastreador: Object.values(rastreadorValues).reduce((acc, value) => acc + (value || 0), 0)
    };

    return (
      <table className="w-full text-xs border border-gray-300">
        <thead className="bg-gray-100">
          <tr className="text-left">
            <th className="border border-gray-300 px-2 py-1">DESCRIÇÃO DOS SERVIÇOS</th>
            <th className="border border-gray-300 px-2 py-1">TOTAL MENSAL (R$)</th>
            <th className="border border-gray-300 px-2 py-1">QTD/DIA</th>
            <th className="border border-gray-300 px-2 py-1">VALOR (R$)</th>
            <th className="border border-gray-300 px-2 py-1">PRODUTIVIDADE</th>
            <th className="border border-gray-300 px-2 py-1">ABASTECIMENTO</th>
            <th className="border border-gray-300 px-2 py-1">MÉDIA ARAST.</th>
            <th className="border border-gray-300 px-2 py-1">RASTREADOR</th>
          </tr>
        </thead>
        <tbody>
          {truckData.map((item, i) => (
            <tr key={i}>
              <td className="border border-gray-300 px-2 py-1">{item.label}</td>
              <td className="border border-gray-300 px-2 py-1">{formatCurrency(item.totalMensal)}</td>
              <td className="border border-gray-300 px-2 py-1">{item.qtdDia || 0}</td>
              <td className="border border-gray-300 px-2 py-1">{formatCurrency(item.valor)}</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.quilometragem)} km</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.abastecimento)} L</td>
              <td className="border border-gray-300 px-2 py-1">{formatNumber(item.mediaAbastecimento)} L/KM</td>
              <td className="border border-gray-300 px-2 py-1">
                <input
                  type="number"
                  step="0.01"
                  value={rastreadorValues[item.id] || 0}
                  onChange={e => handleRastreadorChange(item.id, e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-xs text-right"
                  style={{ minWidth: '60px' }}
                />
              </td>
            </tr>
          ))}
          {/* CORRIGIDO: Linha de totais com valores para caminhões */}
          <tr className="font-bold bg-gray-50">
            <td className="border border-gray-300 px-2 py-1 text-right">TOTAIS</td>
            <td className="border border-gray-300 px-2 py-1">-</td>
            <td className="border border-gray-300 px-2 py-1">{totais.qtdDia}</td>
            <td className="border border-gray-300 px-2 py-1">{formatCurrency(totais.valor)}</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.quilometragem)} km</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.abastecimento)} L</td>
            <td className="border border-gray-300 px-2 py-1">-</td>
            <td className="border border-gray-300 px-2 py-1">{formatNumber(totais.rastreador)} km</td>
          </tr>
        </tbody>
      </table>
    );
  };

  // Renderizar seção de descontos - ATUALIZADO para múltiplos descontos
  const renderDescontos = () => {
    if (tipoVeiculo === "Equipamento") {
      const equipmentMaintenance = manutencaoData as ManutencaoEquipmentData;
      
      // Se não há dados de manutenção ou descontos, mostrar valores zerados
      if (!equipmentMaintenance || !equipmentMaintenance.descontos || equipmentMaintenance.descontos.length === 0) {
        return (
          <table className="w-full text-xs border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1">TIPO DE DESCONTO</th>
                <th className="border border-gray-300 px-2 py-1">VALOR UNIT. (R$)</th>
                <th className="border border-gray-300 px-2 py-1">QTD/H</th>
                <th className="border border-gray-300 px-2 py-1">VALOR (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1">NENHUM DESCONTO APLICÁVEL</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(0)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatNumber(0)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(0)}</td>
              </tr>
            </tbody>
          </table>
        );
      }
      
      return (
        <table className="w-full text-xs border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 px-2 py-1">TIPO DE DESCONTO</th>
              <th className="border border-gray-300 px-2 py-1">VALOR UNIT. (R$)</th>
              <th className="border border-gray-300 px-2 py-1">QTD/H</th>
              <th className="border border-gray-300 px-2 py-1">VALOR (R$)</th>
            </tr>
          </thead>
          <tbody>
            {equipmentMaintenance.descontos.map((desconto, index) => (
              <tr key={index}>
                <td className="border border-gray-300 px-2 py-1 font-medium">{desconto.tipoDesconto}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(desconto.valorUnitario)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatNumber(desconto.qtdHoras || 0)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(desconto.valor)}</td>
              </tr>
            ))}
            {equipmentMaintenance.descontos.length > 1 && (
              <tr className="font-bold bg-gray-50">
                <td className="border border-gray-300 px-2 py-1 text-right">TOTAL DESCONTOS</td>
                <td className="border border-gray-300 px-2 py-1">-</td>
                <td className="border border-gray-300 px-2 py-1">{formatNumber(equipmentMaintenance.qtdHoras)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(equipmentMaintenance.valor)}</td>
              </tr>
            )}
          </tbody>
        </table>
      );
    } else {
      // NOVA LÓGICA PARA CAMINHÕES COM MÚLTIPLOS DESCONTOS
      const truckMaintenance = manutencaoData as ManutencaoTruckData;
      
      // Se não há dados de manutenção ou descontos, mostrar valores zerados
      if (!truckMaintenance || !truckMaintenance.descontos || truckMaintenance.descontos.length === 0) {
        return (
          <table className="w-full text-xs border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="border border-gray-300 px-2 py-1">TIPO DE DESCONTO</th>
                <th className="border border-gray-300 px-2 py-1">VALOR UNIT. (R$)</th>
                <th className="border border-gray-300 px-2 py-1">QTD/DIA</th>
                <th className="border border-gray-300 px-2 py-1">VALOR (R$)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-gray-300 px-2 py-1">NENHUM DESCONTO APLICÁVEL</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(0)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatNumber(0)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(0)}</td>
              </tr>
            </tbody>
          </table>
        );
      }
      
      return (
        <table className="w-full text-xs border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="border border-gray-300 px-2 py-1">TIPO DE DESCONTO</th>
              <th className="border border-gray-300 px-2 py-1">VALOR UNIT. (R$)</th>
              <th className="border border-gray-300 px-2 py-1">QTD/DIA</th>
              <th className="border border-gray-300 px-2 py-1">VALOR (R$)</th>
            </tr>
          </thead>
          <tbody>
            {truckMaintenance.descontos.map((desconto, index) => (
              <tr key={index}>
                <td className="border border-gray-300 px-2 py-1 font-medium">{desconto.tipoDesconto}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(desconto.valorUnitario)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatNumber(desconto.qtdDias || 0)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(desconto.valor)}</td>
              </tr>
            ))}
            {truckMaintenance.descontos.length > 1 && (
              <tr className="font-bold bg-gray-50">
                <td className="border border-gray-300 px-2 py-1 text-right">TOTAL DESCONTOS</td>
                <td className="border border-gray-300 px-2 py-1">-</td>
                <td className="border border-gray-300 px-2 py-1">{formatNumber(truckMaintenance.qtdDias)}</td>
                <td className="border border-gray-300 px-2 py-1">{formatCurrency(truckMaintenance.valor)}</td>
              </tr>
            )}
          </tbody>
        </table>
      );
    }
  };

  // Calcular total do período baseado no tipo - ATUALIZADO para subtrair descontos
  const calculateTotalPeriodo = () => {
    if (tipoVeiculo === "Equipamento") {
      const equipmentData = vehicleData as EquipmentReportData[];
      const totalServicos = equipmentData.reduce((acc, item) => acc + (item.valorPeriodo || 0), 0);
      
      // Subtrair descontos se existirem
      const equipmentMaintenance = manutencaoData as ManutencaoEquipmentData;
      const totalDescontos = equipmentMaintenance?.valor || 0;
      
      return totalServicos - totalDescontos;
    } else {
      const truckData = vehicleData as TruckReportData[];
      const totalServicos = truckData.reduce((acc, item) => acc + (item.valor || 0), 0);
      
      // Subtrair descontos de caminhões
      const truckMaintenance = manutencaoData as ManutencaoTruckData;
      const totalDescontos = truckMaintenance?.valor || 0;
      
      return totalServicos - totalDescontos;
    }
  };

  return (
    <div id="relatorio-medicao-detalhado" className="px-6 py-4 space-y-4 bg-white print:p-4 print:shadow-none">
      {/* Header */}
      <div className="flex items-start justify-between print:mb-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 flex items-center justify-center print:w-12 print:h-12">
            <img 
              src="/lovable-uploads/dcf6c980-f927-4180-b109-b425da1323ba.png" 
              alt="Lytorânea Logo" 
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <p className="text-sm font-medium print:text-black">CONSTRUTORA LYTORÂNEA</p>
            <h2 className="text-xl font-bold print:text-black">RELATÓRIO DE MEDIÇÃO</h2>
          </div>
        </div>
        <div className="text-right space-y-1 text-sm print:text-black">
          <p><strong>PM nº:</strong> 9</p>
          <p><strong>Mês de Referência:</strong> {mesReferencia}</p>
          <p><strong>Período:</strong> {periodo}</p>
        </div>
      </div>

      {/* Contratada e Obra */}
      <div className="grid grid-cols-2 gap-4 text-sm print:text-black print:mb-4">
        <p><strong>CONTRATADA:</strong> ABRA INFRAESTRUTURA</p>
        <p><strong>OBRA:</strong> {obra}</p>
      </div>

      {/* Tabela de Serviços Dinâmica */}
      <div className="overflow-auto print:overflow-visible">
        <h3 className="text-sm font-bold mb-2 print:text-black">1. DESCRIÇÃO DOS SERVIÇOS</h3>
        {tipoVeiculo === "Equipamento" ? renderEquipmentTable() : renderTruckTable()}
      </div>

      {/* Tabela de Descontos - ATUALIZADA para múltiplos descontos */}
      <div className="text-sm print:mb-4">
        <p className="font-bold mb-2 print:text-black">2. DESCONTOS/ACRÉSCIMOS</p>
        <p className="font-semibold mb-1 text-xs print:text-black">2.1 DESCONTOS APLICÁVEIS</p>
        {renderDescontos()}
      </div>

      {/* Observações */}
      <div className="print:mb-4">
        <label className="block text-sm font-bold mb-1 print:text-black">Observações:</label>
        <textarea
          className="w-full border border-gray-300 rounded-md p-2 text-sm print:border print:border-gray-400 print:min-h-[60px]"
          rows={3}
          value={observacoes}
          onChange={e => setObservacoes(e.target.value)}
          placeholder="Digite suas observações aqui..."
        />
      </div>

      {/* Total do Período */}
      <div className="text-center text-lg font-bold print:text-black print:mb-6">
        <p>TOTAL NO PERÍODO: {formatCurrency(calculateTotalPeriodo())}</p>
      </div>

      {/* Assinaturas */}
      <div className="grid grid-cols-3 gap-4 text-center text-sm pt-6 border-t mt-6 print:border-t print:border-gray-400 print:pt-8">
        <div>
          <div className="h-12 border-b border-gray-400 w-3/4 mx-auto mt-2 mb-2 print:border-b print:border-gray-400" />
          <p className="font-semibold print:text-black">Medição e Controle</p>
        </div>
        <div>
          <div className="h-12 border-b border-gray-400 w-3/4 mx-auto mt-2 mb-2 print:border-b print:border-gray-400" />
          <p className="font-semibold print:text-black">Gestor de Contratos</p>
        </div>
        <div>
          <div className="h-12 border-b border-gray-400 w-3/4 mx-auto mt-2 mb-2 print:border-b print:border-gray-400" />
          <p className="font-semibold print:text-black">Contratada</p>
        </div>
      </div>
    </div>
  );
};

export default RelatorioMedicaoDetalhado;
