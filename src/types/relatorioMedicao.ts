
export interface BaseVehicleReportData {
  id: string;
  label: string;
  tipo_veiculo: string;
  centro_custo: string;
  diasTrabalhados: number;
  totalMensal: number;
  abastecimento: number;
  mediaAbastecimento: number;
  rastreador: number;
}

export interface EquipmentReportData extends BaseVehicleReportData {
  quantidadeHoras: number; // 200 horas fixas
  valorUnitarioHora: number; // R$/h
  horasDisponiveis: number; // Horas efetivas - manutenção
  valorPeriodo: number; // Horas disponíveis * valor unitário
  produtividade: number; // Horas trabalhadas
}

export interface TruckReportData extends BaseVehicleReportData {
  qtdDia: number; // Dias trabalhados
  valor: number; // Valor proporcional
  quilometragem: number; // Km do período
}

export interface ManutencaoEquipmentData {
  valorUnitario: number;
  qtdHoras: number;
  valor: number;
}

export interface ManutencaoTruckData {
  valorMensal: number;
  qtdDia: number;
  valor: number;
}
