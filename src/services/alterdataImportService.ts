import { supabase } from '@/integrations/supabase/client';
import { stripCPF } from '@/utils/textTransform';

// ── Types ──────────────────────────────────────────────────────

export interface AlterdataRow {
  nome: string;
  cpf: string;
  matricula: string;
  funcao: string;
  departamento: string;
  empresa: string;
  admissao: string;
}

export interface AlterdataImportResult {
  linhasProcessadas: number;
  agendamentosAtualizados: number;
  funcionariosAtualizados: number;
  funcionariosCriados: number;
  funcionariosAtivados: number;
  erros: AlterdataImportError[];
}

export interface AlterdataImportError {
  linha: number;
  nome: string;
  motivo: string;
  departamento?: string;
  empresa?: string;
}

export interface StagingRow {
  id: string;
  nome_funcionario: string | null;
  cpf: string | null;
  matricula: string | null;
  funcao_nome: string | null;
  funcao_id: string | null;
  departamento: string | null;
  codigo_centro: string | null;
  centro_custo_id: string | null;
  empresa_nome: string | null;
  empresa_id: string | null;
  data_admissao: string | null;
  status_processamento: string;
  erro: string | null;
  created_at: string | null;
  created_by: string | null;
}

// ── Helpers ────────────────────────────────────────────────────

/** Normalize text for comparison only – never save this to DB */
export function normalizeForMatch(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function normalizeCpf(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const digits = stripCPF(String(cpf));
  if (digits.length === 0) return '';
  return digits.padStart(11, '0');
}

/** Parse flexible header names from Excel */
export function parseAlterdataRow(row: Record<string, any>): AlterdataRow {
  const nome = String(
    row['Funcionario'] || row['Funcionário'] || row['funcionario'] ||
    row['Nome'] || row['nome'] || row['FUNCIONARIO'] || row['NOME'] || ''
  ).trim();

  const cpf = String(
    row['CPF'] || row['cpf'] || row['C.P.F.'] || row['Cpf'] || ''
  ).trim();

  const matricula = String(
    row['Matricula'] || row['Matrícula'] || row['matricula'] ||
    row['MATRICULA'] || row['Mat'] || ''
  ).trim();

  const funcao = String(
    row['Função'] || row['Funcao'] || row['funcao'] || row['FUNÇÃO'] || row['FUNCAO'] ||
    row['funcão'] || ''
  ).trim();

  const departamento = String(
    row['Departamento'] || row['departamento'] || row['DEPARTAMENTO'] ||
    row['Depto'] || row['depto'] || ''
  ).trim();

  const empresa = String(
    row['Empresa'] || row['empresa'] || row['EMPRESA'] || ''
  ).trim();

  const admissao = String(
    row['Admissão'] || row['Admissao'] || row['admissão'] || row['admissao'] ||
    row['ADMISSÃO'] || row['ADMISSAO'] || row['Data Admissão'] || row['Data Admissao'] || ''
  ).trim();

  return { nome, cpf, matricula, funcao, departamento, empresa, admissao };
}

/** Parse date from various formats: dd/mm/yyyy, yyyy-mm-dd, Excel serial */
function parseDate(value: string): string | null {
  if (!value) return null;

  const num = Number(value);
  if (!isNaN(num) && num > 30000 && num < 60000) {
    const date = new Date((num - 25569) * 86400000);
    return date.toISOString().split('T')[0];
  }

  const brMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const [, d, m, y] = brMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;

  return null;
}

/** Extract code from first word of departamento */
function extractCodigoCentroCusto(dep: string): string {
  return dep.split(' ')[0].trim().toUpperCase();
}

// ── Caches ─────────────────────────────────────────────────────

interface SimpleCache {
  [key: string]: string;
}

async function loadCentrosCustoCache(): Promise<SimpleCache> {
  const { data } = await supabase
    .from('bd_centros_custo')
    .select('id, codigo_centro_custo')
    .eq('situacao', 'Ativo');

  const cache: SimpleCache = {};
  if (data) {
    for (const cc of data) {
      cache[cc.codigo_centro_custo.toUpperCase()] = cc.id;
    }
  }
  return cache;
}

async function loadEmpresasCache(): Promise<SimpleCache> {
  const { data } = await supabase
    .from('bd_empresas')
    .select('id, nome_empresa')
    .eq('situacao', 'Ativo');

  const cache: SimpleCache = {};
  if (data) {
    for (const emp of data) {
      cache[normalizeForMatch(emp.nome_empresa)] = emp.id;
    }
  }
  return cache;
}

async function loadFuncoesCache(): Promise<SimpleCache> {
  const { data } = await supabase
    .from('bd_funcoes')
    .select('id, nome_funcao')
    .eq('situacao', 'Ativo');

  const cache: SimpleCache = {};
  if (data) {
    for (const f of data) {
      cache[normalizeForMatch(f.nome_funcao)] = f.id;
    }
  }
  return cache;
}

// ── ETAPA 1: Insert Staging Rows ──────────────────────────────

export async function insertStagingRows(
  rows: Record<string, any>[],
  userId: string
): Promise<{ inserted: number; parseErrors: AlterdataImportError[] }> {
  const parseErrors: AlterdataImportError[] = [];
  const stagingRows: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    const linha = i + 2;
    try {
      const parsed = parseAlterdataRow(rows[i]);

      if (!parsed.nome && !parsed.cpf) {
        parseErrors.push({ linha, nome: '(vazio)', motivo: 'Nome e CPF vazios' });
        continue;
      }

      const cpfClean = normalizeCpf(parsed.cpf);
      const codigoCentro = parsed.departamento ? extractCodigoCentroCusto(parsed.departamento) : null;
      const dataAdmissao = parseDate(parsed.admissao);

      stagingRows.push({
        nome_funcionario: parsed.nome || null,
        cpf: cpfClean || null,
        matricula: parsed.matricula || null,
        funcao_nome: parsed.funcao || null,
        departamento: parsed.departamento || null,
        codigo_centro: codigoCentro,
        empresa_nome: parsed.empresa || null,
        data_admissao: dataAdmissao,
        status_processamento: 'pendente',
        created_by: userId,
      });
    } catch (err: any) {
      parseErrors.push({
        linha,
        nome: String(rows[i]?.['Funcionario'] || rows[i]?.['Funcionário'] || ''),
        motivo: `Erro ao parsear: ${err.message}`,
      });
    }
  }

  // Insert in batches of 100
  for (let b = 0; b < stagingRows.length; b += 100) {
    const batch = stagingRows.slice(b, b + 100);
    const { error } = await supabase
      .from('bd_importacao_alterdata')
      .insert(batch as any);
    if (error) throw new Error(`Erro ao inserir staging: ${error.message}`);
  }

  return { inserted: stagingRows.length, parseErrors };
}

