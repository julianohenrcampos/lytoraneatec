export type TipoDesligamento = 'com_aviso' | 'sem_aviso';
export type StatusDesligamento = 'em_andamento' | 'concluido' | 'cancelado';

export const MOTIVOS_DESLIGAMENTO = [
  'Pedido de demissão',
  'Dispensa sem justa causa',
  'Dispensa com justa causa',
  'Término de contrato',
  'Acordo mútuo',
  'Redução de quadro',
  'Outro',
] as const;

export type MotivoDesligamento = typeof MOTIVOS_DESLIGAMENTO[number];

export interface Desligamento {
  id: string;
  funcionario_id: string;
  tipo_desligamento: TipoDesligamento;
  dias_aviso: number | null;
  data_solicitacao: string;
  data_inicio_aviso: string | null;
  data_fim_aviso: string | null;
  data_efetiva_desligamento: string | null;
  motivo: string | null;
  recontratavel: boolean;
  observacoes: string | null;
  status: StatusDesligamento;
  criado_por: string;
  modificado_por: string | null;
  created_at: string;
  updated_at: string;
  // Joins
  bd_funcionarios?: {
    id: string;
    nome_completo: string;
    cpf: string;
    status: string | null;
    bd_funcoes: { nome_funcao: string } | null;
    bd_empresas: { nome_empresa: string } | null;
  };
}

export interface DesligamentoFormData {
  funcionario_id: string;
  tipo_desligamento: TipoDesligamento;
  dias_aviso: number;
  motivo: string;
  recontratavel: boolean;
  observacoes: string;
}

export const getStatusDesligamentoColor = (status: StatusDesligamento): "default" | "warning" | "success" | "destructive" => {
  switch (status) {
    case 'em_andamento': return 'warning';
    case 'concluido': return 'success';
    case 'cancelado': return 'destructive';
    default: return 'default';
  }
};

export const getStatusDesligamentoLabel = (status: StatusDesligamento): string => {
  switch (status) {
    case 'em_andamento': return 'Em Andamento';
    case 'concluido': return 'Concluído';
    case 'cancelado': return 'Cancelado';
    default: return status;
  }
};

export const getTipoDesligamentoLabel = (tipo: TipoDesligamento): string => {
  return tipo === 'com_aviso' ? 'Com Aviso Prévio' : 'Sem Aviso Prévio';
};
