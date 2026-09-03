// PR-3.2 — Regras puras de reprocessamento.
import { describe, it, expect } from 'vitest';
import { isReprocessavel, CODIGOS_NAO_REPROCESSAVEIS } from '../reprocessRules';
import type { ResultadoLinhaV3 } from '../executarImportacaoV3';
import type { StatusResultado } from '../classificarLinhas';

function mk(over: Partial<ResultadoLinhaV3> & { status_final: StatusResultado; codigo_resultado: string | null }): ResultadoLinhaV3 {
  return {
    chave: 'k', linha_excel: 2, codigo_canonico: 'LYE1', codigo_exibicao: 'LYE001',
    acao_arquivo: 'INSERIR', mensagem: null, equipamento_id: null,
    execution_id: 'exec', tentativa: 1, timestamp_iso: '', payload_enviado: null,
    ...over,
  } as ResultadoLinhaV3;
}

describe('isReprocessavel (PR-3.2)', () => {
  it('CONFLITO nunca é reprocessável', () => {
    expect(isReprocessavel(mk({ status_final: 'CONFLITO', codigo_resultado: 'CONFLITO_DADO_ATUAL_DESATUALIZADO' }))).toBe(false);
    expect(isReprocessavel(mk({ status_final: 'CONFLITO', codigo_resultado: null }))).toBe(false);
  });

  it('status terminais nunca são reprocessáveis', () => {
    (['SUCESSO_INSERT', 'SUCESSO_UPDATE', 'JA_PROCESSADO', 'JA_EXISTENTE', 'SEM_ALTERACAO', 'BLOQUEADO', 'ERRO_PARSER'] as StatusResultado[])
      .forEach((s) => expect(isReprocessavel(mk({ status_final: s, codigo_resultado: 'X' }))).toBe(false));
  });

  it('erros definitivos ficam bloqueados por código', () => {
    for (const cod of CODIGOS_NAO_REPROCESSAVEIS) {
      expect(isReprocessavel(mk({ status_final: 'ERRO', codigo_resultado: cod }))).toBe(false);
    }
  });

  it('erros transitórios permanecem reprocessáveis', () => {
    for (const cod of ['NETWORK_ERROR', 'TIMEOUT', 'RPC_TEMPORARIAMENTE_INDISPONIVEL', 'ERRO_INTERNO_TRANSITORIO', 'ERRO_RPC', 'EXCEPTION']) {
      expect(isReprocessavel(mk({ status_final: 'ERRO', codigo_resultado: cod }))).toBe(true);
    }
  });

  it('ERRO sem código presume transitório', () => {
    expect(isReprocessavel(mk({ status_final: 'ERRO', codigo_resultado: null }))).toBe(true);
  });
});
