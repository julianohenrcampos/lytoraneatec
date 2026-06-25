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
import { useCameraDevices } from "@/hooks/ponto/useCameraDevices";

import { IndicadorQualidadeRosto } from "@/components/ponto/IndicadorQualidadeRosto";

/**
 * Debug do fluxo Totem.
 * Ativo SOMENTE quando `?debug=1` está na URL OU `localStorage.ponto_debug === "1"`.
 * Usa console.error porque o esbuild de produção remove console.log/info/warn.
 */
function isTotemDebugEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const url = new URL(window.location.href);
    if (url.searchParams.get("debug") === "1") return true;
    return localStorage.getItem("ponto_debug") === "1";
  } catch {
    return false;
  }
}
function totemDebug(evento: string, payload?: Record<string, unknown>) {
  if (!isTotemDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.error(`[PONTO_TOTEM][DEBUG][${evento}]`, payload ?? {});
}

// ============================================================
// Erro operacional explicativo (substitui mensagens genéricas)
// ============================================================
type ErroIdentificacao = {
  titulo: string;
  mensagem: string;
  motivo?: string;
  status?: number;
  decisao?: string;
  distancia?: number;
  confianca?: number;
  margem?: number;
  rpcErrorCode?: string | null;
  rpcErrorDetails?: string | null;
  rpcErrorHint?: string | null;
};

function mapearErroIdentificacao(args: {
  motivo?: string | null;
  status?: number;
  message?: string | null;
  decisao?: string | null;
  distancia?: number | null;
  confianca?: number | null;
  margem?: number | null;
  rpcErrorCode?: string | null;
  rpcErrorDetails?: string | null;
  rpcErrorHint?: string | null;
}): ErroIdentificacao {
  const m = (args.motivo ?? "").toString().toLowerCase();
  const base = {
    motivo: args.motivo ?? undefined,
    status: args.status,
    decisao: args.decisao ?? undefined,
    distancia: args.distancia ?? undefined,
    confianca: args.confianca ?? undefined,
    margem: args.margem ?? undefined,
    rpcErrorCode: args.rpcErrorCode ?? undefined,
    rpcErrorDetails: args.rpcErrorDetails ?? undefined,
    rpcErrorHint: args.rpcErrorHint ?? undefined,
  };
  switch (m) {
    case "sem_candidato":
      return { ...base, titulo: "Funcionário não encontrado", mensagem: "Nenhuma biometria compatível foi encontrada para este dispositivo ou centro de custo." };
    case "baixa_confianca":
    case "not_strong_enough":
    case "low_confidence":
      return { ...base, titulo: "Reconhecimento com baixa confiança", mensagem: "O rosto foi detectado, mas a similaridade ficou abaixo do limite necessário." };
    case "ambiguous_match":
      return { ...base, titulo: "Reconhecimento ambíguo", mensagem: "O sistema encontrou mais de um possível funcionário. Procure o RH para revisar a biometria." };
    case "dispositivo_invalido":
    case "sessao_invalida":
    case "sessao_expirada":
      return { ...base, titulo: "Dispositivo não configurado", mensagem: "Este Totem não está ativo ou não foi configurado corretamente." };
    case "configuracao_dispositivo_invalida":
      return { ...base, titulo: "Dispositivo sem centros de custo", mensagem: "Vincule centros de custo a este dispositivo no Admin de Dispositivos." };
    case "erro_rpc_matching":
      return { ...base, titulo: "Erro no matching facial", mensagem: args.message || "O servidor encontrou um erro ao comparar a biometria. Contate o TI." };
    case "motivo_nao_informado":
      return { ...base, titulo: "Erro ao identificar funcionário", mensagem: "Motivo técnico não informado pela Edge." };

    case "sem_vinculo":
    case "funcionario_sem_vinculo_obra":
      return { ...base, titulo: "Funcionário sem vínculo com esta obra", mensagem: "A biometria foi encontrada, mas o funcionário não possui vínculo com o centro de custo deste Totem." };
    case "erro_interno":
    case "erro_dispositivo":
      return { ...base, titulo: "Erro interno", mensagem: "O servidor não conseguiu concluir a identificação." };
    case "modelo_nao_carregado":
    case "camera_nao_pronta":
    case "descriptor_nao_gerado":
    case "deteccao_fraca":
    case "frame_invalido":
      return { ...base, titulo: "Identificação não enviada ao servidor", mensagem: "O sistema não conseguiu gerar a biometria facial para consulta." };
    default:
      return { ...base, titulo: "Erro ao identificar funcionário", mensagem: args.message || "Não foi possível concluir a identificação." };
  }
}

type TipoBatida = "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida";
type Status =
  | "carregando_modelos"
  | "escaneando"
  | "reconhecido_provisorio"
  | "reconhecido"
  | "registrando"
  | "sucesso"
  | "falha";

interface CentroCustoInfo {
  id: string;
  nome: string | null;
  latitude: number | null;
  longitude: number | null;
  raio_ponto_metros: number | null;
}
interface DispositivoInfo {
  id: string;
  nome?: string;
  codigo_dispositivo: string;
  centro_custo_id?: string | null;
  centro_custo_nome?: string;
  latitude_fixa?: number | null;
  longitude_fixa?: number | null;
  centro_custo?: CentroCustoInfo | null;
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
  qualidadeNivel: "ruim" | "media" | "boa";
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
  qualidadeNivel: "ruim",
};

const PontoTotem: React.FC = () => {
  const navigate = useNavigate();

  // Persistência + estado explícito do debug visual
  const [debugEnabled, setDebugEnabled] = useState<boolean>(false);
  useEffect(() => {
    let fromUrl = false;
    let fromStorage = false;
    try {
      const params = new URLSearchParams(window.location.search);
      fromUrl = params.get("debug") === "1";
      fromStorage = localStorage.getItem("ponto_debug") === "1";
      if (fromUrl) localStorage.setItem("ponto_debug", "1");
    } catch {}
    const enabled = fromUrl || fromStorage;
    setDebugEnabled(enabled);
    // eslint-disable-next-line no-console
    console.error("[PONTO_TOTEM][DEBUG_BOOT]", {
      href: typeof window !== "undefined" ? window.location.href : null,
      search: typeof window !== "undefined" ? window.location.search : null,
      storageDebug: (() => { try { return localStorage.getItem("ponto_debug"); } catch { return null; } })(),
      debugEnabledCalculado: enabled,
    });
  }, []);


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
  const [erroIdentificacaoDetalhado, setErroIdentificacaoDetalhado] = useState<ErroIdentificacao | null>(null);
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
  // Painel de debug visual (somente quando isTotemDebugEnabled()) — não afeta fluxo
  const [debugInfo, setDebugInfo] = useState<{
    detectionScore: number | null;
    mediaScore: number | null;
    limiteMedia: number | null;
    limiteUltimo: number | null;
    faceRatio: number | null;
    faceRatioMin: number | null;
    faceRatioMax: number | null;
    yaw: number | null;
    yawMax: number | null;
    centerOk: boolean | null;
    areaOk: boolean | null;
    motivoBloqueio: string | null;
    codigoBloqueio: string | null;
    qualidadeNivel: string | null;
    framesConfirmados: number | null;
    descriptorGerado: boolean;
    descriptorLen: number | null;
    edgeChamou: boolean;
    edgeFound: boolean | null;
  }>({
    detectionScore: null,
    mediaScore: null,
    limiteMedia: null,
    limiteUltimo: null,
    faceRatio: null,
    faceRatioMin: null,
    faceRatioMax: null,
    yaw: null,
    yawMax: null,
    centerOk: null,
    areaOk: null,
    motivoBloqueio: null,
    codigoBloqueio: null,
    qualidadeNivel: null,
    framesConfirmados: null,
    descriptorGerado: false,
    descriptorLen: null,
    edgeChamou: false,
    edgeFound: null,
  });
  const debugLastCodigoRef = useRef<string | null>(null);
  const debugLastLogTsRef = useRef<number>(0);
  // GPS
  const [gpsStatus, setGpsStatus] = useState<"idle" | "capturando" | "ok" | "impreciso" | "indisponivel">("idle");
  const [gpsPrecisao, setGpsPrecisao] = useState<number | null>(null);
  const [gpsTentativaAtual, setGpsTentativaAtual] = useState<number>(0);

  // F2 — Localização fixa do TOTEM (sem GPS do navegador)
  const localizacaoFixa = useMemo<
    { latitude: number; longitude: number; origem: "dispositivo" | "centro_custo"; raio: number | null } | null
  >(() => {
    if (!dispositivo) return null;
    const lat = dispositivo.latitude_fixa;
    const lon = dispositivo.longitude_fixa;
    if (lat != null && lon != null && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) {
      return {
        latitude: Number(lat),
        longitude: Number(lon),
        origem: "dispositivo",
        raio: dispositivo.centro_custo?.raio_ponto_metros ?? null,
      };
    }
    const cc = dispositivo.centro_custo;
    if (cc && cc.latitude != null && cc.longitude != null && Number.isFinite(Number(cc.latitude)) && Number.isFinite(Number(cc.longitude))) {
      return {
        latitude: Number(cc.latitude),
        longitude: Number(cc.longitude),
        origem: "centro_custo",
        raio: cc.raio_ponto_metros ?? null,
      };
    }
    return null;
  }, [dispositivo]);

  const semLocalizacaoConfigurada = !!dispositivo && !localizacaoFixa;

  // Quando o dispositivo carregar com localização fixa, marca GPS como OK sem chamar navigator.geolocation
  useEffect(() => {
    if (!localizacaoFixa) return;
    setGpsStatus("ok");
    setGpsPrecisao(0);
    setGpsTentativaAtual(0);
    totemDebug("GPS_FIXO", {
      origem: localizacaoFixa.origem,
      latitude: localizacaoFixa.latitude,
      longitude: localizacaoFixa.longitude,
      centro_custo_id: dispositivo?.centro_custo?.id ?? dispositivo?.centro_custo_id ?? null,
      raio: localizacaoFixa.raio,
    });
  }, [localizacaoFixa, dispositivo]);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  // Buffer multi-frame por funcionario_id (Fase 4 — anti falso-positivo)
  const matchBufferRef = useRef<Array<{ funcionario_id: string; confianca: number; ts: number }>>([]);
  const { validarRostoSeguro, resetBiometriaSegura } = useBiometriaSegura();
  // Seleção de câmera (USB ou frontal). Persiste deviceId em localStorage.
  const { devices: cameraDevices, selectedDeviceId, setSelectedDeviceId, refresh: refreshCameras } = useCameraDevices();
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
        totemDebug("MODELO_CARREGADO", { modeloCarregado: true });
      })
      .catch((e) => {
        pontoLog("FACEAPI", "ERRO", "error", { message: (e as Error)?.message });
        totemDebug("MODELO_ERRO", { message: (e as Error)?.message });
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
        totemDebug("CAMERA_READY", { deviceId: selectedDeviceId, videoWidth: v.videoWidth, videoHeight: v.videoHeight });
        setCameraReady(true);
        setCameraError(null);
      }
    };
    (async () => {
      try {
        const videoConstraints: MediaTrackConstraints = selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 720 }, height: { ideal: 720 } }
          : { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } };
        const stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
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
        // Re-popula labels após permissão concedida
        refreshCameras();
      } catch (e: any) {
        console.error("[TOTEM][CAMERA] erro:", e);
        if (e?.name === "OverconstrainedError" && selectedDeviceId) {
          setSelectedDeviceId(null);
          return;
        }
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
  }, [selectedDeviceId, refreshCameras, setSelectedDeviceId]);

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
    setEdgeStatus("idle");
    setEdgeErroMsg(null);
    setErroIdentificacaoDetalhado(null);
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

        // === Diagnóstico unificado (apenas em modo debug) ===
        const r: any = resultado;
        const diagSnapshot = {
          detectionScore: r.detectionScore ?? null,
          mediaScore: r.mediaScore ?? null,
          limiteMedia: r.limiteMedia ?? null,
          limiteUltimo: r.limiteUltimo ?? null,
          faceRatio: r.faceRatio ?? null,
          faceRatioMin: r.faceRatioMin ?? null,
          faceRatioMax: r.faceRatioMax ?? null,
          yaw: r.yaw ?? null,
          yawMax: r.yawMax ?? null,
          centerOk: r.centerOk ?? null,
          areaOk: r.areaOk ?? null,
          motivoBloqueio: resultado.motivo ?? null,
          codigoBloqueio: (resultado.codigoBloqueio as string | null | undefined) ?? null,
          qualidadeNivel: resultado.qualidadeNivel ?? null,
          framesConfirmados: r.framesConfirmados ?? null,
          descriptorGerado: !!r.descriptorGerado || !!resultado.descriptor,
        };
        setDebugInfo((prev) => ({ ...prev, ...diagSnapshot }));
        if (debugEnabled || isTotemDebugEnabled()) {
          const agora = Date.now();
          const codigo = diagSnapshot.codigoBloqueio;
          const mudou = codigo !== debugLastCodigoRef.current;
          if (mudou || agora - debugLastLogTsRef.current >= 500) {
            debugLastLogTsRef.current = agora;
            debugLastCodigoRef.current = codigo;
            // eslint-disable-next-line no-console
            console.error("[PONTO_TOTEM][DEBUG][DETECCAO_STATUS]", diagSnapshot);
          }
        }

        if (!resultado.valido || !resultado.descriptor) {
          // NÃO limpar resultado remoto aqui: frames inválidos intermitentes
          // (SEM_ROSTO / AGUARDANDO_BUFFER) ocorrem entre chamadas Edge e
          // apagariam o erro remoto recém-exibido. A limpeza ocorre
          // exclusivamente quando uma nova chamada Edge é despachada
          // (linhas ~720-722) ou em reset().


          // Deriva mensagem local humana a partir do código de bloqueio
          const codigo = (r.codigoBloqueio as string | null | undefined) ?? null;
          const faceRatio = (r.faceRatio as number | null | undefined) ?? null;
          const faceRatioMin = (r.faceRatioMin as number | null | undefined) ?? null;
          const faceRatioMax = (r.faceRatioMax as number | null | undefined) ?? null;
          let msgLocal: string | null = null;
          switch (codigo) {
            case "SEM_ROSTO":
              msgLocal = null; // texto inferior já cobre "Procurando rosto..."
              break;
            case "DETECCAO_FRACA":
              msgLocal = "Melhore a iluminação ou aproxime-se um pouco.";
              break;
            case "FRAME_INVALIDO":
              if (faceRatio != null && faceRatioMax != null && faceRatio > faceRatioMax) {
                msgLocal = "Afaste-se um pouco da câmera.";
              } else if (faceRatio != null && faceRatioMin != null && faceRatio < faceRatioMin) {
                msgLocal = "Aproxime-se da câmera.";
              } else {
                msgLocal = "Centralize o rosto no círculo.";
              }
              break;
            case "YAW_ALTO":
              msgLocal = "Olhe diretamente para a câmera.";
              break;
            case "AGUARDANDO_BUFFER":
            case "DETECCAO_AGUARDANDO_BUFFER":
              msgLocal = "Mantenha-se parado.";
              break;
            default:
              msgLocal =
                resultado.motivo && resultado.motivo !== "Nenhum rosto detectado"
                  ? resultado.motivo
                  : null;
          }
          setQualidadeMsg(msgLocal);
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
            qualidadeNivel: resultado.qualidadeNivel ?? "ruim",
          }));
          return;
        }

        setUltimaDeteccaoEm(Date.now());
        setQualidadeMsg(null);
        setBiometria((b) => ({ ...b, rostoDetectado: true, qualidadeOk: true, rostoValido: true, livenessOk: true, motivoBloqueio: "Identificando...", qualidadeNivel: resultado.qualidadeNivel ?? "boa" }));

        const descriptor = Array.from(resultado.descriptor);
        totemDebug("DESCRIPTOR_GERADO", {
          dispositivo_codigo: dispositivo.codigo_dispositivo,
          descriptorGerado: true,
          descriptorLen: descriptor.length,
          detectionScore: (resultado as any).detectionScore ?? null,
          faceRatio: (resultado as any).faceRatio ?? null,
          qualidadeNivel: resultado.qualidadeNivel ?? null,
        });
        setDebugInfo((prev) => ({
          ...prev,
          descriptorGerado: true,
          descriptorLen: descriptor.length,
          detectionScore: (resultado as any).detectionScore ?? null,
          faceRatio: (resultado as any).faceRatio ?? null,
          edgeChamou: true,
        }));
        setEdgeStatus("consultando");
        setEdgeErroMsg(null);
        setErroIdentificacaoDetalhado(null);

        // fetch direto: captura body mesmo em status não-2xx.
        // Edge `identificar-funcionario-por-face` tem verify_jwt=false e valida apenas x-device-secret.
        const SUPA_URL = (supabase as any).supabaseUrl as string;
        const ANON = (supabase as any).supabaseKey as string;
        let httpStatus: number | undefined;
        let data: any = null;
        let error: { message: string; __timeout?: true } | null = null;
        try {
          const ctrl = new AbortController();
          const tId = setTimeout(() => ctrl.abort(), 2500);
          const resp = await fetch(
            `${SUPA_URL}/functions/v1/identificar-funcionario-por-face`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: ANON,
                "x-device-secret": deviceSecret,
              },
              body: JSON.stringify({
                codigo_dispositivo: dispositivo.codigo_dispositivo,
                face_descriptor: descriptor,
              }),
              signal: ctrl.signal,
            },
          );
          clearTimeout(tId);
          httpStatus = resp.status;
          try { data = await resp.json(); } catch { data = null; }
          if (!resp.ok) {
            error = { message: data?.message ?? data?.error ?? `http_${resp.status}` };
          }
        } catch (e: any) {
          if (e?.name === "AbortError") {
            error = { message: "timeout_2s", __timeout: true };
          } else {
            error = { message: e?.message ?? "network_error" };
          }
        }

        if (error) {
          if (error.__timeout) {
            setEdgeStatus("timeout");
            setEdgeErroMsg("Falha na comunicação com servidor");
            setErroIdentificacaoDetalhado(mapearErroIdentificacao({
              motivo: "erro_interno",
              status: httpStatus,
              message: "Tempo de resposta esgotado (2.5s).",
            }));
          } else {
            setEdgeStatus("erro");
            setEdgeErroMsg("Erro ao identificar funcionário");
            setErroIdentificacaoDetalhado(mapearErroIdentificacao({
              motivo: data?.reason ?? data?.motivo ?? data?.error ?? "erro_interno",
              status: httpStatus,
              message: data?.message ?? data?.detail ?? error.message,
              decisao: data?.decisao ?? null,
              distancia: data?.top1_distancia ?? null,
              confianca: data?.top1_confidence ?? data?.confianca ?? null,
              margem: data?.margem ?? null,
            }));
          }
          setConfiancaAtual(null);
          return;
        }
        if (!data || data.error) {
          setEdgeStatus("erro");
          setEdgeErroMsg(data?.error ? `Erro: ${data.error}` : "Erro ao identificar funcionário");
          setErroIdentificacaoDetalhado(mapearErroIdentificacao({
            motivo: data?.error ?? data?.reason ?? "erro_interno",
            status: httpStatus,
            message: data?.message ?? data?.detail ?? null,
          }));
          setConfiancaAtual(null);
          return;
        }
        setEdgeStatus("idle");
        totemDebug("EDGE_RESPONSE", {
          edgeStatus: "idle",
          found: (data as any)?.found ?? null,
          decisao: (data as any)?.decisao ?? null,
          motivo: (data as any)?.reason ?? (data as any)?.motivo ?? null,
          top1_distancia: (data as any)?.top1_distancia ?? null,
          margem: (data as any)?.margem ?? null,
        });
        console.error("[PONTO_TOTEM][EDGE_PAYLOAD_FINAL]", data);
        setDebugInfo((prev) => ({ ...prev, edgeFound: (data as any)?.found ?? null }));


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
          const motivoRaw = (data.reason ?? data.motivo ?? null) as string | null;
          if (!motivoRaw) {
            // eslint-disable-next-line no-console
            console.error("[PONTO_TOTEM][MATCH_REJEITADO_PAYLOAD]", data);
          }
          const motivo = motivoRaw ?? "motivo_nao_informado";
          setConfiancaAtual(null);
          setLastReason(motivo as any);
          matchBufferRef.current = [];
          setTentativasSemMatch((x) => x + 1);
          setBiometria((b) => ({ ...b, matchValido: false, framesValidos: 0, motivoBloqueio: "Rosto detectado, mas não reconhecido" }));
          setEdgeStatus("erro");
          setEdgeErroMsg("Rosto detectado, mas não reconhecido");
          setErroIdentificacaoDetalhado(mapearErroIdentificacao({
            motivo,
            status: httpStatus,
            message: data.message ?? data.error ?? null,
            decisao: data.decisao ?? null,
            distancia: data.top1_distancia ?? null,
            confianca: data.top1_confidence ?? data.confianca ?? null,
            margem: data.margem ?? null,
            rpcErrorCode: data.rpc_error_code ?? null,
            rpcErrorDetails: data.rpc_error_details ?? null,
            rpcErrorHint: data.rpc_error_hint ?? null,
          }));
          pontoLog("BIOMETRIA", "MATCH_REJEITADO_BACKEND", "warn", {
            reason: motivo,
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

        // Sem gate local: confiar na decisão da Edge (aprovado/provisorio aceitos)
        const decisaoEdge = String(data.decisao ?? "").toLowerCase();
        const aceito =
          !!funcionarioId &&
          data.found === true &&
          (decisaoEdge === "aprovado" || decisaoEdge === "provisorio");

        if (!aceito) {
          console.error("[PONTO_TOTEM][EDGE_PAYLOAD_INESPERADO]", data);
          setConfiancaAtual(null);
          matchBufferRef.current = [];
          setBiometria((b) => ({ ...b, matchValido: false, framesValidos: 0, motivoBloqueio: "Resposta inesperada do servidor de reconhecimento" }));
          setEdgeStatus("erro");
          setEdgeErroMsg("Resposta inesperada do servidor de reconhecimento");
          setTentativasSemMatch((x) => x + 1);
          setErroIdentificacaoDetalhado(mapearErroIdentificacao({
            motivo: "motivo_nao_informado",
            status: httpStatus,
            decisao: data.decisao ?? null,
            distancia: Number.isFinite(top1d) ? top1d : null,
            confianca: Number.isFinite(confianca) ? confianca : null,
            margem: Number.isFinite(margem) ? margem : null,
          }));
          pontoLog("BIOMETRIA", "EDGE_INESPERADO", "warn", { dist: top1d, margem, confianca, funcionario_id: funcionarioId, decisao: data.decisao });
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
        setErroIdentificacaoDetalhado(null);
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
    if (localizacaoFixa) return; // F2: totem fixo não usa GPS do navegador
    if (status === "reconhecido_provisorio" && (gpsStatus === "idle" || gpsStatus === "indisponivel")) {
      capturarGPSComRetry(3).catch(() => undefined);
    }
  }, [status, gpsStatus, capturarGPSComRetry, localizacaoFixa]);

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
    if (semLocalizacaoConfigurada) return "Dispositivo sem localização configurada";
    if (!localizacaoFixa) {
      if (gpsPrecisao == null) return "Aguardando GPS";
      if (gpsPrecisao > GPS_PRECISAO_MAX_TOTEM) return `GPS impreciso (±${Math.round(gpsPrecisao)}m). Tente novamente.`;
      if (!gpsValido) return "Aguardando GPS";
    }
    if (!faceValida) return "Aguardando confirmação";
    return null;
  }, [biometria, gpsValido, gpsPrecisao, faceValida, modeloErro, cameraError, localizacaoFixa, semLocalizacaoConfigurada]);

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
      setErroIdentificacaoDetalhado(mapearErroIdentificacao({ motivo: "modelo_nao_carregado" }));
      return;
    }
    if (!cameraReady) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "camera_indisponivel" });
      toast.error("Câmera necessária");
      setErroIdentificacaoDetalhado(mapearErroIdentificacao({ motivo: "camera_nao_pronta" }));
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

    // F2 — Totem fixo: usa coordenadas cadastradas; senão tenta GPS do navegador
    let gps: { latitude: number; longitude: number; precisao_gps_metros: number } | null = null;
    if (localizacaoFixa) {
      gps = {
        latitude: localizacaoFixa.latitude,
        longitude: localizacaoFixa.longitude,
        precisao_gps_metros: 0,
      };
      totemDebug("BATIDA_GPS_FIXO", { origem: localizacaoFixa.origem, ...gps });
    } else {
      if (gpsStatus === "ok" || gpsStatus === "impreciso") {
        gps = await capturarGPSUmaVez();
      }
      if (!gps) {
        gps = await capturarGPSComRetry(3);
      }
      if (!gps) {
        pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "gps_invalido" });
        toast.error("Não foi possível obter localização. Ative o GPS para registrar o ponto.");
        return;
      }
      const accuracy = gps.precisao_gps_metros;
      if (!Number.isFinite(accuracy) || accuracy > GPS_PRECISAO_MAX_TOTEM) {
        pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "gps_impreciso", accuracy, limite: GPS_PRECISAO_MAX_TOTEM });
        toast.error(`GPS impreciso (±${Math.round(accuracy)}m). Tente novamente em local aberto.`);
        setStatus("escaneando");
        return;
      }
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
  }, [dispositivo, deviceSecret, funcionario, cameraReady, modeloErro, gpsStatus, capturarFotoBase64, capturarGPSUmaVez, capturarGPSComRetry, tipoBatida, reset, podeConfirmar, motivoBotao, biometria, localizacaoFixa]);

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
    if (semLocalizacaoConfigurada) {
      return {
        titulo: "Dispositivo sem localização configurada",
        descricao: "Este dispositivo não possui coordenadas fixas e o centro de custo principal também não está geolocalizado. Procure o administrador.",
        podeRetentar: false,
      };
    }
    return null;
  }, [modeloErro, cameraError, semLocalizacaoConfigurada]);

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
          {localizacaoFixa ? (
            <div
              className="flex items-center gap-1 text-xs px-2 py-1 rounded border border-cyan-500/40 text-cyan-200 bg-cyan-500/10"
              title={`Localização fixa (${localizacaoFixa.origem === "dispositivo" ? "dispositivo" : "centro de custo"})${localizacaoFixa.raio ? ` • raio ${localizacaoFixa.raio}m` : ""}`}
            >
              <MapPin className="h-3 w-3" />
              Localização fixa
              {localizacaoFixa.raio ? <span className="text-cyan-300/70">• {localizacaoFixa.raio}m</span> : null}
            </div>
          ) : (
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
          )}
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
      {!localizacaoFixa && (status === "reconhecido_provisorio" || status === "reconhecido") && gpsStatus === "capturando" && (
        <div className="absolute top-20 right-6 z-40 px-3 py-2 rounded-lg bg-amber-500/15 border border-amber-400/40 text-amber-200 text-xs flex items-center gap-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Obtendo localização... ({gpsTentativaAtual}/3)
        </div>
      )}
      {!localizacaoFixa && (status === "reconhecido_provisorio" || status === "reconhecido") && gpsStatus === "indisponivel" && (
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

            {status === "escaneando" && cameraReady && (
              <div className="absolute top-3 left-3 z-20">
                <IndicadorQualidadeRosto
                  qualidadeNivel={biometria.qualidadeNivel}
                  rostoDetectado={biometria.rostoDetectado}
                  motivoBloqueio={biometria.motivoBloqueio}
                />
              </div>
            )}

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="relative w-[55%] aspect-square">
                <div
                  className={cn(
                    "absolute inset-0 rounded-[40%] border-2 shadow-[0_0_30px_rgba(34,211,238,0.6)]",
                    status === "reconhecido"
                      ? "border-emerald-300/80"
                      : status === "escaneando"
                        ? (biometria.qualidadeNivel === "boa"
                            ? "border-emerald-300/80"
                            : biometria.qualidadeNivel === "media"
                              ? "border-amber-300/80"
                              : "border-red-400/80 animate-pulse")
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
                  lastReason === "sem_candidato" && "text-rose-300",
                )}>
                  {lastReason === "low_confidence" && "Rosto não reconhecido"}
                  {lastReason === "ambiguous_match" && "Ambiguidade detectada — tente novamente"}
                  {lastReason === "not_strong_enough" && "Aproxime o rosto / melhore iluminação"}
                  {lastReason === "sem_candidato" && "Funcionário não encontrado. Procure o RH para cadastrar sua biometria."}
                </p>
              )}
              {status === "escaneando" && !lastReason && qualidadeMsg && (
                <p className="text-sm mt-1 font-medium text-amber-300">{qualidadeMsg}</p>
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
          ) : erroIdentificacaoDetalhado ? (
            <div className="flex-1 rounded-3xl border-2 border-rose-500/60 bg-rose-950/30 p-8 flex flex-col gap-4 text-rose-100">
              <h3 className="text-2xl font-bold text-rose-200">{erroIdentificacaoDetalhado.titulo}</h3>
              <p className="text-base text-rose-100/90">{erroIdentificacaoDetalhado.mensagem}</p>
              <dl className="text-xs text-rose-200/80 grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 mt-2">
                {erroIdentificacaoDetalhado.motivo && (
                  <><dt className="font-semibold">Motivo</dt><dd className="font-mono">{erroIdentificacaoDetalhado.motivo}</dd></>
                )}
                {erroIdentificacaoDetalhado.status != null && (
                  <><dt className="font-semibold">HTTP</dt><dd className="font-mono">{erroIdentificacaoDetalhado.status}</dd></>
                )}
                {erroIdentificacaoDetalhado.decisao && (
                  <><dt className="font-semibold">Decisão</dt><dd className="font-mono">{erroIdentificacaoDetalhado.decisao}</dd></>
                )}
                {erroIdentificacaoDetalhado.distancia != null && (
                  <><dt className="font-semibold">Distância</dt><dd className="font-mono">{Number(erroIdentificacaoDetalhado.distancia).toFixed(3)}</dd></>
                )}
                {erroIdentificacaoDetalhado.confianca != null && (
                  <><dt className="font-semibold">Confiança</dt><dd className="font-mono">{Number(erroIdentificacaoDetalhado.confianca).toFixed(3)}</dd></>
                )}
                {erroIdentificacaoDetalhado.margem != null && (
                  <><dt className="font-semibold">Margem</dt><dd className="font-mono">{Number(erroIdentificacaoDetalhado.margem).toFixed(3)}</dd></>
                )}
                {erroIdentificacaoDetalhado.rpcErrorCode && (
                  <><dt className="font-semibold">RPC code</dt><dd className="font-mono">{erroIdentificacaoDetalhado.rpcErrorCode}</dd></>
                )}
                {erroIdentificacaoDetalhado.rpcErrorDetails && (
                  <><dt className="font-semibold">RPC details</dt><dd className="font-mono break-all">{erroIdentificacaoDetalhado.rpcErrorDetails}</dd></>
                )}
                {erroIdentificacaoDetalhado.rpcErrorHint && (
                  <><dt className="font-semibold">RPC hint</dt><dd className="font-mono break-all">{erroIdentificacaoDetalhado.rpcErrorHint}</dd></>
                )}
              </dl>
              <button
                onClick={reset}
                className="mt-4 self-start rounded-lg bg-rose-500 hover:bg-rose-400 text-white px-6 py-3 font-semibold transition-colors"
              >
                Tentar novamente
              </button>
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

      {debugEnabled && (
        <div
          data-testid="totem-debug-badge"
          style={{
            position: "fixed", top: 8, left: "50%", transform: "translateX(-50%)",
            zIndex: 2147483647, background: "#22d3ee", color: "#000",
            padding: "6px 14px", borderRadius: 999, fontWeight: 800, fontSize: 12,
            fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase",
            boxShadow: "0 4px 12px rgba(0,0,0,.4)",
          }}
        >
          DEBUG TOTEM ATIVO
        </div>
      )}
      {debugEnabled && (
        <div
          data-testid="totem-debug-panel"
          style={{
            position: "fixed", top: 56, right: 12, zIndex: 2147483647,
            width: 380, maxHeight: "78vh", overflow: "auto",
            background: "rgba(0,0,0,0.92)", color: "#fff",
            border: "2px solid #22d3ee", borderRadius: 12, padding: 12,
            fontSize: 12, fontFamily: "monospace",
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-cyan-300 font-bold uppercase text-sm">Debug Totem</span>
            <button
              type="button"
              onClick={() => { try { localStorage.removeItem("ponto_debug"); } catch {} window.location.href = "/ponto-totem"; }}
              className="px-2 py-1 rounded bg-rose-500 text-white text-[11px] font-semibold hover:bg-rose-600"
              aria-label="Desligar debug"
            >Desligar debug</button>
          </div>
          {(() => {
            const v = videoRef.current;
            const yes = <span className="text-emerald-300">true</span>;
            const no = <span className="text-rose-300">false</span>;
            const bool = (b: boolean | null | undefined) => (b === true ? yes : b === false ? no : <span className="text-slate-500">—</span>);
            const val = (x: unknown) => (x === null || x === undefined || x === "" ? <span className="text-slate-500">—</span> : <span className="text-amber-200">{String(x)}</span>);
            const Row = ({ k, v }: { k: string; v: React.ReactNode }) => (
              <div className="flex justify-between gap-2"><span className="text-slate-400">{k}:</span><span className="text-right break-all">{v}</span></div>
            );
            const Sec = ({ t, children }: { t: string; children: React.ReactNode }) => (
              <div className="mb-2">
                <div className="text-cyan-300 uppercase text-[11px] mb-1 border-b border-slate-800">{t}</div>
                {children}
              </div>
            );
            return (
              <>
                <Sec t="Modelo">
                  <Row k="debugEnabled" v={bool(true)} />
                  <Row k="modeloCarregado" v={bool(biometria.modeloCarregado)} />
                  <Row k="modeloErro" v={val(modeloErro)} />
                </Sec>

                <Sec t="Validação">
                  <Row k="codigoBloqueio" v={debugInfo.codigoBloqueio == null ? <span className="text-emerald-300">ok</span> : <span className="text-amber-300">{debugInfo.codigoBloqueio}</span>} />
                  <Row k="motivoBloqueio" v={val(debugInfo.motivoBloqueio)} />
                  <Row k="detectionScore" v={val(`${debugInfo.detectionScore?.toFixed?.(3) ?? "—"} / min ${debugInfo.limiteUltimo ?? "—"}`)} />
                  <Row k="mediaScore" v={val(`${debugInfo.mediaScore?.toFixed?.(3) ?? "—"} / min ${debugInfo.limiteMedia ?? "—"}`)} />
                  <Row k="faceRatio" v={val(`${debugInfo.faceRatio?.toFixed?.(3) ?? "—"} (${debugInfo.faceRatioMin ?? "—"}…${debugInfo.faceRatioMax ?? "—"})`)} />
                  <Row k="yaw" v={val(`${debugInfo.yaw?.toFixed?.(3) ?? "—"} / max ${debugInfo.yawMax ?? "—"}`)} />
                  <Row k="centerOk" v={bool(debugInfo.centerOk)} />
                  <Row k="areaOk" v={bool(debugInfo.areaOk)} />
                  <Row k="qualidadeNivel" v={val(debugInfo.qualidadeNivel)} />
                  <Row k="framesConfirmados" v={val(debugInfo.framesConfirmados)} />
                  <Row k="descriptorGerado" v={bool(debugInfo.descriptorGerado)} />
                </Sec>
                <Sec t="Câmera">
                  <Row k="cameraReady" v={bool(cameraReady)} />
                  <Row k="videoWidth" v={val(v?.videoWidth ?? null)} />
                  <Row k="videoHeight" v={val(v?.videoHeight ?? null)} />
                  <Row k="deviceId" v={val(selectedDeviceId ? `…${selectedDeviceId.slice(-8)}` : null)} />
                  <Row k="cameraError" v={val(cameraError)} />
                </Sec>
                <Sec t="Detecção">
                  <Row k="detectionScore" v={val(debugInfo.detectionScore?.toFixed?.(3) ?? debugInfo.detectionScore)} />
                  <Row k="faceRatio" v={val(debugInfo.faceRatio?.toFixed?.(3) ?? debugInfo.faceRatio)} />
                  <Row k="qualidadeNivel" v={val(biometria.qualidadeNivel)} />
                  <Row k="motivoBloqueio" v={val(biometria.motivoBloqueio)} />
                  <Row k="descriptorGerado" v={bool(debugInfo.descriptorGerado)} />
                  <Row k="descriptorLen" v={val(debugInfo.descriptorLen)} />
                </Sec>
                <Sec t="Edge">
                  <Row k="edgeChamou" v={bool(debugInfo.edgeChamou)} />
                  <Row k="edgeStatus" v={val(edgeStatus)} />
                  <Row k="found" v={bool(debugInfo.edgeFound)} />
                  <Row k="decisao" v={val(matchDebug.decisao)} />
                  <Row k="motivo" v={val(matchDebug.motivo ?? edgeErroMsg)} />
                  <Row k="top1_distancia" v={val(matchDebug.top1_distancia?.toFixed?.(4) ?? matchDebug.top1_distancia)} />
                  <Row k="margem" v={val(matchDebug.margem?.toFixed?.(4) ?? matchDebug.margem)} />
                </Sec>
                <Sec t="Dispositivo">
                  <Row k="codigo" v={val(dispositivo?.codigo_dispositivo)} />
                  <Row k="centro_custo_id" v={val(dispositivo?.centro_custo?.id ?? dispositivo?.centro_custo_id)} />
                  <Row k="centro_custo" v={val(dispositivo?.centro_custo?.nome ?? dispositivo?.centro_custo_nome)} />
                </Sec>
                <Sec t="GPS / Localização">
                  <Row k="gpsStatus" v={val(gpsStatus)} />
                  <Row k="aguardandoGPS" v={bool(gpsStatus === "capturando")} />
                  <Row k="gpsPrecisao" v={val(gpsPrecisao)} />
                  <Row k="origem" v={val(localizacaoFixa ? `fixa (${localizacaoFixa.origem})` : "navegador")} />
                  {localizacaoFixa && <Row k="lat,lng" v={val(`${localizacaoFixa.latitude.toFixed(5)}, ${localizacaoFixa.longitude.toFixed(5)}`)} />}
                  {localizacaoFixa && <Row k="raio" v={val(localizacaoFixa.raio)} />}
                </Sec>
              </>
            );
          })()}
        </div>
      )}

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
