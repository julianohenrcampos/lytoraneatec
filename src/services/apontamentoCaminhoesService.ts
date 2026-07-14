import { supabase } from "@/integrations/supabase/client";

// =============================================================
// Tipos públicos — Apontamento C&E + Inspeção (Fase 0)
// =============================================================

export type ChecklistValor = "OK" | "NAO_OK" | "NA";

export interface Caminhao {
  id: string;
  placa?: string;
  modelo?: string;
  situacao?: string;
  tipo_veiculo?: string;
  frota?: string;
  numero_frota?: string;
}

export interface ApontamentoCaminhao {
  id: string;
  data: string;
  operador_id: string | null;
  caminhao_equipamento_id: string | null;
  centro_custo_id: string | null;
  horimetro_inicial: number | null;
  hora_inicial: string | null;
  horimetro_final: number | null;
  hora_final: string | null;
  abastecimento: number | null;
  situacao: string | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  modificado_por?: string | null;

  // Join fields (leitura)
  nome_operador?: string;
  veiculo_identificacao?: string;
  nome_centro_custo?: string;
}

/**
 * Estrutura REAL da tabela `bd_registro_apontamento_inspecao`.
 * Fase 0 elimina campos-fantasma que nunca foram persistidos.
 * Fase R3 acrescenta as colunas do snapshot detalhado (podem vir NULL para registros legados).
 */
export interface ApontamentoInspecao {
  id: string;
  apontamento_caminhao_equipamento_id: string;
  nivel_oleo: ChecklistValor | null;
  nivel_agua: ChecklistValor | null;
  nivel_combustivel: ChecklistValor | null;
  pressao_pneus: ChecklistValor | null;
  estado_pneus: ChecklistValor | null;
  luzes_funcionamento: ChecklistValor | null;
  freios_funcionamento: ChecklistValor | null;
  direcao_funcionamento: ChecklistValor | null;
  equipamentos_seguranca: ChecklistValor | null;
  limpeza_veiculo: ChecklistValor | null;
  avarias_observadas: string | null;
  observacoes_gerais: string | null;
  fotos_inspecao: string[] | null;
  inspecao_aprovada: boolean | null;
  data_inspecao: string;
  hora_inspecao: string;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  modificado_por?: string | null;
  // R3 — snapshot detalhado (montado pelo servidor)
  checklist_codigo?: string | null;
  checklist_versao?: number | null;
  checklist_respostas?: unknown | null;
}

// R3: payload detalhado enviado ao RPC dentro de `p_inspecao`.
export interface InspecaoDetalhadaItem {
  item_codigo: string;
  status: ChecklistValor;
  observacao: string | null;
  fotos_paths: string[];
}
export interface InspecaoDetalhadaPayload {
  modo: "detalhado";
  template_codigo: string;
  template_versao: number;
  observacoes_gerais: string | null;
  fotos_gerais: string[];
  itens: InspecaoDetalhadaItem[];
}

/**
 * L1..L9 — bloco opcional de localização enviado dentro do cabeçalho.
 * CREATE: obrigatório. EDIT: ausência preserva a localização existente.
 * Origem é sempre forçada a `APONTAMENTO_CE` no servidor.
 */
export interface LocalizacaoApontamentoPayload {
  latitude: number;
  longitude: number;
  precisao_metros: number | null;
  capturado_em: string; // ISO
}

export interface CabecalhoApontamentoPayload {
  caminhao_equipamento_id: string;
  operador_id: string;
  centro_custo_id: string;
  data: string;
  hora_inicial: string | null;
  hora_final: string | null;
  horimetro_inicial: number | null;
  horimetro_final: number | null;
  situacao: string;
  abastecimento: number | null;
  localizacao?: LocalizacaoApontamentoPayload | null;
}

export interface LocalizacaoApontamentoRow {
  apontamento_id: string;
  equipamento_id: string;
  centro_custo_id: string | null;
  latitude: number;
  longitude: number;
  precisao_gps: number | null;
  data_registro: string;
  origem: string;
}

