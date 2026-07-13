// Fase 2-C — Catálogo canônico de sistemas afetados (espelho do backend).
// O backend em atestado-submeter é a autoridade sobre a descrição gravada.

export interface SistemaAfetado {
  codigo: string;
  descricao: string;
}

export const SISTEMAS_AFETADOS: SistemaAfetado[] = [
  { codigo: "01", descricao: "Sistema Respiratório" },
  { codigo: "02", descricao: "Sistema Cardiovascular" },
  { codigo: "03", descricao: "Sistema Digestório (Gastrointestinal)" },
  { codigo: "04", descricao: "Sistema Neurológico (Sistema Nervoso)" },
  { codigo: "05", descricao: "Sistema Musculoesquelético" },
  { codigo: "06", descricao: "Sistema Geniturinário" },
  { codigo: "07", descricao: "Sistema Endócrino" },
  { codigo: "08", descricao: "Sistema Hematológico" },
  { codigo: "09", descricao: "Sistema Imunológico" },
  { codigo: "10", descricao: "Sistema Dermatológico (Tegumentar)" },
  { codigo: "11", descricao: "Sistema Oftalmológico (Visual)" },
  { codigo: "12", descricao: "Sistema Otorrinolaringológico (Ouvido, Nariz e Garganta)" },
  { codigo: "13", descricao: "Sistema Reprodutor" },
  { codigo: "14", descricao: "Sistema Psiquiátrico / Saúde Mental" },
  { codigo: "15", descricao: "Sistema Renal" },
  { codigo: "16", descricao: "Sistema Linfático" },
  { codigo: "17", descricao: "Sistema Metabólico" },
  { codigo: "18", descricao: "Sistema Odontológico / Bucal" },
  { codigo: "19", descricao: "Múltiplos Sistemas" },
  { codigo: "20", descricao: "Não Especificado" },
  { codigo: "21", descricao: "Outros" },
];

export const SISTEMA_OUTROS_CODIGO = "21";

export const SISTEMAS_AFETADOS_CODIGOS = SISTEMAS_AFETADOS.map((s) => s.codigo);

export function getSistemaDescricao(codigo?: string | null): string | null {
  if (!codigo) return null;
  return SISTEMAS_AFETADOS.find((s) => s.codigo === codigo)?.descricao ?? null;
}
