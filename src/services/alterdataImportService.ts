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

export interface ImportStagingResult {
  loteId: string;
  totalImportados: number;
}

export interface StagingAnalysisResult {
  linhasProcessadas: number;
  validados: number;
  erros: AlterdataImportError[];
  validadosNomes: string[];
}

export interface AuditRow {
  nome: string;
  cpf: string;
  matricula: string;
  funcao: string;
  empresa: string;
  centro_custo: string;
  data_admissao: string;
  motivo: string;
}

export interface AlterdataImportResult {
  linhasProcessadas: number;
  funcionariosCriados: number;
  funcionariosAtualizados: number;
  funcionariosAtivados: number;
  funcionariosComAgendamento: number;
  funcionariosSemAgendamento: number;
  erros: AlterdataImportError[];
  funcionariosAdicionadosNomes: string[];
  funcionariosAtualizadosNomes: string[];
  comAgendamentoNomes: string[];
  semAgendamentoNomes: string[];
  semAgendamentoDetalhes: AuditRow[];
}

export interface AlterdataImportError {
  linha: number;
  nome: string;
  cpf?: string;
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
  lote_importacao: string | null;
  created_at: string | null;
  created_by: string | null;
}

// ── Helpers ────────────────────────────────────────────────────

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

function normalizeColumnName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findColumn(row: Record<string, any>, aliases: string[], strictMode = false): string {
  const keys = Object.keys(row);
  const normalizedKeys = keys.map(k => ({ original: k, normalized: normalizeColumnName(k) }));
  const normalizedAliases = aliases.map(a => normalizeColumnName(a));

  // Pass 1: exact match
  for (const alias of normalizedAliases) {
    const exact = normalizedKeys.find(k => k.normalized === alias);
    if (exact) {
      const val = row[exact.original];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  // Pass 2: startsWith match
  for (const alias of normalizedAliases) {
    const startsWith = normalizedKeys.find(k => k.normalized.startsWith(alias) || alias.startsWith(k.normalized));
    if (startsWith) {
      const val = row[startsWith.original];
      if (val !== null && val !== undefined && String(val).trim() !== '') {
        return String(val).trim();
      }
    }
  }

  // Pass 3: contains match — SKIP in strict mode to avoid false positives
  if (!strictMode) {
    for (const alias of normalizedAliases) {
      const contains = normalizedKeys.find(k => k.normalized.includes(alias) || alias.includes(k.normalized));
      if (contains) {
        const val = row[contains.original];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          return String(val).trim();
        }
      }
    }
  }

  return '';
}

const NOME_ALIASES = ['funcionario', 'nome completo', 'nome do funcionario', 'nome do funcionário', 'nome', 'funcionário'];
const CPF_ALIASES = ['cpf', 'c.p.f.'];
const MATRICULA_ALIASES = ['matricula', 'matrícula', 'mat', 'registro'];
const FUNCAO_ALIASES = ['funcao', 'função', 'cargo'];
const DEPTO_ALIASES = ['departamento', 'depto', 'centro de custo', 'centro custo', 'cc'];
const EMPRESA_ALIASES = ['empresa'];
const ADMISSAO_ALIASES = ['admissao', 'admissão', 'data admissao', 'data admissão', 'data de admissao', 'data de admissão', 'dt admissao'];

export function parseAlterdataRow(row: Record<string, any>): AlterdataRow {
  // Use strict mode for NOME to avoid fuzzy "contains" matching
  // that can map "matricula" column to "nome" via short alias collision
  const nome = findColumn(row, NOME_ALIASES, true);
  const matricula = findColumn(row, MATRICULA_ALIASES);

  // Safety: if nome is purely numeric, it was likely mis-mapped from matricula
  const nomeValue = (nome && /^\d+$/.test(nome.trim())) ? '' : nome;

  return {
    nome: nomeValue,
    cpf: findColumn(row, CPF_ALIASES),
    matricula,
    funcao: findColumn(row, FUNCAO_ALIASES),
    departamento: findColumn(row, DEPTO_ALIASES),
    empresa: findColumn(row, EMPRESA_ALIASES),
    admissao: findColumn(row, ADMISSAO_ALIASES),
  };
}

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

function extractCodigoCentroCusto(dep: string): string {
  return dep.split(' ')[0].trim().toUpperCase();
}

export function normalizeFuncaoForMatch(text: string | null | undefined): string {
  let result = normalizeForMatch(text);
  result = result.replace(/\s*\([AO]\)\s*/gi, ' ');
  return result.replace(/\s+/g, ' ').trim();
}

// ── Caches ─────────────────────────────────────────────────────

interface SimpleCache { [key: string]: string; }

async function loadCentrosCustoCache(): Promise<SimpleCache> {
  const { data } = await supabase.from('bd_centros_custo').select('id, codigo_centro_custo').eq('situacao', 'Ativo');
  const cache: SimpleCache = {};
  if (data) for (const cc of data) cache[cc.codigo_centro_custo.toUpperCase()] = cc.id;
  return cache;
}

async function loadEmpresasCache(): Promise<SimpleCache> {
  const { data } = await supabase.from('bd_empresas').select('id, nome_empresa');
  const cache: SimpleCache = {};
  if (data) for (const emp of data) cache[normalizeForMatch(emp.nome_empresa)] = emp.id;
  return cache;
}

async function loadFuncoesCache(): Promise<SimpleCache> {
  const { data } = await supabase.from('bd_funcoes').select('id, nome_funcao');
  const cache: SimpleCache = {};
  if (data) for (const f of data) cache[normalizeFuncaoForMatch(f.nome_funcao)] = f.id;
  return cache;
}

// Helper to load names for resolved IDs (for audit export)
async function loadCentrosCustoNomeCache(): Promise<SimpleCache> {
  const { data } = await supabase.from('bd_centros_custo').select('id, nome_centro_custo');
  const cache: SimpleCache = {};
  if (data) for (const cc of data) cache[cc.id] = cc.nome_centro_custo;
  return cache;
}

async function loadEmpresasNomeCache(): Promise<SimpleCache> {
  const { data } = await supabase.from('bd_empresas').select('id, nome_empresa');
  const cache: SimpleCache = {};
  if (data) for (const emp of data) cache[emp.id] = emp.nome_empresa;
  return cache;
}

async function loadFuncoesNomeCache(): Promise<SimpleCache> {
  const { data } = await supabase.from('bd_funcoes').select('id, nome_funcao');
  const cache: SimpleCache = {};
  if (data) for (const f of data) cache[f.id] = f.nome_funcao;
  return cache;
}

// ── ETAPA 1: IMPORTAR — Upload only, no validation ────────────

export async function importToStaging(
  rows: Record<string, any>[],
  userId: string
): Promise<ImportStagingResult> {
  const loteId = crypto.randomUUID();

  // Parse and deduplicate by CPF (keep last)
  const parsedRows: AlterdataRow[] = [];
  for (const row of rows) {
    try {
      const parsed = parseAlterdataRow(row);
      if (!parsed.nome && !parsed.cpf) continue;
      parsedRows.push(parsed);
    } catch {
      continue;
    }
  }

  // Deduplicate by CPF
  const cpfMap = new Map<string, AlterdataRow>();
  const noCpfRows: AlterdataRow[] = [];
  for (const parsed of parsedRows) {
    const cpfClean = normalizeCpf(parsed.cpf);
    if (cpfClean.length >= 9) {
      cpfMap.set(cpfClean, parsed);
    } else {
      noCpfRows.push(parsed);
    }
  }

  const deduped = [...cpfMap.values(), ...noCpfRows];

  const stagingRows: any[] = deduped.map(parsed => ({
    nome_funcionario: parsed.nome || null,
    cpf: normalizeCpf(parsed.cpf) || null,
    matricula: parsed.matricula || null,
    funcao_nome: parsed.funcao || null,
    departamento: parsed.departamento || null,
    codigo_centro: parsed.departamento ? extractCodigoCentroCusto(parsed.departamento) : null,
    empresa_nome: parsed.empresa || null,
    data_admissao: parseDate(parsed.admissao),
    status_processamento: 'pendente',
    lote_importacao: loteId,
    created_by: userId,
  }));

  for (let b = 0; b < stagingRows.length; b += 100) {
    const batch = stagingRows.slice(b, b + 100);
    const { error } = await supabase.from('bd_importacao_alterdata').insert(batch as any);
    if (error) throw new Error(`Erro ao inserir staging: ${error.message}`);
  }

  return { loteId, totalImportados: stagingRows.length };
}

// ── ETAPA 2: ANALISAR — Validate staging rows ─────────────────

export async function analyzeStaging(loteId: string): Promise<StagingAnalysisResult> {
  const [ccCache, empCache, funcCache] = await Promise.all([
    loadCentrosCustoCache(),
    loadEmpresasCache(),
    loadFuncoesCache(),
  ]);

  const { data: pendentes } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('lote_importacao', loteId)
    .eq('status_processamento', 'pendente');

  if (!pendentes || pendentes.length === 0) {
    return { linhasProcessadas: 0, validados: 0, erros: [], validadosNomes: [] };
  }

  let validados = 0;
  const validadosNomes: string[] = [];
  const erros: AlterdataImportError[] = [];

  for (const row of pendentes) {
    const rowErrors: string[] = [];
    let centroCustoId: string | null = null;
    let funcaoId: string | null = null;
    let empresaId: string | null = null;

    // Centro de custo
    if (row.codigo_centro) {
      centroCustoId = ccCache[row.codigo_centro.toUpperCase()] || null;
      if (!centroCustoId) rowErrors.push('Centro de custo não encontrado');
    }

    // Função
    if (row.funcao_nome) {
      funcaoId = funcCache[normalizeFuncaoForMatch(row.funcao_nome)] || null;
      if (!funcaoId) rowErrors.push('Função não cadastrada');
    }

    // Empresa
    if (row.empresa_nome) {
      empresaId = empCache[normalizeForMatch(row.empresa_nome)] || null;
      if (!empresaId) rowErrors.push('Empresa não encontrada');
    }

    if (rowErrors.length > 0) {
      await supabase
        .from('bd_importacao_alterdata')
        .update({ status_processamento: 'erro', erro: rowErrors.join(' | ') } as any)
        .eq('id', row.id);
      erros.push({
        linha: 0,
        nome: row.nome_funcionario || row.cpf || 'Desconhecido',
        cpf: row.cpf || '',
        motivo: rowErrors.join(' | '),
        departamento: row.departamento || '',
        empresa: row.empresa_nome || '',
      });
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
      validadosNomes.push(row.nome_funcionario || row.cpf || '');
    }
  }

  return { linhasProcessadas: pendentes.length, validados, erros, validadosNomes };
}

// ── ETAPA 3: PROCESSAR / AUDITAR ──────────────────────────────

export async function confirmStagingImport(loteId: string): Promise<AlterdataImportResult> {
  const result: AlterdataImportResult = {
    linhasProcessadas: 0,
    funcionariosCriados: 0,
    funcionariosAtualizados: 0,
    funcionariosAtivados: 0,
    funcionariosComAgendamento: 0,
    funcionariosSemAgendamento: 0,
    erros: [],
    funcionariosAdicionadosNomes: [],
    funcionariosAtualizadosNomes: [],
    comAgendamentoNomes: [],
    semAgendamentoNomes: [],
    semAgendamentoDetalhes: [],
  };

  const { data: validados, error: fetchErr } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('lote_importacao', loteId)
    .eq('status_processamento', 'validado');

  if (fetchErr) throw new Error(`Erro ao buscar validados: ${fetchErr.message}`);
  if (!validados || validados.length === 0) return result;

  result.linhasProcessadas = validados.length;

  // Load name caches for audit export
  const [ccNomeCache, empNomeCache, funcNomeCache] = await Promise.all([
    loadCentrosCustoNomeCache(),
    loadEmpresasNomeCache(),
    loadFuncoesNomeCache(),
  ]);

  const processedIds: string[] = [];

  for (const row of validados) {
    try {
      const cpfClean = normalizeCpf(row.cpf);
      const nomeNorm = normalizeForMatch(row.nome_funcionario);

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
        // ── UPDATE existing employee ──
        // IMPORTANT: Only update Alterdata-specific fields.
        // NEVER update: nome_completo, departamento_id, email, data_nascimento,
        // escolaridade, endereco_completo, genero, observacoes, banco, agencia,
        // conta_corrente, chave_pix, salario_base, diarias, etc.
        const updateData: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (funcionarioStatus !== 'Ativo') {
          updateData.status = 'Ativo';
          result.funcionariosAtivados++;
        }
        if (row.matricula) updateData.matricula = row.matricula;
        if (row.funcao_id) updateData.funcao_id = row.funcao_id;
        if (row.centro_custo_id) updateData.centro_custo_id = row.centro_custo_id;
        if (row.empresa_id) updateData.empresa_id = row.empresa_id;
        if (row.data_admissao) updateData.data_admissao = row.data_admissao;

        await supabase.from('bd_funcionarios').update(updateData).eq('id', funcionarioId);
        result.funcionariosAtualizados++;
        result.funcionariosAtualizadosNomes.push(row.nome_funcionario || cpfClean);
      } else {
        // Create new — validate name first
        const nome = (row.nome_funcionario || '').toUpperCase().trim();
        
        // Reject if name is empty or purely numeric (likely mis-mapped matricula)
        if (!nome || /^\d+$/.test(nome)) {
          await supabase
            .from('bd_importacao_alterdata')
            .update({ status_processamento: 'erro', erro: 'Nome do funcionário inválido ou não encontrado na planilha (valor numérico ou vazio)' } as any)
            .eq('id', row.id);
          result.erros.push({
            linha: 0,
            nome: row.nome_funcionario || row.cpf || '',
            cpf: row.cpf || '',
            motivo: 'Nome do funcionário inválido ou não encontrado na planilha',
            departamento: row.departamento || '',
            empresa: row.empresa_nome || '',
          });
          continue;
        }

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

        console.log('🚀 USING RPC create_funcionario (alterdata import)');
        const { error } = await supabase.rpc('create_funcionario', { p_dados: insertData as any });
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
        result.funcionariosAdicionadosNomes.push(row.nome_funcionario || cpfClean);
      }

      // ── Auditoria de agendamento ──
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
            agendamentoFound = true;
            if (match.status_carteira !== 'Registrado') {
              await supabase
                .from('bd_agendamentos_exames')
                .update({ status_carteira: 'Registrado' })
                .eq('id', match.id);
            }
          }
        }
      }

      const displayName = row.nome_funcionario || cpfClean;
      if (agendamentoFound) {
        result.funcionariosComAgendamento++;
        result.comAgendamentoNomes.push(displayName);
      } else {
        result.funcionariosSemAgendamento++;
        result.semAgendamentoNomes.push(displayName);
        result.semAgendamentoDetalhes.push({
          nome: row.nome_funcionario || '',
          cpf: row.cpf || '',
          matricula: row.matricula || '',
          funcao: row.funcao_id ? (funcNomeCache[row.funcao_id] || row.funcao_nome || '') : (row.funcao_nome || ''),
          empresa: row.empresa_id ? (empNomeCache[row.empresa_id] || row.empresa_nome || '') : (row.empresa_nome || ''),
          centro_custo: row.centro_custo_id ? (ccNomeCache[row.centro_custo_id] || row.codigo_centro || '') : (row.codigo_centro || ''),
          data_admissao: row.data_admissao || '',
          motivo: 'Funcionário não encontrado no agendamento de exames',
        });
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
      await supabase.from('bd_importacao_alterdata').delete().in('id', batch);
    }
  }

  // Fetch remaining errors
  const { data: remainingErrors } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('lote_importacao', loteId)
    .eq('status_processamento', 'erro');

  if (remainingErrors) {
    for (const se of remainingErrors) {
      const alreadyHas = result.erros.some(e => e.nome === (se.nome_funcionario || se.cpf || ''));
      if (!alreadyHas) {
        result.erros.push({
          linha: 0,
          nome: se.nome_funcionario || se.cpf || 'Desconhecido',
          cpf: se.cpf || '',
          motivo: se.erro || 'Erro desconhecido',
          departamento: se.departamento || '',
          empresa: se.empresa_nome || '',
        });
      }
    }
  }

  return result;
}

