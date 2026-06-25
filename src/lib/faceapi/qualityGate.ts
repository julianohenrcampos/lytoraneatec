/**
 * Fase 5 M4 — Quality Gate (Modo Aviso / não bloqueante)
 *
 * Avalia métricas de qualidade biométrica de uma captura única (frame estático).
 * Função 100% pura, sem efeitos colaterais. NÃO bloqueia o cadastro nesta fase
 * — `aprovado` é apenas informativo para calibração futura.
 *
 * Reaproveita fórmulas do useBiometriaSegura (yaw, brilho), mas operando sobre
 * HTMLImageElement/HTMLCanvasElement em vez de HTMLVideoElement.
 */


type FaceBox = { x: number; y: number; width: number; height: number };
type FaceLandmarks = {
  getLeftEye: () => Array<{ x: number; y: number }>;
  getRightEye: () => Array<{ x: number; y: number }>;
  getNose: () => Array<{ x: number; y: number }>;
};

export type QualityWarning =
  | "DETECTOR_FRACO"
  | "ROSTO_MUITO_DISTANTE"
  | "ROSTO_MUITO_PROXIMO"
  | "FORA_CENTRO"
  | "YAW_ALTO"
  | "PITCH_ALTO"
  | "POUCA_LUZ"
  | "MUITA_LUZ"
  | "IMAGEM_DESFOCADA"
  | "CROP_PEQUENO";

export type QualityNivel = "boa" | "media" | "ruim";

export type QualityMetrics = {
  detectorScore: number;
  faceRatio: number;
  yaw: number; // graus
  pitch: number; // graus
  blur: number; // variância do Laplaciano (luma)
  brilho: number; // 0..255 (luma média)
  cropResolution: { width: number; height: number };
  centralizado: boolean;
};

export type QualityResult = {
  aprovado: boolean;
  scoreComposto: number; // 0..1
  nivel: QualityNivel;
  warnings: QualityWarning[];
  mensagens: string[];
  metricas: QualityMetrics;
};

// === Thresholds iniciais (conservadores, modo aviso) ===
const TH = {
  detectorMin: 0.75,
  faceRatioMin: 0.18,
  faceRatioMax: 0.55,
  yawMax: 15,
  pitchMax: 15,
  blurMin: 80,
  brilhoMin: 60,
  brilhoMax: 200,
  cropMinPx: 160,
  centerMargin: 0.15,
};

const MENSAGENS: Record<QualityWarning, string> = {
  DETECTOR_FRACO: "Imagem com baixa nitidez de detecção",
  ROSTO_MUITO_DISTANTE: "Aproxime o rosto",
  ROSTO_MUITO_PROXIMO: "Afaste-se um pouco",
  FORA_CENTRO: "Centralize o rosto",
  YAW_ALTO: "Olhe direto para a câmera",
  PITCH_ALTO: "Mantenha o rosto reto",
  POUCA_LUZ: "Pouca iluminação",
  MUITA_LUZ: "Iluminação excessiva",
  IMAGEM_DESFOCADA: "Imagem desfocada",
  CROP_PEQUENO: "Resolução do rosto baixa",
};

