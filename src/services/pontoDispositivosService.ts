import { supabase } from "@/integrations/supabase/client";

export interface PontoDispositivoAdmin {
  id: string;
  nome: string;
  codigo_dispositivo: string;
  tipo: string;
  modo_operacao: string;
  centro_custo_id: string | null;
  ativo: boolean | null;
  ultimo_heartbeat: string | null;
  ultimo_login_at: string | null;
  ultimo_login_ip: string | null;
  device_fingerprint: string | null;
  created_at: string | null;
  updated_at: string | null;
  tem_senha: boolean;
}

export interface DispositivoCcVinculo {
  id: string;
  dispositivo_id: string;
  centro_custo_id: string;
  ativo: boolean;
  centro_custo?: {
    id: string;
    nome_centro_custo: string;
    codigo_centro_custo: string;
  };
}

export async function listarDispositivos(): Promise<PontoDispositivoAdmin[]> {
  const { data, error } = await supabase
    .from("vw_ponto_dispositivos_admin" as any)
    .select("*")
    .order("codigo_dispositivo", { ascending: true });
  if (error) throw error;
  return (data || []) as unknown as PontoDispositivoAdmin[];
}

export async function listarVinculosDispositivo(
  dispositivoId: string,
): Promise<DispositivoCcVinculo[]> {
  const { data, error } = await supabase
    .from("bd_ponto_dispositivo_centros_custo" as any)
    .select(
      "id, dispositivo_id, centro_custo_id, ativo, centro_custo:bd_centros_custo(id, nome_centro_custo, codigo_centro_custo)",
    )
    .eq("dispositivo_id", dispositivoId);
  if (error) throw error;
  return (data || []) as unknown as DispositivoCcVinculo[];
}

export async function listarTodosVinculosAtivos(): Promise<
  { dispositivo_id: string; centro_custo_id: string; centro_custo_nome: string }[]
> {
  const { data, error } = await supabase
    .from("bd_ponto_dispositivo_centros_custo" as any)
    .select(
      "dispositivo_id, centro_custo_id, centro_custo:bd_centros_custo(nome_centro_custo)",
    )
    .eq("ativo", true);
  if (error) throw error;
  return (data || []).map((r: any) => ({
    dispositivo_id: r.dispositivo_id,
    centro_custo_id: r.centro_custo_id,
    centro_custo_nome: r.centro_custo?.nome_centro_custo ?? "",
  }));
}

export interface DispositivoUpsertInput {
  id?: string;
  nome: string;
  codigo_dispositivo: string;
  ativo: boolean;
}

export async function criarDispositivo(input: DispositivoUpsertInput, ccPrincipal: string) {
  // centro_custo_id é NOT NULL legado: usamos o primeiro CC selecionado como "principal"
  const { data, error } = await supabase
    .from("bd_ponto_dispositivos")
    .insert({
      nome: input.nome,
      codigo_dispositivo: input.codigo_dispositivo.toUpperCase().trim(),
      ativo: input.ativo,
      tipo: "dispositivo_obra",
      modo_operacao: "compartilhado",
      centro_custo_id: ccPrincipal,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function atualizarDispositivo(input: DispositivoUpsertInput, ccPrincipal: string) {
  if (!input.id) throw new Error("id obrigatório");
  const { error } = await supabase
    .from("bd_ponto_dispositivos")
    .update({
      nome: input.nome,
      codigo_dispositivo: input.codigo_dispositivo.toUpperCase().trim(),
      ativo: input.ativo,
      centro_custo_id: ccPrincipal,
    })
    .eq("id", input.id)
    .eq("tipo", "dispositivo_obra");
  if (error) throw error;
}

export async function toggleAtivoDispositivo(id: string, ativo: boolean) {
  const { error } = await supabase
    .from("bd_ponto_dispositivos")
    .update({ ativo })
    .eq("id", id)
    .eq("tipo", "dispositivo_obra");
  if (error) throw error;
}

export async function vincularCcsDispositivo(
  dispositivo_id: string,
  centro_custo_ids: string[],
) {
  const { data, error } = await supabase.functions.invoke(
    "vincular-ccs-dispositivo",
    { body: { dispositivo_id, centro_custo_ids } },
  );
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}

export async function definirSenhaDispositivo(
  dispositivo_id: string,
  senha: string,
) {
  const { data, error } = await supabase.functions.invoke(
    "definir-senha-dispositivo",
    { body: { dispositivo_id, senha } },
  );
  if (error) throw error;
  if ((data as any)?.error) throw new Error((data as any).error);
  return data;
}
