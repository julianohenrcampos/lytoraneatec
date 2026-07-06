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

export interface AtestadoSubmeterResponse {
  ok: true;
  protocolo: string;
  dentro_prazo_24h: boolean;
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
}

export interface AtestadosPainelFilters {
  data_inicio?: string; // yyyy-mm-dd
  data_fim?: string;
  status?: string;
  prazo?: 'todos' | 'dentro' | 'fora';
  busca?: string;
}

export interface AtestadoFormValues {
  data_emissao: string;
  data_inicio_afastamento: string;
  dias_afastamento: number;
  arquivo: File | null;
  declaracao_veracidade: boolean;
  declaracao_original_48h: boolean;
  declaracao_ciencia_nao_validacao: boolean;
}
