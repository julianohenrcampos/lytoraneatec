// PR-3.3 Fase C2 — Testes do GERADOR ExcelJS V3 simplificado + parser + rejeição do 41-col.
import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  gerarWorkbookV3Simplificado,
  montarSnapshotCanonicoJson,
  ABA_EQUIPAMENTOS_V3S, ABA_LISTAS_V3S, ABA_CONTROLE_V3S, ABA_METADADOS_V3S, ABA_INSTRUCOES_V3S,
  NOME_TABELA_EQUIPAMENTOS,
  type RegistroExportacaoSimplificado,
} from '../gerarWorkbookV3Simplificado';
import { parseWorkbookV3Simplificado } from '../parseWorkbookV3Simplificado';
import { calcularArquivoSha256LogicoV3 } from '../sha256LogicoV3';
import type { ListasReferenciaV3, ItemListaV3 } from '../carregarListasReferenciaV3';

function it0(v: ItemListaV3): ItemListaV3 { return v; }

function listasFake(): ListasReferenciaV3 {
  const itens: ItemListaV3[] = [
    it0({ tipo_catalogo: 'FROTA', id_erp: 'f1', valor_exibicao: 'CB', codigo: 'CB', nome: 'Caminhão Basculante',
      parent_id_erp: null, ativo: true, vinculado_atualmente: false, contexto: null }),
    it0({ tipo_catalogo: 'FROTA', id_erp: 'f2', valor_exibicao: 'CA', codigo: 'CA', nome: 'Cavalo Mecânico',
      parent_id_erp: null, ativo: true, vinculado_atualmente: true, contexto: null }),
    it0({ tipo_catalogo: 'SUBCATEGORIA', id_erp: 's1', valor_exibicao: 'BASCULANTE', codigo: null, nome: 'BASCULANTE',
      parent_id_erp: 'cat1', ativo: true, vinculado_atualmente: false, contexto: null }),
    it0({ tipo_catalogo: 'CENTRO_CUSTO', id_erp: 'c1', valor_exibicao: 'CC-100', codigo: 'CC-100', nome: 'Obra Alfa',
      parent_id_erp: null, ativo: true, vinculado_atualmente: true, contexto: null }),
    it0({ tipo_catalogo: 'PROPRIETARIO', id_erp: 'p1', valor_exibicao: 'LYTORÂNEA SA', codigo: null,
      nome: 'LYTORÂNEA SA', parent_id_erp: null, ativo: true, vinculado_atualmente: true, contexto: 'EMPRESA' }),
    it0({ tipo_catalogo: 'FABRICANTE', id_erp: 'fa1', valor_exibicao: 'VOLVO', codigo: null, nome: 'VOLVO',
      parent_id_erp: null, ativo: true, vinculado_atualmente: false, contexto: null }),
    it0({ tipo_catalogo: 'DEPARTAMENTO', id_erp: 'd1', valor_exibicao: 'PAVIMENTAÇÃO', codigo: null,
      nome: 'PAVIMENTAÇÃO', parent_id_erp: null, ativo: true, vinculado_atualmente: false, contexto: null }),
    it0({ tipo_catalogo: 'LINHA_OPERACIONAL', id_erp: 'l1', valor_exibicao: 'PAV-01', codigo: 'PAV-01',
      nome: 'Frente Pav 01', parent_id_erp: null, ativo: true, vinculado_atualmente: false, contexto: null }),
  ];
  const por_tipo = {
    FROTA: [], SUBCATEGORIA: [], LINHA_OPERACIONAL: [], CENTRO_CUSTO: [],
    FABRICANTE: [], DEPARTAMENTO: [], PROPRIETARIO: [],
  } as Record<ItemListaV3['tipo_catalogo'], ItemListaV3[]>;
  for (const i of itens) por_tipo[i.tipo_catalogo].push(i);
  return { itens, por_tipo };
}

