/**
 * Hooks React Query para o módulo Chamados Internos (F1).
 * Centraliza query keys e invalidação cirúrgica. Sem Realtime nesta fase.
 */
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import * as svc from "@/services/chamadosInternosService";
import type {
  ChamadoInternoAbrirInput,
  ChamadoInternoEnriquecimentoRow,

  ChamadoInternoSetor,
  ChamadoInternoStatus,
  ChamadosInternosListaFiltro,
} from "@/types/chamadosInternos";

/** Enum fixo de setores (6 valores). Estável — mantém o número de queries
 *  do `useQueries` constante entre renders, atendendo às regras dos hooks. */
export const CHAMADO_INTERNO_SETORES: ReadonlyArray<ChamadoInternoSetor> = [
  "administracao",
  "financeiro",
  "ti",
  "manutencao",
  "eletrica",
  "sso",
];

// ---------------- Query keys ----------------
export const CHAMADOS_INTERNOS_KEYS = {
  root:          ["chamados-internos"] as const,
  lista:         (filtro: ChamadosInternosListaFiltro = {}) =>
    ["chamados-internos", "lista", filtro] as const,
  item:          (id: string) => ["chamados-internos", "item", id] as const,
  eventos:       (id: string) => ["chamados-internos", "eventos", id] as const,
  categorias:    () => ["chamados-internos", "categorias"] as const,
  ccsAbertura:   () => ["chamados-internos", "ccs-abertura"] as const,
  solicitantes:  (ccId: string) => ["chamados-internos", "solicitantes", ccId] as const,
  atendentes:    (setor: ChamadoInternoSetor) => ["chamados-internos", "atendentes", setor] as const,
  capacidade:    (kind: "cc-abertura" | "atender" | "leitura" | "operar", arg: string) =>
    ["chamados-internos", "capacidade", kind, arg] as const,
  profilesAdmin: (busca: string) => ["chamados-internos", "profiles-admin", busca] as const,
  filaAtendimento: (params: { status?: ChamadoInternoStatus[]; setor?: ChamadoInternoSetor | null }) =>
    ["chamados-internos", "fila-atendimento", params] as const,
  pessoas: (id: string) => ["chamados-internos", "pessoas", id] as const,
  anexos: (id: string) => ["chamados-internos", "anexos", id] as const,
  enriquecimento: (ids: string[]) =>
    ["chamados-internos", "enriquecimento", [...ids].sort().join(",")] as const,
};

/**
 * Enriquecimento (CC + solicitante) para um conjunto de chamados já visíveis.
 * Fail-soft: em caso de erro devolve mapa vazio — a UI apenas omite os extras.
 */
export function useChamadoInternoEnriquecimento(ids: string[]) {
  const idsEstaveis = Array.from(new Set(ids.filter(Boolean))).sort();
  const query = useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.enriquecimento(idsEstaveis),
    queryFn: () => svc.enriquecerChamados(idsEstaveis),
    enabled: idsEstaveis.length > 0,
    staleTime: 60_000,
  });

  const mapa = new Map<string, ChamadoInternoEnriquecimentoRow>();
  for (const row of query.data ?? []) mapa.set(row.chamado_id, row);
  return { mapa, isLoading: query.isLoading };
}


/**
 * Fila de atendimento (RPC única). Backend aplica escopo SuperAdm/AdmSede/Atendente.
 * NÃO combinar com `useChamadoInternoSetoresAutorizados` como gate.
 */
export function useChamadoInternoFilaAtendimento(
  params: { status?: ChamadoInternoStatus[]; setor?: ChamadoInternoSetor | null } = {},
) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.filaAtendimento(params),
    queryFn: () => svc.listarFilaAtendimento(params),
  });
}

export function useChamadoInternoProfilesAdmin(busca = "") {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.profilesAdmin(busca),
    queryFn: () => svc.listarProfilesAdminSafe(busca),
  });
}

// ---------------- Queries ----------------
export function useChamadosInternosLista(
  filtro: ChamadosInternosListaFiltro = {},
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.lista(filtro),
    queryFn: () => svc.listarChamados(filtro),
    enabled: options.enabled ?? true,
  });
}

/**
 * Setores em que o usuário atual está apto a atender.
 * Implementado com um único `useQueries` sobre o enum fixo de 6 setores
 * (nunca chame `useChamadoInternoCapacidadeAtender` dentro de `.map`/loops).
 */
