// /ponto-dispositivo — Modo Dispositivo de Obra (busca manual + foto + GPS).
// Isolado: NÃO altera /ponto, /ponto-totem, /dev/teste-ponto.
// Reutiliza:
//  - login-dispositivo-totem (sessão device_secret) — sem alteração
//  - RPC buscar_funcionario_dispositivo_obra — sem alteração
//  - Edge registrar-ponto-dispositivo-obra (proxy fino sobre registrar-ponto-totem)
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Camera,
  CheckCircle2,
  Loader2,
  LogOut,
  MapPin,
  RefreshCw,
  Search,
  Tablet,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type TipoBatida = "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida";

interface DispositivoSession {
  id: string;
  nome: string;
  codigo_dispositivo: string;
  centro_custo_id: string | null;
}

interface FuncionarioRow {
  id: string;
  nome_completo: string;
  matricula: string | null;
  cpf: string | null;
  funcao_nome: string | null;
}

interface GpsState {
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  erro: string | null;
}

const TIPOS: { value: TipoBatida; label: string }[] = [
  { value: "entrada", label: "Entrada" },
  { value: "intervalo_inicio", label: "Início Intervalo" },
  { value: "intervalo_fim", label: "Fim Intervalo" },
  { value: "saida", label: "Saída" },
];

function detectarTipoIdent(s: string): "matricula" | "cpf" | "nome" {
  const digits = s.replace(/\D/g, "");
  if (digits.length === 11) return "cpf";
  if (/^\d+$/.test(s.trim())) return "matricula";
  return "nome";
}

