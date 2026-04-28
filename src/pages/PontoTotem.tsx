import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  MapPinOff,
  ScanFace,
  Search,
  Tablet,
  UserSearch,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { loadFaceApiModels, resetFaceApiLoader } from "@/lib/faceapi/loader";
import { useBiometriaSegura } from "@/hooks/ponto/useBiometriaSegura";
import { verificarCooldownBatida } from "@/lib/ponto/verificarCooldownBatida";
import { pontoLog } from "@/lib/ponto/pontoLog";

type TipoBatida = "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida";
type Status =
  | "carregando_modelos"
  | "escaneando"
  | "reconhecido_provisorio"
  | "reconhecido"
  | "registrando"
  | "sucesso"
  | "falha";

interface DispositivoInfo {
  id: string;
  nome?: string;
  codigo_dispositivo: string;
  centro_custo_nome?: string;
}

interface FuncionarioReconhecido {
  funcionario_id: string;
  nome: string;
  matricula: string | null;
  cpf: string | null;
  funcao: string | null;
  centro_custo: string | null;
  foto_url: string | null;
  confianca: number;
}

interface MatchDebug {
  top1_distancia: number | null;
  top2_distancia: number | null;
  margem: number | null;
  threshold: number;
  margem_min: number;
  decisao: string | null;
  motivo: string | null;
  log_id: string | null;
  frames_ok: number;
}

const TIPOS: { value: TipoBatida; label: string }[] = [
  { value: "entrada", label: "Entrada" },
  { value: "intervalo_inicio", label: "Início Int." },
  { value: "intervalo_fim", label: "Fim Int." },
  { value: "saida", label: "Saída" },
];

// AJUSTE TEMPORÁRIO DE CALIBRAÇÃO — revisar com logs reais.
// Centraliza thresholds locais do gate de match. NÃO espalhar valores no código.
const CALIBRACAO_MATCH = {
  DIST_LOCAL_GATE: 0.42, // antes 0.35
  MARGEM_MIN: 0.08,      // mantido
  CONFIANCA_MIN: 0.88,   // antes 0.92
} as const;

// Modo conservador (espelha backend)
const TICK_MS = 500;
const DIST_LOCAL_GATE = CALIBRACAO_MATCH.DIST_LOCAL_GATE;
const MARGEM_MIN = CALIBRACAO_MATCH.MARGEM_MIN;
const CONFIANCA_MIN = CALIBRACAO_MATCH.CONFIANCA_MIN;
const REQUIRED_MATCH_FRAMES = 3;
const MATCH_BUFFER_WINDOW_MS = 4000;
// GPS — limite de precisão para totem/tablet (mais permissivo que mobile)
const GPS_PRECISAO_MAX_TOTEM = 100; // metros
// Compat: backend ainda usa DIST_MAX_TOP1 como referência de threshold mostrado
const DIST_MAX_TOP1 = 0.50;

type BiometriaEstado = {
  modeloCarregado: boolean;
  rostoDetectado: boolean;
  qualidadeOk: boolean;
  rostoValido: boolean;
  livenessOk: boolean;
  matchValido: boolean;
  framesValidos: number;
  motivoBloqueio: string | null;
};

const BIOMETRIA_INICIAL: BiometriaEstado = {
  modeloCarregado: false,
  rostoDetectado: false,
  qualidadeOk: false,
  rostoValido: false,
  livenessOk: false,
  matchValido: false,
  framesValidos: 0,
  motivoBloqueio: "Carregando reconhecimento facial...",
};

