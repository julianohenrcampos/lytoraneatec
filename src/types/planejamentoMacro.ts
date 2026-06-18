// FASE 6A — Contrato TypeScript conceitual do Planejamento Macro da Obra.
// Apenas tipos. Não cria tabela, RLS, schema ou serviço.
// Datas internas em ISO YYYY-MM-DD. A formatação para DD/MM/AAAA é responsabilidade da UI.

export type OrigemPlanejamento =
  | "manual"
  | "importacao_csv"
  | "importacao_excel"
  | "importacao_msproject";

export type StatusPlanejamento = "rascunho" | "ativo" | "encerrado" | "cancelado";

export type TipoRecursoPlanejado = "mao_obra" | "equipamento" | "material";

export type StatusAtividadePlanejada =
  | "Planejada"
  | "Em andamento"
  | "Concluída"
  | "Atrasada"
  | "Cancelada";

export type StatusOrdemDiaria = "rascunho" | "emitida" | "encerrada";

export type SeveridadePendencia = "Baixa" | "Média" | "Alta";

export type PrioridadeAtividade = "baixa" | "media" | "alta";

export type StatusOrigemRecurso = "Planejado" | "Solicitado" | "Aprovado";

export interface PlanejamentoMacro {
  id: string;
  centro_custo_id: string;
  data_inicio: string; // ISO
  data_fim: string;    // ISO
  versao: number;
  origem: OrigemPlanejamento;
  status: StatusPlanejamento;
}

export interface AtividadePlanejada {
  id: string;
  planejamento_id?: string;
  nome: string;
  frente: string;
  inicio: string; // ISO
  fim: string;    // ISO
  status: StatusAtividadePlanejada;
  status_tecnico?: string; // raw DB status: planejada | em_andamento | concluida | atrasada | cancelada
  prioridade?: PrioridadeAtividade;
  quantidade_prevista?: number;
  unidade?: string;
  codigo_wbs?: string | null;
  descricao?: string | null;
}

export interface RecursoPlanejado {
  id: string;
  atividade_id?: string;
  tipo: TipoRecursoPlanejado;
  descricao: string;
  quantidade: number;
  unidade?: string;
  data_necessaria_inicio?: string; // ISO
  data_necessaria_fim?: string;    // ISO
  status_origem?: StatusOrigemRecurso;
}

export interface OrdemDiariaObra {
  id: string;
  planejamento_id?: string;
  centro_custo_id: string;
  data: string; // ISO
  status: StatusOrdemDiaria;
  frente: string;
  equipe: string[];
  equipamentos: string[];
  observacoes?: string;
}

export interface DiarioObra {
  id: string;
  ordem_diaria_id: string;
  producao_executada?: number;
  observacoes?: string;
}

export interface PendenciaObra {
  id: string;
  descricao: string;
  severidade: SeveridadePendencia;
  responsavel: string;
  status?: "aberta" | "em_tratativa" | "resolvida";
}

export interface MarcoPlanejamento {
  data: string; // ISO
  titulo: string;
}

export interface ResumoPlanejamentoMacroCard {
  key: string;
  label: string;
  valor: number | string;
  hint?: string;
}

export interface ResumoPlanejamentoMacro {
  resumo: ResumoPlanejamentoMacroCard[];
  marcos: MarcoPlanejamento[];
  atividades: AtividadePlanejada[];
  maoObra: RecursoPlanejado[];
  equipamentos: RecursoPlanejado[];
  materiais: RecursoPlanejado[];
  pendencias: PendenciaObra[];
  ordemDiaria: OrdemDiariaObra;
}
