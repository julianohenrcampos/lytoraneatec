// PR-3.1 — Gera artefatos de QA: MODELO, EXPORTACAO, RELATORIO.
// bun run scripts/pr31_gerar_artefatos.ts
import { mkdirSync, writeFileSync } from 'node:fs';

// Stub localStorage ANTES de importar módulos que puxam supabase-js.
const store = new Map<string, string>();
// @ts-expect-error stub
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, String(v)); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};

const OUT = '/mnt/documents/pr31';
mkdirSync(OUT, { recursive: true });

const [
  { gerarModeloV3 },
  { gerarExportacaoV3 },
  { parseWorkbookV3 },
  { classificarLinhas },
  { executarImportacaoV3 },
  { gerarRelatorioV3Xlsx },
  { SCHEMA_VERSION },
  fixtureMod,
] = await Promise.all([
  import('../src/services/veiculo/importV3/gerarModeloXlsx'),
  import('../src/services/veiculo/importV3/exportarEquipamentosXlsx'),
  import('../src/services/veiculo/importV3/parseWorkbookV3'),
  import('../src/services/veiculo/importV3/classificarLinhas'),
  import('../src/services/veiculo/importV3/executarImportacaoV3'),
  import('../src/services/veiculo/importV3/gerarRelatorioV3'),
  import('../src/services/veiculo/importV3/constants'),
  import('../src/services/veiculo/importV3/__tests__/fixtures/equipamentos-2026-07-17.fixture.json', { with: { type: 'json' } }),
]);
const REGISTROS = fixtureMod.default;

async function buf(b: Blob) { return Buffer.from(await b.arrayBuffer()); }
const log = (m: string) => console.log(m);

// 1) MODELO
{
  const b = await buf(gerarModeloV3({ gerado_por: 'pr31.qa', observacoes: 'PR-3.1 evidência funcional.' }));
  writeFileSync(`${OUT}/modelo_importacao_equipamentos_v3.xlsx`, b);
  log(`MODELO: ${b.byteLength} bytes.`);
}

// 2) EXPORTACAO real 214
if (REGISTROS.length !== 214) throw new Error(`fixture ${REGISTROS.length}`);
const stamp = new Date().toISOString().slice(0, 10);
let expBuf: Buffer;
{
  const b = await buf(gerarExportacaoV3({
    registros: REGISTROS, listas: [],
    gerado_por: 'pr31.qa',
    arquivo_referencia_nome: 'Equipamentos_2026-07-17.xlsx',
    arquivo_referencia_sha256: 'r'.repeat(64),
  }));
  writeFileSync(`${OUT}/Equipamentos_${stamp}_V3.xlsx`, b);
  expBuf = b;
  log(`EXPORTACAO: ${b.byteLength} bytes, 214 registros.`);
}

// 3) ROUND-TRIP
{
  const ab = expBuf.buffer.slice(expBuf.byteOffset, expBuf.byteOffset + expBuf.byteLength) as ArrayBuffer;
  const parsed = parseWorkbookV3(ab);
  const cls = classificarLinhas('sha-roundtrip', parsed);
  log(`ROUND-TRIP resumo: total=${cls.resumo.total} sem=${cls.resumo.sem_alteracao} bloq=${cls.resumo.bloqueados} novos=${cls.resumo.novos_validos} upd=${cls.resumo.updates_validos} err=${cls.resumo.erros}`);
  if (cls.resumo.sem_alteracao !== 212 || cls.resumo.bloqueados !== 2) throw new Error('Round-trip fora do esperado');
  const bloq = cls.linhas.filter((l) => l.status_inicial === 'BLOQUEADO');
  log(`BLOQUEADAS: ${bloq.map((b) => `L${b.linha_excel}/${b.codigo_canonico}/${b.subcategoria_nome}`).join(' | ')}`);
}

