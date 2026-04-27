import { useCallback, useRef } from "react";
import { faceapi } from "@/lib/faceapi/loader";

export type BiometriaModo = "totem" | "mobile";

export type ValidarRostoSeguroResult = {
  valido: boolean;
  motivo?: string;
  descriptor?: Float32Array;
  confidence?: number;
  detectionScore?: number;
  faceRatio?: number;
  livenessScore?: number;
  framesConfirmados?: number;
};

type Snapshot = {
  descriptor: Float32Array;
  brightness: number;
  centerX: number;
  centerY: number;
  faceRatio: number;
  noseOffset: number;
  eyeSpan: number;
};

const INPUT_SIZE = 416;
const DETECTION_SCORE_MIN = 0.8; // endurecido (era 0.7) — anti-objeto
const FACE_RATIO_MIN = 0.15;
const FACE_RATIO_MAX = 0.75;
const FACE_BOX_MIN_PX = 120; // tamanho absoluto mínimo da box em px
const CENTER_MARGIN = 0.15; // centro da box dentro de 70% central (0.15..0.85)
const YAW_RATIO_MAX = 0.35;
const REQUIRED_STABLE_FRAMES = 3;
const SAME_FACE_DISTANCE_MAX = 0.42;
const FROZEN_MOVEMENT_MAX = 0.018;
const FROZEN_FRAME_LIMIT = 3;

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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const resetBiometriaSegura = useCallback(() => {
    previousSnapshotRef.current = null;
    stableFramesRef.current = 0;
    frozenFramesRef.current = 0;
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
      resetBiometriaSegura();
      const motivo = MSG_SEM_ROSTO;
      console.log("[BIOMETRIA][QUALIDADE]", { valido: false, motivo });
      return { valido: false, motivo };
    }

    const detection = await faceapi
      .detectSingleFace(
        video,
        new faceapi.TinyFaceDetectorOptions({ inputSize: INPUT_SIZE, scoreThreshold: 0.5 }),
      )
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      // BLOQUEIO ABSOLUTO: nenhum frame sem rosto pode avançar no pipeline
      resetBiometriaSegura();
      const motivo = MSG_SEM_ROSTO;
      console.log("[BIOMETRIA][SEM_ROSTO]", { valido: false, motivo });
      return { valido: false, motivo };
    }

    const detectionScore = detection.detection.score ?? 0;
    const box = detection.detection.box;
    console.log("[BIOMETRIA][DETECT]", {
      score: Number(detectionScore.toFixed(3)),
      box: { x: Math.round(box.x), y: Math.round(box.y), w: Math.round(box.width), h: Math.round(box.height) },
    });

    if (detectionScore < DETECTION_SCORE_MIN) {
      resetBiometriaSegura();
      const motivo = MSG_QUALIDADE;
      console.log("[BIOMETRIA][FRAME_INVALIDO]", { motivo, detectionScore });
      return { valido: false, motivo, detectionScore };
    }

    // Tamanho absoluto mínimo (anti-objeto distante / detecção falsa)
    if (box.width < FACE_BOX_MIN_PX || box.height < FACE_BOX_MIN_PX) {
      resetBiometriaSegura();
      const motivo = MSG_QUALIDADE;
      console.log("[BIOMETRIA][FRAME_INVALIDO]", { motivo, boxPx: { w: box.width, h: box.height }, detectionScore });
      return { valido: false, motivo, detectionScore };
    }

    // Centralização: centro da box dentro de 70% central do frame
    const cxRatio = (box.x + box.width / 2) / Math.max(video.videoWidth, 1);
    const cyRatio = (box.y + box.height / 2) / Math.max(video.videoHeight, 1);
    if (
      cxRatio < CENTER_MARGIN ||
      cxRatio > 1 - CENTER_MARGIN ||
      cyRatio < CENTER_MARGIN ||
      cyRatio > 1 - CENTER_MARGIN
    ) {
      resetBiometriaSegura();
      const motivo = MSG_QUALIDADE;
      console.log("[BIOMETRIA][FRAME_INVALIDO]", { motivo, center: { cxRatio, cyRatio }, detectionScore });
      return { valido: false, motivo, detectionScore };
    }

    const frameArea = Math.max(video.videoWidth * video.videoHeight, 1);
    const faceRatio = (box.width * box.height) / frameArea;
    if (faceRatio < FACE_RATIO_MIN) {
      resetBiometriaSegura();
      const motivo = MSG_QUALIDADE;
      console.log("[BIOMETRIA][FRAME_INVALIDO]", { motivo, faceRatio, detectionScore });
      return { valido: false, motivo, detectionScore, faceRatio };
    }
    if (faceRatio > FACE_RATIO_MAX) {
      resetBiometriaSegura();
      const motivo = "Afaste-se um pouco da câmera";
      console.log("[BIOMETRIA][FRAME_INVALIDO]", { motivo, faceRatio, detectionScore });
      return { valido: false, motivo, detectionScore, faceRatio };
    }

    const landmarks = detection.landmarks;
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();
    const nose = landmarks.getNose();

    const leftEyeCenterX = leftEye.reduce((acc, point) => acc + point.x, 0) / leftEye.length;
    const rightEyeCenterX = rightEye.reduce((acc, point) => acc + point.x, 0) / rightEye.length;
    const noseCenterX = nose.reduce((acc, point) => acc + point.x, 0) / nose.length;
    const eyeSpan = Math.max(Math.abs(rightEyeCenterX - leftEyeCenterX), 1);
    const eyesMidX = (leftEyeCenterX + rightEyeCenterX) / 2;
    const yawRatio = Math.abs((noseCenterX - eyesMidX) / eyeSpan);

    if (yawRatio > YAW_RATIO_MAX) {
      resetBiometriaSegura();
      const motivo = "Olhe direto para a câmera";
      console.log("[BIOMETRIA][FRAME_INVALIDO]", { motivo, yawRatio, detectionScore, faceRatio });
      return { valido: false, motivo, detectionScore, faceRatio };
    }

    const descriptor = Float32Array.from(detection.descriptor);
    const snapshot: Snapshot = {
      descriptor,
      brightness: readBrightness(video, box),
      centerX: box.x + box.width / 2,
      centerY: box.y + box.height / 2,
      faceRatio,
      noseOffset: noseCenterX - eyesMidX,
      eyeSpan,
    };

    const previous = previousSnapshotRef.current;
    let descriptorDelta = 0;
    let movementScore = 1;

    if (previous) {
      descriptorDelta = descriptorDistance(snapshot.descriptor, previous.descriptor);
      const movementBox =
        Math.abs(snapshot.centerX - previous.centerX) / Math.max(video.videoWidth, 1) +
        Math.abs(snapshot.centerY - previous.centerY) / Math.max(video.videoHeight, 1);
      const movementArea = Math.abs(snapshot.faceRatio - previous.faceRatio);
      const movementNose = Math.abs(snapshot.noseOffset - previous.noseOffset) / Math.max(snapshot.eyeSpan, 1);
      const movementBrightness = Math.abs(snapshot.brightness - previous.brightness) / 255;
      movementScore = movementBox + movementArea + movementNose + movementBrightness + descriptorDelta * 0.08;

      if (movementScore < FROZEN_MOVEMENT_MAX) {
        frozenFramesRef.current += 1;
      } else {
        frozenFramesRef.current = 0;
      }

      if (descriptorDelta <= SAME_FACE_DISTANCE_MAX) {
        stableFramesRef.current += 1;
      } else {
        // TROCA DE IDENTIDADE: reset completo do buffer
        console.log("[BIOMETRIA][TROCA_IDENTIDADE]", {
          descriptorDelta: Number(descriptorDelta.toFixed(3)),
          limite: SAME_FACE_DISTANCE_MAX,
        });
        stableFramesRef.current = 1;
        frozenFramesRef.current = 0;
      }
    } else {
      stableFramesRef.current = 1;
      frozenFramesRef.current = 0;
    }

    previousSnapshotRef.current = snapshot;

    const confidence = clamp(1 - descriptorDelta / 5, 0, 0.999);
    const livenessScore = clamp(movementScore * 16, 0, 1);

    if (frozenFramesRef.current >= FROZEN_FRAME_LIMIT) {
      resetBiometriaSegura();
      return {
        valido: false,
        motivo: "Possível uso de imagem/foto",
        confidence,
        detectionScore,
        faceRatio,
        livenessScore,
        framesConfirmados: stableFramesRef.current,
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
      };
    }

    console.log("[BIOMETRIA][RECONHECIMENTO_VALIDO]", {
      framesConfirmados: stableFramesRef.current,
      detectionScore: Number(detectionScore.toFixed(3)),
      faceRatio: Number(faceRatio.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      livenessScore: Number(livenessScore.toFixed(3)),
    });

    return {
      valido: true,
      descriptor,
      confidence,
      detectionScore,
      faceRatio,
      livenessScore,
      framesConfirmados: stableFramesRef.current,
    };
  }, [readBrightness, resetBiometriaSegura]);

  return {
    validarRostoSeguro,
    resetBiometriaSegura,
  };
}