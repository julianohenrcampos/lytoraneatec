import { useState } from "react";
import { toast } from "sonner";
import { obterArquivoAssinado } from "@/services/atestadosService";

export function useAtestadoArquivoAssinado() {
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function abrir(atestadoId: string) {
    if (loadingId) return;
    setLoadingId(atestadoId);
    try {
      const { signed_url } = await obterArquivoAssinado(atestadoId);
      window.open(signed_url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || status === 403) {
        toast.error(
          "Sua sessão não tem permissão para abrir este arquivo ou expirou."
        );
      } else if (status === 404) {
        toast.error("Arquivo não encontrado.");
      } else {
        toast.error("Não foi possível abrir o arquivo. Tente novamente.");
      }
    } finally {
      setLoadingId(null);
    }
  }

  return { abrir, loadingId };
}
