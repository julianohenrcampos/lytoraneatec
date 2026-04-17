import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getConfiguracaoSistema } from "@/services/configService";
import { detectarCentroCustoPorGPS, DeteccaoCCResult } from "@/services/ponto";
import { toast } from "sonner";
import { getEstadoJornada, type TipoBatida } from "@/lib/ponto/estadoJornada";

const SUPABASE_URL = "https://eexzgpmrousuxlkvqwkm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVleHpncG1yb3VzdXhsa3Zxd2ttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyMDA1MDAsImV4cCI6MjA2ODc3NjUwMH0.6OFYvcfdH5iTPLbV8OkFdApWY6JHUAfzuJ5ikfx1tMU";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const MAX_FOTO_SIZE = 2 * 1024 * 1024; // 2MB

interface CentroCustoOption {
  id: string;
  nome_centro_custo: string;
  codigo_centro_custo: string;
}

interface GpsState {
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
  status: "idle" | "obtendo" | "sucesso" | "erro";
  erro?: string;
}

interface LogEntry {
  horario: string;
  tipo: string;
  httpStatus: number | string;
  resultado: "sucesso" | "erro";
  statusValidacao?: string;
  resumo?: string;
}

const TIPOS_BATIDA = [
  { tipo: "entrada", label: "Bater Entrada", color: "bg-green-600" },
  { tipo: "intervalo_inicio", label: "Início Intervalo", color: "bg-yellow-600" },
  { tipo: "intervalo_fim", label: "Fim Intervalo", color: "bg-blue-600" },
  { tipo: "saida", label: "Bater Saída", color: "bg-red-600" },
] as const;

