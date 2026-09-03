// Fase 2-A — Tipos frontend para Atestados Médicos
// Alinhados ao contrato real das Edge Functions e à tabela bd_atestados_medicos.

export interface AtestadoFuncionarioSnapshot {
  id: string;
  nome: string;
  matricula: string;
}

export interface AtestadoValidarResponse {
  ok: true;
  token_validacao: string;
  expira_em: number;
  funcionario: AtestadoFuncionarioSnapshot;
}

export interface AtestadoUploadUrlResponse {
  ok: true;
  signed_url: string;
  token: string;
  arquivo_path: string;
  bucket: string;
}

export type AtestadoAlertaCodigo =
  | "prazo_ok"
  | "prazo_fora"
  | "afastamento_5_dias"
  | "recorrencia_mes"
  | "acompanhamento_60d";

export interface AtestadoAlerta {
  codigo: AtestadoAlertaCodigo;
  meta?: Record<string, unknown>;
}

export interface AtestadoSubmeterResponse {
  ok: true;
  protocolo: string;
  dentro_prazo_24h: boolean;
  tipo_documento?: string;
  tipo_documento_descricao?: string;
  sistema_afetado_codigo?: string | null;
  sistema_afetado_descricao?: string | null;
  alertas_gerados?: AtestadoAlerta[];
}

export interface AtestadoEdgeError {
  ok?: false;
  error: string;
  detail?: unknown;
}

export type AtestadoStatus = string;

export interface AtestadoRow {
  id: string;
  protocolo: string;
  nome_snapshot: string;
  matricula_snapshot: string;
  centro_custo_snapshot: string | null;
  data_emissao: string;
  data_inicio_afastamento: string | null;
  dias_afastamento: number;
  enviado_em: string;
  dentro_prazo_24h: boolean;
  status: string;
  notificacao_email_status: string;
  notificacao_email_tentativas: number;
  declaracao_veracidade: boolean;
  declaracao_original_48h: boolean;
  declaracao_ciencia_nao_validacao: boolean;
  declaracoes_aceitas_em: string | null;
  observacao_saude: string | null;
  arquivo_path: string;
  tipo_documento: string;
  tipo_documento_descricao: string | null;
  notificacao_email_destino: string | null;
  sistema_afetado_codigo: string | null;
  sistema_afetado_descricao: string | null;
  sistema_afetado_observacao: string | null;
  alertas_gerados: AtestadoAlerta[];
  lido: boolean;
  lido_em: string | null;
  lido_por: string | null;
  lido_por_nome: string | null;
}

export interface AtestadosPainelFilters {
  data_inicio?: string; // yyyy-mm-dd
  data_fim?: string;
  status?: string;
  prazo?: 'todos' | 'dentro' | 'fora';
  busca?: string;
  tipo_documento?: string; // 'todos' | codigo do tipo
  setor_destino?: 'todos' | 'saude' | 'dp';
  status_email?: string; // 'todos' | valor de notificacao_email_status
  centro_custo?: string; // busca parcial em centro_custo_snapshot
  sistema_afetado?: string; // 'todos' | codigo do sistema afetado
}

export interface AtestadoFormValues {
  data_emissao: string;
  data_inicio_afastamento: string;
  dias_afastamento: number;
  arquivo: File | null;
  declaracao_veracidade: boolean;
  declaracao_original_48h: boolean;
  declaracao_ciencia_nao_validacao: boolean;
  tipo_documento: string;
  sistema_afetado_codigo: string;
  sistema_afetado_observacao?: string;
}
