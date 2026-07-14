// Adaptador visual do checklist LEGADO (10 campos da Fase 0) para o
// mesmo layout agrupado do checklist detalhado (R3).
// NÃO altera contrato de persistência: os 10 códigos abaixo correspondem
// exatamente às colunas da tabela bd_registro_apontamento_inspecao.

import type { ApontamentoInspecao } from "@/services/apontamentoCaminhoesService";

export type LegadoChecklistKey = Extract<
  keyof ApontamentoInspecao,
  | "nivel_oleo"
  | "nivel_agua"
  | "nivel_combustivel"
  | "pressao_pneus"
  | "estado_pneus"
  | "luzes_funcionamento"
  | "freios_funcionamento"
  | "direcao_funcionamento"
  | "equipamentos_seguranca"
  | "limpeza_veiculo"
>;

export interface LegadoItemDef {
  codigo: LegadoChecklistKey;
  descricao: string;
}

export interface LegadoGrupoDef {
  codigo: string;
  titulo: string;
  icone: LegadoIconeKey;
  itens: LegadoItemDef[];
}

export type LegadoIconeKey =
  | "motor"
  | "pneus"
  | "iluminacao"
  | "freios"
  | "direcao"
  | "seguranca"
  | "geral";

export const LEGADO_GRUPOS: LegadoGrupoDef[] = [
  {
    codigo: "motor",
    titulo: "Motor",
    icone: "motor",
    itens: [
      { codigo: "nivel_oleo", descricao: "Nível de óleo" },
      { codigo: "nivel_agua", descricao: "Nível de água" },
      { codigo: "nivel_combustivel", descricao: "Nível de combustível" },
    ],
  },
  {
    codigo: "pneus",
    titulo: "Pneus e Rodas",
    icone: "pneus",
    itens: [
      { codigo: "pressao_pneus", descricao: "Pressão dos pneus" },
      { codigo: "estado_pneus", descricao: "Estado dos pneus" },
    ],
  },
  {
    codigo: "iluminacao",
    titulo: "Iluminação e Sinalização",
    icone: "iluminacao",
    itens: [{ codigo: "luzes_funcionamento", descricao: "Luzes" }],
  },
  {
    codigo: "freios",
    titulo: "Freios",
    icone: "freios",
    itens: [{ codigo: "freios_funcionamento", descricao: "Freios" }],
  },
  {
    codigo: "direcao",
    titulo: "Direção",
    icone: "direcao",
    itens: [{ codigo: "direcao_funcionamento", descricao: "Direção" }],
  },
  {
    codigo: "seguranca",
    titulo: "Segurança",
    icone: "seguranca",
    itens: [
      { codigo: "equipamentos_seguranca", descricao: "Equipamentos de segurança" },
    ],
  },
  {
    codigo: "geral",
    titulo: "Geral",
    icone: "geral",
    itens: [{ codigo: "limpeza_veiculo", descricao: "Limpeza do veículo" }],
  },
];

export const LEGADO_TOTAL_ITENS = LEGADO_GRUPOS.reduce(
  (acc, g) => acc + g.itens.length,
  0
);
