import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { detectarCentroCustoPorGPS } from "@/services/ponto/detectarCentroCustoPorGPS";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, LogOut, MapPin, Camera, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

type TipoBatida = "entrada" | "intervalo_inicio" | "intervalo_fim" | "saida";

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

interface BatidaDia {
  tipo_batida: string;
  data_hora_considerada: string;
  status_validacao: string;
}

const BOTOES: { tipo: TipoBatida; label: string; icon: string; cor: string }[] = [
  { tipo: "entrada", label: "Entrada", icon: "🟢", cor: "bg-green-600 hover:bg-green-700 text-white" },
  { tipo: "intervalo_inicio", label: "Início Intervalo", icon: "🟡", cor: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  { tipo: "intervalo_fim", label: "Fim Intervalo", icon: "🔵", cor: "bg-blue-600 hover:bg-blue-700 text-white" },
  { tipo: "saida", label: "Saída", icon: "🔴", cor: "bg-red-600 hover:bg-red-700 text-white" },
];

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
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

function precisaoBadge(precisao: number | null) {
  if (precisao == null) return null;
  if (precisao <= 30) return <Badge className="bg-green-600 text-white">GPS: {precisao}m ✓</Badge>;
  if (precisao <= 80) return <Badge className="bg-yellow-500 text-white">GPS: {precisao}m</Badge>;
  if (precisao <= 150) return <Badge className="bg-orange-500 text-white">GPS: {precisao}m ⚠</Badge>;
  return <Badge variant="destructive">GPS: {precisao}m ✗</Badge>;
}

export default function PontoDireto() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [registrando, setRegistrando] = useState(false);
  const [funcionarioNome, setFuncionarioNome] = useState<string>("");
  const [funcionarioId, setFuncionarioId] = useState<string>("");
  const [gps, setGps] = useState<GPSData | null>(null);
  const [gpsLoading, setGpsLoading] = useState(true);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [cc, setCC] = useState<CCDetectado>({ id: null, nome: null, distancia: null });
  const [batidasDia, setBatidasDia] = useState<BatidaDia[]>([]);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchIdRef = useRef<number | null>(null);

  // Load profile
  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
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

      setFuncionarioId(profile.funcionario_id);

      const { data: func } = await supabase
        .from("bd_funcionarios")
        .select("nome_completo")
        .eq("id", profile.funcionario_id)
        .single();

      setFuncionarioNome(func?.nome_completo || "Funcionário");
      setLoading(false);
    };
    loadProfile();
  }, [navigate]);

  // GPS watch
  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("GPS não suportado neste dispositivo");
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: Math.round(pos.coords.accuracy),
        });
        setGpsLoading(false);
        setGpsError(null);
      },
      (err) => {
        setGpsError(err.message);
        setGpsLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // Auto-detect CC when GPS arrives
  useEffect(() => {
    if (!gps) return;
    detectarCentroCustoPorGPS(gps.latitude, gps.longitude).then((result) => {
      setCC({ id: result.centro_custo_id, nome: result.nome, distancia: result.distancia_metros });
    });
  }, [gps]);

  // Load day's punches
  const carregarBatidas = useCallback(async () => {
    if (!funcionarioId) return;
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const { data } = await supabase
      .from("bd_ponto_batidas")
      .select("tipo_batida, data_hora_considerada, status_validacao")
      .eq("funcionario_id", funcionarioId)
      .eq("data_operacional", hoje)
      .neq("status_validacao", "invalidada")
      .order("data_hora_considerada", { ascending: true });
    setBatidasDia((data as BatidaDia[]) || []);
  }, [funcionarioId]);

  useEffect(() => { carregarBatidas(); }, [carregarBatidas]);

  // Determine which buttons are enabled
  const tiposBatidos = batidasDia.map(b => b.tipo_batida);
  const temEntrada = tiposBatidos.includes("entrada");
  const temSaida = tiposBatidos.includes("saida");
  const qtdIntInicio = tiposBatidos.filter(t => t === "intervalo_inicio").length;
  const qtdIntFim = tiposBatidos.filter(t => t === "intervalo_fim").length;
  const intervaloAberto = qtdIntInicio > qtdIntFim;

  const botaoHabilitado = (tipo: TipoBatida): boolean => {
    if (gpsLoading || !gps || registrando || !fotoBase64) return false;
    switch (tipo) {
      case "entrada": return !temEntrada || temSaida; // allows new journey after complete one
      case "intervalo_inicio": return temEntrada && !temSaida && !intervaloAberto;
      case "intervalo_fim": return temEntrada && !temSaida && intervaloAberto;
      case "saida": return temEntrada && !temSaida && !intervaloAberto;
      default: return false;
    }
  };

  // Handle photo
  const handleFoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Foto deve ter no máximo 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFotoBase64(reader.result as string);
    reader.readAsDataURL(file);
  };

  // Register punch
  const registrarPonto = async (tipo: TipoBatida) => {
    if (!gps || !fotoBase64 || !cc.id) {
      toast.error("GPS e foto são obrigatórios");
      return;
    }

    setRegistrando(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        navigate("/login");
        return;
      }

      const payload = {
        tipo_batida: tipo,
        data_hora_dispositivo: new Date().toISOString(),
        latitude: gps.latitude,
        longitude: gps.longitude,
        precisao_gps_metros: gps.precisao,
        centro_custo_id: cc.id,
        foto_base64: fotoBase64,
        device_fingerprint: getDeviceFingerprint(),
        user_agent: navigator.userAgent,
        offline_uuid: crypto.randomUUID(),
      };

      const { data, error } = await supabase.functions.invoke("registrar-ponto", {
        body: payload,
      });

      if (error) {
        // Try to parse the error body
        const errBody = typeof error === "object" && "message" in error ? error.message : String(error);
        toast.error(`Erro: ${errBody}`);
        return;
      }

      if (data?.success) {
        const statusMsg = data.status_validacao === "pendente_revisao"
          ? " (pendente revisão)"
          : "";
        toast.success(`${BOTOES.find(b => b.tipo === tipo)?.label} registrada${statusMsg}`);

        if (data.alertas?.length > 0) {
          data.alertas.forEach((a: any) => {
            toast.warning(a.mensagem, { duration: 5000 });
          });
        }

        setFotoBase64(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        await carregarBatidas();
      } else {
        const motivo = data?.motivo || "erro_desconhecido";
        const message = data?.message || "Erro ao registrar ponto";
        toast.error(`${message}`, {
          description: `Motivo: ${motivo}`,
          duration: 8000,
        });
      }
    } catch (err: any) {
      toast.error("Erro inesperado ao registrar ponto");
      console.error("[PontoDireto]", err);
    } finally {
      setRegistrando(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const statusJornada = () => {
    if (!temEntrada) return { texto: "Aguardando entrada", cor: "text-muted-foreground" };
    if (temSaida) return { texto: "Jornada encerrada", cor: "text-green-500" };
    if (intervaloAberto) return { texto: "Em intervalo", cor: "text-yellow-500" };
    return { texto: "Em jornada", cor: "text-blue-500" };
  };

  const status = statusJornada();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <img
            src="/icons/maskable-icon-512x512.png"
            alt="Logo"
            className="h-8 w-8 rounded"
          />
          <span className="font-semibold text-foreground">Ponto Eletrônico</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" />
          Sair
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 max-w-lg mx-auto w-full space-y-4">
        {/* Funcionário Info */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{funcionarioNome}</span>
            </div>
            <div className={`text-sm font-semibold ${status.cor}`}>
              {status.texto}
            </div>
          </CardContent>
        </Card>

        {/* GPS & CC */}
        <Card>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              {gpsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Obtendo localização...
                </div>
              ) : gpsError ? (
                <span className="text-sm text-destructive">{gpsError}</span>
              ) : (
                <div className="flex items-center gap-2">
                  {precisaoBadge(gps?.precisao ?? null)}
                </div>
              )}
            </div>
            {cc.nome && (
              <div className="text-sm">
                <span className="text-muted-foreground">Centro de Custo: </span>
                <span className="font-medium">{cc.nome}</span>
                {cc.distancia != null && (
                  <span className="text-muted-foreground ml-1">({cc.distancia}m)</span>
                )}
              </div>
            )}
            {!cc.nome && !gpsLoading && gps && (
              <div className="text-sm text-yellow-500 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Nenhum centro de custo detectado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Batidas do dia */}
        {batidasDia.length > 0 && (
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">Registros do dia</p>
              <div className="space-y-1">
                {batidasDia.map((b, i) => {
                  const label = BOTOES.find(bt => bt.tipo === b.tipo_batida);
                  const hora = new Date(b.data_hora_considerada).toLocaleTimeString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                      <span>{label?.icon} {label?.label || b.tipo_batida}</span>
                      <span className="text-muted-foreground">— {hora}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Foto */}
        <Card>
          <CardContent className="pt-4">
            <label className="flex flex-col items-center gap-2 cursor-pointer">
              <div className={`flex items-center gap-2 text-sm ${fotoBase64 ? "text-green-500" : "text-muted-foreground"}`}>
                <Camera className="h-4 w-4" />
                {fotoBase64 ? "Foto capturada ✓" : "Capturar foto (obrigatória)"}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFoto}
              />
              {!fotoBase64 && (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Tirar Foto
                </Button>
              )}
              {fotoBase64 && (
                <div className="relative w-20 h-20">
                  <img src={fotoBase64} alt="Preview" className="w-full h-full object-cover rounded" />
                  <button
                    className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-5 h-5 text-xs flex items-center justify-center"
                    onClick={(e) => {
                      e.preventDefault();
                      setFotoBase64(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </label>
          </CardContent>
        </Card>

        {/* Botões de ponto */}
        <div className="grid grid-cols-2 gap-3">
          {BOTOES.map((btn) => {
            const habilitado = botaoHabilitado(btn.tipo);
            return (
              <Button
                key={btn.tipo}
                className={`h-20 text-lg font-bold ${btn.cor}`}
                disabled={!habilitado}
                onClick={() => registrarPonto(btn.tipo)}
              >
                {registrando ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <span>{btn.icon} {btn.label}</span>
                )}
              </Button>
            );
          })}
        </div>

        {/* Warnings */}
        {gpsLoading && (
          <p className="text-xs text-center text-muted-foreground">
            Aguardando GPS para habilitar os botões...
          </p>
        )}
        {!fotoBase64 && !gpsLoading && gps && (
          <p className="text-xs text-center text-muted-foreground">
            Capture a foto para habilitar os botões
          </p>
        )}
      </div>
    </div>
  );
}