// ── REPROCESSAR ERROS ─────────────────────────────────────────

export async function reprocessStagingErrors(loteId: string): Promise<StagingAnalysisResult> {
  const { data: errorRows } = await supabase
    .from('bd_importacao_alterdata')
    .select('id')
    .eq('lote_importacao', loteId)
    .eq('status_processamento', 'erro');

  if (!errorRows || errorRows.length === 0) {
    return { linhasProcessadas: 0, validados: 0, erros: [], validadosNomes: [] };
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

  // Re-analyze
  return analyzeStaging(loteId);
}

// ── VERIFICAR IMPORTAÇÃO PENDENTE ─────────────────────────────

export interface PendingImportInfo {
  loteId: string;
  pendentes: number;
  validados: number;
  erros: number;
  total: number;
}

export async function checkPendingImport(): Promise<PendingImportInfo | null> {
  const { data, error } = await supabase
    .from('bd_importacao_alterdata')
    .select('status_processamento, lote_importacao')
    .in('status_processamento', ['pendente', 'validado', 'erro']);

  if (error || !data || data.length === 0) return null;

  const loteId = data[0].lote_importacao || '';
  let pendentes = 0, validados = 0, erros = 0;

  for (const row of data) {
    if (row.status_processamento === 'pendente') pendentes++;
    else if (row.status_processamento === 'validado') validados++;
    else if (row.status_processamento === 'erro') erros++;
  }

  return { loteId, pendentes, validados, erros, total: data.length };
}

// ── DESCARTAR IMPORTAÇÃO PENDENTE ─────────────────────────────

export async function discardPendingImport(loteId: string): Promise<void> {
  const { data } = await supabase
    .from('bd_importacao_alterdata')
    .select('id')
    .eq('lote_importacao', loteId);

  if (!data || data.length === 0) return;

  const ids = data.map(r => r.id);
  for (let b = 0; b < ids.length; b += 100) {
    const batch = ids.slice(b, b + 100);
    await supabase.from('bd_importacao_alterdata').delete().in('id', batch);
  }
}

// ── CARREGAR CONTADORES DO STAGING ────────────────────────────

export interface StagingCounts {
  total: number;
  pendentes: number;
  validados: number;
  erros: number;
  errorDetails: AlterdataImportError[];
}

export async function loadStagingCounts(loteId: string): Promise<StagingCounts> {
  const { data } = await supabase
    .from('bd_importacao_alterdata')
    .select('*')
    .eq('lote_importacao', loteId);

  if (!data || data.length === 0) {
    return { total: 0, pendentes: 0, validados: 0, erros: 0, errorDetails: [] };
  }

  let pendentes = 0, validados = 0, erros = 0;
  const errorDetails: AlterdataImportError[] = [];

  for (const row of data) {
    if (row.status_processamento === 'pendente') pendentes++;
    else if (row.status_processamento === 'validado') validados++;
    else if (row.status_processamento === 'erro') {
      erros++;
      errorDetails.push({
        linha: 0,
        nome: row.nome_funcionario || row.cpf || 'Desconhecido',
        cpf: row.cpf || '',
        motivo: row.erro || 'Erro desconhecido',
        departamento: row.departamento || '',
        empresa: row.empresa_nome || '',
      });
    }
  }

  return { total: data.length, pendentes, validados, erros, errorDetails };
}
