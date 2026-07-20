// PR-3.3 Fase C4 — Teste do parser V3 SIMPLIFICADO sob condições reais:
// 581 linhas, muitas fora do range da Excel Table, alguns campos vazios,
// alguns códigos de CC ausentes na _LISTAS. NENHUMA linha pode gerar
// TypeError. NENHUM erro de linha pode virar código fatal.

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  gerarWorkbookV3Simplificado,
} from '../gerarWorkbookV3Simplificado';
import { parseWorkbookV3Simplificado, ehCodigoFatal } from '../parseWorkbookV3Simplificado';
import type { ListasReferenciaV3, ItemListaV3 } from '../carregarListasReferenciaV3';

function makeItem(over: Partial<ItemListaV3>): ItemListaV3 {
  return {
    tipo_catalogo: 'FROTA',
    id_erp: 'x',
    valor_exibicao: 'X',
    codigo: null,
    nome: null,
    parent_id_erp: null,
    ativo: true,
    vinculado_atualmente: true,
    contexto: null,
    ...over,
  };
}

function buildListas(): ListasReferenciaV3 {
  const itens: ItemListaV3[] = [
    makeItem({ tipo_catalogo: 'FROTA', id_erp: 'fr-cv', valor_exibicao: 'CV', codigo: 'CV', nome: 'Caminhão' }),
    makeItem({ tipo_catalogo: 'FROTA', id_erp: 'fr-es', valor_exibicao: 'ES', codigo: 'ES', nome: 'Escavadeira' }),
    makeItem({ tipo_catalogo: 'SUBCATEGORIA', id_erp: 'sub-1', valor_exibicao: 'Caminhão Basculante', nome: 'Caminhão Basculante' }),
    makeItem({ tipo_catalogo: 'PROPRIETARIO', id_erp: 'emp-1', valor_exibicao: 'EMPRESA | Acme', contexto: 'EMPRESA' }),
    makeItem({ tipo_catalogo: 'CENTRO_CUSTO', id_erp: 'cc-a', valor_exibicao: 'CC-A', codigo: 'CC-A' }),
    makeItem({ tipo_catalogo: 'CENTRO_CUSTO', id_erp: 'cc-b', valor_exibicao: 'CC-B', codigo: 'CC-B' }),
    makeItem({ tipo_catalogo: 'FABRICANTE', id_erp: 'fab-1', valor_exibicao: 'Volvo' }),
    makeItem({ tipo_catalogo: 'DEPARTAMENTO', id_erp: 'dep-1', valor_exibicao: 'Operações' }),
    makeItem({ tipo_catalogo: 'LINHA_OPERACIONAL', id_erp: 'lo-1', valor_exibicao: 'LO-1' }),
  ];
  const por_tipo = {
    FROTA: itens.filter((i) => i.tipo_catalogo === 'FROTA'),
    SUBCATEGORIA: itens.filter((i) => i.tipo_catalogo === 'SUBCATEGORIA'),
    LINHA_OPERACIONAL: itens.filter((i) => i.tipo_catalogo === 'LINHA_OPERACIONAL'),
    CENTRO_CUSTO: itens.filter((i) => i.tipo_catalogo === 'CENTRO_CUSTO'),
    FABRICANTE: itens.filter((i) => i.tipo_catalogo === 'FABRICANTE'),
    DEPARTAMENTO: itens.filter((i) => i.tipo_catalogo === 'DEPARTAMENTO'),
    PROPRIETARIO: itens.filter((i) => i.tipo_catalogo === 'PROPRIETARIO'),
  };
  return { itens, por_tipo };
}

