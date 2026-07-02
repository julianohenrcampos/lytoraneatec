import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Rascunho local do Novo Registro Manual de Aplicação.
 * Persistência: localStorage (metadados + estado do wizard).
 * Imagens NÃO persistem — apenas a contagem (`imagensCount`).
 *
 * Nenhuma escrita no banco. Sem dependências extras (idb-keyval ausente).
 */

const NS = "lytotec:registro-manual-drafts:v1";
const EVT = "lytotec:registro-manual-drafts:changed";

export interface RegistroManualDraft {
  id: string;
  userId: string | null;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  lastTab: string;
  // Payload livre — o modal define o schema real.
  ini: any;
  carga: any;
  itens: any[];
  obsFinal: string;
  imagensCount: number;
  // Campos derivados úteis para a listagem principal
  logradouro?: string | null;
  centroCustoId?: string | null;
  centroCustoCodigo?: string | null;
  centroCustoNome?: string | null;
  data?: string | null; // yyyy-mm-dd
  atividade?: string | null;
}

type DraftInput = Omit<RegistroManualDraft, "createdAt" | "updatedAt" | "userId"> & {
  id?: string;
};

function readAll(): RegistroManualDraft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(NS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as RegistroManualDraft[]) : [];
  } catch (e) {
    console.warn("[REGISTRO_MANUAL_DRAFTS] parse error", e);
    return [];
  }
}

function writeAll(list: RegistroManualDraft[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NS, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent(EVT));
  } catch (e) {
    console.error("[REGISTRO_MANUAL_DRAFTS] write error", e);
  }
}

function genId() {
  return `draft_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function useRegistroManualDrafts() {
  const [userId, setUserId] = useState<string | null>(null);
  const [all, setAll] = useState<RegistroManualDraft[]>(() => readAll());

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) setUserId(data.user?.id ?? null);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const handler = () => setAll(readAll());
    if (typeof window === "undefined") return;
    window.addEventListener(EVT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(EVT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const drafts = userId ? all.filter((d) => !d.userId || d.userId === userId) : all;

  const saveDraft = useCallback(
    (input: DraftInput): string => {
      const list = readAll();
      const now = new Date().toISOString();
      const id = input.id || genId();
      const existing = list.find((d) => d.id === id);
      const draft: RegistroManualDraft = {
        id,
        userId: existing?.userId ?? userId,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        lastTab: input.lastTab,
        ini: input.ini,
        carga: input.carga,
        itens: input.itens,
        obsFinal: input.obsFinal,
        imagensCount: input.imagensCount,
        logradouro: input.logradouro ?? input.ini?.logradouro ?? null,
        centroCustoId: input.centroCustoId ?? input.ini?.centroCustoId ?? null,
        centroCustoCodigo: input.centroCustoCodigo ?? existing?.centroCustoCodigo ?? null,
        centroCustoNome: input.centroCustoNome ?? existing?.centroCustoNome ?? null,
        data: input.data ?? input.ini?.data ?? null,
        atividade: input.atividade ?? input.ini?.atividade ?? null,
      };
      const next = existing
        ? list.map((d) => (d.id === id ? draft : d))
        : [...list, draft];
      writeAll(next);
      return id;
    },
    [userId]
  );

  const loadDraft = useCallback((id: string): RegistroManualDraft | null => {
    return readAll().find((d) => d.id === id) ?? null;
  }, []);

  const removeDraft = useCallback((id: string) => {
    writeAll(readAll().filter((d) => d.id !== id));
  }, []);

  return { drafts, saveDraft, loadDraft, removeDraft, userId };
}