const PESOS = {
  detector: 0.30,
  faceRatio: 0.15,
  yaw: 0.15,
  pitch: 0.10,
  blur: 0.15,
  brilho: 0.10,
  crop: 0.05,
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function mediaX(pts: Array<{ x: number }>): number {
  if (!pts.length) return 0;
  return pts.reduce((a, p) => a + p.x, 0) / pts.length;
}
function mediaY(pts: Array<{ y: number }>): number {
  if (!pts.length) return 0;
  return pts.reduce((a, p) => a + p.y, 0) / pts.length;
}

/** Score da faixa: 1.0 dentro [min,max], decai linearmente fora. */
function scoreFaixa(v: number, min: number, max: number, span: number): number {
  if (v >= min && v <= max) return 1;
  if (v < min) return clamp(1 - (min - v) / span, 0, 1);
  return clamp(1 - (v - max) / span, 0, 1);
}
function scoreMin(v: number, min: number, span: number): number {
  if (v >= min) return 1;
  return clamp(1 - (min - v) / span, 0, 1);
}

function getCanvas(width: number, height: number): {
  ctx: CanvasRenderingContext2D | null;
  canvas: HTMLCanvasElement | OffscreenCanvas;
} {
  try {
    if (typeof OffscreenCanvas !== "undefined") {
      const off = new OffscreenCanvas(width, height);
      const c = off.getContext("2d", { willReadFrequently: true } as any);
      return { ctx: c as unknown as CanvasRenderingContext2D | null, canvas: off };
    }
  } catch {
    /* fallback */
  }
  const cnv = document.createElement("canvas");
  cnv.width = width;
  cnv.height = height;
  return { ctx: cnv.getContext("2d", { willReadFrequently: true }), canvas: cnv };
}

/** Calcula brilho (luma média) e blur (variância do Laplaciano) sobre o crop do rosto. */
function calcBrilhoEBlur(
  source: HTMLImageElement | HTMLCanvasElement,
  box: FaceBox,
): { brilho: number; blur: number; cropW: number; cropH: number } {
  const srcW = (source as HTMLImageElement).naturalWidth || source.width;
  const srcH = (source as HTMLImageElement).naturalHeight || source.height;

  const sx = clamp(Math.floor(box.x), 0, Math.max(srcW - 1, 0));
  const sy = clamp(Math.floor(box.y), 0, Math.max(srcH - 1, 0));
  const sw = clamp(Math.floor(box.width), 1, srcW - sx);
  const sh = clamp(Math.floor(box.height), 1, srcH - sy);

  // Subamostragem se crop > 320 (custo do Laplaciano)
  const maxSide = 320;
  const scale = Math.min(1, maxSide / Math.max(sw, sh));
  const dw = Math.max(1, Math.floor(sw * scale));
  const dh = Math.max(1, Math.floor(sh * scale));

  const { ctx } = getCanvas(dw, dh);
  if (!ctx) return { brilho: 0, blur: 0, cropW: sw, cropH: sh };

  ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, 0, 0, dw, dh);
  const data = ctx.getImageData(0, 0, dw, dh).data;

  // Luma
  const luma = new Float32Array(dw * dh);
  let sum = 0;
  for (let i = 0, j = 0; i < data.length; i += 4, j += 1) {
    const y = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    luma[j] = y;
    sum += y;
  }
  const brilho = sum / (dw * dh);

  // Laplaciano 3x3 → variância
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < dh - 1; y += 1) {
    for (let x = 1; x < dw - 1; x += 1) {
      const idx = y * dw + x;
      const v =
        -4 * luma[idx] +
        luma[idx - 1] +
        luma[idx + 1] +
        luma[idx - dw] +
        luma[idx + dw];
      lapSum += v;
      lapSqSum += v * v;
      count += 1;
    }
  }
  const mean = count ? lapSum / count : 0;
  const variancia = count ? lapSqSum / count - mean * mean : 0;

  return { brilho, blur: variancia, cropW: sw, cropH: sh };
}

