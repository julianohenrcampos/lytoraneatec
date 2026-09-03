// PR-1.1 V3 — Zod discriminado por `acao`. Aceita TOKENS lógicos em campos_atualizar.
// Nomes físicos de colunas em campos_atualizar são REJEITADOS.

import { z } from 'zod';
import {
  ACOES_ARQUIVO,
  PROPRIETARIO_REGIMES,
  PROPRIETARIO_CADASTRO_TIPOS,
  CAPACIDADE_UNIDADES,
} from './constants';
import { parseCamposAtualizar } from './equipamentosImportExportSchema';

const trimOrNull = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const zStr = z.preprocess(trimOrNull, z.string().nullable());
const zStrReq = z.preprocess(trimOrNull, z.string().min(1));
const zUuid = z.preprocess(trimOrNull, z.string().uuid().nullable());
const zUuidReq = z.preprocess(trimOrNull, z.string().uuid());

const REGEX_FROTA = /^[A-Z]{2,4}$/;
const REGEX_NUM_FROTA = /^\d{1,6}$/;
const REGEX_CANONICO = /^[A-Z]{2,4}\d{1,6}$/;

const zFrotaCodigo = z.preprocess(
  (v) => (v === null || v === undefined ? null : String(v).trim().toUpperCase() || null),
  z.string().regex(REGEX_FROTA, 'frota_codigo deve ter 2-4 letras maiúsculas'),
);
const zNumeroFrota = z.preprocess(
  (v) => {
    const s = trimOrNull(v);
    if (s === null) return null;
    const canonico = s.replace(/^0+/, '') || '0';
    return canonico;
  },
  z.string().regex(REGEX_NUM_FROTA, 'numero_frota deve ter 1-6 dígitos'),
);
const zCanonico = z.preprocess(
  (v) => (v === null || v === undefined ? null : String(v).trim().toUpperCase() || null),
  z.string().regex(REGEX_CANONICO, 'codigo_canonico inválido'),
);

const zIsoDatetime = z.preprocess(
  trimOrNull,
  z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'updated_at_origem deve ser ISO datetime'),
);

const zRegime = z.preprocess(
  (v) => (v === null || v === undefined ? null : String(v).trim().toUpperCase() || null),
  z.enum(PROPRIETARIO_REGIMES),
);
const zCadastroTipo = z.preprocess(
  (v) => (v === null || v === undefined ? null : String(v).trim().toUpperCase() || null),
  z.enum(PROPRIETARIO_CADASTRO_TIPOS),
);
// Variantes opcionais: empty → undefined → passa como .optional() sem erro de enum.
const zRegimeOpt = z.preprocess(
  (v) => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s === '' ? undefined : s.toUpperCase();
  },
  z.enum(PROPRIETARIO_REGIMES).optional(),
);
const zCadastroTipoOpt = z.preprocess(
  (v) => {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s === '' ? undefined : s.toUpperCase();
  },
  z.enum(PROPRIETARIO_CADASTRO_TIPOS).optional(),
);
const zCapacidadeUnidade = z.preprocess(
  (v) => {
    const s = trimOrNull(v);
    return s === null ? null : s.toLowerCase();
  },
  z.enum(CAPACIDADE_UNIDADES).nullable(),
);
const zNumero = z.preprocess(
  (v) => {
    const s = trimOrNull(v);
    if (s === null) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : Number.NaN;
  },
  z.number().nullable(),
);

const camposEditaveis = {
  frota_codigo: zFrotaCodigo.optional(),
  numero_frota: zNumeroFrota.optional(),
  codigo_exibicao: zStr.optional(),

  subcategoria_id_erp: zUuid.optional(),
  subcategoria_nome: zStr.optional(),
  categoria_id_erp: zUuid.optional(),
  categoria_nome: zStr.optional(),
  linha_operacional_id_erp: zUuid.optional(),
  linha_operacional_codigo: zStr.optional(),

  proprietario_regime: zRegimeOpt,
  proprietario_cadastro_tipo: zCadastroTipoOpt,
  proprietario_id_erp: zUuid.optional(),
  proprietario_nome: zStr.optional(),

  centro_custo_codigo: zStr.optional(),
  centro_custo_nome: zStr.optional(),

  fabricante_id_erp: zUuid.optional(),
  fabricante_nome: zStr.optional(),
  modelo_id_erp: zUuid.optional(),
  modelo_nome: zStr.optional(),
  motor: zStr.optional(),
  ano_fabricacao: zStr.optional(),
  placa: zStr.optional(),
  chassi: zStr.optional(),
  numero_serie: zStr.optional(),
  renavam: zStr.optional(),
  cor: zStr.optional(),
  tipo_combustivel: zStr.optional(),
  capacidade_valor: zNumero.optional(),
  capacidade_unidade: zCapacidadeUnidade.optional(),
  aluguel: zNumero.optional(),
  departamento_id_erp: zUuid.optional(),
  departamento_nome: zStr.optional(),
  observacoes: zStr.optional(),

  situacao_atual: zStr.optional(),
  status_cadastro_atual: zStr.optional(),
  status_disponibilidade_atual: zStr.optional(),
} as const;