export interface InspecaoApontamentoPayload {
  nivel_oleo: ChecklistValor;
  nivel_agua: ChecklistValor;
  nivel_combustivel: ChecklistValor;
  pressao_pneus: ChecklistValor;
  estado_pneus: ChecklistValor;
  luzes_funcionamento: ChecklistValor;
  freios_funcionamento: ChecklistValor;
  direcao_funcionamento: ChecklistValor;
  equipamentos_seguranca: ChecklistValor;
  limpeza_veiculo: ChecklistValor;
  avarias_observadas: string | null;
  observacoes_gerais: string | null;
  fotos_inspecao: string[];
}

export interface SalvarApontamentoResult {
  apontamento_id: string;
  inspecao_id: string;
}

export interface ExcluirApontamentoResult {
  apontamento_id: string;
  inspecoes_removidas: number;
  fotos_paths: string[];
}

export interface ApontamentoFilterParams {
  data_inicio?: string;
  data_fim?: string;
  caminhao_equipamento_id?: string;
  operador_id?: string;
  centro_custo_id?: string;
}

// =============================================================
// Mapa de erros da RPC → mensagens em PT-BR
// =============================================================

const RPC_ERROR_MESSAGES: Record<string, string> = {
  auth_required: "Você precisa estar autenticado para salvar o apontamento.",
  apontamento_id_obrigatorio: "Identificador do apontamento não informado.",
  cabecalho_invalido: "Dados do apontamento em formato inválido.",
  inspecao_invalida: "Dados da inspeção em formato inválido.",
  cabecalho_campos_obrigatorios:
    "Preencha todos os campos obrigatórios (equipamento, operador, centro de custo, data e situação).",
  caminhao_equipamento_inexistente: "O caminhão/equipamento selecionado não foi encontrado.",
  operador_invalido_ou_inativo: "O operador selecionado não está ativo.",
  centro_custo_inexistente: "O centro de custo selecionado não foi encontrado.",
  horimetro_inicial_negativo: "Horímetro inicial não pode ser negativo.",
  horimetro_final_negativo: "Horímetro final não pode ser negativo.",
  horimetro_final_menor_que_inicial:
    "Horímetro final não pode ser menor que o inicial.",
  abastecimento_negativo: "Abastecimento não pode ser negativo.",
  inspecao_incompleta:
    "Preencha todos os itens do checklist (Conforme, Não conforme ou Não aplicável).",
  nao_conformidade_sem_observacao:
    "Há itens Não conformes. Descreva em Avarias observadas ou Observações gerais.",
  fotos_formato_invalido: "Formato inválido para a lista de fotos.",
  fotos_path_invalido: "Uma das fotos possui caminho inválido. Reenvie-a.",
  forbidden_scope: "Você não tem permissão para criar apontamento neste centro de custo.",
  forbidden_row: "Você não tem permissão para alterar este apontamento.",
  forbidden_scope_novo_cc:
    "Você não tem permissão para mover este apontamento para o centro de custo selecionado.",
  apontamento_inexistente: "Apontamento não encontrado.",
  localizacao_obrigatoria:
    "Não foi possível obter a localização (GPS). Ative o GPS e tente novamente.",
  localizacao_payload_invalido:
    "Dados de localização em formato inválido. Tente capturar novamente.",
  localizacao_latitude_invalida: "Latitude capturada é inválida.",
  localizacao_longitude_invalida: "Longitude capturada é inválida.",
  localizacao_coordenadas_incompletas:
    "Coordenadas incompletas. Tente capturar novamente.",
  localizacao_zero_zero:
    "A posição capturada é inválida (0,0). Tente capturar novamente com o GPS ativo.",
  localizacao_precisao_invalida: "Precisão do GPS inválida.",
  localizacao_data_futura: "Horário da captura fora do intervalo válido.",
  localizacao_apontamento_obrigatorio: "Vínculo com o apontamento é obrigatório.",
  localizacao_data_obrigatoria: "Horário da captura é obrigatório.",
  forbidden_equipamento:
    "Você não tem permissão para registrar localização deste equipamento.",
};