export function useChamadoInternoSetoresAutorizados() {
  const results = useQueries({
    queries: CHAMADO_INTERNO_SETORES.map((setor) => ({
      queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("atender", setor),
      queryFn: () => svc.canAttend(setor),
      staleTime: 60_000,
    })),
  });
  const isLoading = results.some((r) => r.isLoading);
  const isError = results.some((r) => r.isError);
  const setoresAutorizados = CHAMADO_INTERNO_SETORES.filter(
    (_, i) => results[i]?.data === true,
  );
  return { setoresAutorizados, isLoading, isError };
}

export function useChamadoInterno(id: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.item(id ?? ""),
    queryFn: () => svc.obterChamado(id as string),
    enabled: !!id,
  });
}

export function useChamadoInternoEventos(id: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.eventos(id ?? ""),
    queryFn: () => svc.listarEventos(id as string),
    enabled: !!id,
  });
}

export function useChamadoInternoCategorias() {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.categorias(),
    queryFn: () => svc.listarCategoriasAtivas(),
  });
}

export function useChamadoInternoCcsAbertura() {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.ccsAbertura(),
    queryFn: () => svc.listarCcsAbertura(),
  });
}

export function useChamadoInternoSolicitantesDoCc(ccId: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.solicitantes(ccId ?? ""),
    queryFn: () => svc.listarSolicitantesDoCc(ccId as string),
    enabled: !!ccId,
  });
}

export function useChamadoInternoAtendentesSetor(setor: ChamadoInternoSetor | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.atendentes(setor as ChamadoInternoSetor),
    queryFn: () => svc.atendentesListar(setor as ChamadoInternoSetor),
    enabled: !!setor,
  });
}

export function useChamadoInternoCapacidadeCcAbertura(ccId: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("cc-abertura", ccId ?? ""),
    queryFn: () => svc.canOpenCc(ccId as string),
    enabled: !!ccId,
  });
}

export function useChamadoInternoCapacidadeAtender(setor: ChamadoInternoSetor | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("atender", setor ?? ""),
    queryFn: () => svc.canAttend(setor as ChamadoInternoSetor),
    enabled: !!setor,
  });
}

export function useChamadoInternoCapacidadeLeitura(chamadoId: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("leitura", chamadoId ?? ""),
    queryFn: () => svc.canRead(chamadoId as string),
    enabled: !!chamadoId,
  });
}

/**
 * Fonte única de autorização operacional no detalhe.
 * Consome `fn_chamado_interno_can_operate(chamado_id)` — cobre SuperAdm,
 * AdmSede (por CC) e Atendente (por setor), sem depender de `can_attend`.
 */
export function useChamadoInternoCapacidadeOperar(chamadoId: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", chamadoId ?? ""),
    queryFn: () => svc.canOperate(chamadoId as string),
    enabled: !!chamadoId,
    staleTime: 30_000,
  });
}

/** Nomes completos do solicitante, de quem abriu e do responsável. */
export function useChamadoInternoPessoas(chamadoId: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.pessoas(chamadoId ?? ""),
    queryFn: () => svc.obterPessoasChamado(chamadoId as string),
    enabled: !!chamadoId,
    staleTime: 60_000,
  });
}

/** Anexos (imagens/PDF) de um chamado. */
export function useChamadoInternoAnexos(chamadoId: string | undefined) {
  return useQuery({
    queryKey: CHAMADOS_INTERNOS_KEYS.anexos(chamadoId ?? ""),
    queryFn: () => svc.listarAnexos(chamadoId as string),
    enabled: !!chamadoId,
  });
}

/** Upload + registro de anexos de um chamado (opcionalmente vinculados a um evento). */
export function useChamadoInternoAnexar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { chamadoId: string; eventoId?: string | null; arquivos: File[] }) =>
      svc.anexarArquivos(vars.chamadoId, vars.eventoId ?? null, vars.arquivos),
    onSuccess: (_d, vars) => {
      void qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.anexos(vars.chamadoId) });
    },
  });
}