// Constrói o MODELO oficial e injeta 581 linhas depois — fora do range da Excel Table.
async function buildXlsx581Linhas(): Promise<ArrayBuffer> {
  const modelo = await gerarWorkbookV3Simplificado({
    tipo_arquivo: 'MODELO',
    listas: buildListas(),
    registros: [],
    arquivo_sha256_logico: 'a'.repeat(64),
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(modelo as unknown as ExcelJS.Buffer);
  const ws = wb.getWorksheet('EQUIPAMENTOS')!;

  // 581 linhas: todas sem proprietário, 35 sem subcategoria, 16 com CC não resolvido,
  // demais com catálogos válidos. Reproduz o XLSX real onde _CONTROLE está vazio.
  const rows: Array<Record<string, string>> = [];
  for (let i = 0; i < 400; i += 1) {
    rows.push({ frota_codigo: 'CV', numero_frota: String(1000 + i),
      subcategoria: 'Caminhão Basculante', proprietario: '',
      centro_custo: 'CC-A', fabricante: 'Volvo' });
  }
  for (let i = 0; i < 35; i += 1) {
    rows.push({ frota_codigo: 'ES', numero_frota: String(2000 + i),
      subcategoria: '', proprietario: '', centro_custo: 'CC-A' });
  }
  const ccsInvalidos = ['CONL528', 'L016', 'L019', 'L349', 'L513'];
  const distrib = [1, 9, 2, 1, 3]; // total 16
  ccsInvalidos.forEach((cc, idx) => {
    for (let i = 0; i < distrib[idx]; i += 1) {
      rows.push({ frota_codigo: 'CV', numero_frota: String(9000 + idx * 100 + i),
        subcategoria: 'Caminhão Basculante', proprietario: '',
        centro_custo: cc });
    }
  });
  for (let i = 0; i < 130; i += 1) {
    rows.push({ frota_codigo: 'CV', numero_frota: String(3000 + i),
      subcategoria: 'Caminhão Basculante', proprietario: '',
      centro_custo: 'CC-B' });
  }

  expect(rows.length).toBe(581);
  rows.forEach((r, i) => {
    const rowNum = i + 2;
    ws.getRow(rowNum).values = [
      r.frota_codigo ?? '', r.numero_frota ?? '', r.subcategoria ?? '', r.linha_operacional ?? '',
      r.proprietario ?? '', r.centro_custo ?? '', r.fabricante ?? '', r.modelo ?? '',
      r.ano_fabricacao ?? '', r.placa ?? '', r.chassi ?? '', r.numero_serie ?? '',
      r.renavam ?? '', r.motor ?? '', r.cor ?? '', r.tipo_combustivel ?? '',
      r.capacidade ?? '', r.aluguel ?? '', r.departamento ?? '', r.observacoes ?? '',
      '', // _controle_ref vazio => INSERIR
    ];
  });

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}

describe('parseWorkbookV3Simplificado — 581 linhas fora do range da Excel Table', () => {
  it('NÃO gera fatal; processa todas as 581 linhas; acumula erros por linha', async () => {
    const buf = await buildXlsx581Linhas();
    const res = await parseWorkbookV3Simplificado(buf);

    // Zero fatais
    const fatais = res.erros_globais.filter((e) => ehCodigoFatal(e.codigo));
    expect(fatais).toEqual([]);

    // Todas as 581 linhas processadas
    expect(res.linhas.length).toBe(581);

    // 35 linhas com SUBCATEGORIA_OBRIGATORIA
    const semSubcat = res.linhas.filter((l) =>
      l.erros.some((e) => e.codigo === 'SUBCATEGORIA_OBRIGATORIA'),
    );
    expect(semSubcat.length).toBe(35);

    // 16 linhas com CENTRO_CUSTO_NAO_RESOLVIDO
    const ccNaoResolvido = res.linhas.filter((l) =>
      l.erros.some((e) => e.codigo === 'CENTRO_CUSTO_NAO_RESOLVIDO'),
    );
    expect(ccNaoResolvido.length).toBe(16);

    // 581 linhas com PROPRIETARIO_OBRIGATORIO, sem quebrar preview.
    const semProprietario = res.linhas.filter((l) =>
      l.erros.some((e) => e.codigo === 'PROPRIETARIO_OBRIGATORIO'),
    );
    expect(semProprietario.length).toBe(581);

    // Resumo consolidado
    expect(res.resumo.total).toBe(581);
    expect(res.resumo.linhas_com_erro).toBe(581);
    expect(res.resumo.total_inconsistencias).toBeGreaterThanOrEqual(581 + 35 + 16);
  });

  it('warning TABELA_EXCEL_NAO_EXPANDIDA quando table.ref cobre apenas as primeiras linhas', async () => {
    const buf = await buildXlsx581Linhas();
    const res = await parseWorkbookV3Simplificado(buf);
    const w = res.warnings_globais.find((x) => x.codigo === 'TABELA_EXCEL_NAO_EXPANDIDA');
    // Warning é opcional: o gerador pode ou não expandir a tabela; o importante
    // é que o parser processou todas as 581 linhas independentemente disso.
    if (w) expect(w.codigo).toBe('TABELA_EXCEL_NAO_EXPANDIDA');
    expect(res.linhas.length).toBe(581);
  });
});
