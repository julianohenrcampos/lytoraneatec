// Fase 6J.1 — Cálculo de semana ISO (BRT, segunda → domingo).
// Datas tratadas como YYYY-MM-DD para evitar shift de fuso.

import type { SemanaRef } from "./tipos";
import { listarDiasUteis } from "./diasUteis";

function parseISO(iso: string): Date {
  // Constrói data local sem timezone shift.
  const [y, m, d] = iso.split("-").map((s) => parseInt(s, 10));
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, n: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + n);
  return out;
}

/** Retorna a segunda-feira da semana que contém a data informada. */
function segundaFeiraDa(date: Date): Date {
  const dow = date.getDay(); // 0=dom, 1=seg, ..., 6=sáb
  // dia 0 (domingo) → voltar 6 dias; dia 1 → 0; dia 6 → voltar 5
  const diff = (dow + 6) % 7;
  return addDays(date, -diff);
}

/** Ano ISO 8601 e número da semana ISO (semana com a primeira quinta-feira do ano). */
function isoYearWeek(date: Date): { ano: number; semana: number } {
  const tmp = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  // Quinta da semana ISO
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day + 3);
  const firstThursday = new Date(tmp.getFullYear(), 0, 4);
  const firstDay = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstDay + 3);
  const diff = (tmp.getTime() - firstThursday.getTime()) / 86400000;
  const week = 1 + Math.round(diff / 7);
  return { ano: tmp.getFullYear(), semana: week };
}

export function calcularSemanaDaData(iso: string): SemanaRef {
  const data = parseISO(iso);
  const seg = segundaFeiraDa(data);
  const dom = addDays(seg, 6);
  const inicio = toISO(seg);
  const fim = toISO(dom);
  const { ano, semana } = isoYearWeek(seg);
  return {
    ano,
    semana,
    inicio,
    fim,
    diasUteis: listarDiasUteis(inicio, fim),
    key: `${ano}-W${String(semana).padStart(2, "0")}`,
  };
}

/** Semana atual em horário de Brasília (UTC-3). */
export function calcularSemanaAtualBRT(now: Date = new Date()): SemanaRef {
  // BRT = UTC-3 sem DST atualmente.
  const brt = new Date(now.getTime() - 3 * 3600_000);
  const iso = `${brt.getUTCFullYear()}-${String(brt.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(brt.getUTCDate()).padStart(2, "0")}`;
  return calcularSemanaDaData(iso);
}

export function deslocarSemana(ref: SemanaRef, delta: number): SemanaRef {
  const segNova = addDays(parseISO(ref.inicio), delta * 7);
  return calcularSemanaDaData(toISO(segNova));
}

/** Clampa uma semana para ficar dentro do intervalo do planejamento. */
export function clampSemana(
  ref: SemanaRef,
  planInicio: string,
  planFim: string
): SemanaRef {
  if (ref.fim < planInicio) return calcularSemanaDaData(planInicio);
  if (ref.inicio > planFim) return calcularSemanaDaData(planFim);
  return ref;
}

export { parseISO as _parseISO, toISO as _toISO, addDays as _addDays };