const baseControle = {
  equipamento_id_erp: zUuid.optional(),
  updated_at_origem: zStr.optional(),
  codigo_canonico: zStr.optional(),
  campos_atualizar: zStr.optional(),
};

const zInserir = z.object({
  acao: z.literal('INSERIR'),
  ...baseControle,
  ...camposEditaveis,
  frota_codigo: zFrotaCodigo,
  numero_frota: zNumeroFrota,
  subcategoria_id_erp: zUuidReq,
  proprietario_regime: zRegime,
  proprietario_cadastro_tipo: zCadastroTipo,
  proprietario_id_erp: zUuidReq,
  centro_custo_codigo: zStrReq,
});

const zAtualizar = z.object({
  acao: z.literal('ATUALIZAR'),
  ...baseControle,
  ...camposEditaveis,
  equipamento_id_erp: zUuidReq,
  updated_at_origem: zIsoDatetime,
  codigo_canonico: zCanonico,
  campos_atualizar: zStrReq,
});

const zSemAlteracao = z.object({
  acao: z.literal('SEM_ALTERACAO'),
  ...baseControle,
  ...camposEditaveis,
  equipamento_id_erp: zUuidReq,
  updated_at_origem: zIsoDatetime,
  codigo_canonico: zCanonico,
});

export const equipamentoRowSchema = z.discriminatedUnion('acao', [
  zInserir,
  zAtualizar,
  zSemAlteracao,
]).superRefine((row, ctx) => {
  if (row.acao !== 'ATUALIZAR') return;

  const parsed = parseCamposAtualizar(String(row.campos_atualizar));
  if (parsed.erro) {
    ctx.addIssue({ code: 'custom', message: parsed.erro, path: ['campos_atualizar'] });
    return;
  }

  const tokens = new Set(parsed.tokens);

  // Requisitos por token: SUBCATEGORIA/PROPRIETARIO/FABRICANTE/MODELO exigem ID+nome.
  if (tokens.has('SUBCATEGORIA')) {
    if (!row.subcategoria_id_erp) ctx.addIssue({ code: 'custom', path: ['subcategoria_id_erp'],
      message: 'SUBCATEGORIA exige subcategoria_id_erp.' });
    if (!row.subcategoria_nome)   ctx.addIssue({ code: 'custom', path: ['subcategoria_nome'],
      message: 'SUBCATEGORIA exige subcategoria_nome.' });
  }
  if (tokens.has('FABRICANTE')) {
    if (!row.fabricante_id_erp) ctx.addIssue({ code: 'custom', path: ['fabricante_id_erp'],
      message: 'FABRICANTE exige fabricante_id_erp.' });
    if (!row.fabricante_nome)   ctx.addIssue({ code: 'custom', path: ['fabricante_nome'],
      message: 'FABRICANTE exige fabricante_nome.' });
  }
  if (tokens.has('MODELO')) {
    // MODELO isolado é permitido; validação de compatibilidade contra fabricante
    // final é feita no parser (usa aba LISTAS). Aqui só exigimos ID+nome.
    if (!row.modelo_id_erp) ctx.addIssue({ code: 'custom', path: ['modelo_id_erp'],
      message: 'MODELO exige modelo_id_erp.' });
    if (!row.modelo_nome)   ctx.addIssue({ code: 'custom', path: ['modelo_nome'],
      message: 'MODELO exige modelo_nome.' });
  }
  if (tokens.has('PROPRIETARIO')) {
    if (!row.proprietario_regime)        ctx.addIssue({ code: 'custom', path: ['proprietario_regime'],        message: 'PROPRIETARIO exige proprietario_regime.' });
    if (!row.proprietario_cadastro_tipo) ctx.addIssue({ code: 'custom', path: ['proprietario_cadastro_tipo'], message: 'PROPRIETARIO exige proprietario_cadastro_tipo.' });
    if (!row.proprietario_id_erp)        ctx.addIssue({ code: 'custom', path: ['proprietario_id_erp'],        message: 'PROPRIETARIO exige proprietario_id_erp.' });
    if (!row.proprietario_nome)          ctx.addIssue({ code: 'custom', path: ['proprietario_nome'],          message: 'PROPRIETARIO exige proprietario_nome.' });
  }
  if (tokens.has('CAPACIDADE')) {
    if (row.capacidade_valor === undefined || row.capacidade_valor === null)
      ctx.addIssue({ code: 'custom', path: ['capacidade_valor'], message: 'CAPACIDADE exige capacidade_valor.' });
    if (!row.capacidade_unidade)
      ctx.addIssue({ code: 'custom', path: ['capacidade_unidade'], message: 'CAPACIDADE exige capacidade_unidade.' });
  }
});

export type EquipamentoRowV3 = z.infer<typeof equipamentoRowSchema>;
export type EquipamentoAcao = EquipamentoRowV3['acao'];
