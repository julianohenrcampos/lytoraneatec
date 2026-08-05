// FASE 6A — Mock tipado segundo o contrato ResumoPlanejamentoMacro.
// Nenhum acesso a banco. Substituir por dados reais somente em fases futuras.
// Datas internas em ISO YYYY-MM-DD. Formatação BR fica na UI.

import type {
  ResumoPlanejamentoMacro,
  ResumoPlanejamentoMacroCard,
  AtividadePlanejada,
  RecursoPlanejado,
  OrdemDiariaObra,
  PendenciaObra,
  MarcoPlanejamento,
} from "@/types/planejamentoMacro";

// Re-exports para compatibilidade com imports já existentes em components.
export type {
  ResumoPlanejamentoMacro,
  ResumoPlanejamentoMacroCard,
  AtividadePlanejada,
  RecursoPlanejado,
  OrdemDiariaObra,
  PendenciaObra,
  MarcoPlanejamento,
} from "@/types/planejamentoMacro";

// Aliases legados (mantêm imports antigos funcionando sem mudança visual).
export type ResumoCard = ResumoPlanejamentoMacroCard;
export type MockPlanejamento = ResumoPlanejamentoMacro;
export type MaoObraPrevista = RecursoPlanejado;
export type EquipamentoPrevisto = RecursoPlanejado;
export type MaterialPrevisto = RecursoPlanejado;
export type PendenciaItem = PendenciaObra;
export type OrdemDiariaPreview = OrdemDiariaObra;

function seed(ccId: string | undefined | null): number {
  if (!ccId) return 0;
  let h = 0;
  for (let i = 0; i < ccId.length; i++) h = (h * 31 + ccId.charCodeAt(i)) | 0;
  return Math.abs(h) % 7;
}

const hoje = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export function getMockByCentroCusto(ccId: string | null): ResumoPlanejamentoMacro {
  const s = seed(ccId);
  const ccRef = ccId ?? "mock-cc";

  const resumo: ResumoPlanejamentoMacroCard[] = [
    { key: "atividades", label: "Atividades planejadas", valor: 8 + s, hint: "Próximos 7 dias" },
    { key: "mao_obra", label: "Mão de obra prevista", valor: 24 + s * 2, hint: "Pessoas/dia" },
    { key: "equipamentos", label: "Equipamentos previstos", valor: 6 + (s % 3), hint: "Unidades" },
    { key: "solicitacoes", label: "Solicitações pendentes", valor: 2 + (s % 2), hint: "Aguardando aprovação" },
    { key: "impedimentos", label: "Impedimentos", valor: 1 + (s % 2), hint: "Em aberto" },
    { key: "producao", label: "Produção prevista (t)", valor: 480 + s * 35, hint: "CBUQ semana" },
  ];

  const marcos: MarcoPlanejamento[] = [
    { data: hoje(), titulo: "Início da fresagem trecho A" },
    { data: addDays(3), titulo: "Aplicação CBUQ pista sul" },
    { data: addDays(7), titulo: "Liberação para tráfego" },
  ];

  const atividades: AtividadePlanejada[] = [
    { id: "a1", nome: "Fresagem trecho A", frente: "Frente 1", inicio: hoje(), fim: addDays(2), status: "Em andamento" },
    { id: "a2", nome: "Imprimação", frente: "Frente 1", inicio: addDays(2), fim: addDays(3), status: "Planejada" },
    { id: "a3", nome: "Aplicação CBUQ", frente: "Frente 2", inicio: addDays(3), fim: addDays(5), status: "Planejada" },
    { id: "a4", nome: "Compactação final", frente: "Frente 2", inicio: addDays(5), fim: addDays(6), status: "Planejada" },
  ];

  const maoObra: RecursoPlanejado[] = [
    { id: "mo1", tipo: "mao_obra", descricao: "Encarregado", quantidade: 1, unidade: "pessoa", data_necessaria_inicio: hoje() },
    { id: "mo2", tipo: "mao_obra", descricao: "Rasteleiro", quantidade: 6, unidade: "pessoa", data_necessaria_inicio: hoje() },
    { id: "mo3", tipo: "mao_obra", descricao: "Operador de rolo", quantidade: 2, unidade: "pessoa", data_necessaria_inicio: hoje() },
    { id: "mo4", tipo: "mao_obra", descricao: "Servente", quantidade: 8, unidade: "pessoa", data_necessaria_inicio: addDays(1) },
    { id: "mo5", tipo: "mao_obra", descricao: "Operador de vibroacabadora", quantidade: 1, unidade: "pessoa", data_necessaria_inicio: addDays(3) },
  ];

  const equipamentos: RecursoPlanejado[] = [
    { id: "eq1", tipo: "equipamento", descricao: "Vibroacabadora", quantidade: 1, unidade: "un", data_necessaria_inicio: hoje(), data_necessaria_fim: addDays(5), status_origem: "Planejado" },
    { id: "eq2", tipo: "equipamento", descricao: "Rolo tandem", quantidade: 2, unidade: "un", data_necessaria_inicio: hoje(), data_necessaria_fim: addDays(5), status_origem: "Solicitado" },
    { id: "eq3", tipo: "equipamento", descricao: "Rolo pneu", quantidade: 1, unidade: "un", data_necessaria_inicio: addDays(1), data_necessaria_fim: addDays(5), status_origem: "Planejado" },
    { id: "eq4", tipo: "equipamento", descricao: "Caminhão pipa", quantidade: 1, unidade: "un", data_necessaria_inicio: hoje(), data_necessaria_fim: addDays(6), status_origem: "Aprovado" },
  ];

  const materiais: RecursoPlanejado[] = [
    { id: "mt1", tipo: "material", descricao: "CBUQ Faixa C", quantidade: 480 + s * 10, unidade: "t" },
    { id: "mt2", tipo: "material", descricao: "Emulsão RR-2C", quantidade: 3200, unidade: "L" },
    { id: "mt3", tipo: "material", descricao: "Brita 3/4", quantidade: 60, unidade: "m³" },
  ];

  const pendencias: PendenciaObra[] = [
    { id: "p1", descricao: "Liberação de faixa pela concessionária", severidade: "Alta", responsavel: "Engenharia" },
    { id: "p2", descricao: "Manutenção preventiva do rolo tandem", severidade: "Média", responsavel: "Mecânica" },
    { id: "p3", descricao: "Confirmar quantitativo de serventes", severidade: "Baixa", responsavel: "RH obra" },
  ];

  const ordemDiaria: OrdemDiariaObra = {
    id: `od-${ccRef}-${hoje()}`,
    centro_custo_id: ccRef,
    data: hoje(),
    status: "rascunho",
    frente: "Frente 1 — Estaca 0+000 a 0+800",
    equipe: ["1 Encarregado", "6 Rasteleiros", "2 Operadores de rolo"],
    equipamentos: ["Vibroacabadora VA-12", "Rolo Tandem RT-04", "Caminhão Pipa CP-09"],
    observacoes: "Verificar previsão de chuva às 14h. Iniciar com aplicação leste.",
  };

  return {
    resumo,
    marcos,
    atividades,
    maoObra,
    equipamentos,
    materiais,
    pendencias,
    ordemDiaria,
  };
}