function registroFake(over: Partial<RegistroExportacaoSimplificado> = {}): RegistroExportacaoSimplificado {
  const linhaCanon = {
    frota_codigo: 'CA', numero_frota: '15', subcategoria: 'BASCULANTE', linha_operacional: '',
    proprietario: 'LYTORÂNEA SA', centro_custo: 'CC-100', fabricante: 'VOLVO', modelo: 'fh 540',
    ano_fabricacao: '2022', placa: 'ABC1D23', chassi: '9BW111', numero_serie: '', renavam: '1234567',
    motor: 'D13', cor: 'branco', tipo_combustivel: 'Diesel S10', capacidade: '28 t', aluguel: '',
    departamento: 'PAVIMENTAÇÃO', observacoes: '',
  };
  const snap = montarSnapshotCanonicoJson(linhaCanon);
  return {
    _controle_ref: 'ctrl-001', equipamento_id_erp: 'erp-001',
    updated_at_origem: '2026-07-01T00:00:00Z', codigo_canonico: 'CA15',
    snapshot_original_json: snap,
    ...linhaCanon, ...over,
  };
}

describe('gerarWorkbookV3Simplificado', () => {
  it('emite arquivo com 5 abas e visibilidade correta', async () => {
    const listas = listasFake();
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'MODELO', linhas: [] });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'MODELO', listas, arquivo_sha256_logico: sha,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    expect(wb.getWorksheet(ABA_EQUIPAMENTOS_V3S)?.state).toBe('visible');
    expect(wb.getWorksheet(ABA_INSTRUCOES_V3S)?.state).toBe('visible');
    expect(wb.getWorksheet(ABA_LISTAS_V3S)?.state).toBe('hidden');
    expect(wb.getWorksheet(ABA_CONTROLE_V3S)?.state).toBe('hidden');
    expect(wb.getWorksheet(ABA_METADADOS_V3S)?.state).toBe('hidden');
  });

  it('EQUIPAMENTOS tem 21 colunas e a 21ª (_controle_ref) fica hidden', async () => {
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'MODELO', linhas: [] });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'MODELO', listas: listasFake(), arquivo_sha256_logico: sha,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const ws = wb.getWorksheet(ABA_EQUIPAMENTOS_V3S)!;
    const headers: string[] = [];
    ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { headers[col - 1] = String(c.value ?? ''); });
    expect(headers.length).toBeGreaterThanOrEqual(21);
    expect(headers[20]).toBe('_controle_ref');
    // Coluna 21 deve estar oculta.
    expect(ws.getColumn(21).hidden).toBe(true);
  });

  it('recusa listas vazias', async () => {
    const listasEmpty = { itens: [], por_tipo: {} as never } as unknown as ListasReferenciaV3;
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'MODELO', linhas: [] });
    await expect(
      gerarWorkbookV3Simplificado({ tipo_arquivo: 'MODELO', listas: listasEmpty, arquivo_sha256_logico: sha }),
    ).rejects.toThrow(/CATALOGOS_VAZIOS/);
  });

  it('recusa SHA lógico vazio', async () => {
    await expect(
      gerarWorkbookV3Simplificado({ tipo_arquivo: 'MODELO', listas: listasFake(), arquivo_sha256_logico: '' }),
    ).rejects.toThrow(/arquivo_sha256_logico/);
  });

  it('EXPORTACAO preserva registros e _controle_ref no _CONTROLE', async () => {
    const listas = listasFake();
    const reg = registroFake();
    const sha = await calcularArquivoSha256LogicoV3({
      tipo_arquivo: 'EXPORTACAO',
      linhas: [{ ...reg, [reg._controle_ref ? 'x' : 'x']: '' }],
    });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'EXPORTACAO', listas, arquivo_sha256_logico: sha, registros: [reg],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const wsCtrl = wb.getWorksheet(ABA_CONTROLE_V3S)!;
    expect(String(wsCtrl.getRow(2).getCell(1).value)).toBe('ctrl-001');
    expect(String(wsCtrl.getRow(2).getCell(4).value)).toBe('CA15');
  });
});

