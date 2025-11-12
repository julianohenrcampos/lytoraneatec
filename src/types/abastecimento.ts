export interface Abastecimento {
  id?: string;
  identificador: string;
  tipo_procedimento?: string;
  data_abast: string;
  hora_abast?: string;
  comboista?: string;
  comboista_tag?: string;
  operador?: string;
  operador_tag?: string;
  frota?: string;
  frota_tag?: string;
  placa?: string;
  combustivel?: string;
  litragem?: number;
  bico?: string;
  estoque?: string;
  medidor?: number;
  medidor_anterior_valor?: number;
  medidor_anterior_data?: string;
  encerrante_fim?: number;
  cc?: string;
  latitude?: number;
  longitude?: number;
  identificacao_do_ponto?: string;
  operacao?: string;
  medidor_via_entrada?: string;
  medidor_unidade?: string;
  codigo_terceiro?: string;
  foto_verificada?: boolean;
  registro_editado_em?: string;
  registrado_editado_por?: string;
  data_integracao?: string;
  created_at?: string;
  updated_at?: string;
}

export interface AbastecimentoFiltros {
  dataInicio?: string;
  dataFim?: string;
  placa?: string;
  frota?: string;
  comboista?: string;
  combustivel?: string;
  cc?: string;
}

export interface AbastecimentoStats {
  totalRegistros: number;
  totalLitros: number;
  totalVeiculos: number;
  totalComboistas: number;
  mediaPorAbastecimento: number;
}

export interface GuardianAuthResponse {
  token?: string;
  erro?: string;
  erros?: string[];
}

export interface GuardianAbastecimentosResponse {
  dados?: Abastecimento[];
  erro?: string;
  erros?: string[];
}
