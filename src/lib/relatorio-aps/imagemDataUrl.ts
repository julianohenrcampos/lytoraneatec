/**
 * Converte uma signedUrl (ou qualquer URL http/https) em dataURL base64
 * APENAS em memória. Não usa getPublicUrl. Não persiste nada.
 *
 * Retorna null em qualquer falha para permitir o PDF renderizar placeholder.
 */
export async function signedUrlParaDataUrl(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, { credentials: "omit" });
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const r = reader.result;
        resolve(typeof r === "string" ? r : null);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("[RELATORIO_APS][PDF] Falha ao converter imagem:", e);
    return null;
  }
}
