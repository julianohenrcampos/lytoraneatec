/**
 * CT-2 / M4 — Motor de idempotência das operações da Central do Transporte.
 *
 * DEVE ser montado no componente persistente (CentralTransportePage), nunca
 * no AnaliseOperacionalSheet nem nos modais filhos: o mapa de tentativas
 * precisa sobreviver ao fechamento do modal, ao fechamento da análise e à
 * reabertura da mesma solicitação.
 *
 * Regras:
 *  - request_id é gerado uma única vez por chave material;
 *  - resultado INCERTO preserva request_id e chave material, permitindo apenas
 *    retry idêntico (nunca novo UUID, nunca parâmetros diferentes);
 *  - a listagem NÃO é prova de não persistência (a RPC não devolve request_id);
 *  - a tentativa só é liberada em sucesso/replay, erro determinístico ou
 *    cancelamento antes do primeiro envio;
 *  - sem localStorage/sessionStorage.
 */
import { useCallback, useRef, useState } from "react";
import type {
  CtOperationKind,
  CtPendingAttempt,
} from "@/types/centralTransporteCT2";
import { normalizeCt2Error, type Ct2NormalizedError } from "@/utils/ct2ErrorMapper";

export type CtRunOutcome<T> =
  | { status: "ok"; data: T; replay: boolean }
  | { status: "error"; error: Ct2NormalizedError }
  | { status: "uncertain"; error: Ct2NormalizedError };

export interface CtRunParams<T> {
  operation: CtOperationKind;
  /** Assinatura material dos parâmetros: mesma chave ⇒ mesmo request_id. */
  materialKey: string;
  /** Recursos travados (item, atendimento, equipamento) para anti-concorrência. */
  resourceIds: Array<string | null | undefined>;
  exec: (requestId: string) => Promise<T & { replay?: boolean }>;
}

const newUuid = (): string => {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  // fallback determinístico apenas para ambientes sem WebCrypto (jsdom antigo)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export interface CtOperationApi {
  attempts: ReadonlyMap<string, CtPendingAttempt>;
  getAttempt: (materialKey: string) => CtPendingAttempt | null;
  /** true quando existe tentativa PENDING/UNCERTAIN incompatível sobre os recursos. */
  isBlocked: (resourceIds: Array<string | null | undefined>, materialKey?: string) => boolean;
  /** Descarta tentativa ainda não enviada (state READY). */
  cancelAttempt: (materialKey: string) => void;
  run: <T>(params: CtRunParams<T>) => Promise<CtRunOutcome<T>>;
  isRunning: boolean;
}

export const useCtOperation = (): CtOperationApi => {
  const attemptsRef = useRef<Map<string, CtPendingAttempt>>(new Map());
  const [, setVersion] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const getAttempt = useCallback(
    (materialKey: string) => attemptsRef.current.get(materialKey) ?? null,
    [],
  );

  const isBlocked = useCallback(
    (resourceIds: Array<string | null | undefined>, materialKey?: string) => {
      const ids = resourceIds.filter((r): r is string => !!r);
      for (const attempt of attemptsRef.current.values()) {
        if (attempt.state === "READY") continue;
        if (materialKey && attempt.materialKey === materialKey) continue;
        if (attempt.resourceIds.some((r) => ids.includes(r))) return true;
      }
      return false;
    },
    [],
  );

  const cancelAttempt = useCallback(
    (materialKey: string) => {
      const a = attemptsRef.current.get(materialKey);
      if (a && a.state === "READY") {
        attemptsRef.current.delete(materialKey);
        bump();
      }
    },
    [bump],
  );

  const run = useCallback(
    async <T,>({ operation, materialKey, resourceIds, exec }: CtRunParams<T>): Promise<CtRunOutcome<T>> => {
      const ids = resourceIds.filter((r): r is string => !!r);
      const existing = attemptsRef.current.get(materialKey);

      if (existing?.state === "PENDING") {
        return {
          status: "error",
          error: {
            code: null,
            message: "Operação em andamento. Aguarde a confirmação.",
            isUncertain: false,
          },
        };
      }

      if (isBlocked(ids, materialKey)) {
        return {
          status: "error",
          error: {
            code: null,
            message:
              "Existe uma operação pendente ou não confirmada sobre este item/atendimento. " +
              "Conclua ou repita aquela tentativa antes de iniciar outra.",
            isUncertain: false,
          },
        };
      }

      // Reaproveita o request_id de uma tentativa incerta; só gera UUID novo
      // quando não há tentativa registrada para esta chave material.
      const attempt: CtPendingAttempt = existing
        ? { ...existing, state: "PENDING" }
        : {
            operation,
            requestId: newUuid(),
            materialKey,
            state: "PENDING",
            createdAt: Date.now(),
            resourceIds: ids,
          };

      attemptsRef.current.set(materialKey, attempt);
      bump();
      setIsRunning(true);

      try {
        const data = await exec(attempt.requestId);
        attemptsRef.current.delete(materialKey);
        bump();
        return { status: "ok", data, replay: data?.replay === true };
      } catch (err) {
        const normalized = normalizeCt2Error(err);
        if (normalized.isUncertain) {
          attemptsRef.current.set(materialKey, { ...attempt, state: "UNCERTAIN" });
          bump();
          return { status: "uncertain", error: normalized };
        }
        // Erro determinístico: transação abortou, tentativa liberada.
        attemptsRef.current.delete(materialKey);
        bump();
        return { status: "error", error: normalized };
      } finally {
        setIsRunning(false);
      }
    },
    [bump, isBlocked],
  );

  return {
    attempts: attemptsRef.current,
    getAttempt,
    isBlocked,
    cancelAttempt,
    run,
    isRunning,
  };
};

export default useCtOperation;