// 4) EXECUÇÃO SIMULADA: 57 elegíveis, 3 lotes, mistura + reprocess
{
  const linhas = Array.from({ length: 57 }, (_, i) => {
    const acao = (i % 2 === 0 ? 'INSERIR' : 'ATUALIZAR') as 'INSERIR' | 'ATUALIZAR';
    return {
      chave: `sha57::${i + 2}::LYE${String(i).padStart(3, '0')}`,
      linha_excel: i + 2,
      codigo_canonico: `LYE${String(i).padStart(3, '0')}`,
      codigo_exibicao: `LYE${String(i).padStart(3, '0')}`,
      frota_codigo: 'LYE', numero_frota: String(i),
      centro_custo_codigo: '', subcategoria_nome: '',
      acao_arquivo: acao,
      status_inicial: (acao === 'INSERIR' ? 'NOVO_VALIDO' : 'UPDATE_VALIDO') as 'NOVO_VALIDO' | 'UPDATE_VALIDO',
      campos_atualizar: acao === 'ATUALIZAR' ? 'MODELO' : '',
      mensagem: '', parsed: { acao } as never, raw: {},
    };
  });
  let idx = 0;
  const disp = {
    async abrirExecucao() { return 'exec-multi-1'; },
    async encerrarExecucao() {},
    async chamar(nome: 'fn_importador_ativos_inserir' | 'fn_importador_ativos_atualizar') {
      const i = idx++;
      if (i === 12) return { data: null, error: { message: 'boom-network' } };
      if (i === 27) return { data: { status: 'JA_PROCESSADO' }, error: null };
      if (i === 31) return { data: { status: 'JA_EXISTENTE' }, error: null };
      if (i === 35) return { data: { status: 'CONFLITO', mensagem: 'updated_at' }, error: null };
      if (i === 42) return { data: null, error: { message: 'ERRO_RPC generic', code: 'X1' } };
      const st = nome === 'fn_importador_ativos_inserir' ? 'SUCESSO_INSERT' : 'SUCESSO_UPDATE';
      return { data: { status: st }, error: null };
    },
  };
  const t0 = Date.now();
  const r1 = await executarImportacaoV3({
    linhas, arquivoSha256: 'sha57', arquivoNome: 'lote57.xlsx',
    batchSize: 25, intervaloMs: 0, dispatcher: disp,
  });
  const conta = (arr: typeof r1.resultados, s: string) => arr.filter((r) => r.status_final === s).length;
  const exec1 = {
    execution_id: r1.execution_id, tentativa: 1,
    iniciada_em: new Date(t0).toISOString(), encerrada_em: new Date().toISOString(),
    total: linhas.length,
    inseridas: conta(r1.resultados, 'SUCESSO_INSERT'),
    atualizadas: conta(r1.resultados, 'SUCESSO_UPDATE'),
    ja_processadas: conta(r1.resultados, 'JA_PROCESSADO'),
    ja_existentes: conta(r1.resultados, 'JA_EXISTENTE'),
    conflitos: conta(r1.resultados, 'CONFLITO'),
    erros: conta(r1.resultados, 'ERRO'),
  };
  log(`ROD1: 57 dispatches; inseridas=${exec1.inseridas} atualizadas=${exec1.atualizadas} jap=${exec1.ja_processadas} jae=${exec1.ja_existentes} conf=${exec1.conflitos} erros=${exec1.erros}`);

  // Reprocess ERROs
  const alvos = linhas.filter((l) => r1.resultados.find((x) => x.chave === l.chave)?.status_final === 'ERRO');
  let idx2 = 0;
  const disp2 = {
    async abrirExecucao() { return 'exec-multi-2'; },
    async encerrarExecucao() {},
    async chamar() {
      const i = idx2++;
      return i === 0
        ? { data: { status: 'SUCESSO_INSERT' }, error: null }
        : { data: null, error: { message: 'ERRO_RPC persistente', code: 'X2' } };
    },
  };
  const r2 = await executarImportacaoV3({
    linhas: alvos, arquivoSha256: 'sha57', arquivoNome: 'lote57.xlsx',
    tentativaBase: 2, execucaoAnteriorId: r1.execution_id,
    batchSize: 25, intervaloMs: 0, dispatcher: disp2,
  });
  const exec2 = {
    execution_id: r2.execution_id, tentativa: 2,
    iniciada_em: new Date().toISOString(), encerrada_em: new Date().toISOString(),
    total: alvos.length,
    inseridas: conta(r2.resultados, 'SUCESSO_INSERT'),
    atualizadas: 0, ja_processadas: 0, ja_existentes: 0, conflitos: 0,
    erros: conta(r2.resultados, 'ERRO'),
  };
  log(`ROD2 (reprocess): ${alvos.length} alvos; inseridas=${exec2.inseridas} erros=${exec2.erros}`);

  const acumulados = [...r1.resultados, ...r2.resultados];
  const b = await buf(gerarRelatorioV3Xlsx({
    arquivoNome: 'lote57.xlsx', arquivoSha256: 'sha57'.padEnd(64, '0'),
    linhas, resultados: acumulados, execucoes: [exec1, exec2], geradoPor: 'pr31.qa',
  }));
  writeFileSync(`${OUT}/relatorio_importacao_v3_completo.xlsx`, b);
  log(`RELATORIO: ${b.byteLength} bytes. execs=[${exec1.execution_id},${exec2.execution_id}] acumulados=${acumulados.length}`);
}

log(`SCHEMA_VERSION=${SCHEMA_VERSION}`);
log('OK');