export function evaluateFaceQuality(
  source: HTMLImageElement | HTMLCanvasElement,
  detection: { box: FaceBox; landmarks: FaceLandmarks; score: number },
): QualityResult {
  const { box, landmarks, score: detectorScore } = detection;
  const srcW = (source as HTMLImageElement).naturalWidth || source.width;
  const srcH = (source as HTMLImageElement).naturalHeight || source.height;

  const boxArea = box.width * box.height;
  const frameArea = Math.max(srcW * srcH, 1);
  const faceRatio = boxArea / frameArea;

  // Centralização
  const cxRatio = (box.x + box.width / 2) / Math.max(srcW, 1);
  const cyRatio = (box.y + box.height / 2) / Math.max(srcH, 1);
  const centralizado =
    cxRatio >= TH.centerMargin &&
    cxRatio <= 1 - TH.centerMargin &&
    cyRatio >= TH.centerMargin &&
    cyRatio <= 1 - TH.centerMargin;

  // Yaw / Pitch via landmarks
  const leftEye = landmarks.getLeftEye?.() ?? [];
  const rightEye = landmarks.getRightEye?.() ?? [];
  const nose = landmarks.getNose?.() ?? [];

  const leftEyeX = mediaX(leftEye);
  const rightEyeX = mediaX(rightEye);
  const eyesMidX = (leftEyeX + rightEyeX) / 2;
  const eyeSpan = Math.max(Math.abs(rightEyeX - leftEyeX), 1);
  const noseCenterX = mediaX(nose);
  const yaw = Math.atan2(noseCenterX - eyesMidX, eyeSpan) * (180 / Math.PI);

  const eyesMidY = (mediaY(leftEye) + mediaY(rightEye)) / 2;
  const noseCenterY = mediaY(nose);
  const boxH = Math.max(box.height, 1);
  // Aproximação: pitch ~ atan( (noseY - eyesMidY)/boxH/0.4 ) — 0.4 ≈ proporção típica frente nariz/altura rosto
  const pitch =
    Math.atan2((noseCenterY - eyesMidY) / boxH - 0.25, 0.4) * (180 / Math.PI);

  // Brilho + blur (sobre crop)
  const { brilho, blur, cropW, cropH } = calcBrilhoEBlur(source, box);

  // Coletar warnings
  const warnings: QualityWarning[] = [];
  if (detectorScore < TH.detectorMin) warnings.push("DETECTOR_FRACO");
  if (faceRatio < TH.faceRatioMin) warnings.push("ROSTO_MUITO_DISTANTE");
  if (faceRatio > TH.faceRatioMax) warnings.push("ROSTO_MUITO_PROXIMO");
  if (!centralizado) warnings.push("FORA_CENTRO");
  if (Math.abs(yaw) > TH.yawMax) warnings.push("YAW_ALTO");
  if (Math.abs(pitch) > TH.pitchMax) warnings.push("PITCH_ALTO");
  if (brilho < TH.brilhoMin) warnings.push("POUCA_LUZ");
  if (brilho > TH.brilhoMax) warnings.push("MUITA_LUZ");
  if (blur < TH.blurMin) warnings.push("IMAGEM_DESFOCADA");
  if (cropW < TH.cropMinPx || cropH < TH.cropMinPx) warnings.push("CROP_PEQUENO");

  // Score por dimensão (0..1)
  const sDetector = scoreMin(detectorScore, TH.detectorMin, 0.25);
  const sFaceRatio = scoreFaixa(faceRatio, TH.faceRatioMin, TH.faceRatioMax, 0.2);
  const sYaw = scoreFaixa(Math.abs(yaw), 0, TH.yawMax, 20);
  const sPitch = scoreFaixa(Math.abs(pitch), 0, TH.pitchMax, 20);
  const sBlur = scoreMin(blur, TH.blurMin, 80);
  const sBrilho = scoreFaixa(brilho, TH.brilhoMin, TH.brilhoMax, 80);
  const sCrop = scoreMin(Math.min(cropW, cropH), TH.cropMinPx, 80);

  const scoreComposto = clamp(
    sDetector * PESOS.detector +
      sFaceRatio * PESOS.faceRatio +
      sYaw * PESOS.yaw +
      sPitch * PESOS.pitch +
      sBlur * PESOS.blur +
      sBrilho * PESOS.brilho +
      sCrop * PESOS.crop,
    0,
    1,
  );

  const nivel: QualityNivel =
    scoreComposto >= 0.75 ? "boa" : scoreComposto >= 0.55 ? "media" : "ruim";

  const mensagens = warnings.map((w) => MENSAGENS[w]);

  return {
    aprovado: warnings.length === 0,
    scoreComposto,
    nivel,
    warnings,
    mensagens,
    metricas: {
      detectorScore,
      faceRatio,
      yaw,
      pitch,
      blur,
      brilho,
      cropResolution: { width: cropW, height: cropH },
      centralizado,
    },
  };
}
