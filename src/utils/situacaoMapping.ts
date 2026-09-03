// Mapeamento entre a etiqueta exibida na UI e o valor persistido no banco
// para o campo `situacao` do apontamento de C&E.
//
// Historicamente a UI mostrava "Parado" mas o valor gravado sempre foi
// "Disponível". A partir da correção do fluxo em duas etapas o rótulo
// oficial passa a ser "À disposição". A leitura permanece retrocompatível
// para valores brutos antigos ("Parado").

export interface SituacaoOption {
  label: string;
  value: string;
}

export const SITUACOES_APONTAMENTO: readonly SituacaoOption[] = [
  { label: "Operando", value: "Operando" },
  { label: "À disposição", value: "Disponível" },
  { label: "Em Manutenção", value: "Em Manutenção" },
  { label: "Intempérie", value: "Intempérie" },
] as const;

// UI (label) → DB (value)
const UI_TO_DB: Record<string, string> = SITUACOES_APONTAMENTO.reduce(
  (acc, item) => {
    acc[item.label] = item.value;
    return acc;
  },
  {} as Record<string, string>
);
UI_TO_DB["Parado"] = "Disponível"; // retrocompat de rótulo antigo

// DB → UI (label)
const DB_TO_UI: Record<string, string> = SITUACOES_APONTAMENTO.reduce(
  (acc, item) => {
    acc[item.value] = item.label;
    return acc;
  },
  {} as Record<string, string>
);
DB_TO_UI["Parado"] = "À disposição"; // caso um registro histórico tenha o valor bruto

export const mapSituacaoToDatabase = (situacaoUI: string): string => {
  if (!situacaoUI) return situacaoUI;
  return UI_TO_DB[situacaoUI] ?? situacaoUI;
};

export const mapSituacaoFromDatabase = (situacaoDB: string): string => {
  if (!situacaoDB) return situacaoDB;
  return DB_TO_UI[situacaoDB] ?? situacaoDB;
};
