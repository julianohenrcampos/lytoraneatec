import { useCallback, useRef } from "react";
import { faceapi } from "@/lib/faceapi/loader";
import { pontoLog } from "@/lib/ponto/pontoLog";

export type BiometriaModo = "totem" | "mobile";

export type CodigoBloqueioBiometria =
  | "SEM_ROSTO"
  | "DETECCAO_FRACA"
  | "LANDMARKS_INVALIDO"
  | "ROSTO_PEQUENO"
  | "FORA_CENTRO"
  | "FRAME_INVALIDO"
  | "YAW_ALTO"
  | "ANTI_FOTO"
  | "LIVENESS_FALHA"
  | "CONFIRMANDO"
  | null;

export type ValidarRostoSeguroResult = {
  valido: boolean;
  motivo?: string;
  descriptor?: Float32Array;
  confidence?: number;
  detectionScore?: number;
  faceRatio?: number;
  livenessScore?: number;
  framesConfirmados?: number;
  rostoDetectado?: boolean;
  qualidadeOk?: boolean;
  livenessOk?: boolean;
  codigoBloqueio?: CodigoBloqueioBiometria;
};

type Snapshot = {
  descriptor: Float32Array;
  brightness: number;
  centerX: number;
  centerY: number;
  faceRatio: number;
  noseOffset: number;
  eyeSpan: number;
  movementScore: number;
  descriptorDelta: number;
};

// AJUSTE TEMPORÁRIO DE CALIBRAÇÃO — revisar com logs reais
const INPUT_SIZE = 320; // antes 416
// AJUSTE TEMPORÁRIO DE CALIBRAÇÃO — revisar com logs reais
const DETECTION_SCORE_MIN = 0.70; // antes 0.85
const FACE_RATIO_MIN = 0.15;
const FACE_RATIO_MAX = 0.75;
const FACE_BOX_MIN_PX = 120;
const FACE_AREA_MIN_PX = 15000;
const CENTER_MARGIN = 0.15;
const YAW_RATIO_MAX = 0.35;
const REQUIRED_STABLE_FRAMES = 3;
const SAME_FACE_DISTANCE_MAX = 0.42;
// AJUSTE TEMPORÁRIO DE CALIBRAÇÃO — revisar com logs reais
const REQUIRED_DETECTION_FRAMES = 3;

// === LIVENESS PASSIVO (revisão v2) ===
// MOVEMENT_MIN: limiar mínimo de movimento real (filtra ruído de câmera/compressão)
const MOVEMENT_MIN = 0.015;
// FROZEN_FRAME_LIMIT mais estrito (3 → 2)
const FROZEN_FRAME_LIMIT = 2;
const FROZEN_MOVEMENT_MAX = 0.018;
// descriptorDelta mínimo entre frames consecutivos (acima disso = mudança real, abaixo = imagem estática)
const DESCRIPTOR_DELTA_MIN = 0.02;

const MIN_MOUTH_POINTS = 1;
const MIN_JAW_POINTS = 8;

const MSG_SEM_ROSTO = "Nenhum rosto detectado. Posicione seu rosto dentro do círculo.";
const MSG_QUALIDADE = "Posicione melhor seu rosto para identificação.";

