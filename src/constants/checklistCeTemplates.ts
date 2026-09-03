// AUTO-GERADO a partir de seed_checklist_ce_221_itens.csv (SHA-256 477223d0…5613e)
// 6 templates / 49 grupos / 221 itens. NÃO editar manualmente.

export const CHECKLIST_CE_SCHEMA_VERSAO = 1 as const;
export const CHECKLIST_CE_CSV_SHA256 = '477223d0ab58ae5a3879660bd3ea0a505cd59fa1924a0876b4f98c9fb205613e' as const;

export type ChecklistCeCriticidade = 'baixa' | 'media' | 'alta';

export interface ChecklistCeItemDef {
  codigo: string;
  descricao: string;
  ordem: number;
  obrigatorio: boolean;
  criticidade: ChecklistCeCriticidade;
  exigeFotoNaoOk: boolean;
}

export interface ChecklistCeGrupoDef {
  codigo: string;
  titulo: string;
  icone: string;
  ordem: number;
  itens: ChecklistCeItemDef[];
}

export interface ChecklistCeTemplateDef {
  codigo: ChecklistCeTemplateCodigo;
  nome: string;
  versao: number;
  grupos: ChecklistCeGrupoDef[];
}

export type ChecklistCeTemplateCodigo =
  | 'CE-ESCAVADEIRA-V1'
  | 'CE-RETRO-V1'
  | 'CE-CAMINHAO-BASC-V1'
  | 'CE-ROLO-V1'
  | 'CE-MOTONIVELADORA-V1'
  | 'CE-CAMINHAO-CABAUX-V1';

export const CHECKLIST_CE_TEMPLATE_CODIGOS: readonly ChecklistCeTemplateCodigo[] = [
  'CE-ESCAVADEIRA-V1',
  'CE-RETRO-V1',
  'CE-CAMINHAO-BASC-V1',
  'CE-ROLO-V1',
  'CE-MOTONIVELADORA-V1',
  'CE-CAMINHAO-CABAUX-V1',
] as const;

