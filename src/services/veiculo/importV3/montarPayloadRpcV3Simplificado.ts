// PR-3.3 Fase C3 (Turn 2) — Payload builder para RPCs V3 SIMPLIFICADAS.
//
// Função PURA. Consome uma LinhaClassificadaSimplificada (do
// parseWorkbookV3Simplificado) + o mapa `_LISTAS` (resolve labels → IDs) e
// devolve o payload físico que vai literal para
//   fn_importador_ativos_inserir(p_payload)
//   fn_importador_ativos_atualizar(p_payload)
//
// Regras críticas:
//   - `campos_atualizar` vem EXCLUSIVAMENTE do diff automático do parser;
//     o usuário nunca fornece esses tokens.
//   - PROPRIETARIO envia sempre proprietario_regime + proprietario_cadastro_tipo
//     + proprietario_id_erp + proprietario_nome. XOR empresa/locadora é
//     resolvido dentro da RPC pelo cadastro_tipo.
//   - MODELO é texto livre (max 120 chars). Nunca envia modelo_id_erp.
//   - CAPACIDADE envia atomicamente {capacidade, capacidade_valor, capacidade_unidade}.
//   - ALUGUEL envia string canônica "1234.56" (parser já normalizou).
//   - Campos protegidos (frota, número, CC) NUNCA vão como tokens.

import type { LinhaClassificadaSimplificada } from './parseWorkbookV3Simplificado';
import type { ItemListaV3, ListasReferenciaV3 } from './carregarListasReferenciaV3';
import { parseCapacidade } from './capacidadeCanonica';
import { parseMoedaBR } from '@/utils/parseMoedaBR';
import { serializarTokensV3, TOKENS_ALLOWLIST, type TokenV3 } from './tokenPayloadMap';

export type AcaoRpcSimplificada = 'INSERIR' | 'ATUALIZAR';

export interface PayloadRpcV3Simplificado {
  acao: AcaoRpcSimplificada;
  // Identidade
  frota_codigo?: string;
  numero_frota?: string;
  codigo_canonico?: string;
  // Update
  equipamento_id_erp?: string;
  updated_at_origem?: string;
  campos_atualizar?: string;
  // Relacionais e valores
  subcategoria_id_erp?: string;
  subcategoria_nome?: string;
  linha_operacional_id_erp?: string;
  linha_operacional_codigo?: string;
  proprietario_regime?: 'PROPRIO' | 'LOCADO';
  proprietario_cadastro_tipo?: 'EMPRESA' | 'LOCADORA';
  proprietario_id_erp?: string;
  proprietario_nome?: string;
  centro_custo_codigo?: string;
  fabricante_id_erp?: string;
  fabricante_nome?: string;
  modelo?: string;
  ano_fabricacao?: string;
  placa?: string;
  chassi?: string;
  numero_serie?: string;
  renavam?: string;
  motor?: string;
  cor?: string;
  tipo_combustivel?: string;
  capacidade?: string;
  capacidade_valor?: string;
  capacidade_unidade?: string;
  aluguel?: string;
  departamento_id_erp?: string;
  departamento_nome?: string;
  observacoes?: string;
}

/** Índice por (tipo, valor_exibicao) → ItemListaV3 para resolução O(1). */
function indexarListas(listas: ListasReferenciaV3): Map<string, ItemListaV3> {
  const idx = new Map<string, ItemListaV3>();
  for (const it of listas.itens) {
    idx.set(`${it.tipo_catalogo}::${it.valor_exibicao}`, it);
  }
  return idx;
}

function txt(v: unknown): string { return String(v ?? '').trim(); }
function upperTxt(v: unknown): string { return txt(v).toUpperCase(); }

export interface MontarPayloadOpts {
  listas: ListasReferenciaV3;
}

/** Erro estruturado por linha (nunca lança — deixa o executor rejeitar). */
export interface PayloadErro {
  codigo: string;
  campo?: string;
  mensagem: string;
}

export interface MontarPayloadResult {
  payload: PayloadRpcV3Simplificado | null;
  erros: PayloadErro[];
  tokens: TokenV3[];
}

