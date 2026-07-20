/**
 * Redimensiona uma imagem (Data URL) em memória para caber num bounding box,
 * preservando proporção, e devolve como JPEG (Data URL) com a qualidade dada.
 *
 * Regras:
 *  - Nenhuma persistência.
 *  - Nenhuma biblioteca adicional (usa Image + Canvas do browser/JSDOM).
 *  - Em falha, devolve a `dataUrl` original (nunca lança).
 *  - Nunca loga a `dataUrl` (é potencialmente enorme e sensível).
 */
export interface NormalizarImagemOpts {
  maxWidthPx: number;
  maxHeightPx: number;
  quality: number;
}

export async function normalizarImagemParaPptx(
  dataUrl: string,
  options: NormalizarImagemOpts,
): Promise<string> {
  if (!dataUrl || typeof dataUrl !== "string") return dataUrl;
  try {
    const img = await carregarImagem(dataUrl);
    const { width: nw, height: nh } = calcularDimensoesReduzidas(
      img.width,
      img.height,
      options.maxWidthPx,
      options.maxHeightPx,
    );
    const canvas = document.createElement("canvas");
    canvas.width = nw;
    canvas.height = nh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.warn("[APS][PPTX] canvas 2d indisponível — usando imagem original");
      return dataUrl;
    }
    ctx.drawImage(img, 0, 0, nw, nh);
    const out = canvas.toDataURL("image/jpeg", options.quality);
    if (!out || typeof out !== "string" || !out.startsWith("data:image/")) {
      return dataUrl;
    }
    return out;
  } catch (err) {
    const name = (err && typeof err === "object" && "name" in err)
      ? String((err as { name?: unknown }).name)
      : "unknown";
    console.warn("[APS][PPTX] normalização de imagem falhou:", name);
    return dataUrl;
  }
}

function calcularDimensoesReduzidas(
  w: number,
  h: number,
  maxW: number,
  maxH: number,
): { width: number; height: number } {
  if (w <= 0 || h <= 0) return { width: maxW, height: maxH };
  const ratio = Math.min(maxW / w, maxH / h, 1);
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
  };
}

function carregarImagem(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("image_load_failed"));
    img.src = src;
  });
}