export function traduzirErroRpc(err: any, apontamentoId?: string): string {
  const raw = String(err?.message || "").trim();
  const key = raw.split(":")[0]?.trim();
  const msg = RPC_ERROR_MESSAGES[key] || RPC_ERROR_MESSAGES[raw] || null;

  // eslint-disable-next-line no-console
  console.error("[apontamento-ce] RPC error", {
    code: err?.code,
    message: err?.message,
    details: err?.details,
    hint: err?.hint,
    apontamentoId,
  });

  if (msg) return msg;
  if (err?.code === "42501") return "Você não tem permissão para esta operação.";
  return "Não foi possível concluir a operação. Tente novamente.";
}

// =============================================================
// Leituras
// =============================================================

export const fetchApontamentos = async (
  filters: ApontamentoFilterParams = {}
): Promise<ApontamentoCaminhao[]> => {
  try {
    let query = supabase
      .from("bd_registro_apontamento_cam_equipa")
      .select(
        `
        *,
        operador:operador_id(id, nome_completo),
        veiculo:caminhao_equipamento_id(id, placa, frota, numero_frota),
        centro_custo:centro_custo_id(id, nome_centro_custo, codigo_centro_custo)
      `
      )
      .order("data", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.data_inicio && filters.data_fim) {
      query = query.gte("data", filters.data_inicio).lte("data", filters.data_fim);
    } else if (filters.data_inicio) {
      query = query.gte("data", filters.data_inicio);
    } else if (filters.data_fim) {
      query = query.lte("data", filters.data_fim);
    }
    if (filters.caminhao_equipamento_id)
      query = query.eq("caminhao_equipamento_id", filters.caminhao_equipamento_id);
    if (filters.operador_id) query = query.eq("operador_id", filters.operador_id);
    if (filters.centro_custo_id)
      query = query.eq("centro_custo_id", filters.centro_custo_id);

    const { data, error } = await query;
    if (error) throw error;

    return (data || []).map((item: any) => ({
      ...item,
      nome_operador: item.operador?.nome_completo || "Não informado",
      veiculo_identificacao: formatarIdentificacaoVeiculo(item),
      nome_centro_custo: item.centro_custo?.codigo_centro_custo || "Não informado",
    }));
  } catch (error) {
    console.error("Erro ao buscar apontamentos:", error);
    throw new Error("Falha ao buscar dados de apontamentos");
  }
};

const formatarIdentificacaoVeiculo = (item: any): string => {
  if (!item.veiculo) return "Não informado";
  const frota = item.veiculo.frota || "";
  const numeroFrota = item.veiculo.numero_frota || "";
  const placa = item.veiculo.placa || "";
  if (frota && placa) return `${frota}${numeroFrota} - ${placa}`;
  return placa || frota || "Veículo sem identificação";
};

/**
 * Busca cabeçalho + inspeção (linha mais recente, determinística).
 */
export const fetchApontamentoById = async (
  id: string
): Promise<{ apontamento: ApontamentoCaminhao; inspecao: ApontamentoInspecao | null }> => {
  const { data: apontamento, error: apontamentoError } = await supabase
    .from("bd_registro_apontamento_cam_equipa")
    .select(
      `
      *,
      operador:operador_id(id, nome_completo),
      veiculo:caminhao_equipamento_id(id, placa, frota, situacao),
      centro_custo:centro_custo_id(id, nome_centro_custo, codigo_centro_custo)
    `
    )
    .eq("id", id)
    .single();

  if (apontamentoError) throw apontamentoError;

  const { data: inspecao, error: inspecaoError } = await supabase
    .from("bd_registro_apontamento_inspecao")
    .select("*")
    .eq("apontamento_caminhao_equipamento_id", id)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (inspecaoError) throw inspecaoError;

  return {
    apontamento: {
      ...(apontamento as any),
      nome_operador: (apontamento as any).operador?.nome_completo || "Não informado",
      veiculo_identificacao: formatarIdentificacaoVeiculo(apontamento),
      nome_centro_custo:
        (apontamento as any).centro_custo?.codigo_centro_custo || "Não informado",
    },
    inspecao: (inspecao as unknown as ApontamentoInspecao) || null,
  };
};

/**
 * Busca apenas os paths de fotos da inspeção atual (usado antes do DELETE
 * como fallback caso a RPC falhe no meio).
 */
