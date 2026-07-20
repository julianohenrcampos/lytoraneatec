// Rodada 2A.4 — Regressão de schema.
// A coluna real em bd_importador_v2_linhas_processadas é `codigo_ativo_canonico`.
// Este teste garante que a definição EFETIVA (última migration na ordem
// lexicográfica de timestamp) da RPC de inserção usa a coluna correta.
// Migrations antigas superseded por CREATE OR REPLACE podem manter o texto legado
// — o que importa é o estado final aplicado.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(__dirname, '../../../../../supabase/migrations');

function listarMigrations(): string[] {
  try {
    return readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort() // timestamp prefix garante ordem cronológica
      .map((f) => join(MIGRATIONS_DIR, f));
  } catch {
    return [];
  }
}

const RPC_NAME = 'fn_importador_v2_inserir_novo_ativo';
const reInsertLinhas =
  /INSERT\s+INTO\s+(?:public\.)?bd_importador_v2_linhas_processadas\s*\(([^)]*)\)/gi;
const reBadColumn = /(?<![A-Za-z0-9_])codigo_canonico(?![A-Za-z0-9_])/;

describe('Regressão schema — bd_importador_v2_linhas_processadas', () => {
  const arquivos = listarMigrations();

  it('encontrou migrations para varrer', () => {
    expect(arquivos.length).toBeGreaterThan(0);
  });

  it('última definição da RPC de inserção usa `codigo_ativo_canonico` (coluna real)', () => {
    let ultimaDefinicao: { arquivo: string; corpo: string } | null = null;
    const reCreate = new RegExp(
      `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+(?:public\\.)?${RPC_NAME}\\b[\\s\\S]*?\\$\\$[\\s\\S]*?\\$\\$`,
      'gi',
    );
    for (const arquivo of arquivos) {
      const conteudo = readFileSync(arquivo, 'utf8');
      const matches = conteudo.match(reCreate);
      if (matches && matches.length) {
        ultimaDefinicao = { arquivo, corpo: matches[matches.length - 1] };
      }
    }
    expect(ultimaDefinicao, 'RPC não encontrada em nenhuma migration').not.toBeNull();
    const corpo = ultimaDefinicao!.corpo;

    // Extrai colunas do INSERT em bd_importador_v2_linhas_processadas dentro do corpo.
    const insertMatch = reInsertLinhas.exec(corpo);
    reInsertLinhas.lastIndex = 0;
    expect(insertMatch, 'INSERT em bd_importador_v2_linhas_processadas não encontrado na RPC').not.toBeNull();
    const colunas = insertMatch![1];
    expect(colunas).toMatch(/(?<![A-Za-z0-9_])codigo_ativo_canonico(?![A-Za-z0-9_])/);
    expect(reBadColumn.test(colunas)).toBe(false);
  });
});