function descriptorDistance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function useBiometriaSegura() {
  const previousSnapshotRef = useRef<Snapshot | null>(null);
  const stableFramesRef = useRef(0);
  const frozenFramesRef = useRef(0);
  const detectionFramesRef = useRef(0);
  // janela dos últimos N pares para liveness — aprovado se ≥1 par tem movement >= MOVEMENT_MIN
  // E ≥1 par tem descriptorDelta >= DESCRIPTOR_DELTA_MIN
  const livenessWindowRef = useRef<Array<{ movementScore: number; descriptorDelta: number }>>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const resetBiometriaSegura = useCallback(() => {
    previousSnapshotRef.current = null;
    stableFramesRef.current = 0;
    frozenFramesRef.current = 0;
    detectionFramesRef.current = 0;
    livenessWindowRef.current = [];
  }, []);

  const readBrightness = useCallback((video: HTMLVideoElement, box: faceapi.Box) => {
    const width = Math.max(video.videoWidth || video.clientWidth || 0, 1);
    const height = Math.max(video.videoHeight || video.clientHeight || 0, 1);
    const canvas = canvasRef.current ?? document.createElement("canvas");
    canvasRef.current = canvas;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return 0;

    ctx.drawImage(video, 0, 0, width, height);

    const sx = clamp(Math.floor(box.x), 0, width - 1);
    const sy = clamp(Math.floor(box.y), 0, height - 1);
    const sw = clamp(Math.floor(box.width), 1, width - sx);
    const sh = clamp(Math.floor(box.height), 1, height - sy);
    const data = ctx.getImageData(sx, sy, sw, sh).data;

    let total = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 16) {
      total += (data[i] + data[i + 1] + data[i + 2]) / 3;
      count += 1;
    }

    return count > 0 ? total / count : 0;
  }, []);

  const validarRostoSeguro = useCallback(async (
    video: HTMLVideoElement,
    _modo: BiometriaModo,
  ): Promise<ValidarRostoSeguroResult> => {
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      detectionFramesRef.current = Math.max(0, detectionFramesRef.current - 1);
      const motivo = MSG_SEM_ROSTO;
      pontoLog("BIOMETRIA", "SEM_ROSTO", "info", { motivo, reason: "video_indisponivel" });
      return { valido: false, motivo, rostoDetectado: false, qualidadeOk: false, livenessOk: false, codigoBloqueio: "SEM_ROSTO" };
    }

    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: INPUT_SIZE, scoreThreshold: 0.5 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      detectionFramesRef.current = Math.max(0, detectionFramesRef.current - 1);
      const motivo = MSG_SEM_ROSTO;
      pontoLog("BIOMETRIA", "SEM_ROSTO", "info", { motivo });
      return { valido: false, motivo, rostoDetectado: false, qualidadeOk: false, livenessOk: false, codigoBloqueio: "SEM_ROSTO" };
    }

    const detectionScore = detection.detection.score ?? 0;
    const box = detection.detection.box;

    if (detectionScore < DETECTION_SCORE_MIN) {
      detectionFramesRef.current = Math.max(0, detectionFramesRef.current - 1);
      const motivo = MSG_QUALIDADE;
      pontoLog("BIOMETRIA", "DETECCAO_FRACA", "info", { motivo, detectionScore, limite: DETECTION_SCORE_MIN });
      return { valido: false, motivo, detectionScore, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "DETECCAO_FRACA" };
    }

    // Buffer temporal: exige N frames consecutivos com score válido antes de seguir
    detectionFramesRef.current += 1;
    if (detectionFramesRef.current < REQUIRED_DETECTION_FRAMES) {
      pontoLog("BIOMETRIA", "DETECCAO_AGUARDANDO_BUFFER", "info", {
        frame: detectionFramesRef.current,
        requerido: REQUIRED_DETECTION_FRAMES,
        detectionScore,
      });
      return {
        valido: false,
        motivo: "Mantenha o rosto centralizado...",
        detectionScore,
        rostoDetectado: true,
        qualidadeOk: false,
        livenessOk: false,
        codigoBloqueio: null,
      };
    }

    const boxArea = box.width * box.height;
    if (box.width < FACE_BOX_MIN_PX || box.height < FACE_BOX_MIN_PX || boxArea < FACE_AREA_MIN_PX) {
      resetBiometriaSegura();
      const motivo = "Aproxime o rosto da câmera";
      pontoLog("BIOMETRIA", "ROSTO_PEQUENO", "info", { motivo, boxPx: { w: Math.round(box.width), h: Math.round(box.height) }, area: Math.round(boxArea), detectionScore });
      return { valido: false, motivo, detectionScore, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "ROSTO_PEQUENO" };
    }

    const cxRatio = (box.x + box.width / 2) / Math.max(video.videoWidth, 1);
    const cyRatio = (box.y + box.height / 2) / Math.max(video.videoHeight, 1);
    if (
      cxRatio < CENTER_MARGIN ||
      cxRatio > 1 - CENTER_MARGIN ||
      cyRatio < CENTER_MARGIN ||
      cyRatio > 1 - CENTER_MARGIN
    ) {
      resetBiometriaSegura();
      const motivo = "Centralize o rosto na câmera";
      pontoLog("BIOMETRIA", "FORA_CENTRO", "info", { motivo, center: { cxRatio: Number(cxRatio.toFixed(2)), cyRatio: Number(cyRatio.toFixed(2)) } });
      return { valido: false, motivo, detectionScore, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "FORA_CENTRO" };
    }

    const frameArea = Math.max(video.videoWidth * video.videoHeight, 1);
    const faceRatio = boxArea / frameArea;
    if (faceRatio < FACE_RATIO_MIN) {
      resetBiometriaSegura();
      const motivo = "Aproxime o rosto da câmera";
      pontoLog("BIOMETRIA", "ROSTO_PEQUENO", "info", { motivo, faceRatio });
      return { valido: false, motivo, detectionScore, faceRatio, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "ROSTO_PEQUENO" };
    }
    if (faceRatio > FACE_RATIO_MAX) {
      resetBiometriaSegura();
      const motivo = "Afaste-se um pouco da câmera";
      pontoLog("BIOMETRIA", "FRAME_INVALIDO", "info", { motivo, faceRatio });
      return { valido: false, motivo, detectionScore, faceRatio, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "FRAME_INVALIDO" };
    }

    const landmarks = detection.landmarks;
    const leftEye = landmarks?.getLeftEye?.() ?? [];
    const rightEye = landmarks?.getRightEye?.() ?? [];
    const nose = landmarks?.getNose?.() ?? [];
    const mouth = landmarks?.getMouth?.() ?? [];
    const jaw = landmarks?.getJawOutline?.() ?? [];

    if (
      !landmarks ||
      leftEye.length === 0 ||
      rightEye.length === 0 ||
      nose.length === 0 ||
      mouth.length < MIN_MOUTH_POINTS ||
      jaw.length < MIN_JAW_POINTS
    ) {
      resetBiometriaSegura();
      const motivo = MSG_QUALIDADE;
      pontoLog("BIOMETRIA", "LANDMARKS_INVALIDO", "info", {
        motivo,
        hasLandmarks: !!landmarks,
        leftEye: leftEye.length, rightEye: rightEye.length, nose: nose.length,
        mouth: mouth.length, jaw: jaw.length,
      });
      return { valido: false, motivo, detectionScore, faceRatio, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "LANDMARKS_INVALIDO" };
    }

    const leftEyeCenterX = leftEye.reduce((acc, p) => acc + p.x, 0) / leftEye.length;
    const rightEyeCenterX = rightEye.reduce((acc, p) => acc + p.x, 0) / rightEye.length;
    const noseCenterX = nose.reduce((acc, p) => acc + p.x, 0) / nose.length;
    const eyeSpan = Math.max(Math.abs(rightEyeCenterX - leftEyeCenterX), 1);
    const eyesMidX = (leftEyeCenterX + rightEyeCenterX) / 2;
    const yawRatio = Math.abs((noseCenterX - eyesMidX) / eyeSpan);

    if (yawRatio > YAW_RATIO_MAX) {
      resetBiometriaSegura();
      const motivo = "Olhe direto para a câmera";
      pontoLog("BIOMETRIA", "YAW_ALTO", "info", { motivo, yawRatio });
      return { valido: false, motivo, detectionScore, faceRatio, rostoDetectado: true, qualidadeOk: false, livenessOk: false, codigoBloqueio: "YAW_ALTO" };
    }

    const descriptor = Float32Array.from(detection.descriptor);
    const previous = previousSnapshotRef.current;
    let descriptorDelta = 0;
    let movementScore = 1;

    if (previous) {
      descriptorDelta = descriptorDistance(descriptor, previous.descriptor);
      const movementBox =
        Math.abs((box.x + box.width / 2) - previous.centerX) / Math.max(video.videoWidth, 1) +
        Math.abs((box.y + box.height / 2) - previous.centerY) / Math.max(video.videoHeight, 1);
      const movementArea = Math.abs(faceRatio - previous.faceRatio);
      const movementNose = Math.abs((noseCenterX - eyesMidX) - previous.noseOffset) / Math.max(eyeSpan, 1);
      const brightness = readBrightness(video, box);
      const movementBrightness = Math.abs(brightness - previous.brightness) / 255;
      movementScore = movementBox + movementArea + movementNose + movementBrightness + descriptorDelta * 0.08;

      if (movementScore < FROZEN_MOVEMENT_MAX) {
        frozenFramesRef.current += 1;
      } else {
        frozenFramesRef.current = 0;
      }

      if (descriptorDelta <= SAME_FACE_DISTANCE_MAX) {
        stableFramesRef.current += 1;
      } else {
        // TROCA DE IDENTIDADE
        pontoLog("BIOMETRIA", "TROCA_IDENTIDADE", "warn", {
          descriptorDelta: Number(descriptorDelta.toFixed(3)),
          limite: SAME_FACE_DISTANCE_MAX,
        });
        stableFramesRef.current = 1;
        frozenFramesRef.current = 0;
        livenessWindowRef.current = [];
      }

      // janela de liveness (últimos 4 pares)
      livenessWindowRef.current.push({ movementScore, descriptorDelta });
      if (livenessWindowRef.current.length > 4) livenessWindowRef.current.shift();
    } else {
      stableFramesRef.current = 1;
      frozenFramesRef.current = 0;
      livenessWindowRef.current = [];
    }

    const brightnessAtual = previous
      ? previous.brightness // já lido acima quando previous existe
      : readBrightness(video, box);
    previousSnapshotRef.current = {
      descriptor,
      brightness: previous ? readBrightness(video, box) : brightnessAtual,
      centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2,
      faceRatio,
      noseOffset: noseCenterX - eyesMidX,
      eyeSpan,
      movementScore,
      descriptorDelta,
    };

    const confidence = clamp(1 - descriptorDelta / 5, 0, 0.999);
    const livenessScore = clamp(movementScore * 16, 0, 1);

    if (frozenFramesRef.current >= FROZEN_FRAME_LIMIT) {
      resetBiometriaSegura();
      pontoLog("BIOMETRIA", "ANTI_FOTO", "warn", { frozen: frozenFramesRef.current, livenessScore: Number(livenessScore.toFixed(3)) });
      return {
        valido: false,
        motivo: "Possível uso de imagem/foto",
        confidence,
        detectionScore,
        faceRatio,
        livenessScore,
        framesConfirmados: stableFramesRef.current,
        rostoDetectado: true,
        qualidadeOk: false,
        livenessOk: false,
        codigoBloqueio: "ANTI_FOTO",
      };
    }

    if (stableFramesRef.current < REQUIRED_STABLE_FRAMES) {
      return {
        valido: false,
        motivo: "Confirmando identidade...",
        confidence,
        detectionScore,
        faceRatio,
        livenessScore,
        framesConfirmados: stableFramesRef.current,
        rostoDetectado: true,
        qualidadeOk: true,
        livenessOk: false,
        codigoBloqueio: "CONFIRMANDO",
      };
    }

    // === Liveness passivo final ===
    // Exige na janela: ≥1 par com movimento real (≥ MOVEMENT_MIN) E ≥1 par com descriptorDelta real (≥ DESCRIPTOR_DELTA_MIN e ≤ SAME_FACE_DISTANCE_MAX)
    const window = livenessWindowRef.current;
    const temMovimentoReal = window.some((w) => w.movementScore >= MOVEMENT_MIN);
    const temVariacaoDescriptor = window.some(
      (w) => w.descriptorDelta >= DESCRIPTOR_DELTA_MIN && w.descriptorDelta <= SAME_FACE_DISTANCE_MAX,
    );
    const livenessOk = temMovimentoReal && temVariacaoDescriptor;

    if (!livenessOk) {
      resetBiometriaSegura();
      pontoLog("BIOMETRIA", "LIVENESS_FALHA", "warn", {
        motivo: "movimento_insuficiente",
        temMovimentoReal,
        temVariacaoDescriptor,
        movementMin: MOVEMENT_MIN,
        descriptorDeltaMin: DESCRIPTOR_DELTA_MIN,
        amostras: window.length,
      });
      return {
        valido: false,
        motivo: "Mova-se ligeiramente para confirmar (anti-foto)",
        confidence,
        detectionScore,
        faceRatio,
        livenessScore,
        framesConfirmados: stableFramesRef.current,
        rostoDetectado: true,
        qualidadeOk: true,
        livenessOk: false,
        codigoBloqueio: "LIVENESS_FALHA",
      };
    }

    pontoLog("BIOMETRIA", "CONFIRMACAO", "info", {
      framesConfirmados: stableFramesRef.current,
      detectionScore: Number(detectionScore.toFixed(3)),
      faceRatio: Number(faceRatio.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      livenessScore: Number(livenessScore.toFixed(3)),
      livenessOk: true,
    });

    return {
      valido: true,
      descriptor,
      confidence,
      detectionScore,
      faceRatio,
      livenessScore,
      framesConfirmados: stableFramesRef.current,
      rostoDetectado: true,
      qualidadeOk: true,
      livenessOk: true,
      codigoBloqueio: null,
    };
  }, [readBrightness, resetBiometriaSegura]);

  return {
    validarRostoSeguro,
    resetBiometriaSegura,
  };
}
