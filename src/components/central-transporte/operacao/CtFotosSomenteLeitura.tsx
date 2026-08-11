import React, { useEffect, useState } from "react";
import { getSignedFotoCtUrl } from "@/services/ctOperacaoService";

interface Props {
  fotos: string[];
}

/** CT-3F.1 — Evidências da saída exibidas como prova imutável (sem remoção). */
const CtFotosSomenteLeitura: React.FC<Props> = ({ fotos }) => {
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    let cancel = false;
    (async () => {
      const pares = await Promise.all(
        fotos.map(async (p) => [p, await getSignedFotoCtUrl(p)] as const),
      );
      if (!cancel) setUrls(Object.fromEntries(pares));
    })();
    return () => {
      cancel = true;
    };
  }, [fotos]);

  if (fotos.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {fotos.map((path) => (
        <div key={path} className="h-14 w-14 overflow-hidden rounded border bg-muted">
          {urls[path] ? (
            <img src={urls[path] as string} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
};

export default CtFotosSomenteLeitura;
