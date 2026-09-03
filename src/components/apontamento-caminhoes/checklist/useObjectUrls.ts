import { useCallback, useEffect, useRef } from "react";

/**
 * Gerencia o ciclo de URL de objetos locais criados via URL.createObjectURL.
 * Garante revogação em: remoção individual, unmount e reset explícito.
 */
export function useObjectUrls() {
  const urlsRef = useRef<Map<string, string>>(new Map());

  const create = useCallback((key: string, file: File): string => {
    const existing = urlsRef.current.get(key);
    if (existing) URL.revokeObjectURL(existing);
    const url = URL.createObjectURL(file);
    urlsRef.current.set(key, url);
    return url;
  }, []);

  const revoke = useCallback((key: string) => {
    const url = urlsRef.current.get(key);
    if (url) {
      URL.revokeObjectURL(url);
      urlsRef.current.delete(key);
    }
  }, []);

  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current.clear();
  }, []);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      urlsRef.current.clear();
    };
  }, []);

  return { create, revoke, revokeAll };
}
