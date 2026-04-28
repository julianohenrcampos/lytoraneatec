import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { detectarCentroCustoPorGPS } from "@/services/ponto/detectarCentroCustoPorGPS";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  MapPinOff,
  ScanFace,
  Wifi,
  WifiOff,
  X,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { loadFaceApiModels, resetFaceApiLoader } from "@/lib/faceapi/loader";
import { getEstadoJornada, type TipoBatida } from "@/lib/ponto/estadoJornada";
import { useBiometriaSegura } from "@/hooks/ponto/useBiometriaSegura";
import { verificarCooldownBatida } from "@/lib/ponto/verificarCooldownBatida";
import { pontoLog } from "@/lib/ponto/pontoLog";

type Status =
  | "carregando"
  | "sem_biometria"
  | "escaneando"
  | "reconhecido"
  | "registrando"
  | "sucesso"
  | "falha";

interface BatidaDia {
  tipo_batida: string;
  data_hora_considerada: string;
  status_validacao: string;
  data_operacional: string;
}

interface GPSData {
  latitude: number;
  longitude: number;
  precisao: number;
}

interface CCDetectado {
  id: string | null;
  nome: string | null;
  distancia: number | null;
}

interface CCEsperado {
  id: string;
  nome: string;
  latitude: number | null;
  longitude: number | null;
  raio_metros: number;
  origem: "cc_funcionario" | "vinculo_operacional";
}

interface PerfilFuncionario {
  funcionario_id: string;
  nome: string;
  funcao: string | null;
  centro_custo: string | null;
  centro_custo_id: string | null;
  foto_signed_url: string | null;
  descriptor: Float32Array | null;
}

const TIPOS: { value: TipoBatida; label: string; icon: string }[] = [
  { value: "entrada", label: "Entrada", icon: "🟢" },
  { value: "intervalo_inicio", label: "Início Int.", icon: "🟡" },
  { value: "intervalo_fim", label: "Fim Int.", icon: "🔵" },
  { value: "saida", label: "Saída", icon: "🔴" },
];

// AJUSTE TEMPORÁRIO DE CALIBRAÇÃO — revisar com logs reais.
// Centraliza thresholds locais do gate de match. NÃO espalhar valores no código.
const CALIBRACAO_MATCH = {
  DIST_LOCAL_GATE: 0.42, // antes 0.35
  CONFIANCA_MIN: 0.88,   // antes 0.92
} as const;

const TICK_MS = 600;
const THRESHOLD = 0.40; // distância máxima aceita pelo edge equivalente
const DIST_LOCAL_GATE = CALIBRACAO_MATCH.DIST_LOCAL_GATE;
const CONFIANCA_MIN = CALIBRACAO_MATCH.CONFIANCA_MIN;
const REQUIRED_MATCH_FRAMES = 3;
const MAX_TENTATIVAS = 3;
// GPS — limite de precisão para mobile
const GPS_PRECISAO_MAX_MOBILE = 50; // metros

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

function getDeviceFingerprint(): string {
  const nav = navigator;
  const parts = [
    nav.userAgent,
    nav.language,
    screen.width + "x" + screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ];
  let hash = 0;
  const str = parts.join("|");
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + c;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function parseDescriptor(raw: string | null | undefined): Float32Array | null {
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw.replace(/^\[/, "[").replace(/\]$/, "]")) as number[];
    if (!Array.isArray(arr) || arr.length !== 128) return null;
    return Float32Array.from(arr);
  } catch {
    return null;
  }
}

