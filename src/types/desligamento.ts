export type TipoDesligamento = 'com_aviso' | 'sem_aviso';

/**
 * Status do desligamento.
 * Novos estados (workflow): pendente_aprovacao, aprovada, reprovada, efetivada
 * Estados legados (compat com Edge process-desligamentos): em_andamento, concluido, cancelado
 */
export type StatusDesligamento =
  | 'pendente_aprovacao'
  | 'aprovada'
  | 'reprovada'
  | 'efetivada'
  | 'em_andamento'
  | 'concluido'
  | 'cancelado';

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
  /** Registro sintético derivado de bd_funcionarios (sem entrada em bd_desligamentos). */
  isVirtual?: boolean;
  origemRegistro?: 'funcionario_inativo';
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
  // Joins (enriquecidos pelo hook)
  bd_funcionarios?: {
    id: string;
    nome_completo: string;
    cpf: string;
    matricula: string | null;
    status: string | null;
    data_admissao: string | null;
    salario_base: number | null;
    centro_custo_id: string | null;
    bd_funcoes: { nome_funcao: string } | null;
    bd_empresas: { nome_empresa: string } | null;
    bd_centros_custo: { id: string; codigo_centro_custo: string; nome_centro_custo: string } | null;
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

export const getStatusDesligamentoColor = (
  status: StatusDesligamento,
): 'default' | 'warning' | 'success' | 'destructive' | 'secondary' => {
  switch (status) {
    case 'pendente_aprovacao': return 'warning';
    case 'aprovada': return 'secondary';
    case 'reprovada': return 'destructive';
    case 'efetivada': return 'success';
    case 'em_andamento': return 'warning';
    case 'concluido': return 'success';
    case 'cancelado': return 'destructive';
    default: return 'default';
  }
};

export const getStatusDesligamentoLabel = (status: StatusDesligamento): string => {
  switch (status) {
    case 'pendente_aprovacao': return 'Pendente Aprovação';
    case 'aprovada': return 'Aprovada';
    case 'reprovada': return 'Reprovada';
    case 'efetivada': return 'Efetivada';
    case 'em_andamento': return 'Em Andamento (Aviso)';
    case 'concluido': return 'Concluído';
    case 'cancelado': return 'Cancelado';
    default: return String(status);
  }
};

export const getTipoDesligamentoLabel = (tipo: TipoDesligamento): string => {
  return tipo === 'com_aviso' ? 'Com Aviso Prévio' : 'Sem Aviso Prévio';
};

/**
 * @deprecated Valor de rescisão é preenchido manualmente. Mantido apenas para
 * compatibilidade com imports legados — não usar em UI/PDF novos.
 */
export const calcularRescisaoSimplificada = (params: {
  salario_base: number;
  data_admissao: string | null;
  data_desligamento: string;
  tipo: TipoDesligamento;
  dias_aviso?: number | null;
}): {
  saldo_salario: number;
  aviso_indenizado: number;
  decimo_terceiro_prop: number;
  ferias_prop: number;
  terco_ferias: number;
  total: number;
} => {
  const salario = Number(params.salario_base) || 0;
  const desl = new Date(params.data_desligamento + 'T12:00:00');
  const adm = params.data_admissao ? new Date(params.data_admissao + 'T12:00:00') : desl;

  // Saldo de salário (dias trabalhados no mês)
  const diasMes = new Date(desl.getFullYear(), desl.getMonth() + 1, 0).getDate();
  const diasTrab = desl.getDate();
  const saldo_salario = (salario / diasMes) * diasTrab;

  // Aviso prévio indenizado (apenas se sem_aviso)
  const aviso_indenizado = params.tipo === 'sem_aviso' ? salario : 0;

  // Meses no ano corrente para 13º (>=15 dias conta o mês)
  const inicioAno = new Date(desl.getFullYear(), 0, 1);
  const baseAno = adm > inicioAno ? adm : inicioAno;
  let mesesAno = desl.getMonth() - baseAno.getMonth() + 1;
  if (desl.getDate() < 15 && desl.getMonth() === baseAno.getMonth()) mesesAno = 0;
  mesesAno = Math.max(0, Math.min(12, mesesAno));
  const decimo_terceiro_prop = (salario / 12) * mesesAno;

  // Férias proporcionais: meses desde último período aquisitivo (simplificado: desde admissão a partir do último aniversário)
  const aniv = new Date(adm);
  while (aniv.getFullYear() < desl.getFullYear() - 1 || (aniv.getFullYear() === desl.getFullYear() - 1 && aniv <= desl)) {
    aniv.setFullYear(aniv.getFullYear() + 1);
  }
  if (aniv > desl) aniv.setFullYear(aniv.getFullYear() - 1);
  let mesesFerias = (desl.getFullYear() - aniv.getFullYear()) * 12 + (desl.getMonth() - aniv.getMonth());
  if (desl.getDate() >= 15) mesesFerias += 1;
  mesesFerias = Math.max(0, Math.min(12, mesesFerias));
  const ferias_prop = (salario / 12) * mesesFerias;
  const terco_ferias = ferias_prop / 3;

  const total = saldo_salario + aviso_indenizado + decimo_terceiro_prop + ferias_prop + terco_ferias;
  return {
    saldo_salario: Number(saldo_salario.toFixed(2)),
    aviso_indenizado: Number(aviso_indenizado.toFixed(2)),
    decimo_terceiro_prop: Number(decimo_terceiro_prop.toFixed(2)),
    ferias_prop: Number(ferias_prop.toFixed(2)),
    terco_ferias: Number(terco_ferias.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
};