// ── ETAPA 2: Validate Staging Rows ────────────────────────────

export async function validateStagingRows(): Promise<{ validados: number; erros: number }> {
  const [ccCache, empCache, funcCache] = await Promise.all([
    loadCentrosCustoCache(),
    loadEmpresasCache(),
    loadFuncoesCache(),
  ]);

  const { data: pendentes, error: fetchErr } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('status_processamento', 'pendente');

  if (fetchErr) throw new Error(`Erro ao buscar pendentes: ${fetchErr.message}`);
  if (!pendentes || pendentes.length === 0) return { validados: 0, erros: 0 };

  let validados = 0;
  let erros = 0;

  for (const row of pendentes) {
    const errors: string[] = [];
    let centroCustoId: string | null = null;
    let funcaoId: string | null = null;
    let empresaId: string | null = null;

    // Resolve centro de custo
    if (row.codigo_centro) {
      centroCustoId = ccCache[row.codigo_centro.toUpperCase()] || null;
      if (!centroCustoId) {
        errors.push(`Centro de custo não encontrado: "${row.codigo_centro}" (Departamento: "${row.departamento}")`);
      }
    }

    // Resolve função
    if (row.funcao_nome) {
      const funcNorm = normalizeForMatch(row.funcao_nome);
      funcaoId = funcCache[funcNorm] || null;
      if (!funcaoId) {
        errors.push(`Função não cadastrada: "${row.funcao_nome}"`);
      }
    }

    // Resolve empresa
    if (row.empresa_nome) {
      const empNorm = normalizeForMatch(row.empresa_nome);
      empresaId = empCache[empNorm] || null;
      if (!empresaId) {
        errors.push(`Empresa não encontrada. Nome na planilha: "${row.empresa_nome}". Nome normalizado: "${empNorm}"`);
      }
    }

    if (errors.length > 0) {
      await supabase
        .from('bd_importacao_alterdata')
        .update({
          status_processamento: 'erro',
          erro: errors.join(' | '),
        } as any)
        .eq('id', row.id);
      erros++;
    } else {
      await supabase
        .from('bd_importacao_alterdata')
        .update({
          status_processamento: 'validado',
          centro_custo_id: centroCustoId,
          funcao_id: funcaoId,
          empresa_id: empresaId,
          erro: null,
        } as any)
        .eq('id', row.id);
      validados++;
    }
  }

  return { validados, erros };
}

