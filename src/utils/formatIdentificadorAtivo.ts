// Rodada 2A.3 — Helper único de identificador do ativo.
// Prioridade: frota+numero (padStart 3) → placa → numero_serie → chassi → 'Sem identificador'.

import type { Veiculo } from "@/types/veiculo";

export interface VeiculoIdentificadorInput {
  frota?: string | null;
  frota_codigo?: string | null;
  numero_frota?: string | null;
  placa?: string | null;
  numero_serie?: string | null;
  chassi?: string | null;
}

export function formatNumeroFrota(numero: string | null | undefined): string | null {
  const raw = String(numero ?? "").trim();
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  const canonical = digits.replace(/^0+/, "") || "0";
  return canonical.padStart(Math.max(3, canonical.length), "0");
}

export function formatIdentificadorAtivo(v: VeiculoIdentificadorInput | null | undefined): string {
  if (!v) return "Sem identificador";
  const prefixo = (v.frota_codigo ?? v.frota ?? "").toString().trim().toUpperCase();
  const numero = formatNumeroFrota(v.numero_frota);
  if (prefixo && numero) return `${prefixo}${numero}`;
  const placa = (v.placa ?? "").toString().trim();
  if (placa) return placa;
  const serie = (v.numero_serie ?? "").toString().trim();
  if (serie) return serie;
  const chassi = (v.chassi ?? "").toString().trim();
  if (chassi) return chassi;
  return "Sem identificador";
}

export function formatIdentificadorFromVeiculo(v: Veiculo | null | undefined): string {
  if (!v) return "Sem identificador";
  return formatIdentificadorAtivo({
    frota: v.frota,
    frota_codigo: (v as any).frota_codigo ?? null,
    numero_frota: v.numero_frota,
    placa: v.placa,
    numero_serie: v.numero_serie,
    chassi: v.chassi,
  });
}
