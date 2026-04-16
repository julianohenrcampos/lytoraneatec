import { supabase } from "@/integrations/supabase/client";

function calcularDistanciaMetros(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface DeteccaoCCResult {
  centro_custo_id: string | null;
  nome: string | null;
  distancia_metros: number | null;
}

export async function detectarCentroCustoPorGPS(
  latitude: number,
  longitude: number
): Promise<DeteccaoCCResult> {
  const { data, error } = await supabase
    .from("bd_centros_custo")
    .select("id, nome_centro_custo, latitude, longitude")
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .eq("situacao", "Ativo");

  if (error || !data || data.length === 0) {
    console.log("[PONTO][AUTO_CC]", { latitude, longitude, centro_detectado: null, distancia: null, error });
    return { centro_custo_id: null, nome: null, distancia_metros: null };
  }

  let melhor: { id: string; nome: string; dist: number } | null = null;

  for (const cc of data) {
    const dist = calcularDistanciaMetros(latitude, longitude, cc.latitude!, cc.longitude!);
    if (!melhor || dist < melhor.dist) {
      melhor = { id: cc.id, nome: cc.nome_centro_custo, dist };
    }
  }

  const resultado: DeteccaoCCResult = melhor
    ? { centro_custo_id: melhor.id, nome: melhor.nome, distancia_metros: Math.round(melhor.dist) }
    : { centro_custo_id: null, nome: null, distancia_metros: null };

  console.log("[PONTO][AUTO_CC]", {
    latitude,
    longitude,
    centro_detectado: resultado.nome,
    distancia: resultado.distancia_metros,
  });

  return resultado;
}