describe('parseWorkbookV3Simplificado (round-trip)', () => {
  it('gera EXPORTACAO, altera 1 campo e infere ATUALIZAR + token único', async () => {
    const listas = listasFake();
    const reg = registroFake();
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [reg as unknown as Record<string, string>] });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'EXPORTACAO', listas, arquivo_sha256_logico: sha, registros: [reg],
    });
    // Reabre, edita o campo "modelo" e chama o parser.
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const wsEq = wb.getWorksheet(ABA_EQUIPAMENTOS_V3S)!;
    // Coluna 8 = modelo (posição no schema).
    wsEq.getRow(2).getCell(8).value = 'fh 540 novo';
    const outBuf = await wb.xlsx.writeBuffer();
    const res = await parseWorkbookV3Simplificado(outBuf as ArrayBuffer);
    expect(res.erros_globais).toEqual([]);
    expect(res.resumo.total).toBe(1);
    expect(res.resumo.atualizar).toBe(1);
    expect(res.linhas[0].campos_atualizar).toEqual(['MODELO']);
  });

  it('sem edição → SEM_ALTERACAO e campos_atualizar vazio', async () => {
    const listas = listasFake();
    const reg = registroFake();
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [reg as unknown as Record<string, string>] });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'EXPORTACAO', listas, arquivo_sha256_logico: sha, registros: [reg],
    });
    const res = await parseWorkbookV3Simplificado(bytes.buffer as ArrayBuffer);
    expect(res.resumo.sem_alteracao).toBe(1);
    expect(res.linhas[0].campos_atualizar).toEqual([]);
  });

  it('editar centro_custo em linha exportada → ERRO CAMPO_PROTEGIDO_ALTERADO', async () => {
    const listas = listasFake();
    const reg = registroFake();
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'EXPORTACAO', linhas: [reg as unknown as Record<string, string>] });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'EXPORTACAO', listas, arquivo_sha256_logico: sha, registros: [reg],
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const wsEq = wb.getWorksheet(ABA_EQUIPAMENTOS_V3S)!;
    // Coluna 6 = centro_custo.
    wsEq.getRow(2).getCell(6).value = 'CC-999';
    const out = await wb.xlsx.writeBuffer();
    const res = await parseWorkbookV3Simplificado(out as ArrayBuffer);
    expect(res.resumo.erro).toBe(1);
    expect(res.linhas[0].erros[0].codigo).toBe('CAMPO_PROTEGIDO_ALTERADO');
    expect(res.linhas[0].erros[0].campo).toBe('centro_custo');
  });

  it('linha nova (sem _controle_ref) e identidade nova → INSERIR', async () => {
    const listas = listasFake();
    const sha = await calcularArquivoSha256LogicoV3({ tipo_arquivo: 'MODELO', linhas: [] });
    const bytes = await gerarWorkbookV3Simplificado({
      tipo_arquivo: 'MODELO', listas, arquivo_sha256_logico: sha,
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const wsEq = wb.getWorksheet(ABA_EQUIPAMENTOS_V3S)!;
    const linhaNova = ['CB', '30', 'BASCULANTE', '', 'LYTORÂNEA SA', 'CC-100',
      'VOLVO', 'fh 400', '2020', 'XYZ9A99', '', '', '', 'D11', 'branco',
      'Diesel', '28 t', '', 'PAVIMENTAÇÃO', '', ''];
    // Linha 2: inserir dados
    linhaNova.forEach((v, i) => { wsEq.getRow(2).getCell(i + 1).value = v; });
    const out = await wb.xlsx.writeBuffer();
    const res = await parseWorkbookV3Simplificado(out as ArrayBuffer);
    expect(res.resumo.inserir).toBe(1);
    expect(res.linhas[0].codigo_canonico).toBe('CB30');
  });

  it('rejeita arquivo do layout completo (41 colunas) com MODELO_INCOMPATIVEL', async () => {
    // Cria um workbook manual sem METADADOS válido do simplificado.
    const wb = new ExcelJS.Workbook();
    const eq = wb.addWorksheet('EQUIPAMENTOS');
    eq.getRow(1).values = ['acao', 'equipamento_id_erp', 'campos_atualizar', ...Array(38).fill('x')];
    const meta = wb.addWorksheet('METADADOS');
    meta.getRow(1).values = ['chave', 'valor'];
    meta.getRow(2).values = ['schema_version', 'EQUIPAMENTOS_IMPORT_EXPORT_V3']; // legado
    const buf = await wb.xlsx.writeBuffer();
    const res = await parseWorkbookV3Simplificado(buf as ArrayBuffer);
    expect(res.erros_globais[0].codigo).toBe('MODELO_INCOMPATIVEL_BAIXE_NOVO_MODELO');
  });
});