export default function TestePonto() {
  const [gps, setGps] = useState<GpsState>({ latitude: null, longitude: null, precisao: null, status: "idle" });
  const [simulandoFora, setSimulandoFora] = useState(false);
  const [gpsReal, setGpsReal] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [ultimoRetorno, setUltimoRetorno] = useState<any>(null);
  const [ultimoHttpStatus, setUltimoHttpStatus] = useState<number | string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [toggleStatus, setToggleStatus] = useState<string | null>(null);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [centrosCusto, setCentrosCusto] = useState<CentroCustoOption[]>([]);
  const [centroCustoId, setCentroCustoId] = useState<string | null>(null);
  const [ccLoading, setCcLoading] = useState(false);

  // Auto-detecção GPS
  const [autoCC, setAutoCC] = useState<{ id: string; nome: string; distancia: number } | null>(null);
  const [autoCCLoading, setAutoCCLoading] = useState(false);
  const [modoSelecao, setModoSelecao] = useState<"automatico" | "manual">("manual");

  // Foto
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Data operacional do servidor + batidas do dia
  const [dataOperacional, setDataOperacional] = useState<string | null>(null);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [batidasDia, setBatidasDia] = useState<Array<{ tipo_batida: string; data_operacional: string; status_validacao: string }>>([]);

  useEffect(() => {
    const fetchCC = async () => {
      setCcLoading(true);
      const { data, error } = await supabase
        .from('bd_centros_custo')
        .select('id, nome_centro_custo, codigo_centro_custo')
        .eq('situacao', 'Ativo')
        .order('nome_centro_custo');
      if (!error && data) setCentrosCusto(data);
      setCcLoading(false);
    };
    fetchCC();
  }, []);

  // Data operacional 100% do backend
  useEffect(() => {
    let cancelled = false;
    supabase.rpc("get_data_operacional_atual").then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) {
        toast.error("Falha ao obter data do servidor.");
        return;
      }
      setDataOperacional(data as unknown as string);
    });
    return () => { cancelled = true; };
  }, []);

  // funcionario_id do usuário logado
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("funcionario_id")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.funcionario_id) setFuncionarioId(profile.funcionario_id);
    })();
  }, []);

  // Carregar batidas do dia operacional
  const carregarBatidas = useCallback(async () => {
    if (!funcionarioId || !dataOperacional) return;
    const { data } = await supabase
      .from("bd_ponto_batidas")
      .select("tipo_batida, data_operacional, status_validacao")
      .eq("funcionario_id", funcionarioId)
      .eq("data_operacional", dataOperacional)
      .neq("status_validacao", "invalidada")
      .order("data_hora_considerada", { ascending: true });
    setBatidasDia((data as any[]) || []);
  }, [funcionarioId, dataOperacional]);

  useEffect(() => { carregarBatidas(); }, [carregarBatidas]);

  const executarDeteccaoCC = useCallback(async (lat: number, lng: number) => {
    setAutoCCLoading(true);
    try {
      const resultado = await detectarCentroCustoPorGPS(lat, lng);
      if (resultado.centro_custo_id && resultado.nome && resultado.distancia_metros !== null) {
        setAutoCC({ id: resultado.centro_custo_id, nome: resultado.nome, distancia: resultado.distancia_metros });
        setCentroCustoId(resultado.centro_custo_id);
        setModoSelecao("automatico");
      } else {
        setAutoCC(null);
      }
    } catch (e) {
      console.error("[PONTO][AUTO_CC] Erro na detecção:", e);
      setAutoCC(null);
    }
    setAutoCCLoading(false);
  }, []);

  const capturarGps = useCallback(() => {
    setGps(prev => ({ ...prev, status: "obtendo" }));
    if (!navigator.geolocation) {
      setGps({ latitude: null, longitude: null, precisao: null, status: "erro", erro: "Geolocation não suportado" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setGps({ latitude: lat, longitude: lng, precisao: pos.coords.accuracy, status: "sucesso" });
        setGpsReal({ lat, lng });
        setSimulandoFora(false);
        executarDeteccaoCC(lat, lng);
      },
      (err) => {
        setGps({ latitude: null, longitude: null, precisao: null, status: "erro", erro: err.message });
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, [executarDeteccaoCC]);

  const toggleSimulacao = () => {
    if (!gpsReal) return;
    if (simulandoFora) {
      setGps(prev => ({ ...prev, latitude: gpsReal.lat, longitude: gpsReal.lng }));
      setSimulandoFora(false);
      executarDeteccaoCC(gpsReal.lat, gpsReal.lng);
    } else {
      const latFora = gpsReal.lat + 0.01;
      const lngFora = gpsReal.lng + 0.01;
      setGps(prev => ({ ...prev, latitude: latFora, longitude: lngFora }));
      setSimulandoFora(true);
      executarDeteccaoCC(latFora, lngFora);
    }
  };

  const verificarToggle = async () => {
    setToggleLoading(true);
    try {
      const val = await getConfiguracaoSistema("ponto_eletronico_ativo");
      setToggleStatus(val);
    } catch (e: any) {
      setToggleStatus(`ERRO: ${e.message}`);
    }
    setToggleLoading(false);
  };

  const handleCCManualChange = (v: string) => {
    setCentroCustoId(v || null);
    setModoSelecao("manual");
  };

  const handleFotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FOTO_SIZE) {
      toast.error("Imagem maior que 2MB. Tire outra foto.");
      setFotoBase64(null);
      setFotoPreview(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setFotoBase64(result);
      setFotoPreview(result);
    };
    reader.onerror = () => {
      toast.error("Falha ao ler a imagem. Tente novamente.");
      setFotoBase64(null);
      setFotoPreview(null);
      if (fotoInputRef.current) fotoInputRef.current.value = "";
    };
    reader.readAsDataURL(file);
  };

  const handleFotoRemover = () => {
    setFotoBase64(null);
    setFotoPreview(null);
    if (fotoInputRef.current) fotoInputRef.current.value = "";
  };

  const registrarPonto = async (tipo: string) => {
    if (loading) return; // anti-duplo-clique
    setLoading(tipo);
    const payload = {
      tipo_batida: tipo,
      data_hora_dispositivo: new Date().toISOString(),
      latitude: gps.latitude,
      longitude: gps.longitude,
      precisao_gps_metros: gps.precisao,
      foto_base64: fotoBase64,
      centro_custo_id: centroCustoId,
      offline_uuid: null,
      device_fingerprint: "dev-test",
      user_agent: navigator.userAgent,
    };

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        const resultado = { success: false, motivo: "nao_autenticado", message: "Sessão não encontrada. Faça login." };
        setUltimoRetorno(resultado);
        setUltimoHttpStatus(401);
        setLogs(prev => [{ horario: new Date().toLocaleTimeString("pt-BR"), tipo, httpStatus: 401, resultado: "erro", resumo: resultado.message }, ...prev]);
        setLoading(null);
        return;
      }

      const response = await fetch(`${SUPABASE_URL}/functions/v1/registrar-ponto`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify(payload),
      });

      const httpStatus = response.status;
      const data = await response.json();
      const isError = !response.ok;

      setUltimoRetorno(data);
      setUltimoHttpStatus(httpStatus);

      // Atualiza data operacional do servidor (caso tenha virado o dia)
      if (data?.data_operacional) setDataOperacional(data.data_operacional);

      const entry: LogEntry = {
        horario: new Date().toLocaleTimeString("pt-BR"),
        tipo,
        httpStatus,
        resultado: isError ? "erro" : "sucesso",
        statusValidacao: data?.status_validacao || data?.motivo || "",
        resumo: data?.message || (isError ? "Erro" : "OK"),
      };
      setLogs(prev => [entry, ...prev]);
    } catch (e: any) {
      const resultado = { success: false, motivo: "exception", message: e.message };
      setUltimoRetorno(resultado);
      setUltimoHttpStatus("exception");
      setLogs(prev => [{ horario: new Date().toLocaleTimeString("pt-BR"), tipo, httpStatus: "exception", resultado: "erro", resumo: e.message }, ...prev]);
    } finally {
      // Refetch garantido (backend = fonte de verdade)
      await carregarBatidas();
      setLoading(null);
    }
  };

  // Estado central da jornada (mesma função usada em /ponto)
  const estado = getEstadoJornada(batidasDia, dataOperacional);
  const podeRegistrar = (tipo: string): boolean => {
    if (!gpsOk || !fotoBase64 || loading !== null || !dataOperacional) return false;
    switch (tipo) {
      case "entrada": return estado.podeEntrada;
      case "intervalo_inicio": return estado.podeIntervaloInicio;
      case "intervalo_fim": return estado.podeIntervaloFim;
      case "saida": return estado.podeSaida;
      default: return false;
    }
  };

  const gpsOk = gps.status === "sucesso" && gps.latitude !== null;

  return (
    <div className="min-h-screen bg-muted p-4 space-y-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">🧪 Teste Ponto Eletrônico</h1>
      <p className="text-sm text-muted-foreground">Página de desenvolvimento — não integrada ao sistema principal.</p>

      {/* 1. Status do Sistema */}
      <section className="bg-card p-4 rounded border space-y-2">
        <h2 className="font-semibold">📡 Status do Sistema</h2>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={verificarToggle} disabled={toggleLoading}>
            {toggleLoading ? "Verificando..." : "Verificar Toggle"}
          </Button>
          {toggleStatus !== null && (
            <Badge variant={toggleStatus === "true" ? "success" : "destructive"}>
              ponto_eletronico_ativo = {toggleStatus}
            </Badge>
          )}
        </div>
      </section>

      {/* 2. GPS */}
      <section className="bg-card p-4 rounded border space-y-3">
        <h2 className="font-semibold">📍 Informações do Dispositivo</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {gpsOk ? (
            <Badge variant="success">GPS: ✅ OK</Badge>
          ) : (
            <Badge variant="destructive">GPS: ❌ Não capturado</Badge>
          )}
          {gpsOk && gps.precisao != null && (
            gps.precisao <= 80 ? (
              <Badge variant="success">📍 Precisão: {gps.precisao.toFixed(0)}m — Boa</Badge>
            ) : gps.precisao <= 150 ? (
              <Badge variant="warning">📍 Precisão: {gps.precisao.toFixed(0)}m — Intermediária</Badge>
            ) : (
              <Badge variant="destructive">📍 Precisão: {gps.precisao.toFixed(0)}m — Registro será bloqueado</Badge>
            )
          )}
          {simulandoFora && <Badge variant="warning">⚠️ Simulando fora do raio</Badge>}
        </div>
        {gpsOk && (
          <div className="text-sm font-mono bg-muted p-2 rounded">
            Lat: {gps.latitude?.toFixed(6)} | Lng: {gps.longitude?.toFixed(6)} | Precisão: {gps.precisao?.toFixed(1)}m
          </div>
        )}
        {gps.status === "obtendo" && <p className="text-sm text-muted-foreground">Obtendo localização...</p>}
        {gps.status === "erro" && <p className="text-sm text-destructive">Erro: {gps.erro}</p>}
        <div className="flex gap-2">
          <Button onClick={capturarGps} disabled={gps.status === "obtendo"}>Capturar GPS</Button>
          <Button variant="outline" onClick={toggleSimulacao} disabled={!gpsOk}>
            {simulandoFora ? "Restaurar GPS Real" : "Simular Fora do Raio"}
          </Button>
        </div>
      </section>

      {/* 3. Centro de Custo */}
      <section className="bg-card p-4 rounded border space-y-3">
        <h2 className="font-semibold">🏢 Centro de Custo</h2>

        {/* Indicador de detecção automática */}
        {autoCCLoading && <p className="text-sm text-muted-foreground">🧠 Detectando centro de custo via GPS...</p>}
        {autoCC && modoSelecao === "automatico" && (
          <div className="space-y-1">
            <Badge variant={autoCC.distancia <= 200 ? "success" : "warning"}>
              🧠 Centro identificado: {autoCC.nome} ({autoCC.distancia}m)
            </Badge>
            {autoCC.distancia > 200 && (
              <p className="text-sm text-yellow-500">⚠️ Centro identificado está distante — verificar localização</p>
            )}
          </div>
        )}
        {modoSelecao === "manual" && autoCC && (
          <p className="text-xs text-muted-foreground">Seleção manual ativa — detecção automática ignorada.</p>
        )}

        <Select value={centroCustoId ?? ""} onValueChange={handleCCManualChange}>
          <SelectTrigger>
            <SelectValue placeholder={ccLoading ? "Carregando..." : "Selecione o Centro de Custo"} />
          </SelectTrigger>
          <SelectContent>
            {centrosCusto.map((cc) => (
              <SelectItem key={cc.id} value={cc.id}>
                {cc.codigo_centro_custo} — {cc.nome_centro_custo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {centroCustoId && (
          <div className="text-sm font-mono bg-muted p-2 rounded space-y-1">
            <div>ID: {centroCustoId}</div>
            <div>Nome: {centrosCusto.find(c => c.id === centroCustoId)?.nome_centro_custo}</div>
          </div>
        )}
        {!centroCustoId && <p className="text-sm text-yellow-500">⚠️ Sem CC selecionado — resolverCentroCusto será usado como fallback.</p>}
      </section>

      {/* 3.5. Foto de Evidência */}
      <section className="bg-card p-4 rounded border space-y-3">
        <h2 className="font-semibold">📸 Foto de Evidência</h2>
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFotoCapture}
        />
        {fotoPreview ? (
          <div className="space-y-2">
            <img src={fotoPreview} alt="Preview" className="max-h-48 rounded border" />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => fotoInputRef.current?.click()}>Trocar Foto</Button>
              <Button size="sm" variant="destructive" onClick={handleFotoRemover}>Remover</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Button variant="outline" onClick={() => fotoInputRef.current?.click()}>Capturar Foto</Button>
            <p className="text-sm text-yellow-500">⚠️ Foto obrigatória para registrar ponto.</p>
          </div>
        )}
      </section>

      <section className="bg-card p-4 rounded border space-y-3">
        <h2 className="font-semibold">⏱️ Ações de Ponto</h2>
        {!gpsOk && <p className="text-sm text-muted-foreground">Capture o GPS antes de bater ponto.</p>}
        {!fotoBase64 && gpsOk && <p className="text-sm text-yellow-500">📸 Foto obrigatória para registrar ponto.</p>}
        {!dataOperacional && <p className="text-sm text-yellow-500">⏳ Aguardando data do servidor...</p>}
        {dataOperacional && (
          <p className="text-xs text-muted-foreground">
            Data operacional (servidor): <strong>{dataOperacional}</strong> · Batidas hoje: {batidasDia.length}
            {estado.temSaida && " · Jornada encerrada"}
            {estado.intervaloAberto && " · Em intervalo"}
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          {TIPOS_BATIDA.map(({ tipo, label, color }) => {
            const habilitado = podeRegistrar(tipo);
            return (
              <Button
                key={tipo}
                className={`${color} text-white h-14 text-base`}
                disabled={!habilitado}
                onClick={() => registrarPonto(tipo)}
              >
                {loading === tipo ? "Enviando..." : label}
              </Button>
            );
          })}
        </div>
      </section>

      {/* 4. Retorno da API */}
      <section className="bg-card p-4 rounded border space-y-2">
        <h2 className="font-semibold">📋 Retorno da API</h2>
        {ultimoHttpStatus !== null && (
          <Badge variant={ultimoHttpStatus === 200 ? "success" : "destructive"}>
            Status HTTP: {ultimoHttpStatus}
          </Badge>
        )}
        {ultimoRetorno ? (
          <pre className="bg-muted p-3 rounded text-xs overflow-auto max-h-80 whitespace-pre-wrap font-mono">
            {JSON.stringify(ultimoRetorno, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma requisição realizada.</p>
        )}
      </section>

      {/* 5. Log de Execução */}
      <section className="bg-card p-4 rounded border space-y-2">
        <h2 className="font-semibold">📜 Log de Execução ({logs.length})</h2>
        <div className="max-h-60 overflow-auto space-y-1">
          {logs.length === 0 && <p className="text-sm text-muted-foreground">Sem registros.</p>}
          {logs.map((l, i) => (
            <div key={i} className={`text-xs font-mono p-2 rounded ${l.resultado === "erro" ? "bg-destructive/10" : "bg-green-500/10"}`}>
              [{l.horario}] <strong>{l.tipo}</strong> — HTTP {l.httpStatus} — {l.resultado.toUpperCase()} — {l.resumo}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