const PontoTotem: React.FC = () => {
  const navigate = useNavigate();

  // Sessão
  const [dispositivo, setDispositivo] = useState<DispositivoInfo | null>(null);
  const [deviceSecret, setDeviceSecret] = useState<string | null>(null);

  // Estado UI
  const [status, setStatus] = useState<Status>("carregando_modelos");
  const [funcionario, setFuncionario] = useState<FuncionarioReconhecido | null>(null);
  const [tipoBatida, setTipoBatida] = useState<TipoBatida>("entrada");
  const [agora, setAgora] = useState<Date>(new Date());
  const [online, setOnline] = useState<boolean>(navigator.onLine);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [confiancaAtual, setConfiancaAtual] = useState<number | null>(null);
  const [tentativasSemMatch, setTentativasSemMatch] = useState(0);
  const [ultimaDeteccaoEm, setUltimaDeteccaoEm] = useState<number | null>(null);
  const [agoraTick, setAgoraTick] = useState<number>(Date.now());
  const [edgeStatus, setEdgeStatus] = useState<"idle" | "consultando" | "erro" | "timeout">("idle");
  const [lastReason, setLastReason] = useState<"low_confidence" | "ambiguous_match" | "not_strong_enough" | "sem_candidato" | null>(null);
  // Fallback identificação manual
  const [manualOpen, setManualOpen] = useState(false);
  const [manualTab, setManualTab] = useState<"matricula" | "nome">("matricula");
  const [manualValor, setManualValor] = useState("");
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSugestoes, setManualSugestoes] = useState<Array<{
    funcionario_id: string; nome: string; matricula: string | null; funcao: string | null; centro_custo: string | null;
  }>>([]);
  const [edgeErroMsg, setEdgeErroMsg] = useState<string | null>(null);
  const [matchDebug, setMatchDebug] = useState<MatchDebug>({
    top1_distancia: null,
    top2_distancia: null,
    margem: null,
    threshold: DIST_MAX_TOP1,
    margem_min: MARGEM_MIN,
    decisao: null,
    motivo: null,
    log_id: null,
    frames_ok: 0,
  });
  const [qualidadeMsg, setQualidadeMsg] = useState<string | null>(null);
  const [modeloErro, setModeloErro] = useState<string | null>(null);
  const [biometria, setBiometria] = useState<BiometriaEstado>(BIOMETRIA_INICIAL);
  // GPS
  const [gpsStatus, setGpsStatus] = useState<"idle" | "capturando" | "ok" | "impreciso" | "indisponivel">("idle");
  const [gpsPrecisao, setGpsPrecisao] = useState<number | null>(null);
  const [gpsTentativaAtual, setGpsTentativaAtual] = useState<number>(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  // Buffer multi-frame por funcionario_id (Fase 4 — anti falso-positivo)
  const matchBufferRef = useRef<Array<{ funcionario_id: string; confianca: number; ts: number }>>([]);
  const { validarRostoSeguro, resetBiometriaSegura } = useBiometriaSegura();
  const statusRef = useRef<Status>("carregando_modelos");
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Boot: validar sessão
  useEffect(() => {
    const secret = localStorage.getItem("device_secret");
    const infoRaw = localStorage.getItem("device_info");
    if (!secret || !infoRaw) {
      navigate("/ponto-totem-login", { replace: true });
      return;
    }
    try {
      const info = JSON.parse(infoRaw) as DispositivoInfo;
      if (!info?.id || !info?.codigo_dispositivo) throw new Error("device_info inválido");
      setDispositivo(info);
      setDeviceSecret(secret);
    } catch {
      localStorage.removeItem("device_secret");
      localStorage.removeItem("device_info");
      navigate("/ponto-totem-login", { replace: true });
    }
  }, [navigate]);

  // Relógio + online
  useEffect(() => {
    const id = window.setInterval(() => setAgora(new Date()), 1000);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const carregarModelos = useCallback(() => {
    setModeloErro(null);
    setBiometria((b) => ({ ...b, modeloCarregado: false, motivoBloqueio: "Carregando reconhecimento facial..." }));
    setStatus("carregando_modelos");
    loadFaceApiModels()
      .then(() => {
        setModeloErro(null);
        setBiometria((b) => ({ ...b, modeloCarregado: true, motivoBloqueio: "Aguardando rosto" }));
        setStatus("escaneando");
      })
      .catch((e) => {
        pontoLog("FACEAPI", "ERRO", "error", { message: (e as Error)?.message });
        setModeloErro("Falha ao carregar reconhecimento facial");
        setBiometria((b) => ({ ...b, modeloCarregado: false, motivoBloqueio: "Reconhecimento facial indisponível" }));
        setStatus("falha");
      });
  }, []);

  const tentarRecarregarModelo = useCallback(() => {
    resetFaceApiLoader();
    carregarModelos();
  }, [carregarModelos]);

  // Carregar modelos face-api
  useEffect(() => {
    carregarModelos();
  }, [carregarModelos]);

  // Câmera — aguarda frame válido antes de marcar cameraReady
  useEffect(() => {
    let cancelled = false;
    const onFrameReady = () => {
      const v = videoRef.current;
      if (!v) return;
      if (v.videoWidth > 0 && v.videoHeight > 0) {
        console.log("[TOTEM][CAMERA] frame válido", v.videoWidth, "x", v.videoHeight);
        setCameraReady(true);
        setCameraError(null);
      }
    };
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.addEventListener("loadeddata", onFrameReady);
          v.addEventListener("canplay", onFrameReady);
          v.addEventListener("playing", onFrameReady);
          await v.play().catch(() => undefined);
          if (v.videoWidth > 0) onFrameReady();
        }
      } catch (e: any) {
        console.error("[TOTEM][CAMERA] erro:", e);
        setCameraReady(false);
        setCameraError(
          e?.name === "NotAllowedError" ? "Permissão de câmera negada" : "Câmera indisponível",
        );
      }
    })();
    return () => {
      cancelled = true;
      const v = videoRef.current;
      if (v) {
        v.removeEventListener("loadeddata", onFrameReady);
        v.removeEventListener("canplay", onFrameReady);
        v.removeEventListener("playing", onFrameReady);
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  // Tick visual ("Procurando rosto..." após 2s sem detecção)
  useEffect(() => {
    const id = window.setInterval(() => setAgoraTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const reset = useCallback(() => {
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
    resetBiometriaSegura();
    matchBufferRef.current = [];
    setFuncionario(null);
    setTipoBatida("entrada");
    setConfiancaAtual(null);
    setMatchDebug({
      top1_distancia: null,
      top2_distancia: null,
      margem: null,
      threshold: DIST_MAX_TOP1,
      margem_min: MARGEM_MIN,
      decisao: null,
      motivo: null,
      log_id: null,
      frames_ok: 0,
    });
    setQualidadeMsg(null);
    setLastReason(null);
    setTentativasSemMatch(0);
    setBiometria((b) => ({
      ...b,
      rostoDetectado: false,
      qualidadeOk: false,
      rostoValido: false,
      livenessOk: false,
      matchValido: false,
      framesValidos: 0,
      motivoBloqueio: b.modeloCarregado ? "Aguardando rosto" : "Carregando reconhecimento facial...",
    }));
    setStatus("escaneando");
  }, [resetBiometriaSegura]);

  const capturarFotoBase64 = useCallback((): string | null => {
    const v = videoRef.current;
    if (!v || !cameraReady || v.videoWidth === 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.8);
  }, [cameraReady]);

  // Loop de detecção facial
  useEffect(() => {
    if (status !== "escaneando" || !cameraReady || !dispositivo || !deviceSecret) return;

    const tick = async () => {
      const v = videoRef.current;
      if (statusRef.current !== "escaneando" || inflightRef.current) return;
      if (!v || v.videoWidth === 0 || v.videoHeight === 0) return;
      inflightRef.current = true;
      try {
        const resultado = await validarRostoSeguro(v, "totem");
        if (statusRef.current !== "escaneando") return;
        if (!resultado.valido || !resultado.descriptor) {
          setQualidadeMsg(resultado.motivo ?? null);
          setConfiancaAtual(resultado.confidence ?? null);
          // Frame inválido quebra a sequência
          matchBufferRef.current = [];
          setBiometria((b) => ({
            ...b,
            rostoDetectado: !!resultado.rostoDetectado,
            qualidadeOk: !!resultado.qualidadeOk,
            rostoValido: false,
            livenessOk: !!resultado.livenessOk,
            matchValido: false,
            framesValidos: 0,
            motivoBloqueio: resultado.motivo ?? "Aguardando rosto",
          }));
          if (resultado.motivo === "Nenhum rosto detectado") {
            setQualidadeMsg(null);
          } else if (resultado.motivo && resultado.motivo !== "Confirmando identidade...") {
            setTentativasSemMatch((x) => x + 1);
          }
          return;
        }

        setUltimaDeteccaoEm(Date.now());
        setQualidadeMsg(null);
        setBiometria((b) => ({ ...b, rostoDetectado: true, qualidadeOk: true, rostoValido: true, livenessOk: true, motivoBloqueio: "Identificando..." }));

        const descriptor = Array.from(resultado.descriptor);
        setEdgeStatus("consultando");
        setEdgeErroMsg(null);

        const invokePromise = supabase.functions.invoke(
          "identificar-funcionario-por-face",
          {
            headers: { "x-device-secret": deviceSecret },
            body: {
              codigo_dispositivo: dispositivo.codigo_dispositivo,
              face_descriptor: descriptor,
            },
          },
        );
        const timeoutPromise = new Promise<{ data: null; error: { message: string; __timeout: true } }>(
          (resolve) =>
            setTimeout(
              () => resolve({ data: null, error: { message: "timeout_2s", __timeout: true } }),
              2500,
            ),
        );

        const { data, error } = (await Promise.race([invokePromise, timeoutPromise])) as any;

        if (error) {
          if (error.__timeout) {
            setEdgeStatus("timeout");
            setEdgeErroMsg("Falha na comunicação com servidor");
          } else {
            setEdgeStatus("erro");
            setEdgeErroMsg("Erro ao identificar funcionário");
          }
          setConfiancaAtual(null);
          return;
        }
        if (!data || data.error) {
          setEdgeStatus("erro");
          setEdgeErroMsg(data?.error ? `Erro: ${data.error}` : "Erro ao identificar funcionário");
          setConfiancaAtual(null);
          return;
        }
        setEdgeStatus("idle");

        // Atualiza painel debug com métricas reais
        setMatchDebug((prev) => ({
          ...prev,
          top1_distancia: data.top1_distancia ?? null,
          top2_distancia: data.top2_distancia ?? null,
          margem: data.margem ?? null,
          threshold: data.thresholds?.min ?? data.threshold ?? DIST_MAX_TOP1,
          margem_min: data.thresholds?.delta ?? data.margem_min ?? MARGEM_MIN,
          decisao: data.decisao ?? null,
          motivo: data.reason ?? data.motivo ?? null,
          log_id: data.log_id ?? null,
          frames_ok: prev.frames_ok,
        }));

        if (!data.found || data.decisao === "rejeitado") {
          setConfiancaAtual(null);
          setLastReason((data.reason as any) ?? "sem_candidato");
          matchBufferRef.current = [];
          setTentativasSemMatch((x) => x + 1);
          setBiometria((b) => ({ ...b, matchValido: false, framesValidos: 0, motivoBloqueio: "Rosto detectado, mas não reconhecido" }));
          setEdgeErroMsg("Rosto detectado, mas não reconhecido");
          pontoLog("BIOMETRIA", "MATCH_REJEITADO_BACKEND", "warn", {
            reason: data.reason ?? "sem_candidato",
            top1Conf: data.top1_confidence ?? null,
            top1Dist: data.top1_distancia ?? null,
          });
          return;
        }

        const top1d = Number(data.top1_distancia);
        const margem = Number(data.margem);
        const confianca = Number(data.top1_confidence ?? data.confianca ?? 0);
        const funcionarioId = (data as any).funcionario_id as string | undefined;

        // MATCH_DEBUG estruturado — visibilidade completa para calibração
        pontoLog("BIOMETRIA", "MATCH_DEBUG", "info", {
          top1Distance: top1d,
          top2Distance: Number.isFinite(Number(data.top2_distancia)) ? Number(data.top2_distancia) : null,
          margem,
          confidence: confianca,
          decisaoBackend: data.decisao,
          reasonBackend: data.reason ?? null,
          funcionario_id: funcionarioId ?? null,
          thresholds_local: {
            dist: CALIBRACAO_MATCH.DIST_LOCAL_GATE,
            margem: CALIBRACAO_MATCH.MARGEM_MIN,
            conf: CALIBRACAO_MATCH.CONFIANCA_MIN,
          },
          thresholds_backend: data.thresholds ?? null,
        });

        // GATE ÚNICO E AND ESTRITO (calibrado via CALIBRACAO_MATCH)
        const matchOk =
          !!funcionarioId &&
          Number.isFinite(top1d) &&
          top1d < DIST_LOCAL_GATE &&
          margem >= MARGEM_MIN &&
          confianca >= CONFIANCA_MIN;
        if (!matchOk) {
          setConfiancaAtual(null);
          matchBufferRef.current = [];
          setBiometria((b) => ({ ...b, matchValido: false, framesValidos: 0, motivoBloqueio: "Rosto detectado, mas não reconhecido" }));
          setEdgeErroMsg("Rosto detectado, mas não reconhecido");
          setTentativasSemMatch((x) => x + 1);
          pontoLog("BIOMETRIA", "MATCH_INVALIDO", "warn", { dist: top1d, margem, confianca, funcionario_id: funcionarioId });
          return;
        }

        pontoLog("BIOMETRIA", "MATCH", "info", { confianca, funcionario_id: funcionarioId, dist: top1d, aprovado: true });

        // Fase 4: buffer multi-frame por mesmo funcionario_id
        const now = Date.now();
        const buffer = matchBufferRef.current.filter((x) => now - x.ts <= MATCH_BUFFER_WINDOW_MS);
        // Reset se houver troca de identidade
        const baseId = buffer.length > 0 ? buffer[0].funcionario_id : funcionarioId;
        const novoBuffer = funcionarioId === baseId
          ? [...buffer, { funcionario_id: funcionarioId!, confianca, ts: now }]
          : [{ funcionario_id: funcionarioId!, confianca, ts: now }];
        matchBufferRef.current = novoBuffer;

        const framesConfirmados = novoBuffer.length;
        if (framesConfirmados < REQUIRED_MATCH_FRAMES) {
          setConfiancaAtual(confianca);
          setBiometria((b) => ({ ...b, matchValido: false, framesValidos: framesConfirmados, motivoBloqueio: "Confirmando identidade..." }));
          console.log("[BIOMETRIA][CONFIRMACAO]", { aprovado: false, framesConfirmados, funcionario_id: funcionarioId });
          return;
        }

        console.log("[BIOMETRIA][CONFIRMACAO]", { aprovado: true, framesConfirmados, funcionario_id: funcionarioId });
        setConfiancaAtual(confianca);
        setLastReason(null);
        setMatchDebug((prev) => ({ ...prev, frames_ok: framesConfirmados }));
        setBiometria((b) => ({ ...b, matchValido: true, framesValidos: framesConfirmados, motivoBloqueio: null }));
        setFuncionario(data as FuncionarioReconhecido);
        setStatus("reconhecido_provisorio");
        setTentativasSemMatch(0);
        matchBufferRef.current = [];
        resetTimerRef.current = window.setTimeout(reset, 20000);
      } catch (e) {
        console.error("[TOTEM][EXCEPTION]", e);
        setEdgeStatus("erro");
        setEdgeErroMsg("Erro inesperado");
      } finally {
        inflightRef.current = false;
      }
    };

    tickRef.current = window.setInterval(tick, TICK_MS);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [status, cameraReady, dispositivo, deviceSecret, reset, validarRostoSeguro]);

  // Captura GPS uma vez (timeout 4s, high accuracy)
  const capturarGPSUmaVez = useCallback((): Promise<{ latitude: number; longitude: number; precisao_gps_metros: number } | null> => {
    return new Promise((resolve) => {
      if (!("geolocation" in navigator)) {
        console.warn("[BIOMETRIA][GPS_BLOQUEADO]", { motivo: "indisponivel_no_dispositivo" });
        resolve(null);
        return;
      }
      let resolved = false;
      const timeoutId = window.setTimeout(() => {
        if (resolved) return;
        resolved = true;
        console.warn("[BIOMETRIA][GPS_BLOQUEADO]", { motivo: "timeout" });
        resolve(null);
      }, 4000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (resolved) return;
          resolved = true;
          window.clearTimeout(timeoutId);
          const precisao = pos.coords.accuracy ?? 0;
          resolve({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            precisao_gps_metros: precisao,
          });
        },
        (err) => {
          if (resolved) return;
          resolved = true;
          window.clearTimeout(timeoutId);
          console.warn("[BIOMETRIA][GPS_BLOQUEADO]", { motivo: err.message, code: err.code });
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 3500, maximumAge: 0 },
      );
    });
  }, []);

  // Captura GPS com retry (até 3 tentativas)
  const capturarGPSComRetry = useCallback(async (
    maxTentativas: number = 3,
  ): Promise<{ latitude: number; longitude: number; precisao_gps_metros: number } | null> => {
    setGpsStatus("capturando");
    setGpsTentativaAtual(0);
    for (let i = 1; i <= maxTentativas; i += 1) {
      setGpsTentativaAtual(i);
      const r = await capturarGPSUmaVez();
      if (r) {
        const precisao = r.precisao_gps_metros;
        setGpsStatus(precisao > 50 ? "impreciso" : "ok");
        setGpsPrecisao(precisao);
        setGpsTentativaAtual(0);
        console.log("[PONTO][GPS]", { ok: true, tentativa: i, ...r });
        return r;
      }
      if (i < maxTentativas) {
        await new Promise((res) => setTimeout(res, 600));
      }
    }
    setGpsStatus("indisponivel");
    setGpsPrecisao(null);
    setGpsTentativaAtual(0);
    return null;
  }, [capturarGPSUmaVez]);

  // Pré-captura GPS assim que reconhecimento provisório acontece
  useEffect(() => {
    if (status === "reconhecido_provisorio" && (gpsStatus === "idle" || gpsStatus === "indisponivel")) {
      capturarGPSComRetry(3).catch(() => undefined);
    }
  }, [status, gpsStatus, capturarGPSComRetry]);

  // Validação visual + gates derivados (devem vir antes de confirmarBatida)
  // GPS válido = lat/lon finitos + accuracy ≤ limite (NÃO aceita "impreciso" automaticamente)
  const gpsValido = useMemo(() => (
    gpsPrecisao != null &&
    Number.isFinite(gpsPrecisao) &&
    gpsPrecisao <= GPS_PRECISAO_MAX_TOTEM &&
    (gpsStatus === "ok" || gpsStatus === "impreciso")
  ), [gpsPrecisao, gpsStatus]);
  const faceValida = status === "reconhecido_provisorio" || status === "reconhecido";

  const podeConfirmar = useMemo(() => {
    return (
      biometria.modeloCarregado &&
      biometria.rostoDetectado &&
      biometria.rostoValido &&
      biometria.livenessOk &&
      biometria.matchValido &&
      biometria.framesValidos >= REQUIRED_MATCH_FRAMES &&
      gpsValido &&
      faceValida &&
      !modeloErro &&
      !cameraError
    );
  }, [biometria, gpsValido, faceValida, modeloErro, cameraError]);

  const motivoBotao = useMemo<string | null>(() => {
    if (!biometria.modeloCarregado) return "Carregando reconhecimento...";
    if (modeloErro) return "Reconhecimento facial indisponível";
    if (cameraError) return "Câmera indisponível";
    if (!biometria.rostoDetectado) return "Posicione o rosto na câmera";
    if (!biometria.rostoValido) return biometria.motivoBloqueio ?? "Ajuste o rosto na câmera";
    if (!biometria.livenessOk) return "Mova-se ligeiramente (anti-foto)";
    if (!biometria.matchValido) return biometria.motivoBloqueio ?? "Identificando...";
    if (biometria.framesValidos < REQUIRED_MATCH_FRAMES) return "Confirmando identidade...";
    if (gpsPrecisao == null) return "Aguardando GPS";
    if (gpsPrecisao > GPS_PRECISAO_MAX_TOTEM) return `GPS impreciso (±${Math.round(gpsPrecisao)}m). Tente novamente.`;
    if (!gpsValido) return "Aguardando GPS";
    if (!faceValida) return "Aguardando confirmação";
    return null;
  }, [biometria, gpsValido, gpsPrecisao, faceValida, modeloErro, cameraError]);

  // Confirmar batida
  const confirmarBatida = useCallback(async () => {
    if (!dispositivo || !deviceSecret || !funcionario) return;

    // BLOQUEIO ABSOLUTO PRÉ-EDGE: validação completa obrigatória
    const faceValida = statusRef.current === "reconhecido_provisorio" || statusRef.current === "reconhecido";
    if (!faceValida) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "face_invalida", status: statusRef.current });
      toast.error("Validação biométrica incompleta — não é possível registrar");
      return;
    }
    if (statusRef.current === "reconhecido" && !podeConfirmar) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "validacao_incompleta", biometria, motivoBotao });
      toast.error(motivoBotao ?? "Validação incompleta — não é possível registrar");
      return;
    }
    if (modeloErro) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "modelo_nao_carregado" });
      toast.error("Reconhecimento facial indisponível");
      return;
    }
    if (!cameraReady) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "camera_indisponivel" });
      toast.error("Câmera necessária");
      return;
    }
    const cooldown = await verificarCooldownBatida(funcionario.funcionario_id);
    if (cooldown.bloqueado) {
      const msg = cooldown.minutosRestantes > 1
        ? `Aguarde ${cooldown.minutosRestantes} minutos antes de registrar novo ponto`
        : "Aguarde antes de registrar novo ponto";
      toast.error(msg);
      setStatus("falha");
      setEdgeErroMsg(msg);
      resetTimerRef.current = window.setTimeout(reset, 3500);
      return;
    }
    const foto = capturarFotoBase64();
    if (!foto) {
      toast.error("Falha ao capturar foto");
      return;
    }
    if (resetTimerRef.current) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }

    // Garante GPS válido com retry antes de chamar a edge
    let gps: { latitude: number; longitude: number; precisao_gps_metros: number } | null = null;
    if (gpsStatus === "ok" || gpsStatus === "impreciso") {
      gps = await capturarGPSUmaVez(); // refresh rápido
    }
    if (!gps) {
      gps = await capturarGPSComRetry(3);
    }
    if (!gps) {
      pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "gps_invalido" });
      toast.error("Não foi possível obter localização. Ative o GPS para registrar o ponto.");
      return;
    }
    // Hard-block por precisão (defesa em camadas — botão já bloqueia, mas garantimos aqui)
    const accuracy = gps.precisao_gps_metros;
    if (!Number.isFinite(accuracy) || accuracy > GPS_PRECISAO_MAX_TOTEM) {
      pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "gps_impreciso", accuracy, limite: GPS_PRECISAO_MAX_TOTEM });
      toast.error(`GPS impreciso (±${Math.round(accuracy)}m). Tente novamente em local aberto.`);
      setStatus("escaneando");
      return;
    }

    setStatus("registrando");
    const payloadRegistro = {
      codigo_dispositivo: dispositivo.codigo_dispositivo,
      identificador_funcionario: funcionario.matricula || funcionario.cpf || "",
      tipo_identificador: funcionario.matricula ? "matricula" : "cpf",
      tipo_batida: tipoBatida,
      data_hora_dispositivo: new Date().toISOString(),
      foto_base64: foto,
      offline_uuid: crypto.randomUUID(),
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      precisao_gps_metros: gps?.precisao_gps_metros ?? null,
    };
    console.log("[PONTO][CALL_REGISTRO]", {
      funcionario_id: funcionario.funcionario_id,
      dispositivo_id: dispositivo.id,
      codigo_dispositivo: dispositivo.codigo_dispositivo,
      tipo_batida: tipoBatida,
      temFoto: !!foto,
    });
    try {
      const { data, error } = await supabase.functions.invoke("registrar-ponto-totem", {
        headers: { "x-device-secret": deviceSecret },
        body: payloadRegistro,
      });
      console.log("[TOTEM][EDGE_RESPONSE]", { data, error });

      // Tenta extrair body do erro HTTP (FunctionsHttpError)
      let serverPayload: any = data;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            serverPayload = await ctx.json();
            console.log("[TOTEM][EDGE_ERROR_BODY]", serverPayload);
          }
        } catch (parseErr) {
          console.warn("[TOTEM][EDGE_ERROR_PARSE_FAIL]", parseErr);
        }
      }

      if (error || !serverPayload?.success) {
        const msg =
          serverPayload?.message ||
          serverPayload?.error ||
          error?.message ||
          "Erro ao registrar ponto";
        const stage = serverPayload?.stage ? ` [${serverPayload.stage}]` : "";
        toast.error(`${msg}${stage}`);
        setStatus("falha");
        resetTimerRef.current = window.setTimeout(reset, 3500);
        return;
      }

      const tipoLabel = TIPOS.find((t) => t.value === tipoBatida)?.label || tipoBatida;
      toast.success(`Ponto registrado ✅ ${tipoLabel} • ${new Date().toLocaleTimeString("pt-BR")}`);
      setStatus("sucesso");
      resetTimerRef.current = window.setTimeout(reset, 2000);
    } catch (e: any) {
      console.error("[TOTEM][EXCEPTION]", e);
      toast.error(e?.message || "Erro ao registrar ponto");
      setStatus("falha");
      resetTimerRef.current = window.setTimeout(reset, 3000);
    }
  }, [dispositivo, deviceSecret, funcionario, cameraReady, modeloErro, gpsStatus, capturarFotoBase64, capturarGPSUmaVez, capturarGPSComRetry, tipoBatida, reset, podeConfirmar, motivoBotao, biometria]);

  // Confirmação humana "Sou eu" → registra no log + promove para "reconhecido"
  const confirmarMatch = useCallback(async () => {
    if (!dispositivo || !deviceSecret || !funcionario) return;
    setStatus("reconhecido");
    if (matchDebug.log_id) {
      try {
        await supabase.functions.invoke("confirmar-match-totem", {
          headers: { "x-device-secret": deviceSecret },
          body: {
            codigo_dispositivo: dispositivo.codigo_dispositivo,
            log_id: matchDebug.log_id,
            funcionario_id: funcionario.funcionario_id,
          },
        });
      } catch (e) {
        console.warn("[TOTEM][CONFIRM_MATCH] falhou:", e);
      }
    }
  }, [dispositivo, deviceSecret, funcionario, matchDebug.log_id]);

  const sairDispositivo = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    localStorage.removeItem("device_secret");
    localStorage.removeItem("device_info");
    navigate("/ponto-totem-login", { replace: true });
  }, [navigate]);

  // Auto-enrolamento removido — biometria só é cadastrada pelo RH no painel administrativo.

  const iniciais = useMemo(() => {
    if (!funcionario?.nome) return "??";
    return funcionario.nome
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || "")
      .join("");
  }, [funcionario]);

  const fotoAvatarUrl = useMemo(() => {
    if (!funcionario?.foto_url) return undefined;
    if (funcionario.foto_url.startsWith("http")) return funcionario.foto_url;
    return undefined;
  }, [funcionario]);

  // (gpsValido / faceValida / podeConfirmar / motivoBotao definidos antes de confirmarBatida)

  // Bloqueio crítico: modelo, câmera (não bloqueia GPS aqui — GPS bloqueia só na confirmação)
  const motivoBloqueioCritico = useMemo<{ titulo: string; descricao: string; podeRetentar: boolean } | null>(() => {
    if (modeloErro) {
      return {
        titulo: "Reconhecimento facial indisponível",
        descricao: "Falha ao carregar modelos de reconhecimento. Verifique sua conexão e tente novamente.",
        podeRetentar: true,
      };
    }
    if (cameraError) {
      return {
        titulo: "Câmera indisponível",
        descricao: cameraError,
        podeRetentar: false,
      };
    }
    return null;
  }, [modeloErro, cameraError]);

  // Handler de busca/seleção manual
  const buscarManual = useCallback(async () => {
    if (!dispositivo || !deviceSecret) return;
    const valor = manualValor.trim();
    if (valor.length < 2) {
      toast.error("Informe ao menos 2 caracteres");
      return;
    }
    setManualLoading(true);
    setManualSugestoes([]);
    try {
      const modo: "matricula" | "cpf" | "nome" =
        manualTab === "nome"
          ? "nome"
          : valor.replace(/\D/g, "").length === 11
            ? "cpf"
            : "matricula";
      const valorEnvio = modo === "cpf" ? valor.replace(/\D/g, "") : valor;
      const { data, error } = await supabase.functions.invoke("identificar-funcionario-manual", {
        headers: { "x-device-secret": deviceSecret },
        body: { codigo_dispositivo: dispositivo.codigo_dispositivo, modo, valor: valorEnvio },
      });
      if (error) {
        let msg = error.message;
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.json();
            msg = body?.message || body?.error || msg;
          }
        } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (modo === "nome") {
        const list = (data?.sugestoes ?? []) as typeof manualSugestoes;
        if (!list.length) {
          toast.error("Nenhum funcionário encontrado");
        }
        setManualSugestoes(list);
      } else {
        const f = data?.funcionario;
        if (!f) throw new Error("Funcionário não encontrado");
        setFuncionario(f as FuncionarioReconhecido);
        setStatus("reconhecido");
        setManualOpen(false);
        setManualValor("");
        setManualSugestoes([]);
        setTentativasSemMatch(0);
        if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = window.setTimeout(reset, 30000);
      }
    } catch (e: any) {
      toast.error(e?.message || "Erro na busca manual");
    } finally {
      setManualLoading(false);
    }
  }, [dispositivo, deviceSecret, manualValor, manualTab, reset]);

  const selecionarSugestao = useCallback(async (id: string) => {
    if (!dispositivo || !deviceSecret) return;
    setManualLoading(true);
    try {
      // Busca dados completos pela matrícula encontrada
      const sug = manualSugestoes.find((s) => s.funcionario_id === id);
      if (!sug?.matricula) {
        toast.error("Funcionário sem matrícula cadastrada");
        return;
      }
      const { data, error } = await supabase.functions.invoke("identificar-funcionario-manual", {
        headers: { "x-device-secret": deviceSecret },
        body: { codigo_dispositivo: dispositivo.codigo_dispositivo, modo: "matricula", valor: sug.matricula },
      });
      if (error || !data?.funcionario) throw new Error(error?.message || "Falha ao selecionar");
      setFuncionario(data.funcionario as FuncionarioReconhecido);
      setStatus("reconhecido");
      setManualOpen(false);
      setManualValor("");
      setManualSugestoes([]);
      setTentativasSemMatch(0);
      if (resetTimerRef.current) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(reset, 30000);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao selecionar funcionário");
    } finally {
      setManualLoading(false);
    }
  }, [dispositivo, deviceSecret, manualSugestoes, reset]);

  if (!dispositivo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-cyan-200">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col">
      {/* HEADER */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-cyan-500/20 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/dashboard", { replace: true })}
            aria-label="Voltar ao sistema LYTOTEC"
            title="Voltar ao sistema"
            className="flex items-center gap-3 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          >
            <img
              src="/icons/dcf6c980-f927-4180-b109-b425da1323ba.png"
              alt="Lytorânea"
              className="h-12 w-12 object-contain"
            />
            <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-700">
              <Tablet className="h-5 w-5 text-cyan-400" />
            </div>
            <div className="text-left">
              <p className="text-sm text-slate-400 leading-none">Dispositivo</p>
              <p className="text-lg font-semibold tracking-wide">
                {dispositivo.nome || dispositivo.codigo_dispositivo}
                <span className="ml-2 text-xs text-cyan-400/80">
                  {dispositivo.codigo_dispositivo}
                </span>
              </p>
              {dispositivo.centro_custo_nome && (
                <p className="text-xs text-cyan-300/70 leading-tight mt-0.5">
                  Obra: {dispositivo.centro_custo_nome}
                </p>
              )}
            </div>
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="text-xs text-slate-400 leading-none capitalize">
              {agora.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
            </p>
            <p className="text-2xl font-mono font-bold text-cyan-300 tracking-wider">
              {agora.toLocaleTimeString("pt-BR")}
            </p>
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded border",
              online
                ? "border-emerald-500/40 text-emerald-300"
                : "border-amber-500/40 text-amber-300",
            )}
          >
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {online ? "Online" : "Offline"}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded border",
              gpsStatus === "ok" && "border-emerald-500/40 text-emerald-300",
              gpsStatus === "impreciso" && "border-amber-500/40 text-amber-300",
              gpsStatus === "indisponivel" && "border-red-500/40 text-red-300",
              gpsStatus === "capturando" && "border-cyan-500/40 text-cyan-300",
              gpsStatus === "idle" && "border-slate-700 text-slate-400",
            )}
            title={
              gpsStatus === "ok" ? `GPS preciso (${Math.round(gpsPrecisao ?? 0)}m)`
              : gpsStatus === "impreciso" ? `GPS impreciso (${Math.round(gpsPrecisao ?? 0)}m)`
              : gpsStatus === "indisponivel" ? "GPS indisponível"
              : gpsStatus === "capturando" ? "Capturando GPS..."
              : "GPS"
            }
          >
            {gpsStatus === "indisponivel" ? (
              <MapPinOff className="h-3 w-3" />
            ) : gpsStatus === "capturando" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <MapPin className="h-3 w-3" />
            )}
            {gpsStatus === "ok" && `GPS ${Math.round(gpsPrecisao ?? 0)}m`}
            {gpsStatus === "impreciso" && `GPS ~${Math.round(gpsPrecisao ?? 0)}m`}
            {gpsStatus === "indisponivel" && "Sem GPS"}
            {gpsStatus === "capturando" && "GPS..."}
            {gpsStatus === "idle" && "GPS"}
          </div>
          <button
            onClick={sairDispositivo}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 transition-colors text-sm"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        </div>
      </header>

      {/* OVERLAY DE BLOQUEIO CRÍTICO */}
      {motivoBloqueioCritico && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="max-w-md w-full rounded-3xl border-2 border-rose-500/60 bg-slate-900 p-8 text-center shadow-[0_0_60px_rgba(244,63,94,0.35)]">
            <div className="mx-auto h-16 w-16 rounded-full bg-rose-500/20 flex items-center justify-center mb-4">
              <X className="h-10 w-10 text-rose-400" />
            </div>
            <h2 className="text-2xl font-bold text-rose-100">{motivoBloqueioCritico.titulo}</h2>
            <p className="text-sm text-slate-300 mt-3">{motivoBloqueioCritico.descricao}</p>
            {motivoBloqueioCritico.podeRetentar && (
              <button
                onClick={tentarRecarregarModelo}
                className="mt-6 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm"
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      )}

      {/* Banner de GPS capturando/indisponível (visível durante reconhecimento provisório) */}
      {(status === "reconhecido_provisorio" || status === "reconhecido") && gpsStatus === "capturando" && (
        <div className="absolute top-20 right-6 z-40 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Obtendo localização... ({gpsTentativaAtual}/3)
        </div>
      )}
      {(status === "reconhecido_provisorio" || status === "reconhecido") && gpsStatus === "indisponivel" && (
        <div className="absolute top-20 right-6 z-40 px-3 py-2 rounded-lg bg-rose-500/20 border border-rose-400/50 text-rose-100 text-xs flex items-center gap-2">
          <MapPinOff className="h-3 w-3" />
          GPS indisponível — registro bloqueado
        </div>
      )}

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 p-6">
        {/* SCANNER */}
        <section className="flex flex-col gap-4">
          <div
            className={cn(
              "relative flex-1 rounded-3xl overflow-hidden bg-slate-900 border-2",
              status === "reconhecido"
                ? "border-emerald-400/70 shadow-[0_0_60px_rgba(16,185,129,0.35)]"
                : "border-cyan-400/60 shadow-[0_0_60px_rgba(34,211,238,0.25)]",
            )}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-90 scale-x-[-1]"
            />

            {!cameraReady && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3 bg-slate-900">
                <Camera className="h-16 w-16 opacity-40" />
                <p className="text-sm">{cameraError || "Iniciando câmera..."}</p>
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[55%] aspect-square">
                <div
                  className={cn(
                    "absolute inset-0 rounded-[40%] border-2 shadow-[0_0_30px_rgba(34,211,238,0.6)]",
                    status === "reconhecido"
                      ? "border-emerald-300/80"
                      : "border-cyan-300/70 animate-pulse",
                  )}
                />
                {[
                  "top-0 left-0 border-t-4 border-l-4 rounded-tl-2xl",
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-2xl",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-2xl",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-2xl",
                ].map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      "absolute h-10 w-10",
                      status === "reconhecido" ? "border-emerald-400" : "border-cyan-400",
                      c,
                    )}
                  />
                ))}
                {status === "escaneando" && (
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.9)] animate-[scan_2.4s_ease-in-out_infinite]" />
                )}
              </div>
            </div>

            <div className="absolute bottom-6 inset-x-0 text-center px-6">
              <p className="text-cyan-200 text-2xl font-semibold drop-shadow">
                {status === "carregando_modelos" && "Carregando reconhecimento facial..."}
                {status === "escaneando" && (
                  edgeStatus === "consultando"
                    ? "Consultando servidor..."
                    : edgeStatus === "timeout"
                      ? "Falha na comunicação com servidor"
                      : edgeStatus === "erro"
                        ? edgeErroMsg || "Erro ao identificar funcionário"
                        : confiancaAtual !== null
                          ? "Identificando..."
                          : ultimaDeteccaoEm && agoraTick - ultimaDeteccaoEm < 2000
                            ? "Rosto detectado"
                            : cameraReady
                              ? "Procurando rosto..."
                              : "Iniciando câmera..."
                )}
                {status === "reconhecido" && "Identificação confirmada"}
                {status === "registrando" && "Registrando ponto..."}
                {status === "sucesso" && "Registrado com sucesso ✓"}
                {status === "falha" && "Falha — tente novamente"}
              </p>
              {status === "escaneando" && edgeStatus === "idle" && lastReason && (
                <p className={cn(
                  "text-sm mt-1 font-medium",
                  lastReason === "low_confidence" && "text-rose-300",
                  lastReason === "ambiguous_match" && "text-amber-300",
                  lastReason === "not_strong_enough" && "text-cyan-300",
                  lastReason === "sem_candidato" && "text-slate-400",
                )}>
                  {lastReason === "low_confidence" && "Rosto não reconhecido"}
                  {lastReason === "ambiguous_match" && "Ambiguidade detectada — tente novamente"}
                  {lastReason === "not_strong_enough" && "Aproxime o rosto / melhore iluminação"}
                  {lastReason === "sem_candidato" && "Procurando rosto..."}
                </p>
              )}
              {status === "escaneando" && qualidadeMsg && (
                <p className="text-sm mt-1 font-medium text-amber-300">{qualidadeMsg}</p>
              )}
              {status === "escaneando" && tentativasSemMatch >= 8 && edgeStatus === "idle" && (
                <p className="text-rose-300 text-base font-semibold mt-2">
                  Funcionário não encontrado. Procure o RH para cadastrar sua biometria.
                </p>
              )}
            </div>

            {status === "carregando_modelos" && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
                <Loader2 className="h-12 w-12 animate-spin text-cyan-300" />
              </div>
            )}
          </div>

        </section>

        {/* IDENTIFICAÇÃO */}
        <section className="flex flex-col gap-4">
          {status === "reconhecido_provisorio" || status === "reconhecido" || status === "registrando" || status === "sucesso" ? (
            <div className={cn(
              "flex-1 rounded-3xl border-2 bg-slate-900/80 p-8 flex flex-col items-center text-center animate-fade-in",
              status === "reconhecido_provisorio"
                ? "border-amber-400/70 shadow-[0_0_40px_rgba(245,158,11,0.25)]"
                : "border-emerald-400/60 shadow-[0_0_40px_rgba(16,185,129,0.2)]",
            )}>
              {status === "reconhecido_provisorio" && (
                <div className="w-full mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-amber-200 text-sm font-medium">
                  ⚠ Funcionário identificado <strong>provisoriamente</strong> — confirme a identidade abaixo
                </div>
              )}
              {fotoAvatarUrl ? (
                <img
                  key={fotoAvatarUrl}
                  src={fotoAvatarUrl}
                  alt={funcionario?.nome}
                  className="h-32 w-32 rounded-full object-cover ring-4 ring-emerald-400/60 shadow-lg animate-fade-in"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <Avatar className="h-32 w-32 ring-4 ring-emerald-400/60 shadow-lg animate-fade-in">
                  <AvatarFallback className="bg-slate-800 text-emerald-300 text-3xl font-bold">{iniciais}</AvatarFallback>
                </Avatar>
              )}
              <h2 className="text-4xl font-bold mt-4 text-white">{funcionario?.nome}</h2>
              <p className="text-slate-400 text-lg mt-2">
                {funcionario?.matricula && <>Matrícula <span className="text-cyan-300">{funcionario.matricula}</span> • </>}
                {funcionario?.funcao || "Função não informada"}
              </p>
              {funcionario?.centro_custo && (
                <p className="text-slate-500 text-sm">{funcionario.centro_custo}</p>
              )}



              {/* Tipo de batida — só habilitado quando confirmado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full mt-6">
                {TIPOS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTipoBatida(t.value)}
                    disabled={status !== "reconhecido"}
                    className={cn(
                      "py-3 rounded-lg border text-sm font-semibold transition-colors",
                      tipoBatida === t.value
                        ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.4)]"
                        : "bg-slate-950 text-slate-300 border-slate-700 hover:border-cyan-500/40",
                      status !== "reconhecido" && "opacity-40 cursor-not-allowed",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Botões SIM / NÃO */}
              <div className="flex gap-6 mt-8">
                <button
                  onClick={status === "reconhecido_provisorio" ? confirmarMatch : confirmarBatida}
                  disabled={
                    status === "registrando" ||
                    status === "sucesso" ||
                    !!motivoBloqueioCritico ||
                    !faceValida ||
                    (status === "reconhecido" && !podeConfirmar)
                  }
                  className={cn(
                    "flex flex-col items-center justify-center gap-2 h-32 w-32 rounded-full font-bold text-lg disabled:opacity-50 animate-pulse",
                    status === "reconhecido_provisorio"
                      ? "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.6)]"
                      : "bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.6)]",
                  )}
                >
                  {status === "registrando" ? (
                    <Loader2 className="h-10 w-10 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-10 w-10" />
                      {status === "reconhecido_provisorio" ? "SOU EU" : "SIM"}
                    </>
                  )}
                </button>
                <button
                  onClick={reset}
                  disabled={status === "registrando"}
                  className="flex flex-col items-center justify-center gap-2 h-32 w-32 rounded-full bg-rose-500 hover:bg-rose-400 text-white font-bold text-lg shadow-[0_0_30px_rgba(244,63,94,0.5)] disabled:opacity-50"
                >
                  <X className="h-10 w-10" />
                  NÃO
                </button>
              </div>
              {status === "reconhecido" && !podeConfirmar && motivoBotao && (
                <p className="mt-4 text-sm text-amber-300 font-medium">{motivoBotao}</p>
              )}
            </div>
          ) : (
            <div className="flex-1 rounded-3xl border-2 border-dashed border-slate-700 bg-slate-900/40 flex flex-col items-center justify-center text-slate-500 gap-4 p-8">
              <ScanFace className="h-24 w-24 opacity-30" />
              <p className="text-xl">Aguardando reconhecimento</p>
              <p className="text-sm text-center max-w-md">
                O sistema identifica automaticamente. Olhe para a câmera ao lado e mantenha o rosto
                centralizado.
              </p>
            </div>
          )}
        </section>
      </main>

      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(120%); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default PontoTotem;
