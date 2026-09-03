/**
 * CT-3E — Templates dos checklists de SAÍDA da Central do Transporte.
 *
 * Reaproveitam a mesma estrutura de item do checklist de C&E (código, descrição,
 * obrigatoriedade, criticidade, exigência de foto em não conformidade), de modo
 * que a renderização e as regras de validação sejam idênticas.
 */
import type { ChecklistCeGrupoDef } from "@/constants/checklistCeTemplates";

export type CtChecklistTemplateCodigo = "CT-TRANSPORTADOR-V1" | "CT-CARGA-V1";

export interface CtChecklistTemplateDef {
  codigo: CtChecklistTemplateCodigo;
  nome: string;
  versao: number;
  grupos: ChecklistCeGrupoDef[];
}

const item = (
  codigo: string,
  descricao: string,
  ordem: number,
  opts?: { obrigatorio?: boolean; criticidade?: "baixa" | "media" | "alta"; foto?: boolean },
) => ({
  codigo,
  descricao,
  ordem,
  obrigatorio: opts?.obrigatorio ?? true,
  criticidade: opts?.criticidade ?? "media",
  exigeFotoNaoOk: opts?.foto ?? true,
});

export const CT_CHECKLIST_TEMPLATES: Record<CtChecklistTemplateCodigo, CtChecklistTemplateDef> = {
  "CT-TRANSPORTADOR-V1": {
    codigo: "CT-TRANSPORTADOR-V1",
    nome: "Checklist do transportador (prancha/carreta)",
    versao: 1,
    grupos: [
      {
        codigo: "documentacao",
        titulo: "DOCUMENTAÇÃO",
        icone: "documentacao",
        ordem: 1,
        itens: [
          item("doc_crlv", "CRLV do conjunto dentro da validade", 1, { criticidade: "alta" }),
          item("doc_cnh", "CNH do motorista compatível com a categoria", 2, {
            criticidade: "alta",
          }),
          item("doc_aet", "AET / autorização de transporte especial quando aplicável", 3, {
            obrigatorio: false,
          }),
        ],
      },
      {
        codigo: "conjunto",
        titulo: "CONJUNTO TRANSPORTADOR",
        icone: "estrutura",
        ordem: 2,
        itens: [
          item("cj_pneus", "Pneus do cavalo e da prancha em condição de uso", 1, {
            criticidade: "alta",
          }),
          item("cj_freios", "Sistema de freios sem vazamento aparente", 2, { criticidade: "alta" }),
          item("cj_luzes", "Iluminação, setas e luz de freio funcionando", 3),
          item("cj_rampas", "Rampas / plataforma sem trincas e travadas", 4),
          item("cj_quinta_roda", "Quinta roda e pino-rei travados", 5, { criticidade: "alta" }),
        ],
      },
      {
        codigo: "amarracao",
        titulo: "AMARRAÇÃO E SEGURANÇA",
        icone: "seguranca",
        ordem: 3,
        itens: [
          item("am_cintas", "Cintas / correntes suficientes e sem desgaste crítico", 1, {
            criticidade: "alta",
          }),
          item("am_calcos", "Calços e cunhas disponíveis", 2),
          item("am_sinalizacao", "Sinalização de carga (bandeirolas / placas)", 3),
          item("am_epi", "EPIs do motorista disponíveis", 4),
          item("am_extintor", "Extintor válido e acessível", 5),
        ],
      },
    ],
  },
  "CT-CARGA-V1": {
    codigo: "CT-CARGA-V1",
    nome: "Checklist do ativo transportado",
    versao: 1,
    grupos: [
      {
        codigo: "identificacao",
        titulo: "IDENTIFICAÇÃO E ESTADO",
        icone: "identificacao",
        ordem: 1,
        itens: [
          item("id_confere", "Frota / placa conferem com a ordem de mobilização", 1, {
            criticidade: "alta",
          }),
          item("id_estrutura", "Estrutura sem avarias novas (registrar se houver)", 2, {
            criticidade: "alta",
          }),
          item("id_vidros", "Vidros, espelhos e lanternas íntegros", 3),
          item("id_vazamentos", "Sem vazamento de óleo, combustível ou fluido", 4, {
            criticidade: "alta",
          }),
          item("id_horimetro", "Horímetro / odômetro registrado antes da saída", 5),
        ],
      },
      {
        codigo: "acessorios",
        titulo: "ACESSÓRIOS E IMPLEMENTOS",
        icone: "implementos",
        ordem: 2,
        itens: [
          item("ac_implementos", "Implementos e ferramentas acompanham o ativo", 1),
          item("ac_bateria", "Bateria e chaves entregues ao transportador", 2, {
            obrigatorio: false,
          }),
          item("ac_manual", "Documentos / manual do equipamento", 3, { obrigatorio: false }),
        ],
      },
      {
        codigo: "preparo",
        titulo: "PREPARO PARA O TRANSPORTE",
        icone: "transporte",
        ordem: 3,
        itens: [
          item("pr_travas", "Travas de transporte acionadas", 1, { criticidade: "alta" }),
          item("pr_amarrado", "Ativo amarrado e calçado sobre a prancha", 2, {
            criticidade: "alta",
          }),
          item("pr_combustivel", "Nível de combustível compatível com o deslocamento", 3, {
            obrigatorio: false,
          }),
          item("pr_fotos", "Registro fotográfico do ativo antes da saída", 4),
        ],
      },
    ],
  },
};

export const ctChecklistTodosItens = (codigo: CtChecklistTemplateCodigo) =>
  CT_CHECKLIST_TEMPLATES[codigo].grupos.flatMap((g) => g.itens);