// ── ETAPA 3: Process Staging Rows ─────────────────────────────

export async function processStagingRows(): Promise<AlterdataImportResult> {
  const result: AlterdataImportResult = {
    linhasProcessadas: 0,
    agendamentosAtualizados: 0,
    funcionariosAtualizados: 0,
    funcionariosCriados: 0,
    funcionariosAtivados: 0,
    erros: [],
  };

  const { data: validados, error: fetchErr } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('status_processamento', 'validado');

  if (fetchErr) throw new Error(`Erro ao buscar validados: ${fetchErr.message}`);
  if (!validados || validados.length === 0) return result;

  result.linhasProcessadas = validados.length;
  const processedIds: string[] = [];

  for (const row of validados) {
    try {
      const cpfClean = normalizeCpf(row.cpf);
      const nomeNorm = normalizeForMatch(row.nome_funcionario);

      // ── Update agendamento status_carteira ──
      let agendamentoFound = false;

      if (cpfClean.length >= 9) {
        const { data: agByCpf } = await supabase
          .from('bd_agendamentos_exames')
          .select('id, status_carteira')
          .eq('cpf', cpfClean)
          .order('data_agendamento', { ascending: false })
          .limit(1);

        if (agByCpf && agByCpf.length > 0) {
          agendamentoFound = true;
          if (agByCpf[0].status_carteira !== 'Registrado') {
            await supabase
              .from('bd_agendamentos_exames')
              .update({ status_carteira: 'Registrado' })
              .eq('id', agByCpf[0].id);
            result.agendamentosAtualizados++;
          }
        }
      }

      if (!agendamentoFound && nomeNorm) {
        const { data: agByName } = await supabase
          .from('bd_agendamentos_exames')
          .select('id, status_carteira, nome_colaborador')
          .order('data_agendamento', { ascending: false });

        if (agByName) {
          const match = agByName.find(a => normalizeForMatch(a.nome_colaborador) === nomeNorm);
          if (match) {
            if (match.status_carteira !== 'Registrado') {
              await supabase
                .from('bd_agendamentos_exames')
                .update({ status_carteira: 'Registrado' })
                .eq('id', match.id);
              result.agendamentosAtualizados++;
            }
          }
        }
      }

      // ── Upsert funcionário ──
      let funcionarioId: string | null = null;
      let funcionarioStatus: string | null = null;

      if (cpfClean.length >= 9) {
        const { data: funcByCpf } = await supabase
          .from('bd_funcionarios')
          .select('id, status')
          .eq('cpf', cpfClean)
          .limit(1);

        if (funcByCpf && funcByCpf.length > 0) {
          funcionarioId = funcByCpf[0].id;
          funcionarioStatus = funcByCpf[0].status;
        }
      }

      if (!funcionarioId && nomeNorm) {
        const { data: allFuncs } = await supabase
          .from('bd_funcionarios')
          .select('id, status, nome_completo');

        if (allFuncs) {
          const match = allFuncs.find(f => normalizeForMatch(f.nome_completo) === nomeNorm);
          if (match) {
            funcionarioId = match.id;
            funcionarioStatus = match.status;
          }
        }
      }

      if (funcionarioId) {
        const updateData: Record<string, any> = {
          status: 'Ativo',
          updated_at: new Date().toISOString(),
        };
        if (row.matricula) updateData.matricula = row.matricula;
        if (row.funcao_id) updateData.funcao_id = row.funcao_id;
        if (row.centro_custo_id) updateData.centro_custo_id = row.centro_custo_id;
        if (row.empresa_id) updateData.empresa_id = row.empresa_id;
        if (row.data_admissao) updateData.data_admissao = row.data_admissao;

        await supabase
          .from('bd_funcionarios')
          .update(updateData)
          .eq('id', funcionarioId);

        result.funcionariosAtualizados++;
        if (funcionarioStatus !== 'Ativo') {
          result.funcionariosAtivados++;
        }
      } else {
        const nome = (row.nome_funcionario || '').toUpperCase().trim();
        const insertData: Record<string, any> = {
          nome_completo: nome,
          cpf: cpfClean || '00000000000',
          status: 'Ativo',
        };
        if (row.matricula) insertData.matricula = row.matricula;
        if (row.funcao_id) insertData.funcao_id = row.funcao_id;
        if (row.centro_custo_id) insertData.centro_custo_id = row.centro_custo_id;
        if (row.empresa_id) insertData.empresa_id = row.empresa_id;
        if (row.data_admissao) insertData.data_admissao = row.data_admissao;

        const { error } = await supabase
          .from('bd_funcionarios')
          .insert(insertData as any);

        if (error) {
          await supabase
            .from('bd_importacao_alterdata')
            .update({ status_processamento: 'erro', erro: `Erro ao criar funcionário: ${error.message}` } as any)
            .eq('id', row.id);
          result.erros.push({
            linha: 0,
            nome: row.nome_funcionario || '',
            motivo: `Erro ao criar: ${error.message}`,
            departamento: row.departamento || '',
            empresa: row.empresa_nome || '',
          });
          continue;
        }
        result.funcionariosCriados++;
      }

      processedIds.push(row.id);
    } catch (err: any) {
      await supabase
        .from('bd_importacao_alterdata')
        .update({ status_processamento: 'erro', erro: `Erro inesperado: ${err.message}` } as any)
        .eq('id', row.id);
      result.erros.push({
        linha: 0,
        nome: row.nome_funcionario || '',
        motivo: `Erro inesperado: ${err.message}`,
        departamento: row.departamento || '',
        empresa: row.empresa_nome || '',
      });
    }
  }

  // Remove processed rows from staging
  if (processedIds.length > 0) {
    for (let b = 0; b < processedIds.length; b += 100) {
      const batch = processedIds.slice(b, b + 100);
      await supabase
        .from('bd_importacao_alterdata')
        .delete()
        .in('id', batch);
    }
  }

  return result;
}