export const buscarFotosInspecao = async (apontamentoId: string): Promise<string[]> => {
  const { data, error } = await supabase
    .from("bd_registro_apontamento_inspecao")
    .select("fotos_inspecao")
    .eq("apontamento_caminhao_equipamento_id", apontamentoId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[apontamento-ce] buscarFotosInspecao erro:", error);
    return [];
  }
  return ((data as any)?.fotos_inspecao as string[]) || [];
};

/**
 * L1..L9 — Localização já registrada para o apontamento (para hidratação em EDIT).
 * Retorna null quando não houver linha. RLS já filtra pelo escopo do usuário.
 */
export const fetchLocalizacaoByApontamento = async (
  apontamentoId: string
): Promise<LocalizacaoApontamentoRow | null> => {
  if (!apontamentoId) return null;
  const { data, error } = await (supabase as any)
    .from("bd_localizacao_equipamentos")
    .select(
      "apontamento_id, equipamento_id, centro_custo_id, latitude, longitude, precisao_gps, data_registro, origem"
    )
    .eq("apontamento_id", apontamentoId)
    .maybeSingle();
  if (error) {
    console.error("[apontamento-ce] fetchLocalizacaoByApontamento erro:", error);
    return null;
  }
  return (data as LocalizacaoApontamentoRow) || null;
};

// =============================================================
// Escrita — SOMENTE via RPC transacional
// =============================================================

export const salvarApontamentoComInspecao = async (
  apontamentoId: string,
  cabecalho: CabecalhoApontamentoPayload,
  inspecao: InspecaoApontamentoPayload | InspecaoDetalhadaPayload
): Promise<SalvarApontamentoResult> => {
  const { data, error } = await (supabase as any).rpc(
    "fn_salvar_apontamento_ce_com_inspecao",
    {
      p_apontamento_id: apontamentoId,
      p_cabecalho: cabecalho,
      p_inspecao: inspecao,
    }
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    apontamento_id: row?.apontamento_id,
    inspecao_id: row?.inspecao_id,
  };
};

export const excluirApontamentoComInspecao = async (
  apontamentoId: string
): Promise<ExcluirApontamentoResult> => {
  const { data, error } = await (supabase as any).rpc(
    "fn_excluir_apontamento_ce_com_inspecao",
    { p_apontamento_id: apontamentoId }
  );
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    apontamento_id: row?.apontamento_id,
    inspecoes_removidas: row?.inspecoes_removidas ?? 0,
    fotos_paths: (row?.fotos_paths as string[]) || [],
  };
};

/**
 * Confirmação após erro de transporte.
 */
export type ConfirmacaoResult =
  | { status: "match"; fotosPersistidas: string[] }
  | { status: "mismatch"; fotosPersistidas: string[] }
  | { status: "unknown"; fotosPersistidas: string[] };

const normText = (v: unknown): string => {
  if (v === undefined || v === null) return "";
  return String(v).trim();
};
const normNum = (v: unknown): string => {
  if (v === undefined || v === null || v === "") return "";
  const n = typeof v === "number" ? v : Number(v);
  if (Number.isNaN(n)) return "";
  return String(n);
};
const normTime = (v: unknown): string => {
  const s = normText(v);
  if (!s) return "";
  const m = s.match(/^(\d{2}):(\d{2})(?::\d{2})?/);
  return m ? `${m[1]}:${m[2]}` : s;
};
const normFotos = (v: unknown): string[] =>
  Array.isArray(v) ? [...(v as string[])].map(String).sort() : [];