export const CHECKLIST_CE_TEMPLATES: Record<ChecklistCeTemplateCodigo, ChecklistCeTemplateDef> = {
  "CE-ESCAVADEIRA-V1": {
    codigo: "CE-ESCAVADEIRA-V1",
    nome: "Escavadeira Hidráulica",
    versao: 1,
    grupos: [
      {
        codigo: "motor",
        titulo: "MOTOR",
        icone: "motor",
        ordem: 1,
        itens: [
          { codigo: "motor_01", descricao: "Nível de óleo do motor", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_02", descricao: "Nível do líquido de arrefecimento", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_03", descricao: "Vazamentos de óleo ou combustível", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_04", descricao: "Estado das mangueiras e conexões", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_05", descricao: "Filtro de ar (restrição/condição)", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_06", descricao: "Cinto do alternador", ordem: 6, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "hidraulico",
        titulo: "SISTEMA HIDRÁULICO",
        icone: "hidraulico",
        ordem: 2,
        itens: [
          { codigo: "hidraulico_01", descricao: "Nível do óleo hidráulico", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_02", descricao: "Vazamentos no sistema hidráulico", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_03", descricao: "Mangueiras e conexões", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_04", descricao: "Cilindros (vazamentos/danos)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_05", descricao: "Estado dos engates e pinos", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "estrutura",
        titulo: "ESTRUTURA E COMPONENTES",
        icone: "estrutura",
        ordem: 3,
        itens: [
          { codigo: "estrutura_01", descricao: "Estado da caçamba (dentes e estrutura)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_02", descricao: "Articulação da lança, braço e caçamba", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_03", descricao: "Pinos e buchas (folgas anormais)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_04", descricao: "Rachaduras na estrutura", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_05", descricao: "Parafusos e fixações", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "rodagem",
        titulo: "RODAGEM",
        icone: "rodagem",
        ordem: 4,
        itens: [
          { codigo: "rodagem_01", descricao: "Sapatas, corrente e roletes", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rodagem_02", descricao: "Esticador da esteira", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rodagem_03", descricao: "Grau de desgaste da esteira", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rodagem_04", descricao: "Limpeza da rodagem", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rodagem_05", descricao: "Vazamentos nos motores de translação", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "eletrico",
        titulo: "ELÉTRICO",
        icone: "eletrico",
        ordem: 5,
        itens: [
          { codigo: "eletrico_01", descricao: "Bateria e terminais", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eletrico_02", descricao: "Fiação e conexões", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eletrico_03", descricao: "Luzes, faróis e lanternas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eletrico_04", descricao: "Buzina e alarme de ré", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eletrico_05", descricao: "Painel de instrumentos e indicadores", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "seguranca",
        titulo: "SEGURANÇA",
        icone: "seguranca",
        ordem: 6,
        itens: [
          { codigo: "seguranca_01", descricao: "Extintor de incêndio", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "seguranca_02", descricao: "Corrimãos e degraus", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "seguranca_03", descricao: "Cinto de segurança (condição)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "seguranca_04", descricao: "Espelhos retrovisores", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "seguranca_05", descricao: "Adesivos de segurança e identificação", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
    ],
  },
  "CE-RETRO-V1": {
    codigo: "CE-RETRO-V1",
    nome: "Retroescavadeira",
    versao: 1,
    grupos: [
      {
        codigo: "motor",
        titulo: "MOTOR",
        icone: "motor",
        ordem: 1,
        itens: [
          { codigo: "motor_01", descricao: "Nível de óleo do motor", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_02", descricao: "Nível do líquido de arrefecimento", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_03", descricao: "Vazamentos de óleo ou combustível", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_04", descricao: "Filtro de ar (restrição/condição)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_05", descricao: "Correias do motor (tensão/estado)", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_06", descricao: "Cinto do alternador", ordem: 6, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "hidraulico",
        titulo: "SISTEMA HIDRÁULICO",
        icone: "hidraulico",
        ordem: 2,
        itens: [
          { codigo: "hidraulico_01", descricao: "Nível do óleo hidráulico", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_02", descricao: "Vazamentos no sistema hidráulico", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_03", descricao: "Mangueiras, conexões e tubos", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_04", descricao: "Cilindros (vazamentos/danos)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_05", descricao: "Funcionamento das alavancas e comandos", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "carregadeira",
        titulo: "CARREGADEIRA DIANTEIRA",
        icone: "carregadeira",
        ordem: 3,
        itens: [
          { codigo: "carregadeira_01", descricao: "Caçamba (dentes, corte e estrutura)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carregadeira_02", descricao: "Braços, articulações e pinos", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carregadeira_03", descricao: "Cilindros de levantamento e basculamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carregadeira_04", descricao: "Pinos e buchas (folgas anormais)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carregadeira_05", descricao: "Trava de segurança da caçamba", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "retroescavadeira",
        titulo: "RETROESCAVADEIRA TRASEIRA",
        icone: "retroescavadeira",
        ordem: 4,
        itens: [
          { codigo: "retroescavadeira_01", descricao: "Caçamba (dentes, corte e estrutura)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "retroescavadeira_02", descricao: "Braço principal, secundário e articulações", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "retroescavadeira_03", descricao: "Cilindros da lança, braço e caçamba", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "retroescavadeira_04", descricao: "Pinos e buchas (folgas anormais)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "retroescavadeira_05", descricao: "Patolas estabilizadoras (estrutura e pinos)", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "pneus",
        titulo: "PNEUS E RODAS",
        icone: "pneus",
        ordem: 5,
        itens: [
          { codigo: "pneus_01", descricao: "Condição dos pneus (cortes, bolhas, desgaste)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_02", descricao: "Pressão dos pneus", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_03", descricao: "Aperto dos parafusos das rodas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_04", descricao: "Estepe e suporte", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "freios",
        titulo: "FREIOS",
        icone: "freios",
        ordem: 6,
        itens: [
          { codigo: "freios_01", descricao: "Nível do fluido de freio", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_02", descricao: "Funcionamento do freio de serviço", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_03", descricao: "Funcionamento do freio de estacionamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_04", descricao: "Desgaste das lonas/pastilhas", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "iluminacao",
        titulo: "ILUMINAÇÃO E SINALIZAÇÃO",
        icone: "iluminacao",
        ordem: 7,
        itens: [
          { codigo: "iluminacao_01", descricao: "Faróis (alto/baixo)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_02", descricao: "Luzes de posição, seta e freio", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_03", descricao: "Luzes de ré", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_04", descricao: "Pisca-alerta e buzina", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "cabine",
        titulo: "CABINE",
        icone: "cabine",
        ordem: 8,
        itens: [
          { codigo: "cabine_01", descricao: "Cinto de segurança", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_02", descricao: "Limpeza e organização", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_03", descricao: "Painel de instrumentos (alertas e indicadores)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_04", descricao: "Funcionamento de vidros e espelhos", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "geral",
        titulo: "GERAL",
        icone: "geral",
        ordem: 9,
        itens: [
          { codigo: "geral_01", descricao: "Vazamentos (óleo, combustível, ar)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_02", descricao: "Fixação de componentes e parafusos", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_03", descricao: "Protetores e para-choques", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_04", descricao: "Adesivos refletivos e faixas de segurança", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
    ],
  },
  "CE-CAMINHAO-BASC-V1": {
    codigo: "CE-CAMINHAO-BASC-V1",
    nome: "Caminhão Basculante",
    versao: 1,
    grupos: [
      {
        codigo: "motor",
        titulo: "MOTOR",
        icone: "motor",
        ordem: 1,
        itens: [
          { codigo: "motor_01", descricao: "Nível de óleo do motor", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_02", descricao: "Nível do líquido de arrefecimento", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_03", descricao: "Vazamentos de óleo ou combustível", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_04", descricao: "Filtro de ar (restrição/condição)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_05", descricao: "Cintos do alternador e ventilador", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "hidraulico",
        titulo: "SISTEMA HIDRÁULICO",
        icone: "hidraulico",
        ordem: 2,
        itens: [
          { codigo: "hidraulico_01", descricao: "Nível do óleo hidráulico", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_02", descricao: "Vazamentos no sistema hidráulico", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_03", descricao: "Mangueiras, conexões e cilindro do basculamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_04", descricao: "Funcionamento do basculamento", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "freios",
        titulo: "FREIOS",
        icone: "freios",
        ordem: 3,
        itens: [
          { codigo: "freios_01", descricao: "Nível do fluido de freio", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_02", descricao: "Funcionamento do freio de serviço", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_03", descricao: "Funcionamento do freio de estacionamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_04", descricao: "Desgaste das lonas/pastilhas", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "pneus",
        titulo: "PNEUS E RODAS",
        icone: "pneus",
        ordem: 4,
        itens: [
          { codigo: "pneus_01", descricao: "Condição dos pneus (cortes, bolhas, desgaste)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_02", descricao: "Pressão dos pneus", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_03", descricao: "Aperto dos parafusos das rodas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_04", descricao: "Estepe e suporte", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "iluminacao",
        titulo: "ILUMINAÇÃO E SINALIZAÇÃO",
        icone: "iluminacao",
        ordem: 5,
        itens: [
          { codigo: "iluminacao_01", descricao: "Faróis (alto/baixo)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_02", descricao: "Luzes de posição, seta e freio", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_03", descricao: "Luzes de ré", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_04", descricao: "Pisca-alerta e buzina", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "cacamba",
        titulo: "CAÇAMBA",
        icone: "cacamba",
        ordem: 6,
        itens: [
          { codigo: "cacamba_01", descricao: "Estrutura da caçamba (trincas, amassados)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cacamba_02", descricao: "Sistema de basculamento (articulações e pinos)", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cacamba_03", descricao: "Trava de segurança da caçamba", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cacamba_04", descricao: "Vedação da caçamba (laterais e traseira)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "cabine",
        titulo: "CABINE",
        icone: "cabine",
        ordem: 7,
        itens: [
          { codigo: "cabine_01", descricao: "Cinto de segurança", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_02", descricao: "Limpeza e organização", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_03", descricao: "Painel de instrumentos (alertas e indicadores)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_04", descricao: "Funcionamento de vidros e espelhos", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "geral",
        titulo: "GERAL",
        icone: "geral",
        ordem: 8,
        itens: [
          { codigo: "geral_01", descricao: "Vazamentos (óleo, combustível, ar)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_02", descricao: "Fixação de componentes e parafusos", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_03", descricao: "Protetores e para-choques", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_04", descricao: "Adesivos refletivos e faixas de segurança", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
    ],
  },
  "CE-ROLO-V1": {
    codigo: "CE-ROLO-V1",
    nome: "Rolo Compactador",
    versao: 1,
    grupos: [
      {
        codigo: "motor",
        titulo: "MOTOR",
        icone: "motor",
        ordem: 1,
        itens: [
          { codigo: "motor_01", descricao: "Nível de óleo do motor", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_02", descricao: "Nível do líquido de arrefecimento", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_03", descricao: "Vazamentos de óleo ou combustível", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_04", descricao: "Filtro de ar (restrição/condição)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_05", descricao: "Correias e mangueiras", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "hidraulico",
        titulo: "SISTEMA HIDRÁULICO",
        icone: "hidraulico",
        ordem: 2,
        itens: [
          { codigo: "hidraulico_01", descricao: "Nível do óleo hidráulico", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_02", descricao: "Vazamentos no sistema hidráulico", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_03", descricao: "Mangueiras, conexões e cilindros", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_04", descricao: "Funcionamento dos comandos hidráulicos", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_05", descricao: "Sistema de vibração (acionamento e funcionamento)", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "freios",
        titulo: "FREIOS",
        icone: "freios",
        ordem: 3,
        itens: [
          { codigo: "freios_01", descricao: "Nível do fluido de freio", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_02", descricao: "Funcionamento do freio de serviço", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_03", descricao: "Funcionamento do freio de estacionamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_04", descricao: "Desgaste das lonas/pastilhas", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "pneus",
        titulo: "PNEUS E RODAS",
        icone: "pneus",
        ordem: 4,
        itens: [
          { codigo: "pneus_01", descricao: "Condição dos pneus (cortes, bolhas, desgaste)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_02", descricao: "Pressão dos pneus", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_03", descricao: "Aperto dos parafusos das rodas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "iluminacao",
        titulo: "ILUMINAÇÃO E SINALIZAÇÃO",
        icone: "iluminacao",
        ordem: 5,
        itens: [
          { codigo: "iluminacao_01", descricao: "Faróis (alto/baixo)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_02", descricao: "Luzes de posição, seta e freio", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_03", descricao: "Luzes de ré", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_04", descricao: "Pisca-alerta e buzina", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "rolo",
        titulo: "ROLO E VIBRAÇÃO",
        icone: "rolo",
        ordem: 6,
        itens: [
          { codigo: "rolo_01", descricao: "Superfície do tambor (condição/limpeza)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rolo_02", descricao: "Sistema de aspersão (água)", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rolo_03", descricao: "Raspadores do tambor", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rolo_04", descricao: "Rolamentos e pontos de articulação", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "rolo_05", descricao: "Funcionamento do sistema de vibração", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "estrutura",
        titulo: "ESTRUTURA E SEGURANÇA",
        icone: "estrutura",
        ordem: 7,
        itens: [
          { codigo: "estrutura_01", descricao: "ROPS / Cabine (estrutura e fixação)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_02", descricao: "Cinto de segurança", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_03", descricao: "Espelhos retrovisores", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_04", descricao: "Corrimãos e degraus", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "estrutura_05", descricao: "Extintor de incêndio", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "geral",
        titulo: "GERAL",
        icone: "geral",
        ordem: 8,
        itens: [
          { codigo: "geral_01", descricao: "Painel de instrumentos (alertas e indicadores)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_02", descricao: "Funcionamento dos comandos", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_03", descricao: "Limpeza geral do equipamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_04", descricao: "Vazamentos (óleo, combustível, ar)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_05", descricao: "Fixação de componentes e parafusos", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_06", descricao: "Adesivos refletivos e faixas de segurança", ordem: 6, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
    ],
  },
  "CE-MOTONIVELADORA-V1": {
    codigo: "CE-MOTONIVELADORA-V1",
    nome: "Motoniveladora (Patrol)",
    versao: 1,
    grupos: [
      {
        codigo: "motor",
        titulo: "MOTOR",
        icone: "motor",
        ordem: 1,
        itens: [
          { codigo: "motor_01", descricao: "Nível de óleo do motor", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_02", descricao: "Nível do líquido de arrefecimento", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_03", descricao: "Vazamentos de óleo ou combustível", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_04", descricao: "Filtro de ar (restrição/condição)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_05", descricao: "Correias e mangueiras", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "hidraulico",
        titulo: "SISTEMA HIDRÁULICO",
        icone: "hidraulico",
        ordem: 2,
        itens: [
          { codigo: "hidraulico_01", descricao: "Nível do óleo hidráulico", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_02", descricao: "Vazamentos no sistema hidráulico", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_03", descricao: "Mangueiras, conexões e cilindros", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_04", descricao: "Funcionamento dos comandos hidráulicos", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_05", descricao: "Sistema de controle da lâmina (indicação e resposta)", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "freios",
        titulo: "FREIOS",
        icone: "freios",
        ordem: 3,
        itens: [
          { codigo: "freios_01", descricao: "Nível do fluido de freio", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_02", descricao: "Funcionamento do freio de serviço", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_03", descricao: "Funcionamento do freio de estacionamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_04", descricao: "Desgaste das lonas/pastilhas", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "pneus",
        titulo: "PNEUS E RODAS",
        icone: "pneus",
        ordem: 4,
        itens: [
          { codigo: "pneus_01", descricao: "Condição dos pneus (cortes, bolhas, desgaste)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_02", descricao: "Pressão dos pneus", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_03", descricao: "Aperto dos parafusos das rodas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "lamina",
        titulo: "LÂMINA E CÍRCULO",
        icone: "lamina",
        ordem: 5,
        itens: [
          { codigo: "lamina_01", descricao: "Condição da lâmina (corte, desgaste, parafusos)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "lamina_02", descricao: "Ajuste e fixação da lâmina", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "lamina_03", descricao: "Condição do círculo de giro (folgas, fixação)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "lamina_04", descricao: "Rolamentos do círculo", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "lamina_05", descricao: "Funcionamento da inclinação e deslocamento", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "iluminacao",
        titulo: "ILUMINAÇÃO E SINALIZAÇÃO",
        icone: "iluminacao",
        ordem: 6,
        itens: [
          { codigo: "iluminacao_01", descricao: "Faróis (alto/baixo)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_02", descricao: "Luzes de posição, seta e freio", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_03", descricao: "Luzes de ré", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_04", descricao: "Pisca-alerta e buzina", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "direcao",
        titulo: "DIREÇÃO",
        icone: "direcao",
        ordem: 7,
        itens: [
          { codigo: "direcao_01", descricao: "Funcionamento da direção", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "direcao_02", descricao: "Vazamentos no sistema de direção", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "direcao_03", descricao: "Folgas e articulação (estrutura e pinos)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "eixos",
        titulo: "ESTRUTURA E EIXOS",
        icone: "eixos",
        ordem: 8,
        itens: [
          { codigo: "eixos_01", descricao: "Condição do chassi e soldas", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eixos_02", descricao: "Fixação de componentes e parafusos", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eixos_03", descricao: "Pinos, buchas e articulações (desgaste/folga)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "eixos_04", descricao: "Eixos dianteiro e traseiro (vazamentos/folgas)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "cabine",
        titulo: "CABINE",
        icone: "cabine",
        ordem: 9,
        itens: [
          { codigo: "cabine_01", descricao: "Cinto de segurança", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_02", descricao: "Limpeza e organização", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_03", descricao: "Painel de instrumentos (alertas e indicadores)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_04", descricao: "Funcionamento de vidros, espelhos e limpadores", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "geral",
        titulo: "GERAL",
        icone: "geral",
        ordem: 10,
        itens: [
          { codigo: "geral_01", descricao: "Vazamentos (óleo, combustível, ar)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_02", descricao: "Fixação de componentes e parafusos", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_03", descricao: "Protetores e para-choques", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_04", descricao: "Adesivos refletivos e faixas de segurança", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_05", descricao: "Extintor de incêndio", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
    ],
  },
  "CE-CAMINHAO-CABAUX-V1": {
    codigo: "CE-CAMINHAO-CABAUX-V1",
    nome: "Caminhão Cabine Auxiliar",
    versao: 1,
    grupos: [
      {
        codigo: "motor",
        titulo: "MOTOR",
        icone: "motor",
        ordem: 1,
        itens: [
          { codigo: "motor_01", descricao: "Nível de óleo do motor", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_02", descricao: "Nível do líquido de arrefecimento", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_03", descricao: "Vazamentos de óleo ou combustível", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_04", descricao: "Filtro de ar (restrição/condição)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "motor_05", descricao: "Correias e mangueiras", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "hidraulico",
        titulo: "SISTEMA HIDRÁULICO",
        icone: "hidraulico",
        ordem: 2,
        itens: [
          { codigo: "hidraulico_01", descricao: "Nível do óleo hidráulico (se aplicável)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_02", descricao: "Vazamentos no sistema hidráulico", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_03", descricao: "Mangueiras, conexões e cilindros", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "hidraulico_04", descricao: "Funcionamento de implementos (se aplicável)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "freios",
        titulo: "FREIOS",
        icone: "freios",
        ordem: 3,
        itens: [
          { codigo: "freios_01", descricao: "Nível do fluido de freio", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_02", descricao: "Funcionamento do freio de serviço", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_03", descricao: "Funcionamento do freio de estacionamento", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "freios_04", descricao: "Desgaste das lonas/pastilhas", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "pneus",
        titulo: "PNEUS E RODAS",
        icone: "pneus",
        ordem: 4,
        itens: [
          { codigo: "pneus_01", descricao: "Condição dos pneus (cortes, bolhas, desgaste)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_02", descricao: "Pressão dos pneus", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_03", descricao: "Aperto dos parafusos das rodas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "pneus_04", descricao: "Estepe e suporte", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "iluminacao",
        titulo: "ILUMINAÇÃO E SINALIZAÇÃO",
        icone: "iluminacao",
        ordem: 5,
        itens: [
          { codigo: "iluminacao_01", descricao: "Faróis (alto/baixo)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_02", descricao: "Luzes de posição, seta e freio", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_03", descricao: "Luzes de ré", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_04", descricao: "Pisca-alerta, buzina e giroflex (se aplicável)", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "iluminacao_05", descricao: "Refletores e faixas de segurança", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "cabine",
        titulo: "CABINE E CABINE AUXILIAR",
        icone: "cabine",
        ordem: 6,
        itens: [
          { codigo: "cabine_01", descricao: "Cinto de segurança (motorista e passageiros)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_02", descricao: "Limpeza e organização", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_03", descricao: "Painel de instrumentos (alertas e indicadores)", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_04", descricao: "Espelhos retrovisores", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "cabine_05", descricao: "Funcionamento de vidros e travas", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "carroceria",
        titulo: "CARROCERIA E CAÇAMBA",
        icone: "carroceria",
        ordem: 7,
        itens: [
          { codigo: "carroceria_01", descricao: "Estrutura da caçamba/carroceria (trincas, amassados)", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carroceria_02", descricao: "Sistema de basculamento/trava (se aplicável)", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carroceria_03", descricao: "Tampa traseira, laterais e travas", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "carroceria_04", descricao: "Condição geral da carroceria", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
      {
        codigo: "geral",
        titulo: "GERAL",
        icone: "geral",
        ordem: 8,
        itens: [
          { codigo: "geral_01", descricao: "Documentação do veículo/porte obrigatório", ordem: 1, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_02", descricao: "Extintor de incêndio", ordem: 2, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_03", descricao: "Triângulo de sinalização e cones", ordem: 3, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_04", descricao: "Macaco, chave de roda e ferramentas", ordem: 4, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_05", descricao: "Adesivos refletivos e faixas de segurança", ordem: 5, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
          { codigo: "geral_06", descricao: "Limpeza geral do equipamento", ordem: 6, obrigatorio: true, criticidade: "media", exigeFotoNaoOk: false },
        ],
      },
    ],
  },
};

// Mapa subcategoria_ativo_id → template_codigo (15 UUIDs auditados em bd_subcategorias_ativos)
export const SUBCATEGORIA_TO_TEMPLATE: Record<string, ChecklistCeTemplateCodigo> = {
  "0fbca844-b069-4da0-91b6-b6563940116d": "CE-ESCAVADEIRA-V1", // ESCAVADEIRA HIDRAULICA
  "b3468354-71df-496c-be0e-3ee3d69d413a": "CE-ESCAVADEIRA-V1", // ESCAVADEIRA HIDRAULICA LONG REACH
  "c407e9b4-15a3-4732-833b-a2e62da641fd": "CE-ESCAVADEIRA-V1", // ESCAVADEIRA ANFÍBIA
  "1177d077-4340-48e7-a651-b6923d423c5b": "CE-RETRO-V1", // RETROESCAVADEIRA
  "cee49223-d1f4-42cb-a092-59473ae719f9": "CE-CAMINHAO-BASC-V1", // CAMINHÃO BASCULANTE
  "c0f5f5c5-e117-4c60-a1ea-3a88abf43725": "CE-CAMINHAO-BASC-V1", // CAMINHÃO BASCULANTE TRAÇADO
  "5f6ed89a-972a-4168-903f-8768c2da3c51": "CE-CAMINHAO-BASC-V1", // CAMINHÃO BASCULANTE TRUCK
  "6a58912a-1a6b-4251-b192-56503d6423eb": "CE-ROLO-V1", // ROLO COMPACTADOR COMBINADO
  "faf5ee95-884a-4d8c-a072-64f9afc3de18": "CE-ROLO-V1", // ROLO COMPACTADOR TANDEM
  "81df7e70-28a6-4b33-8903-96281a6a8e3d": "CE-ROLO-V1", // ROLO PNEUMATICO
  "7bc3daa3-3ff2-4be3-ae5e-73a58692e915": "CE-ROLO-V1", // ROLO PNEUMÁTICO
  "3631ceae-e90e-4fef-8bad-f6aaf13e3ba6": "CE-MOTONIVELADORA-V1", // MOTONIVELADORA (Patrol)
  "280723c8-8bc9-4348-8453-890570d87e99": "CE-CAMINHAO-CABAUX-V1", // CAMINHÃO BASCULANTE/CABINE AUX
  "ea5176c0-67c2-44c8-bf4e-37c496f95f4c": "CE-CAMINHAO-CABAUX-V1", // CAMINHÃO CARROCERIA C/ CAB AUXILIAR
  "7fe91d65-fc6f-4ed8-8ef7-87dea69c79b2": "CE-CAMINHAO-CABAUX-V1", // CAMINHÃO TOCO CARROCERIA CAB AUX
};

export function resolveTemplateCE(subcategoriaId?: string | null): ChecklistCeTemplateDef | null {
  if (!subcategoriaId) return null;
  const code = SUBCATEGORIA_TO_TEMPLATE[subcategoriaId];
  return code ? CHECKLIST_CE_TEMPLATES[code] : null;
}

export function listItemCodigosOficiais(templateCodigo: string): string[] {
  const t = CHECKLIST_CE_TEMPLATES[templateCodigo as ChecklistCeTemplateCodigo];
  if (!t) return [];
  return t.grupos.flatMap((g) => g.itens.map((i) => i.codigo));
}
