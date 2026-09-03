// Fase 2-D — Catálogo canônico de tipos de documento (espelho do backend).
// O backend em atestado-submeter é a autoridade sobre descrição e e-mail destino.

export interface TipoDocumento {
  codigo: string;
  descricao: string;
  exigeSistemaAfetado: boolean;
}

export const TIPOS_DOCUMENTO: TipoDocumento[] = [
  { codigo: "atestado_medico", descricao: "Atestado Médico", exigeSistemaAfetado: true },
  { codigo: "declaracao_comparecimento", descricao: "Declaração de Comparecimento", exigeSistemaAfetado: false },
  { codigo: "licenca_judicial", descricao: "Licença Judicial", exigeSistemaAfetado: false },
  { codigo: "doacao_sangue", descricao: "Doação de Sangue", exigeSistemaAfetado: false },
  { codigo: "acompanhamento_filho", descricao: "Acompanhamento de Filho", exigeSistemaAfetado: false },
  { codigo: "acompanhamento_esposa_gestante", descricao: "Acompanhamento de Esposa Gestante", exigeSistemaAfetado: false },
];

export const TIPO_ATESTADO_MEDICO = "atestado_medico";

export const TIPOS_DOCUMENTO_CODIGOS = TIPOS_DOCUMENTO.map((t) => t.codigo);

export function getTipoDocumentoDescricao(codigo?: string | null): string | null {
  if (!codigo) return null;
  return TIPOS_DOCUMENTO.find((t) => t.codigo === codigo)?.descricao ?? null;
}

export function tipoExigeSistemaAfetado(codigo?: string | null): boolean {
  return codigo === TIPO_ATESTADO_MEDICO;
}