const PontoDispositivo: React.FC = () => {
  const navigate = useNavigate();
  const [session, setSession] = useState<DispositivoSession | null>(null);
  const [tipoBatida, setTipoBatida] = useState<TipoBatida>("entrada");

  const [busca, setBusca] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<FuncionarioRow[]>([]);
  const [funcionario, setFuncionario] = useState<FuncionarioRow | null>(null);

  const [foto, setFoto] = useState<string | null>(null);
  const [gps, setGps] = useState<GpsState>({
    latitude: null, longitude: null, precisao: null, erro: null,
  });

  const [enviando, setEnviando] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Sessão ────────────────────────────────────────────────────────────
  useEffect(() => {
    const secret = localStorage.getItem("device_secret");
    const infoRaw = localStorage.getItem("device_info");
    if (!secret || !infoRaw) {
      navigate("/ponto-totem-login?redirect=/ponto-dispositivo", { replace: true });
      return;
    }
    try {
      const info = JSON.parse(infoRaw) as DispositivoSession;
      setSession(info);
    } catch {
      navigate("/ponto-totem-login?redirect=/ponto-dispositivo", { replace: true });
    }
  }, [navigate]);

  const logout = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    localStorage.removeItem("device_secret");
    localStorage.removeItem("device_info");
    navigate("/ponto-totem-login", { replace: true });
  };

  // ── GPS contínuo ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) {
      setGps((g) => ({ ...g, erro: "GPS indisponível neste dispositivo" }));
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: pos.coords.accuracy,
          erro: null,
        });
      },
      (err) => setGps((g) => ({ ...g, erro: err.message })),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Câmera frontal ────────────────────────────────────────────────────
  const iniciarCamera = useCallback(async () => {
    try {
      if (streamRef.current) return;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: 640, height: 480 },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (e) {
      toast.error("Não foi possível acessar a câmera", {
        description: (e as Error)?.message,
      });
    }
  }, []);

  useEffect(() => {
    if (funcionario) iniciarCamera();
    return () => {
      if (!funcionario && streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [funcionario, iniciarCamera]);

  const capturarFoto = useCallback(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = v.videoWidth || 640;
    canvas.height = v.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    setFoto(canvas.toDataURL("image/jpeg", 0.85));
  }, []);

  // ── Busca funcionário (RPC restrita ao CC do dispositivo) ─────────────
  const buscar = useCallback(async () => {
    if (!session) return;
    const q = busca.trim();
    if (q.length < 2) {
      toast.warning("Digite pelo menos 2 caracteres");
      return;
    }
    setBuscando(true);
    try {
      const { data, error } = await supabase.rpc(
        "buscar_funcionario_dispositivo_obra",
        { p_dispositivo_id: session.id, p_identificador: q },
      );
      if (error) throw error;
      setResultados((data ?? []) as FuncionarioRow[]);
      if (!data || data.length === 0) {
        toast.info("Nenhum funcionário encontrado para este centro de custo");
      }
    } catch (e) {
      toast.error("Falha na busca", { description: (e as Error)?.message });
    } finally {
      setBuscando(false);
    }
  }, [busca, session]);

  // ── Reset obrigatório após cada batida ────────────────────────────────
  const reset = useCallback(() => {
    setFuncionario(null);
    setFoto(null);
    setBusca("");
    setResultados([]);
    setSucesso(false);
    setTipoBatida("entrada");
  }, []);

  // ── Envio ─────────────────────────────────────────────────────────────
  const enviar = useCallback(async () => {
    if (!session || !funcionario || !foto) return;
    if (gps.latitude == null || gps.longitude == null) {
      toast.error("GPS obrigatório", { description: "Aguarde a captura do GPS." });
      return;
    }
    setEnviando(true);
    try {
      const deviceSecret = localStorage.getItem("device_secret")!;
      const ident =
        funcionario.matricula?.trim() ||
        funcionario.cpf?.replace(/\D/g, "") ||
        "";
      const tipoIdent = funcionario.matricula ? "matricula" : "cpf";

      // operador_id provisório = id do funcionário (o tablet de obra é compartilhado;
      // quando houver login operador-humano, substituir aqui)
      const operadorId = funcionario.id;

      const payload = {
        codigo_dispositivo: session.codigo_dispositivo,
        operador_id: operadorId,
        identificador_funcionario: ident,
        tipo_identificador: tipoIdent,
        tipo_batida: tipoBatida,
        data_hora_dispositivo: new Date().toISOString(),
        latitude: gps.latitude,
        longitude: gps.longitude,
        precisao_gps_metros: gps.precisao,
        foto_base64: foto,
        offline_uuid: crypto.randomUUID(),
        modo_registro: "dispositivo_obra",
      };

      const resp = await fetch(
        `${(import.meta as any).env.VITE_SUPABASE_URL}/functions/v1/registrar-ponto-dispositivo-obra`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-device-secret": deviceSecret,
            apikey: (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${(import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify(payload),
        },
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok || json?.success === false) {
        const msg = json?.erro || json?.error || "Falha ao registrar ponto";
        toast.error(msg, { description: json?.codigo });
        return;
      }
      setSucesso(true);
      toast.success("Ponto registrado!", {
        description: `${funcionario.nome_completo} — ${tipoBatida.replace("_", " ")}`,
      });
      // reset automático após 2s
      setTimeout(reset, 2000);
    } catch (e) {
      toast.error("Erro inesperado", { description: (e as Error)?.message });
    } finally {
      setEnviando(false);
    }
  }, [session, funcionario, foto, gps, tipoBatida, reset]);

  const podeEnviar = useMemo(
    () => !!funcionario && !!foto && gps.latitude != null && gps.longitude != null && !enviando,
    [funcionario, foto, gps, enviando],
  );

  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Tablet className="h-5 w-5 text-primary" />
            <div>
              <p className="text-sm font-semibold leading-none">{session.nome}</p>
              <p className="text-xs text-muted-foreground">
                {session.codigo_dispositivo} • Modo Dispositivo de Obra
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 p-4">
        {/* Status GPS */}
        <Card>
          <CardContent className="flex items-center gap-2 py-3 text-sm">
            <MapPin className={cn("h-4 w-4", gps.latitude ? "text-primary" : "text-muted-foreground")} />
            {gps.erro ? (
              <span className="text-destructive">GPS: {gps.erro}</span>
            ) : gps.latitude == null ? (
              <span className="text-muted-foreground">Capturando GPS…</span>
            ) : (
              <span>
                GPS OK • precisão {Math.round(gps.precisao ?? 0)}m
              </span>
            )}
          </CardContent>
        </Card>

        {/* Etapa 1: busca */}
        {!funcionario && (
          <Card>
            <CardContent className="space-y-3 pt-6">
              <p className="text-sm font-medium">Buscar funcionário</p>
              <div className="flex gap-2">
                <Input
                  placeholder="Matrícula, CPF ou nome…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && buscar()}
                  autoFocus
                />
                <Button onClick={buscar} disabled={buscando}>
                  {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                </Button>
              </div>
              {resultados.length > 0 && (
                <div className="divide-y rounded-md border">
                  {resultados.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setFuncionario(f);
                        setResultados([]);
                      }}
                      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted"
                    >
                      <div>
                        <p className="text-sm font-medium">{f.nome_completo}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.matricula ? `Mat. ${f.matricula}` : f.cpf ?? "—"}
                          {f.funcao_nome ? ` • ${f.funcao_nome}` : ""}
                        </p>
                      </div>
                      <span className="text-xs text-primary">Selecionar →</span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Etapa 2: foto + tipo + envio */}
        {funcionario && !sucesso && (
          <>
            <Card>
              <CardContent className="flex items-center justify-between pt-6">
                <div>
                  <p className="text-sm font-semibold">{funcionario.nome_completo}</p>
                  <p className="text-xs text-muted-foreground">
                    {funcionario.matricula ? `Mat. ${funcionario.matricula}` : funcionario.cpf}
                    {funcionario.funcao_nome ? ` • ${funcionario.funcao_nome}` : ""}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={reset}>
                  <X className="mr-1 h-4 w-4" /> Trocar
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm font-medium">Tipo de batida</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIPOS.map((t) => (
                    <Button
                      key={t.value}
                      variant={tipoBatida === t.value ? "default" : "outline"}
                      onClick={() => setTipoBatida(t.value)}
                      size="sm"
                    >
                      {t.label}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 pt-6">
                <p className="text-sm font-medium">Foto (obrigatória)</p>
                <div className="aspect-video overflow-hidden rounded-md bg-black">
                  {foto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={foto} alt="Foto capturada" className="h-full w-full object-cover" />
                  ) : (
                    <video
                      ref={videoRef}
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  {!foto ? (
                    <Button onClick={capturarFoto} className="w-full">
                      <Camera className="mr-2 h-4 w-4" /> Capturar foto
                    </Button>
                  ) : (
                    <Button variant="outline" onClick={() => setFoto(null)} className="w-full">
                      <RefreshCw className="mr-2 h-4 w-4" /> Refazer
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={enviar}
              disabled={!podeEnviar}
              size="lg"
              className="w-full"
            >
              {enviando ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-2 h-5 w-5" />
              )}
              Registrar ponto
            </Button>
          </>
        )}

        {sucesso && (
          <Card className="border-primary">
            <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
              <CheckCircle2 className="h-12 w-12 text-primary" />
              <p className="text-lg font-semibold">Ponto registrado!</p>
              <p className="text-sm text-muted-foreground">Pronto para a próxima batida…</p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default PontoDispositivo;