export function montarPayloadRpcV3Simplificado(
  linha: LinhaClassificadaSimplificada,
  opts: MontarPayloadOpts,
): MontarPayloadResult {
  const idx = indexarListas(opts.listas);
  const erros: PayloadErro[] = [];
  const raw = linha.raw as Record<string, unknown>;
  const c = linha.atual_canonico;

  const acao: AcaoRpcSimplificada | null =
    linha.acao === 'INSERIR' ? 'INSERIR' :
    linha.acao === 'ATUALIZAR' ? 'ATUALIZAR' : null;
  if (!acao) return { payload: null, erros: [{ codigo: 'ACAO_NAO_DESPACHAVEL', mensagem: `acao=${linha.acao} não vai para RPC` }], tokens: [] };

  // Resolve PROPRIETARIO (label → id + cadastro_tipo + regime)
  const propLabel = txt(raw['proprietario']);
  const propItem = propLabel ? idx.get(`PROPRIETARIO::${propLabel}`) : undefined;
  // Resolve SUBCATEGORIA
  const subLabel = txt(raw['subcategoria']);
  const subItem = subLabel ? idx.get(`SUBCATEGORIA::${subLabel}`) : undefined;
  // Resolve LINHA_OPERACIONAL
  const loLabel = txt(raw['linha_operacional']);
  const loItem = loLabel ? idx.get(`LINHA_OPERACIONAL::${loLabel}`) : undefined;
  // Resolve FABRICANTE
  const fabLabel = txt(raw['fabricante']);
  const fabItem = fabLabel ? idx.get(`FABRICANTE::${fabLabel}`) : undefined;
  // Resolve DEPARTAMENTO
  const depLabel = txt(raw['departamento']);
  const depItem = depLabel ? idx.get(`DEPARTAMENTO::${depLabel}`) : undefined;

  const cap = parseCapacidade(raw['capacidade']);
  if (cap.erro) erros.push({ codigo: cap.erro, campo: 'capacidade', mensagem: cap.texto || 'capacidade inválida' });
  const aluguelStr = raw['aluguel'] !== undefined && raw['aluguel'] !== null && String(raw['aluguel']).trim() !== ''
    ? parseMoedaBR(raw['aluguel']) : null;
  if (raw['aluguel'] && String(raw['aluguel']).trim() !== '' && aluguelStr === null) {
    erros.push({ codigo: 'ALUGUEL_INVALIDO', campo: 'aluguel', mensagem: `aluguel "${raw['aluguel']}" não normalizável` });
  }

  const p: PayloadRpcV3Simplificado = { acao };

  if (acao === 'INSERIR') {
    p.frota_codigo = upperTxt(raw['frota_codigo']);
    p.numero_frota = txt(raw['numero_frota']);
    p.codigo_canonico = linha.codigo_canonico;
    p.centro_custo_codigo = upperTxt(raw['centro_custo']);
    if (subItem) { p.subcategoria_id_erp = subItem.id_erp; p.subcategoria_nome = subItem.valor_exibicao; }
    else if (subLabel) erros.push({ codigo: 'SUBCATEGORIA_NAO_ENCONTRADA', campo: 'subcategoria', mensagem: `Subcategoria "${subLabel}" não encontrada em _LISTAS` });
    else erros.push({ codigo: 'SUBCATEGORIA_OBRIGATORIA', campo: 'subcategoria', mensagem: 'subcategoria obrigatória para INSERIR' });
    if (loItem) { p.linha_operacional_id_erp = loItem.id_erp; p.linha_operacional_codigo = loItem.codigo ?? loItem.valor_exibicao; }
    if (propItem) {
      const tipo = propItem.contexto === 'LOCADORA' ? 'LOCADORA' : 'EMPRESA';
      p.proprietario_regime = tipo === 'EMPRESA' ? 'PROPRIO' : 'LOCADO';
      p.proprietario_cadastro_tipo = tipo;
      p.proprietario_id_erp = propItem.id_erp;
      p.proprietario_nome = propItem.nome ?? propItem.valor_exibicao;
    } else if (propLabel) erros.push({ codigo: 'PROPRIETARIO_NAO_ENCONTRADO', campo: 'proprietario', mensagem: `Proprietário "${propLabel}" não encontrado em _LISTAS` });
    else erros.push({ codigo: 'PROPRIETARIO_OBRIGATORIO', campo: 'proprietario', mensagem: 'proprietário obrigatório para INSERIR' });
    if (fabItem) { p.fabricante_id_erp = fabItem.id_erp; p.fabricante_nome = fabItem.valor_exibicao; }
    if (depItem) { p.departamento_id_erp = depItem.id_erp; p.departamento_nome = depItem.valor_exibicao; }
  } else {
    // ATUALIZAR
    p.equipamento_id_erp = txt(raw['equipamento_id_erp']) || txt(linha.controle_ref);
    p.updated_at_origem = txt(raw['updated_at_origem']);
    p.codigo_canonico = linha.codigo_canonico;
    p.campos_atualizar = serializarTokensV3(linha.campos_atualizar as TokenV3[]);
    if (!p.equipamento_id_erp) erros.push({ codigo: 'EQUIPAMENTO_ID_OBRIGATORIO', mensagem: 'equipamento_id_erp ausente' });
    if (!p.updated_at_origem) erros.push({ codigo: 'UPDATED_AT_OBRIGATORIO', mensagem: 'updated_at_origem ausente' });
    if (!p.campos_atualizar) erros.push({ codigo: 'CAMPOS_ATUALIZAR_VAZIO', mensagem: 'nenhum token para atualizar' });
    // Anexa por token os campos requeridos pela RPC
    for (const tok of linha.campos_atualizar as TokenV3[]) {
      switch (tok) {
        case 'SUBCATEGORIA':
          if (subItem) { p.subcategoria_id_erp = subItem.id_erp; p.subcategoria_nome = subItem.valor_exibicao; }
          break;
        case 'LINHA_OPERACIONAL':
          if (loItem) { p.linha_operacional_id_erp = loItem.id_erp; p.linha_operacional_codigo = loItem.codigo ?? loItem.valor_exibicao; }
          break;
        case 'PROPRIETARIO':
          if (propItem) {
            const tipo = propItem.contexto === 'LOCADORA' ? 'LOCADORA' : 'EMPRESA';
            p.proprietario_regime = tipo === 'EMPRESA' ? 'PROPRIO' : 'LOCADO';
            p.proprietario_cadastro_tipo = tipo;
            p.proprietario_id_erp = propItem.id_erp;
            p.proprietario_nome = propItem.nome ?? propItem.valor_exibicao;
          }
          break;
        case 'FABRICANTE':
          if (fabItem) { p.fabricante_id_erp = fabItem.id_erp; p.fabricante_nome = fabItem.valor_exibicao; }
          break;
        case 'DEPARTAMENTO':
          if (depItem) { p.departamento_id_erp = depItem.id_erp; p.departamento_nome = depItem.valor_exibicao; }
          break;
        default: break;
      }
    }
  }

  // Campos comuns (INSERIR grava tudo; UPDATE só grava se token correspondente)
  const setSe = (chave: keyof PayloadRpcV3Simplificado, valor: string | undefined | null, token?: TokenV3) => {
    if (valor === undefined || valor === null || valor === '') return;
    if (acao === 'ATUALIZAR' && token && !(linha.campos_atualizar as TokenV3[]).includes(token)) return;
    (p as unknown as Record<string, unknown>)[chave as string] = valor;
  };

  setSe('modelo', txt(raw['modelo']) || undefined, 'MODELO');
  setSe('ano_fabricacao', txt(raw['ano_fabricacao']) || undefined, 'ANO_FABRICACAO');
  setSe('placa', upperTxt(raw['placa']) || undefined, 'PLACA');
  setSe('chassi', upperTxt(raw['chassi']) || undefined, 'CHASSI');
  setSe('numero_serie', upperTxt(raw['numero_serie']) || undefined, 'NUMERO_SERIE');
  setSe('renavam', txt(raw['renavam']) || undefined, 'RENAVAM');
  setSe('motor', txt(raw['motor']) || undefined, 'MOTOR');
  setSe('cor', txt(raw['cor']) || undefined, 'COR');
  setSe('tipo_combustivel', txt(raw['tipo_combustivel']) || undefined, 'TIPO_COMBUSTIVEL');
  setSe('observacoes', txt(raw['observacoes']) || undefined, 'OBSERVACOES');

  // CAPACIDADE — atomic trio
  if (!cap.erro && (cap.valor !== null || cap.unidade !== null)) {
    if (acao === 'INSERIR' || (linha.campos_atualizar as TokenV3[]).includes('CAPACIDADE')) {
      if (cap.valor !== null) p.capacidade_valor = String(cap.valor);
      if (cap.unidade) p.capacidade_unidade = cap.unidade;
      p.capacidade = cap.texto;
    }
  }

  // ALUGUEL — canônico
  if (aluguelStr !== null) {
    if (acao === 'INSERIR' || (linha.campos_atualizar as TokenV3[]).includes('ALUGUEL')) {
      p.aluguel = aluguelStr;
    }
  }

  // Validação final tokens fora da allowlist
  if (acao === 'ATUALIZAR') {
    for (const t of linha.campos_atualizar as string[]) {
      if (!(TOKENS_ALLOWLIST as readonly string[]).includes(t)) {
        erros.push({ codigo: 'TOKEN_FORA_ALLOWLIST', mensagem: `Token "${t}" fora da allowlist` });
      }
    }
  }

  return { payload: erros.length === 0 ? p : null, erros, tokens: linha.campos_atualizar as TokenV3[] };
}