export const confirmarApontamentoPersistido = async (params: {
  apontamentoId: string;
  cabecalhoEsperado: CabecalhoApontamentoPayload;
  inspecaoEsperada: InspecaoApontamentoPayload;
}): Promise<ConfirmacaoResult> => {
  const { apontamentoId, cabecalhoEsperado, inspecaoEsperada } = params;
  try {
    const [{ data: cab, error: e1 }, { data: insp, error: e2 }] = await Promise.all([
      supabase
        .from("bd_registro_apontamento_cam_equipa")
        .select(
          "caminhao_equipamento_id, operador_id, centro_custo_id, data, hora_inicial, hora_final, horimetro_inicial, horimetro_final, situacao, abastecimento"
        )
        .eq("id", apontamentoId)
        .maybeSingle(),
      supabase
        .from("bd_registro_apontamento_inspecao")
        .select("*")
        .eq("apontamento_caminhao_equipamento_id", apontamentoId)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (e1 || e2) return { status: "unknown", fotosPersistidas: [] };
    if (!cab || !insp) return { status: "unknown", fotosPersistidas: [] };

    const cabOk =
      normText((cab as any).caminhao_equipamento_id) === normText(cabecalhoEsperado.caminhao_equipamento_id) &&
      normText((cab as any).operador_id) === normText(cabecalhoEsperado.operador_id) &&
      normText((cab as any).centro_custo_id) === normText(cabecalhoEsperado.centro_custo_id) &&
      normText((cab as any).data) === normText(cabecalhoEsperado.data) &&
      normTime((cab as any).hora_inicial) === normTime(cabecalhoEsperado.hora_inicial) &&
      normTime((cab as any).hora_final) === normTime(cabecalhoEsperado.hora_final) &&
      normNum((cab as any).horimetro_inicial) === normNum(cabecalhoEsperado.horimetro_inicial) &&
      normNum((cab as any).horimetro_final) === normNum(cabecalhoEsperado.horimetro_final) &&
      normText((cab as any).situacao) === normText(cabecalhoEsperado.situacao) &&
      normNum((cab as any).abastecimento) === normNum(cabecalhoEsperado.abastecimento);

    const camposChecklist: (keyof InspecaoApontamentoPayload)[] = [
      "nivel_oleo",
      "nivel_agua",
      "nivel_combustivel",
      "pressao_pneus",
      "estado_pneus",
      "luzes_funcionamento",
      "freios_funcionamento",
      "direcao_funcionamento",
      "equipamentos_seguranca",
      "limpeza_veiculo",
    ];
    const inspOk =
      camposChecklist.every(
        (k) => normText((insp as any)[k]) === normText((inspecaoEsperada as any)[k])
      ) &&
      normText((insp as any).avarias_observadas) === normText(inspecaoEsperada.avarias_observadas) &&
      normText((insp as any).observacoes_gerais) === normText(inspecaoEsperada.observacoes_gerais) &&
      JSON.stringify(normFotos((insp as any).fotos_inspecao)) ===
        JSON.stringify(normFotos(inspecaoEsperada.fotos_inspecao)) &&
      Boolean((insp as any).inspecao_aprovada) ===
        !camposChecklist.some((k) => (inspecaoEsperada as any)[k] === "NAO_OK");

    const fotosPersistidas = ((insp as any).fotos_inspecao as string[]) || [];
    return {
      status: cabOk && inspOk ? "match" : "mismatch",
      fotosPersistidas,
    };
  } catch (err) {
    console.error("[apontamento-ce] confirmarApontamentoPersistido erro:", err);
    return { status: "unknown", fotosPersistidas: [] };
  }
};

// =============================================================
// Storage
// =============================================================

const MIME_OK = ["image/jpeg", "image/png", "image/webp"] as const;
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Upload de foto de inspeção. Path relativo ao bucket `apontamentos`.
 * Retorna somente o path (nunca URL).
 */
export const uploadFotoAvaria = async (
  apontamentoId: string,
  file: File
): Promise<string> => {
  if (!apontamentoId) throw new Error("apontamento_id_obrigatorio");
  if (!file) throw new Error("Arquivo inválido");
  if (!MIME_OK.includes(file.type as any)) {
    throw new Error("Formato não suportado. Envie JPG, PNG ou WebP.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivo excede 5 MB.");
  }
  const ext = EXT_BY_MIME[file.type] || "jpg";
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${apontamentoId}/${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from("apontamentos")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[apontamento-ce] upload erro:", error);
    throw new Error("Falha ao enviar imagem.");
  }
  return path;
};

/**
 * R3 — upload de foto de item de checklist detalhado.
 * Path: <apontamentoId>/checklist/<itemCodigo>/<uuid>.<ext>
 */
export const uploadFotoChecklistItem = async (
  apontamentoId: string,
  itemCodigo: string,
  file: File
): Promise<string> => {
  if (!apontamentoId) throw new Error("apontamento_id_obrigatorio");
  if (!itemCodigo || !/^[a-z0-9_]+$/.test(itemCodigo))
    throw new Error("item_codigo_invalido");
  if (!file) throw new Error("Arquivo inválido");
  if (!MIME_OK.includes(file.type as any)) {
    throw new Error("Formato não suportado. Envie JPG, PNG ou WebP.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("Arquivo excede 5 MB.");
  }
  const ext = EXT_BY_MIME[file.type] || "jpg";
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const path = `${apontamentoId}/checklist/${itemCodigo}/${uuid}.${ext}`;

  const { error } = await supabase.storage
    .from("apontamentos")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.error("[apontamento-ce] upload checklist erro:", error);
    throw new Error("Falha ao enviar imagem do checklist.");
  }
  return path;
};

/**
 * R3 — coleta todos os storage paths presentes num snapshot detalhado.
 */
export function coletarFotosDoSnapshot(respostas: unknown): string[] {
  if (!respostas || typeof respostas !== "object") return [];
  const r = respostas as any;
  const paths: string[] = [];
  if (Array.isArray(r.fotos_gerais)) paths.push(...r.fotos_gerais.filter((x: any) => typeof x === "string"));
  if (Array.isArray(r.grupos)) {
    for (const g of r.grupos) {
      if (!Array.isArray(g?.itens)) continue;
      for (const it of g.itens) {
        if (Array.isArray(it?.fotos)) {
          paths.push(...it.fotos.filter((x: any) => typeof x === "string"));
        }
      }
    }
  }
  return paths;
}

/**
 * R3 — normaliza um snapshot detalhado para comparação estável.
 */
export function normalizeSnapshot(respostas: unknown): string {
  if (!respostas || typeof respostas !== "object") return "";
  const r = respostas as any;
  const flat: Array<{ codigo: string; status: any; observacao: any; fotos: string[] }> = [];
  if (Array.isArray(r.grupos)) {
    for (const g of r.grupos) {
      if (!Array.isArray(g?.itens)) continue;
      for (const it of g.itens) {
        flat.push({
          codigo: String(it?.codigo ?? ""),
          status: it?.status ?? null,
          observacao: it?.observacao ?? null,
          fotos: Array.isArray(it?.fotos) ? [...it.fotos].map(String).sort() : [],
        });
      }
    }
  }
  flat.sort((a, b) => a.codigo.localeCompare(b.codigo));
  return JSON.stringify({
    template_codigo: r.template_codigo ?? null,
    template_versao: r.template_versao ?? null,
    itens: flat,
  });
}

/**
 * R3 — confirmação após timeout de RPC para o modo detalhado.
 * Compara checklist_codigo, checklist_versao e snapshot normalizado.
 */
export const confirmarApontamentoDetalhadoPersistido = async (params: {
  apontamentoId: string;
  esperado: InspecaoDetalhadaPayload;
}): Promise<ConfirmacaoResult> => {
  const { apontamentoId, esperado } = params;
  try {
    const { data: insp, error } = await supabase
      .from("bd_registro_apontamento_inspecao")
      .select("checklist_codigo, checklist_versao, checklist_respostas")
      .eq("apontamento_caminhao_equipamento_id", apontamentoId)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !insp) return { status: "unknown", fotosPersistidas: [] };
    const respostas = (insp as any).checklist_respostas;
    const persistedNorm = normalizeSnapshot(respostas);
    const expectedNorm = normalizeSnapshot({
      template_codigo: esperado.template_codigo,
      template_versao: esperado.template_versao,
      grupos: [
        {
          itens: esperado.itens.map((i) => ({
            codigo: i.item_codigo,
            status: i.status,
            observacao: i.observacao,
            fotos: i.fotos_paths,
          })),
        },
      ],
    });
    const codigoOk =
      String((insp as any).checklist_codigo || "") === String(esperado.template_codigo) &&
      Number((insp as any).checklist_versao || 0) === Number(esperado.template_versao);
    const fotos = coletarFotosDoSnapshot(respostas);
    return {
      status: codigoOk && persistedNorm === expectedNorm ? "match" : "mismatch",
      fotosPersistidas: fotos,
    };
  } catch (err) {
    console.error("[apontamento-ce] confirmarDetalhado exceção:", err);
    return { status: "unknown", fotosPersistidas: [] };
  }
};

/**
 * Cleanup best-effort. Nunca falha o fluxo; loga paths não removidos.
 */
export const removerFotosStorage = async (paths: string[]): Promise<void> => {
  if (!paths || paths.length === 0) return;
  try {
    const { data, error } = await supabase.storage.from("apontamentos").remove(paths);
    if (error) {
      console.warn("[apontamento-ce] cleanup fotos (parcial):", { error, paths });
      return;
    }
    const removed = new Set((data || []).map((d: any) => d?.name).filter(Boolean));
    const naoRemovidos = paths.filter((p) => !removed.has(p));
    if (naoRemovidos.length > 0) {
      console.warn("[apontamento-ce] cleanup fotos: paths não removidos", naoRemovidos);
    }
  } catch (err) {
    console.warn("[apontamento-ce] cleanup fotos exceção:", err);
  }
};

export const getSignedFotoUrl = async (path: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.storage
      .from("apontamentos")
      .createSignedUrl(path, 300);
    if (error) {
      console.warn("[apontamento-ce] signedUrl erro:", { error, path });
      return null;
    }
    return data?.signedUrl || null;
  } catch (err) {
    console.warn("[apontamento-ce] signedUrl exceção:", err);
    return null;
  }
};