function distEuclid(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

function haversineMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function PontoDireto() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("carregando");
  const [perfil, setPerfil] = useState<PerfilFuncionario | null>(null);
  const [batidasDia, setBatidasDia] = useState<BatidaDia[]>([]);
  const [dataOperacional, setDataOperacional] = useState<string | null>(null);
  const [agora, setAgora] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [tentativasSemMatch, setTentativasSemMatch] = useState(0);
  const [tipoBatida, setTipoBatida] = useState<TipoBatida>("entrada");
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // GPS
  const [gps, setGps] = useState<GPSData | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsBloqueado, setGpsBloqueado] = useState(false);
  const [gpsPermissao, setGpsPermissao] = useState<"granted" | "prompt" | "denied" | "unknown">("unknown");
  const [gpsCapturando, setGpsCapturando] = useState(false);
  const [gpsTentativaAtual, setGpsTentativaAtual] = useState(0);
  const [modeloErro, setModeloErro] = useState<string | null>(null);
  const [biometria, setBiometria] = useState<BiometriaEstado>(BIOMETRIA_INICIAL);
  // CC detectado por GPS (apenas auditoria visual; NUNCA usado para decisão)
  const [cc, setCC] = useState<CCDetectado>({ id: null, nome: null, distancia: null });
  // CC esperado = vínculo formal do funcionário (decisão de geofence)
  const [ccEsperado, setCCEsperado] = useState<CCEsperado | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const tickRef = useRef<number | null>(null);
  const inflightRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);
  const statusRef = useRef<Status>("carregando");
  // Buffer multi-frame para anti falso-positivo (Fase 4)
  const matchBufferRef = useRef<Array<{ dist: number; confianca: number; ts: number }>>([]);
  const { validarRostoSeguro, resetBiometriaSegura } = useBiometriaSegura();
  useEffect(() => { statusRef.current = status; }, [status]);

  // Relógio + online/offline
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

  // Boot: data operacional, perfil, descriptor, modelos
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ data: dataOp }, { data: { user } }] = await Promise.all([
          supabase.rpc("get_data_operacional_atual"),
          supabase.auth.getUser(),
        ]);
        if (cancelled) return;
        if (!dataOp) {
          toast.error("Falha ao obter data do servidor");
          return;
        }
        setDataOperacional(dataOp as unknown as string);

        if (!user) { navigate("/login"); return; }

        const { data: profile } = await supabase
          .from("profiles")
          .select("funcionario_id")
          .eq("id", user.id)
          .single();

        if (!profile?.funcionario_id) {
          toast.error("Usuário sem vínculo de funcionário");
          navigate("/");
          return;
        }

        const { data: func } = await supabase
          .from("bd_funcionarios")
          .select("id, nome_completo, funcao_id, centro_custo_id")
          .eq("id", profile.funcionario_id)
          .single();

        // funcao + cc completo (lat/lon/raio) + vínculo operacional ativo
        const [{ data: funcao }, { data: ccRow }, { data: vinculo }] = await Promise.all([
          func?.funcao_id
            ? supabase.from("bd_funcoes").select("nome_funcao").eq("id", func.funcao_id).single()
            : Promise.resolve({ data: null } as any),
          func?.centro_custo_id
            ? supabase
                .from("bd_centros_custo")
                .select("id, nome_centro_custo, latitude, longitude, raio_ponto_metros")
                .eq("id", func.centro_custo_id)
                .single()
            : Promise.resolve({ data: null } as any),
          supabase
            .from("bd_ponto_vinculos_operacionais")
            .select("centro_custo_id")
            .eq("funcionario_id", profile.funcionario_id)
            .eq("ativo", true)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        // Resolver CC esperado: vínculo operacional ativo > CC formal do funcionário
        let ccEsperadoLocal: CCEsperado | null = null;
        const vinculoCCId = (vinculo as any)?.centro_custo_id || null;
        if (vinculoCCId && vinculoCCId !== func?.centro_custo_id) {
          const { data: ccVinc } = await supabase
            .from("bd_centros_custo")
            .select("id, nome_centro_custo, latitude, longitude, raio_ponto_metros")
            .eq("id", vinculoCCId)
            .single();
          if (ccVinc) {
            ccEsperadoLocal = {
              id: ccVinc.id,
              nome: ccVinc.nome_centro_custo,
              latitude: (ccVinc as any).latitude ?? null,
              longitude: (ccVinc as any).longitude ?? null,
              raio_metros: ((ccVinc as any).raio_ponto_metros as number | null) ?? 200,
              origem: "vinculo_operacional",
            };
          }
        } else if (ccRow) {
          ccEsperadoLocal = {
            id: (ccRow as any).id,
            nome: (ccRow as any).nome_centro_custo,
            latitude: (ccRow as any).latitude ?? null,
            longitude: (ccRow as any).longitude ?? null,
            raio_metros: ((ccRow as any).raio_ponto_metros as number | null) ?? 200,
            origem: "cc_funcionario",
          };
        }

        // Biometria ativa+aprovada mais recente
        const { data: bios } = await supabase
          .from("bd_funcionarios_biometria_facial" as any)
          .select("descriptor, foto_url, created_at, ativo, status_validacao")
          .eq("funcionario_id", profile.funcionario_id)
          .eq("ativo", true)
          .eq("status_validacao", "aprovado")
          .order("created_at", { ascending: false })
          .limit(1);

        const bio = bios?.[0] as any;
        let signedUrl: string | null = null;
        if (bio?.foto_url) {
          const { data: s } = await supabase.storage
            .from("biometria-facial")
            .createSignedUrl(bio.foto_url, 300);
          signedUrl = s?.signedUrl || null;
        }

        const descriptor = parseDescriptor(bio?.descriptor);

        if (cancelled) return;
        setCCEsperado(ccEsperadoLocal);
        setPerfil({
          funcionario_id: profile.funcionario_id,
          nome: func?.nome_completo || "Funcionário",
          funcao: funcao?.nome_funcao || null,
          centro_custo: ccEsperadoLocal?.nome || (ccRow as any)?.nome_centro_custo || null,
          centro_custo_id: ccEsperadoLocal?.id || func?.centro_custo_id || null,
          foto_signed_url: signedUrl,
          descriptor,
        });

        // Carrega modelos para reconhecimento (com retry interno no loader)
        try {
          await loadFaceApiModels();
          setModeloErro(null);
          setBiometria((b) => ({ ...b, modeloCarregado: true, motivoBloqueio: "Aguardando rosto" }));
        } catch (modelErr) {
          pontoLog("FACEAPI", "ERRO", "error", { message: (modelErr as Error)?.message });
          if (cancelled) return;
          setModeloErro("Falha ao carregar reconhecimento facial");
          setBiometria((b) => ({ ...b, modeloCarregado: false, motivoBloqueio: "Reconhecimento facial indisponível" }));
          setStatus("falha");
          return;
        }
        if (cancelled) return;

        if (!descriptor) {
          setStatus("sem_biometria");
        } else {
          setStatus("escaneando");
        }
      } catch (e) {
        console.error("[PontoDireto][BOOT]", e);
        if (!cancelled) {
          toast.error("Falha ao iniciar reconhecimento");
          setStatus("falha");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  // Câmera
  useEffect(() => {
    if (status === "carregando") return;
    let cancelled = false;
    const onFrameReady = () => {
      const v = videoRef.current;
      if (v && v.videoWidth > 0 && v.videoHeight > 0) {
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
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          v.addEventListener("loadeddata", onFrameReady);
          v.addEventListener("playing", onFrameReady);
          await v.play().catch(() => undefined);
          if (v.videoWidth > 0) onFrameReady();
        }
      } catch (e: any) {
        console.error("[PontoDireto][CAMERA]", e);
        setCameraReady(false);
        setCameraError(e?.name === "NotAllowedError" ? "Permissão de câmera negada" : "Câmera indisponível");
      }
    })();
    return () => {
      cancelled = true;
      const v = videoRef.current;
      if (v) {
        v.removeEventListener("loadeddata", onFrameReady);
        v.removeEventListener("playing", onFrameReady);
      }
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [status]);

  // Inicia watchPosition (chamado após permissão concedida)
  const iniciarWatchGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste dispositivo");
      setGpsBloqueado(true);
      console.warn("[BIOMETRIA][GPS_BLOQUEADO]", { motivo: "geolocation_indisponivel" });
      return;
    }
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy),
        });
        setGpsError(null);
        setGpsBloqueado(false);
        setGpsPermissao("granted");
      },
      (err) => {
        const msgsBloqueantes: Record<number, string> = {
          1: "Permissão de localização negada",
          2: "Localização indisponível",
          3: "Tempo esgotado para obter localização",
        };
        const motivo = msgsBloqueantes[err.code] || err.message;
        setGpsError(motivo);
        setGpsBloqueado(true);
        if (err.code === 1) setGpsPermissao("denied");
        console.warn("[BIOMETRIA][GPS_BLOQUEADO]", { code: err.code, message: err.message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
  }, []);

  // Captura única (com retry) — usada no clique do usuário
  const ativarLocalizacao = useCallback(async (maxTentativas = 3) => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste dispositivo");
      setGpsBloqueado(true);
      return;
    }
    setGpsCapturando(true);
    setGpsError(null);
    for (let i = 1; i <= maxTentativas; i += 1) {
      setGpsTentativaAtual(i);
      const ok = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setGps({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              precisao: Math.round(pos.coords.accuracy),
            });
            setGpsBloqueado(false);
            setGpsPermissao("granted");
            setGpsError(null);
            resolve(true);
          },
          (err) => {
            if (err.code === 1) setGpsPermissao("denied");
            console.warn("[BIOMETRIA][GPS_BLOQUEADO]", { tentativa: i, code: err.code, message: err.message });
            resolve(false);
          },
          { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
        );
      });
      if (ok) {
        setGpsCapturando(false);
        setGpsTentativaAtual(0);
        iniciarWatchGPS();
        return true;
      }
      if (i < maxTentativas) await new Promise((r) => setTimeout(r, 600));
    }
    setGpsCapturando(false);
    setGpsTentativaAtual(0);
    setGpsBloqueado(true);
    setGpsError("Não foi possível obter sua localização");
    return false;
  }, [iniciarWatchGPS]);

  // Boot do GPS: checa permissão antes de iniciar watch
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste dispositivo");
      setGpsBloqueado(true);
      setGpsPermissao("denied");
      return;
    }
    const setup = async () => {
      try {
        const perms = (navigator as any).permissions;
        if (perms?.query) {
          const res = await perms.query({ name: "geolocation" as PermissionName });
          setGpsPermissao(res.state as any);
          if (res.state === "granted") {
            iniciarWatchGPS();
          } else {
            // exige gesto do usuário — não dispara watch automaticamente
            setGpsBloqueado(true);
          }
        } else {
          // navegadores sem Permissions API — tenta watch direto
          iniciarWatchGPS();
        }
      } catch {
        iniciarWatchGPS();
      }
    };
    setup();
    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, [iniciarWatchGPS]);

  // CC detectado por GPS — APENAS auditoria visual / log (não decide permissão)
  useEffect(() => {
    if (!gps) return;
    detectarCentroCustoPorGPS(gps.latitude, gps.longitude).then((r) => {
      setCC({ id: r.centro_custo_id, nome: r.nome, distancia: r.distancia_metros });
    });
  }, [gps]);

  // Carrega batidas do dia
  const carregarBatidas = useCallback(async () => {
    if (!perfil?.funcionario_id || !dataOperacional) return;
    const { data } = await supabase
      .from("bd_ponto_batidas")
      .select("tipo_batida, data_hora_considerada, status_validacao, data_operacional")
      .eq("funcionario_id", perfil.funcionario_id)
      .eq("data_operacional", dataOperacional)
      .neq("status_validacao", "invalidada")
      .order("data_hora_considerada", { ascending: true });
    setBatidasDia((data as BatidaDia[]) || []);
  }, [perfil?.funcionario_id, dataOperacional]);

  useEffect(() => { carregarBatidas(); }, [carregarBatidas]);

  const estado = useMemo(() => getEstadoJornada(batidasDia, dataOperacional), [batidasDia, dataOperacional]);

  // Sugestão automática do tipo de batida quando entra em "reconhecido"
  useEffect(() => {
    if (status !== "reconhecido") return;
    if (estado.podeEntrada) setTipoBatida("entrada");
    else if (estado.podeIntervaloInicio) setTipoBatida("intervalo_inicio");
    else if (estado.podeIntervaloFim) setTipoBatida("intervalo_fim");
    else if (estado.podeSaida) setTipoBatida("saida");
  }, [status, estado.podeEntrada, estado.podeIntervaloInicio, estado.podeIntervaloFim, estado.podeSaida]);

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

  // Loop de reconhecimento facial (1×1)
  useEffect(() => {
    if (status !== "escaneando" || !cameraReady || !perfil?.descriptor) return;

    const tick = async () => {
      if (statusRef.current !== "escaneando" || inflightRef.current) return;
      const v = videoRef.current;
      if (!v || v.videoWidth === 0) return;
      inflightRef.current = true;
      try {
        const resultado = await validarRostoSeguro(v, "mobile");
        if (statusRef.current !== "escaneando") return;
        if (!resultado.valido || !resultado.descriptor) {
          setErrMsg(resultado.motivo || null);
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
          if (resultado.motivo === "Possível uso de imagem/foto") {
            setTentativasSemMatch((x) => x + 1);
          }
          return;
        }

        const dist = distEuclid(resultado.descriptor, perfil.descriptor!);
        const confianca = Math.min(0.999, Math.max(0, 1 - dist / THRESHOLD));
        pontoLog("BIOMETRIA", "MATCH", "info", {
          confianca: Number(confianca.toFixed(3)),
          funcionario_id: perfil.funcionario_id,
          dist: Number(dist.toFixed(3)),
        });

        // MATCH_DEBUG estruturado — visibilidade completa para calibração
        pontoLog("BIOMETRIA", "MATCH_DEBUG", "info", {
          top1Distance: dist,
          top2Distance: null, // PontoDireto compara contra perfil único
          margem: null,
          confidence: confianca,
          decisaoBackend: "local_compare",
          reasonBackend: null,
          funcionario_id: perfil.funcionario_id,
          thresholds_local: {
            dist: CALIBRACAO_MATCH.DIST_LOCAL_GATE,
            conf: CALIBRACAO_MATCH.CONFIANCA_MIN,
          },
        });

        // GATE ÚNICO E AND ESTRITO (calibrado via CALIBRACAO_MATCH)
        const matchOk =
          Number.isFinite(dist) &&
          dist < DIST_LOCAL_GATE &&
          confianca >= CONFIANCA_MIN;
        if (!matchOk) {
          matchBufferRef.current = [];
          setErrMsg("Rosto detectado, mas não reconhecido");
          setBiometria((b) => ({ ...b, rostoDetectado: true, qualidadeOk: true, rostoValido: true, livenessOk: true, matchValido: false, framesValidos: 0, motivoBloqueio: "Rosto detectado, mas não reconhecido" }));
          setTentativasSemMatch((x) => x + 1);
          pontoLog("BIOMETRIA", "MATCH_INVALIDO", "warn", { dist, confianca });
          return;
        }

        const now = Date.now();
        matchBufferRef.current.push({ dist, confianca, ts: now });
        matchBufferRef.current = matchBufferRef.current.filter((x) => now - x.ts <= 4000);

        const framesConfirmados = matchBufferRef.current.length;
        if (framesConfirmados < REQUIRED_MATCH_FRAMES) {
          setErrMsg("Confirmando identidade...");
          setBiometria((b) => ({ ...b, rostoDetectado: true, qualidadeOk: true, rostoValido: true, livenessOk: true, matchValido: false, framesValidos: framesConfirmados, motivoBloqueio: "Confirmando identidade..." }));
          return;
        }

        pontoLog("BIOMETRIA", "CONFIRMACAO", "info", { aprovado: true, framesConfirmados });
        setErrMsg(null);
        setTentativasSemMatch(0);
        setBiometria((b) => ({ ...b, rostoDetectado: true, qualidadeOk: true, rostoValido: true, livenessOk: true, matchValido: true, framesValidos: framesConfirmados, motivoBloqueio: null }));
        matchBufferRef.current = [];
        setStatus("reconhecido");
      } catch (e) {
        console.error("[PontoDireto][TICK]", e);
      } finally {
        inflightRef.current = false;
      }
    };

    tickRef.current = window.setInterval(tick, TICK_MS);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
      tickRef.current = null;
    };
  }, [status, cameraReady, perfil?.descriptor, validarRostoSeguro]);

  // Reset para scanner
  const reset = useCallback(() => {
    resetBiometriaSegura();
    matchBufferRef.current = [];
    setTentativasSemMatch(0);
    setErrMsg(null);
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

  // Distância do GPS atual até o CC ESPERADO do funcionário (não o mais próximo)
  const distanciaCCEsperado = useMemo<number | null>(() => {
    if (!gps || !ccEsperado || ccEsperado.latitude == null || ccEsperado.longitude == null) return null;
    return Math.round(haversineMetros(gps.latitude, gps.longitude, ccEsperado.latitude, ccEsperado.longitude));
  }, [gps, ccEsperado]);

  const dentroRaio = useMemo<boolean | null>(() => {
    if (distanciaCCEsperado == null || !ccEsperado) return null;
    return distanciaCCEsperado <= ccEsperado.raio_metros;
  }, [distanciaCCEsperado, ccEsperado]);

  // Confirmação e registro de ponto
  const confirmarBatida = useCallback(async (tipo: TipoBatida) => {
    if (!perfil) return;

    // BLOQUEIO ABSOLUTO PRÉ-EDGE
    const faceValida = statusRef.current === "reconhecido" && !!perfil.descriptor;
    if (!faceValida) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "face_invalida", status: statusRef.current });
      const msg = "Validação biométrica incompleta — não é possível registrar";
      setErrMsg(msg); toast.error(msg); return;
    }
    if (modeloErro) {
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "modelo_nao_carregado" });
      toast.error("Reconhecimento facial indisponível"); return;
    }
    // Bloqueio frontend (defesa em camadas — backend valida igual)
    if (gpsBloqueado || !navigator.geolocation) {
      const msg = "Não foi possível obter sua localização. Ative o GPS para registrar o ponto.";
      console.warn("[BIOMETRIA][BLOQUEIO_PRE_EDGE]", { motivo: "gps_bloqueado" });
      setErrMsg(msg); toast.error(msg); return;
    }
    if (!gps) {
      pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "gps_ausente" });
      toast.error("Aguardando localização..."); return;
    }
    // Hard-block por precisão GPS (mobile)
    if (!Number.isFinite(gps.precisao) || gps.precisao > GPS_PRECISAO_MAX_MOBILE) {
      const msg = `GPS impreciso (±${Math.round(gps.precisao)}m, máx ${GPS_PRECISAO_MAX_MOBILE}m). Vá para um local aberto e tente novamente.`;
      pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "gps_impreciso", accuracy: gps.precisao, limite: GPS_PRECISAO_MAX_MOBILE });
      setErrMsg(msg); toast.error(msg); return;
    }
    if (!ccEsperado) {
      const msg = "Funcionário sem centro de custo vinculado. Procure o RH.";
      setErrMsg(msg); toast.error(msg); return;
    }
    if (dentroRaio === false) {
      const msg = "Você está fora do raio permitido do seu centro de custo. Procure o responsável.";
      pontoLog("GPS", "HARD_BLOCK", "error", { motivo: "fora_do_raio", distancia: distanciaCCEsperado });
      setErrMsg(msg); toast.error(msg); return;
    }
    const cooldown = await verificarCooldownBatida(perfil.funcionario_id);
    if (cooldown.bloqueado) {
      const msg = cooldown.minutosRestantes > 1
        ? `Aguarde ${cooldown.minutosRestantes} minutos antes de registrar novo ponto`
        : "Aguarde antes de registrar novo ponto";
      setErrMsg(msg);
      toast.error(msg);
      return;
    }
    const foto = capturarFotoBase64();
    if (!foto) { toast.error("Falha ao capturar foto da câmera"); return; }

    const lastMatch = matchBufferRef.current[matchBufferRef.current.length - 1];
    console.log("[BIOMETRIA][STATUS_FINAL]", {
      estado: status,
      framesConfirmados: matchBufferRef.current.length,
      confianca: lastMatch?.confianca ?? null,
      funcionario_id: perfil?.funcionario_id ?? null,
    });

    setStatus("registrando");
    setErrMsg(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada");
        navigate("/login");
        return;
      }
      const payload = {
        tipo_batida: tipo,
        data_hora_dispositivo: new Date().toISOString(),
        latitude: gps.latitude,
        longitude: gps.longitude,
        precisao_gps_metros: gps.precisao,
        // CC oficial = vínculo formal do funcionário. GPS é apenas referência geográfica/auditoria.
        centro_custo_id: perfil.centro_custo_id ?? null,
        cc_gps_referencia_id: cc.id ?? null,
        foto_base64: foto,
        device_fingerprint: getDeviceFingerprint(),
        user_agent: navigator.userAgent,
        // offline_uuid só é enviado quando realmente offline (via sync-ponto-offline).
        // Enviar aqui faria a edge tratar como sync offline e bloquear.
      };

      const { data, error } = await supabase.functions.invoke("registrar-ponto", { body: payload });
      console.log("[PONTODIRETO][EDGE_RESPONSE]", { data, error });

      let serverPayload: any = data;
      if (error) {
        try {
          const ctx: any = (error as any).context;
          if (ctx && typeof ctx.json === "function") {
            serverPayload = await ctx.json();
            console.log("[PONTODIRETO][EDGE_ERROR_BODY]", serverPayload);
          }
        } catch (parseErr) {
          console.warn("[PONTODIRETO][EDGE_ERROR_PARSE_FAIL]", parseErr);
        }
      }

      if (error || !serverPayload?.success) {
        // Tratamento específico do bloqueio de geofence vindo da edge
        if (serverPayload?.error === "fora_do_raio_mobile") {
          const dist = serverPayload.distancia_metros;
          const raio = serverPayload.raio_permitido;
          const ccNome = serverPayload.centro_custo_nome;
          const detalhe = (dist != null && raio != null)
            ? ` (${dist}m de ${ccNome || "seu CC"}, raio ${raio}m)`
            : "";
          throw new Error(`${serverPayload.message}${detalhe}`);
        }
        const msg =
          serverPayload?.message ||
          serverPayload?.error ||
          (error as any)?.message ||
          "Erro ao registrar ponto";
        const stage = serverPayload?.stage ? ` [${serverPayload.stage}]` : "";
        throw new Error(`${msg}${stage}`);
      }

      const respondeu = serverPayload;
      const tipoLabel = TIPOS.find(t => t.value === tipo)?.label || tipo;
      const statusMsg = respondeu.status_validacao === "pendente_revisao" ? " (pendente revisão)" : "";
      toast.success(`${tipoLabel} registrada${statusMsg}`);
      if (respondeu.alertas?.length) {
        respondeu.alertas.forEach((a: any) => toast.warning(a.mensagem, { duration: 5000 }));
      }
      if (respondeu.data_operacional) setDataOperacional(respondeu.data_operacional);

      setStatus("sucesso");
      window.setTimeout(() => {
        carregarBatidas();
        reset();
      }, 4000);
    } catch (e: any) {
      console.error("[PontoDireto][REGISTRO]", e);
      const msg = e?.message || "Erro ao registrar ponto";
      setErrMsg(msg);
      toast.error(msg);
      setStatus("falha");
    }
  }, [perfil, gps, gpsBloqueado, ccEsperado, dentroRaio, distanciaCCEsperado, cc.id, modeloErro, capturarFotoBase64, navigate, carregarBatidas, reset, status]);

  // Retry do modelo de reconhecimento
  const tentarRecarregarModelo = useCallback(async () => {
    setModeloErro(null);
    setStatus("carregando");
    resetFaceApiLoader();
    try {
      await loadFaceApiModels();
      setStatus(perfil?.descriptor ? "escaneando" : "sem_biometria");
    } catch (e) {
      console.error("[BIOMETRIA][ERRO_MODELO]", e);
      setModeloErro("Falha ao carregar reconhecimento facial");
      setStatus("falha");
    }
  }, [perfil?.descriptor]);

  // Auto-enrolamento removido — biometria só é cadastrada pelo RH no painel administrativo.

  const handleLogout = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    await supabase.auth.signOut();
    navigate("/login");
  };

  // ── RENDER ───────────────────────────────────────────────────────────
  const iniciais = useMemo(() => {
    if (!perfil?.nome) return "??";
    return perfil.nome.split(" ").filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() || "").join("");
  }, [perfil]);

  const statusJornadaTxt = (() => {
    if (!estado.temEntrada) return { txt: "Aguardando entrada", cor: "text-slate-300" };
    if (estado.temSaida) return { txt: "Jornada encerrada", cor: "text-emerald-300" };
    if (estado.intervaloAberto) return { txt: "Em intervalo", cor: "text-amber-300" };
    return { txt: "Em jornada", cor: "text-cyan-300" };
  })();

  const gpsBadge = (() => {
    if (gpsError || !gps) return { cls: "border-red-500/40 text-red-300", icon: <MapPinOff className="h-3 w-3" />, txt: "Sem GPS" };
    if (gps.precisao <= 30) return { cls: "border-emerald-500/40 text-emerald-300", icon: <MapPin className="h-3 w-3" />, txt: `GPS ${gps.precisao}m` };
    if (gps.precisao <= 80) return { cls: "border-amber-500/40 text-amber-300", icon: <MapPin className="h-3 w-3" />, txt: `GPS ${gps.precisao}m` };
    if (gps.precisao <= 150) return { cls: "border-orange-500/40 text-orange-300", icon: <MapPin className="h-3 w-3" />, txt: `GPS ${gps.precisao}m` };
    return { cls: "border-red-500/40 text-red-300", icon: <MapPin className="h-3 w-3" />, txt: `GPS ${gps.precisao}m` };
  })();

  // GPS válido = lat/lon finitos + accuracy ≤ limite (mobile) + dentro do raio
  const gpsValido = useMemo<boolean>(() => (
    !!gps &&
    Number.isFinite(gps.latitude) &&
    Number.isFinite(gps.longitude) &&
    Number.isFinite(gps.precisao) &&
    gps.precisao <= GPS_PRECISAO_MAX_MOBILE
  ), [gps]);

  // Razão de bloqueio do botão Confirmar (string null = pode confirmar)
  const motivoBloqueio = useMemo<string | null>(() => {
    if (gpsBloqueado) {
      return "Não foi possível obter sua localização. Ative o GPS para registrar o ponto.";
    }
    if (!gps) {
      return "Aguardando localização...";
    }
    if (gps.precisao > GPS_PRECISAO_MAX_MOBILE) {
      return `GPS impreciso (±${gps.precisao}m, máx ${GPS_PRECISAO_MAX_MOBILE}m). Vá para um local aberto.`;
    }
    if (!ccEsperado) {
      return "Funcionário sem centro de custo vinculado. Procure o RH.";
    }
    if (ccEsperado.latitude == null || ccEsperado.longitude == null) {
      return `O centro de custo (${ccEsperado.nome}) não possui coordenadas cadastradas. Procure o RH.`;
    }
    if (dentroRaio === false) {
      return "Você está fora do raio permitido do seu centro de custo. Procure o responsável.";
    }
    return null;
  }, [gpsBloqueado, gps, ccEsperado, dentroRaio]);

  // Gate final único — botão Confirmar só habilita se TODOS forem verdadeiros
  const podeConfirmar = useMemo<boolean>(() => (
    biometria.modeloCarregado &&
    biometria.rostoDetectado &&
    biometria.rostoValido &&
    biometria.livenessOk &&
    biometria.matchValido &&
    biometria.framesValidos >= REQUIRED_MATCH_FRAMES &&
    gpsValido &&
    dentroRaio === true &&
    !modeloErro &&
    !cameraError &&
    status === "reconhecido"
  ), [biometria, gpsValido, dentroRaio, modeloErro, cameraError, status]);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-slate-100 flex flex-col relative">
      {/* OVERLAY DE BLOQUEIO CRÍTICO — modelo */}
      {modeloErro && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6">
          <div className="max-w-md w-full rounded-3xl border-2 border-rose-500/60 bg-slate-900 p-8 text-center shadow-[0_0_60px_rgba(244,63,94,0.35)]">
            <AlertTriangle className="h-12 w-12 text-rose-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-rose-100">Reconhecimento facial indisponível</h2>
            <p className="text-sm text-slate-300 mt-3">{modeloErro}. Verifique sua conexão e tente novamente.</p>
            <button
              onClick={tentarRecarregarModelo}
              className="mt-6 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm"
            >
              <RotateCcw className="h-4 w-4 inline mr-1" />
              Tentar novamente
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY — exigir gesto do usuário para GPS */}
      {!modeloErro && (gpsPermissao === "prompt" || gpsPermissao === "denied" || (gpsBloqueado && !gps)) && (
        <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-sm p-6">
          <div className="max-w-md w-full rounded-3xl border-2 border-amber-500/50 bg-slate-900 p-8 text-center shadow-[0_0_60px_rgba(245,158,11,0.3)]">
            <MapPinOff className="h-12 w-12 text-amber-300 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-amber-100">Localização necessária</h2>
            <p className="text-sm text-slate-300 mt-3">
              {gpsPermissao === "denied"
                ? "Permissão de localização negada. Habilite o GPS nas configurações do navegador para registrar o ponto."
                : "Ative o GPS do seu dispositivo. O registro de ponto exige sua localização atual."}
            </p>
            <button
              onClick={() => ativarLocalizacao(3)}
              disabled={gpsCapturando}
              className="mt-6 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm disabled:opacity-60"
            >
              {gpsCapturando ? (
                <>
                  <Loader2 className="h-4 w-4 inline mr-1 animate-spin" />
                  Obtendo localização... ({gpsTentativaAtual}/3)
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 inline mr-1" />
                  Ativar localização
                </>
              )}
            </button>
            {gpsError && <p className="text-xs text-rose-300 mt-3">{gpsError}</p>}
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-cyan-500/20 bg-slate-900/60 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => navigate("/dashboard", { replace: true })}
            aria-label="Voltar ao sistema LYTOTEC"
            title="Voltar ao sistema"
            className="flex items-center gap-2 min-w-0 rounded hover:opacity-80 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          >
            <img src="/icons/dcf6c980-f927-4180-b109-b425da1323ba.png" alt="Lytorânea" className="h-9 w-9 object-contain" />
            <div className="min-w-0 text-left">
              <p className="text-xs text-slate-400 leading-none">Ponto Eletrônico</p>
              <p className="text-sm font-mono text-cyan-300 tabular-nums">
                {agora.toLocaleTimeString("pt-BR")}
              </p>
            </div>
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded border",
            online ? "border-emerald-500/40 text-emerald-300" : "border-amber-500/40 text-amber-300")}>
            {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          </div>
          <div className={cn("flex items-center gap-1 text-xs px-2 py-1 rounded border", gpsBadge.cls)}>
            {gpsBadge.icon}
            <span className="hidden sm:inline">{gpsBadge.txt}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 text-xs"
          >
            <LogOut className="h-3 w-3" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 max-w-md mx-auto w-full flex flex-col gap-4">
        {/* STATUS CARREGANDO */}
        {status === "carregando" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-cyan-200">
            <Loader2 className="h-10 w-10 animate-spin" />
            <p className="text-sm">Inicializando reconhecimento...</p>
          </div>
        )}

        {/* SEM BIOMETRIA */}
        {status === "sem_biometria" && (
          <div className="flex-1 flex flex-col gap-4 animate-fade-in">
            <div className="rounded-3xl border-2 border-dashed border-amber-500/40 bg-slate-900/60 p-6 text-center">
              <ScanFace className="h-16 w-16 mx-auto text-amber-300 opacity-70" />
              <h2 className="text-xl font-bold mt-3">Biometria não cadastrada</h2>
              <p className="text-sm text-slate-400 mt-2">
                Sua biometria facial ainda não foi cadastrada. Procure o RH para realizar o
                cadastro biométrico no painel administrativo.
              </p>
              <p className="text-xs text-slate-500 mt-4">
                Após o cadastro pelo RH, você poderá registrar ponto pelo celular normalmente.
              </p>
            </div>
          </div>
        )}

        {/* SCANNER */}
        {(status === "escaneando" || status === "reconhecido" || status === "registrando" || status === "sucesso" || status === "falha") && (
          <CameraView
            videoRef={videoRef}
            cameraReady={cameraReady}
            cameraError={cameraError}
            estado={status}
            overlayLabel={
              status === "escaneando"
                  ? (errMsg === "Confirmando identidade..." ? "Confirmando identidade..." : "Procurando rosto...")
                : status === "reconhecido" ? "Identificação confirmada"
                : status === "registrando" ? "Registrando..."
                : status === "sucesso" ? "Registrado ✓"
                : "Falha"
            }
          />
        )}

        {/* CONFIRMAÇÃO + AÇÕES */}
        {(status === "reconhecido" || status === "registrando") && perfil && (
          <div className="rounded-3xl border-2 border-emerald-400/60 bg-slate-900/80 p-5 animate-scale-in shadow-[0_0_40px_rgba(16,185,129,0.2)]">
            <div className="flex items-center gap-3">
              {perfil.foto_signed_url ? (
                <img
                  src={perfil.foto_signed_url}
                  alt={perfil.nome}
                  className="h-16 w-16 rounded-full object-cover ring-2 ring-emerald-400/60"
                />
              ) : (
                <Avatar className="h-16 w-16 ring-2 ring-emerald-400/60">
                  <AvatarFallback className="bg-slate-800 text-emerald-300 text-lg font-bold">
                    {iniciais}
                  </AvatarFallback>
                </Avatar>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-bold text-white truncate">{perfil.nome}</h2>
                <p className="text-xs text-slate-400 truncate">
                  {perfil.funcao || "Sem função"}{perfil.centro_custo ? ` • ${perfil.centro_custo}` : ""}
                </p>
                <p className={cn("text-xs font-semibold mt-0.5", statusJornadaTxt.cor)}>
                  {statusJornadaTxt.txt}
                </p>
              </div>
            </div>

            {/* CC oficial (decisão) — destacado */}
            {ccEsperado && (
              <div className="mt-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3">
                <p className="text-[10px] uppercase tracking-wide text-emerald-300/80 font-semibold">
                  Centro de Custo (oficial)
                </p>
                <p className="text-sm font-semibold text-emerald-100 mt-0.5 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {ccEsperado.nome}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-[11px] text-emerald-200/80">
                  <span>
                    {ccEsperado.origem === "vinculo_operacional" ? "Vínculo operacional" : "Cadastro do funcionário"}
                  </span>
                  {distanciaCCEsperado != null && (
                    <span>• {distanciaCCEsperado}m / raio {ccEsperado.raio_metros}m</span>
                  )}
                  {dentroRaio === true && (
                    <Badge className="bg-emerald-600 text-white text-[10px] py-0 px-1.5">Dentro do raio</Badge>
                  )}
                  {dentroRaio === false && (
                    <Badge className="bg-rose-600 text-white text-[10px] py-0 px-1.5">Fora do raio</Badge>
                  )}
                </div>
              </div>
            )}

            {/* Auditoria GPS + status */}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {cc.nome && cc.id !== ccEsperado?.id && (
                <Badge
                  variant="secondary"
                  className="text-[10px] font-normal text-muted-foreground"
                  title="Centro de custo mais próximo via GPS — apenas auditoria, não influencia o registro."
                >
                  Ref. GPS: {cc.nome}{cc.distancia != null ? ` • ${cc.distancia}m` : ""}
                </Badge>
              )}
              {!gps && !gpsBloqueado && (
                <Badge variant="outline" className="border-amber-500/40 text-amber-300">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Aguardando GPS
                </Badge>
              )}
            </div>

            {/* Banner de bloqueio */}
            {motivoBloqueio && (
              <div className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-100 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5 text-rose-300" />
                <span>{motivoBloqueio}</span>
              </div>
            )}

            {/* Tipo de batida — sugestão pré-selecionada */}
            <div className="grid grid-cols-2 gap-2 mt-4">
              {TIPOS.map((t) => {
                const habilitado = (
                  (t.value === "entrada" && estado.podeEntrada) ||
                  (t.value === "intervalo_inicio" && estado.podeIntervaloInicio) ||
                  (t.value === "intervalo_fim" && estado.podeIntervaloFim) ||
                  (t.value === "saida" && estado.podeSaida)
                );
                const sugerido = tipoBatida === t.value && habilitado;
                return (
                  <button
                    key={t.value}
                    disabled={!habilitado || status === "registrando"}
                    onClick={() => setTipoBatida(t.value)}
                    className={cn(
                      "h-14 rounded-2xl border text-sm font-semibold transition-all",
                      sugerido
                        ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)] ring-2 ring-cyan-300 animate-pulse"
                        : habilitado
                          ? "bg-slate-950 text-slate-200 border-slate-700 hover:border-cyan-500/40"
                          : "bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed",
                    )}
                  >
                    <span className="mr-1">{t.icon}</span>{t.label}
                  </button>
                );
              })}
            </div>

            {/* Confirmar / Não sou eu */}
            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => confirmarBatida(tipoBatida)}
                disabled={!podeConfirmar || status === "registrando"}
                className="h-16 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-lg flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === "registrando" ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="h-6 w-6" />
                    Confirmar
                  </>
                )}
              </button>
              <button
                onClick={reset}
                disabled={status === "registrando"}
                className="h-16 rounded-2xl bg-rose-500/90 hover:bg-rose-500 text-white font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <X className="h-6 w-6" />
                Não sou eu
              </button>
            </div>
          </div>
        )}

        {/* SUCESSO */}
        {status === "sucesso" && (
          <div className="rounded-3xl border-2 border-emerald-400/60 bg-emerald-500/10 p-6 text-center animate-scale-in">
            <CheckCircle2 className="h-16 w-16 mx-auto text-emerald-400" />
            <p className="text-lg font-bold text-emerald-200 mt-2">Ponto registrado!</p>
            <p className="text-3xl font-mono text-white tabular-nums mt-1">
              {agora.toLocaleTimeString("pt-BR")}
            </p>
          </div>
        )}

        {/* FALHA */}
        {status === "falha" && (
          <div className="rounded-3xl border-2 border-rose-500/60 bg-rose-500/10 p-5 text-center animate-fade-in space-y-3">
            <AlertTriangle className="h-12 w-12 mx-auto text-rose-300" />
            <p className="text-base font-semibold text-rose-100">{errMsg || "Falha ao registrar ponto"}</p>
            <button
              onClick={() => setStatus("reconhecido")}
              className="h-12 px-5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold inline-flex items-center gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Tentar novamente
            </button>
          </div>
        )}

        {/* Banner de falhas de identificação */}
        {status === "escaneando" && tentativasSemMatch >= MAX_TENTATIVAS && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-center animate-fade-in">
            <p className="text-sm text-amber-200 font-medium">
              Não consigo te identificar ({tentativasSemMatch} tentativas)
            </p>
            <p className="text-xs text-amber-300/80 mt-2">
              Verifique a iluminação e tente novamente. Se persistir, procure o RH para revalidar
              sua biometria facial.
            </p>
            <div className="flex gap-2 mt-3 justify-center">
              <button
                onClick={() => setTentativasSemMatch(0)}
                className="h-10 px-4 rounded-xl border border-amber-500/40 text-amber-200 hover:bg-amber-500/10 text-sm inline-flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                Tentar novamente
              </button>
            </div>
          </div>
        )}

        {/* Batidas do dia */}
        {batidasDia.length > 0 && status !== "sem_biometria" && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3">
            <p className="text-xs font-medium text-slate-400 mb-2">Registros de hoje</p>
            <div className="space-y-1">
              {batidasDia.map((b, i) => {
                const t = TIPOS.find(x => x.value === b.tipo_batida);
                const hora = new Date(b.data_hora_considerada).toLocaleTimeString("pt-BR", {
                  timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <div key={i} className="flex items-center gap-2 text-sm text-slate-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                    <span>{t?.icon} {t?.label || b.tipo_batida}</span>
                    <span className="text-slate-500 ml-auto tabular-nums">{hora}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Subcomponente: vídeo + overlay ───
function CameraView({
  videoRef, cameraReady, cameraError, estado, overlayLabel,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  cameraReady: boolean;
  cameraError: string | null;
  estado: Status;
  overlayLabel: string;
}) {
  const reconhecido = estado === "reconhecido" || estado === "registrando" || estado === "sucesso";
  return (
    <div className={cn(
      "relative aspect-square w-full rounded-3xl overflow-hidden bg-slate-900 border-2",
      reconhecido
        ? "border-emerald-400/70 shadow-[0_0_60px_rgba(16,185,129,0.35)]"
        : estado === "falha"
          ? "border-rose-500/60"
          : "border-cyan-400/60 shadow-[0_0_60px_rgba(34,211,238,0.25)]",
    )}>
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
      />
      {!cameraReady && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 gap-3 bg-slate-900">
          <Camera className="h-12 w-12 opacity-40" />
          <p className="text-sm">{cameraError || "Iniciando câmera..."}</p>
        </div>
      )}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative w-[70%] aspect-square">
          <div className={cn(
            "absolute inset-0 rounded-full border-2",
            reconhecido
              ? "border-emerald-300/80 shadow-[0_0_30px_rgba(16,185,129,0.5)]"
              : "border-cyan-300/70 shadow-[0_0_30px_rgba(34,211,238,0.5)] animate-pulse",
          )} />
          {estado === "escaneando" && (
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-cyan-300 to-transparent shadow-[0_0_15px_rgba(34,211,238,0.9)] animate-[scan_2.4s_ease-in-out_infinite]" />
          )}
        </div>
      </div>
      <div className="absolute bottom-3 inset-x-0 text-center px-4">
        <p className={cn(
          "text-base font-semibold drop-shadow",
          reconhecido ? "text-emerald-200" : estado === "falha" ? "text-rose-200" : "text-cyan-200",
        )}>
          {overlayLabel}
        </p>
      </div>
      <style>{`
        @keyframes scan {
          0%, 100% { transform: translateY(0); opacity: 0.6; }
          50% { transform: translateY(2400%); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