// ---------------- Helpers de invalidação ----------------
function useInvalidacoes() {
  const qc = useQueryClient();
  return {
    lista: () => qc.invalidateQueries({ queryKey: ["chamados-internos", "lista"] }),
    fila: () => qc.invalidateQueries({ queryKey: ["chamados-internos", "fila-atendimento"] }),
    item:  (id: string) => qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.item(id) }),
    eventos: (id: string) => qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.eventos(id) }),
    capacidadeOperar: (id: string) =>
      qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.capacidade("operar", id) }),
    atendentes: (setor: ChamadoInternoSetor) =>
      qc.invalidateQueries({ queryKey: CHAMADOS_INTERNOS_KEYS.atendentes(setor) }),
  };
}

// ---------------- Mutations ----------------
export function useChamadoInternoAbrir() {
  const inv = useInvalidacoes();
  return useMutation({
    mutationFn: (input: ChamadoInternoAbrirInput) => svc.abrir(input),
    onSuccess: () => { void inv.lista(); },
  });
}

function useAcaoChamado<TArgs>(fn: (chamadoId: string, args: TArgs) => Promise<void>) {
  const inv = useInvalidacoes();
  return useMutation({
    mutationFn: async (vars: { chamadoId: string } & (TArgs extends void ? object : { args: TArgs })) => {
      // @ts-expect-error — união condicional em runtime; args opcional
      await fn(vars.chamadoId, vars.args as TArgs);
    },
    onSuccess: (_data, vars) => {
      void inv.item(vars.chamadoId);
      void inv.eventos(vars.chamadoId);
      void inv.capacidadeOperar(vars.chamadoId);
      void inv.lista();
      void inv.fila();
    },
  });
}

export function useChamadoInternoAssumir() {
  const inv = useInvalidacoes();
  return useMutation({
    mutationFn: (chamadoId: string) => svc.assumir(chamadoId),
    onSuccess: (_d, chamadoId) => {
      void inv.item(chamadoId);
      void inv.eventos(chamadoId);
      void inv.capacidadeOperar(chamadoId);
      void inv.lista();
      void inv.fila();
    },
  });
}

export function useChamadoInternoResponder() {
  return useAcaoChamado<string>((id, msg) => svc.responder(id, msg));
}
export function useChamadoInternoSolicitarInformacao() {
  return useAcaoChamado<string>((id, msg) => svc.solicitarInformacao(id, msg));
}
export function useChamadoInternoAdicionarNotaInterna() {
  return useAcaoChamado<string>((id, msg) => svc.adicionarNotaInterna(id, msg));
}
export function useChamadoInternoResolver() {
  return useAcaoChamado<string>((id, msg) => svc.resolver(id, msg));
}
export function useChamadoInternoResponderSolicitante() {
  return useAcaoChamado<string>((id, msg) => svc.responderSolicitante(id, msg));
}
export function useChamadoInternoReabrir() {
  return useAcaoChamado<string>((id, msg) => svc.reabrir(id, msg));
}
export function useChamadoInternoCancelar() {
  return useAcaoChamado<string>((id, motivo) => svc.cancelar(id, motivo));
}

export interface ConfirmarEncerramentoVars {
  chamadoId: string;
  nota?: number | null;
  comentario?: string | null;
}

export function useChamadoInternoConfirmarEncerramento() {
  const inv = useInvalidacoes();
  return useMutation({
    mutationFn: (vars: string | ConfirmarEncerramentoVars) =>
      typeof vars === "string"
        ? svc.confirmarEncerramento(vars)
        : svc.confirmarEncerramento(vars.chamadoId, vars.nota, vars.comentario),
    onSuccess: (_d, vars) => {
      const chamadoId = typeof vars === "string" ? vars : vars.chamadoId;
      void inv.item(chamadoId);
      void inv.eventos(chamadoId);
      void inv.capacidadeOperar(chamadoId);
      void inv.lista();
      void inv.fila();
    },
  });
}


export function useChamadoInternoAtendenteVincular() {
  const inv = useInvalidacoes();
  return useMutation({
    mutationFn: (vars: { profileId: string; setor: ChamadoInternoSetor }) =>
      svc.atendenteVincular(vars.profileId, vars.setor),
    onSuccess: (_d, vars) => { void inv.atendentes(vars.setor); },
  });
}

export function useChamadoInternoAtendenteDesativar() {
  const inv = useInvalidacoes();
  return useMutation({
    mutationFn: (vars: { vinculoId: string; setor: ChamadoInternoSetor }) =>
      svc.atendenteDesativar(vars.vinculoId),
    onSuccess: (_d, vars) => { void inv.atendentes(vars.setor); },
  });
}