// =============================================================
// Utilitário legado ainda usado por outras telas
// =============================================================

export const getUltimoHorimetro = async (caminhaoId: string): Promise<number | null> => {
  try {
    const { data, error } = await (supabase as any).rpc("get_ultimo_horimetro_privilegiado", {
      caminhao_id: caminhaoId,
    });
    if (error) {
      console.error("Erro ao buscar último horímetro:", error);
      return null;
    }
    return data !== null && data > 0 ? (data as number) : null;
  } catch (error) {
    console.error("Erro ao buscar último horímetro:", error);
    return null;
  }
};

export const fetchFuncionariosOperacionais = async (): Promise<
  Array<{ id: string; label: string }>
> => {
  try {
    const { data, error } = await supabase
      .from("bd_funcionarios")
      .select(
        `
        id,
        nome_completo,
        status,
        bd_funcoes (nome_funcao)
      `
      )
      .in("status", ["Ativo", "Ativo sem Registro"])
      .not("bd_funcoes.nome_funcao", "is", null)
      .in("bd_funcoes.nome_funcao", ["Operador", "Encarregado", "Apontador", "Mestre de Obra"])
      .order("nome_completo");

    if (error) {
      console.warn("fetchFuncionariosOperacionais fallback:", error.message);
      const { data: basicData, error: basicError } = await supabase
        .from("bd_funcionarios")
        .select("id, nome_completo")
        .in("status", ["Ativo", "Ativo sem Registro"])
        .order("nome_completo");
      if (basicError) return [];
      return (basicData || []).map((f: any) => ({ id: f.id, label: f.nome_completo }));
    }
    return (data || []).map((f: any) => ({ id: f.id, label: f.nome_completo }));
  } catch (error) {
    console.error("Erro ao buscar funcionários operacionais:", error);
    return [];
  }
};

// =============================================================
// Compat legada — stubs para calls remanescentes.
// =============================================================

/** @deprecated Use salvarApontamentoComInspecao. */
export const createApontamento = async (): Promise<string> => {
  throw new Error(
    "createApontamento foi removido. Use salvarApontamentoComInspecao via a nova RPC."
  );
};

/** @deprecated Use salvarApontamentoComInspecao. */
export const updateApontamento = async (): Promise<void> => {
  throw new Error(
    "updateApontamento foi removido. Use salvarApontamentoComInspecao via a nova RPC."
  );
};

/** @deprecated Use excluirApontamentoComInspecao. */
export const deleteApontamento = async (): Promise<void> => {
  throw new Error(
    "deleteApontamento foi removido. Use excluirApontamentoComInspecao via a nova RPC."
  );
};