// ── Full Import Pipeline ──────────────────────────────────────

export async function processAlterdataImport(
  rows: Record<string, any>[],
  userId: string
): Promise<AlterdataImportResult> {
  // Etapa 1: Insert into staging
  const { inserted, parseErrors } = await insertStagingRows(rows, userId);

  // Etapa 2: Validate
  await validateStagingRows();

  // Etapa 3: Process
  const result = await processStagingRows();
  result.linhasProcessadas = rows.length;

  // Add parse errors to result
  for (const pe of parseErrors) {
    result.erros.push(pe);
  }

  // Fetch remaining errors from staging for display
  const { data: stagingErrors } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('status_processamento', 'erro');

  if (stagingErrors) {
    for (const se of stagingErrors) {
      result.erros.push({
        linha: 0,
        nome: se.nome_funcionario || '',
        motivo: se.erro || 'Erro desconhecido',
        departamento: se.departamento || '',
        empresa: se.empresa_nome || '',
      });
    }
  }

  return result;
}

// ── Reprocess Staging Errors ──────────────────────────────────

export async function reprocessStagingErrors(): Promise<AlterdataImportResult> {
  // Reset error rows to pendente
  const { data: errorRows } = await supabase
    .from('bd_importacao_alterdata')
    .select('id')
    .eq('status_processamento', 'erro');

  if (!errorRows || errorRows.length === 0) {
    return {
      linhasProcessadas: 0,
      agendamentosAtualizados: 0,
      funcionariosAtualizados: 0,
      funcionariosCriados: 0,
      funcionariosAtivados: 0,
      erros: [],
    };
  }

  // Reset to pendente
  const ids = errorRows.map(r => r.id);
  for (let b = 0; b < ids.length; b += 100) {
    const batch = ids.slice(b, b + 100);
    await supabase
      .from('bd_importacao_alterdata')
      .update({ status_processamento: 'pendente', erro: null } as any)
      .in('id', batch);
  }

  // Re-validate
  await validateStagingRows();

  // Re-process
  const result = await processStagingRows();
  result.linhasProcessadas = errorRows.length;

  // Fetch remaining errors
  const { data: remainingErrors } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('status_processamento', 'erro');

  if (remainingErrors) {
    for (const se of remainingErrors) {
      result.erros.push({
        linha: 0,
        nome: se.nome_funcionario || '',
        motivo: se.erro || 'Erro desconhecido',
        departamento: se.departamento || '',
        empresa: se.empresa_nome || '',
      });
    }
  }

  return result;
}

// ── Get Staging Error Count ───────────────────────────────────

export async function getStagingErrorCount(): Promise<number> {
  const { count } = await supabase
    .from('bd_importacao_alterdata')
    .select('*', { count: 'exact', head: true })
    .eq('status_processamento', 'erro');

  return count || 0;
}
