import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadFaceApiModels, faceapi } from "@/lib/faceapi/loader";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox } from "@/components/ui/combobox";
import {
  Loader2,
  Camera,
  Trash2,
  Search,
  ShieldCheck,
  ShieldX,
  Clock,
  Plus,
  ScanFace,
  CheckCircle2,
  AlertTriangle,
  CameraOff,
  Upload,
  RefreshCcw,
  Eye,
  EyeOff,
  Pencil,
  User,
  Fingerprint,
  Shield,
  PenTool,
  Copy,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import MainLayout from "@/components/layout/MainLayout";
import { usePageTitle } from "@/contexts/PageTitleContext";
import { evaluateFaceQuality, type QualityResult } from "@/lib/faceapi/qualityGate";

interface FuncionarioRow {
  id: string;
  nome_completo: string;
  matricula: string | null;
  funcao_nome: string | null;
  centro_custo_nome: string | null;
  tem_biometria: boolean;
  biometria_em: string | null;
  foto_url: string | null;
  foto_signed_url?: string | null;
  assinatura_url?: string | null;
}

interface PendenteRow {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  matricula: string | null;
  centro_custo: string | null;
  origem: string;
  created_at: string;
  foto_url: string | null;
  foto_signed_url?: string | null;
}

type DetectStatus = "idle" | "processing" | "ok" | "low_quality" | "no_face" | "error";

const QUALITY_THRESHOLD = 0.7;

const BiometriaFacial: React.FC = () => {
  usePageTitle("Biometria Facial");

  // ---------- Listas ----------
  const [funcionarios, setFuncionarios] = useState<FuncionarioRow[]>([]);
  const [pendentes, setPendentes] = useState<PendenteRow[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingPend, setLoadingPend] = useState(true);
  const [acaoPend, setAcaoPend] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------- Modal ----------
  const [modalAberto, setModalAberto] = useState(false);
  const [funcSelecionadoId, setFuncSelecionadoId] = useState<string>("");
  const [processando, setProcessando] = useState(false);

  // Câmera
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const isMobileDevice = typeof navigator !== "undefined" && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">(
    isMobileDevice ? "environment" : "user",
  );
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  // Aba ativa controlada (para auto-trocar após salvar) + destaque do recém-cadastrado
  const [activeTab, setActiveTab] = useState<string>("pendentes");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  // Captura/processamento
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const descriptorRef = useRef<Float32Array | null>(null);
  const [hasDescriptor, setHasDescriptor] = useState(false);
  const [detectStatus, setDetectStatus] = useState<DetectStatus>("idle");
  const [detectScore, setDetectScore] = useState<number | null>(null);
  const [detectMessage, setDetectMessage] = useState<string>("");
  const qualityRef = useRef<QualityResult | null>(null);
  const [qualityResult, setQualityResult] = useState<QualityResult | null>(null);

  // Assinatura do funcionário
  const [assinaturaPreview, setAssinaturaPreview] = useState<string | null>(null);
  const [assinaturaFile, setAssinaturaFile] = useState<File | null>(null);

  function handleUploadAssinatura(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      toast.error("Apenas PNG é permitido para a assinatura.");
      e.target.value = "";
      return;
    }
    if (file.size > 100 * 1024) {
      toast.error("Arquivo maior que 100KB. Reduza a imagem.");
      e.target.value = "";
      return;
    }
    if (assinaturaPreview) URL.revokeObjectURL(assinaturaPreview);
    setAssinaturaFile(file);
    setAssinaturaPreview(URL.createObjectURL(file));
  }

  // Hash SHA-256 hex de um File/Blob
  async function sha256Hex(blob: Blob): Promise<string> {
    const buf = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /** Faz upload da assinatura + chama RPC. Retorna {url, hash}. */
  async function salvarAssinaturaParaFuncionario(
    funcionarioId: string,
    file: File,
  ): Promise<{ url: string; hash: string }> {
    const path = `${funcionarioId}/assinatura.png`;
    const { error: upErr } = await supabase.storage
      .from("assinaturas-funcionarios")
      .upload(path, file, { upsert: true, contentType: "image/png" });
    if (upErr) throw new Error(`Upload assinatura: ${upErr.message}`);

    const hash = await sha256Hex(file);

    const { error: rpcErr } = await supabase.rpc("salvar_assinatura_funcionario", {
      p_funcionario_id: funcionarioId,
      p_assinatura_url: path,
      p_assinatura_hash: hash,
      p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
      p_origem: "admin_web",
    } as any);
    if (rpcErr) throw new Error(`RPC assinatura: ${rpcErr.message}`);

    return { url: path, hash };
  }
  const [confirmCloseAberto, setConfirmCloseAberto] = useState(false);

  // Confirm dialogs adicionais (substituir window.confirm)
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<FuncionarioRow | null>(null);
  const [confirmRejeitar, setConfirmRejeitar] = useState<PendenteRow | null>(null);

  // Modal de visualização da biometria
  const [viewing, setViewing] = useState<FuncionarioRow | null>(null);

  // Detalhes carregados sob demanda ao abrir o modal de visualização
  interface ViewingDetails {
    cpf?: string | null;
    biometria_id?: string | null;
    biometria_origem?: string | null;
    biometria_descriptor_hash?: string | null;
    cpf_hash?: string | null;
    assinatura_signed_url?: string | null;
    assinatura_hash?: string | null;
    assinatura_updated_at?: string | null;
  }
  const [viewingDetails, setViewingDetails] = useState<ViewingDetails | null>(null);
  const [viewingLoading, setViewingLoading] = useState(false);
  const [cpfRevealed, setCpfRevealed] = useState(false);
  const [hashAuditoria, setHashAuditoria] = useState<string | null>(null);

  // Reset CPF visibility ao fechar o modal
  useEffect(() => {
    if (!viewing) {
      setCpfRevealed(false);
      setHashAuditoria(null);
    }
  }, [viewing]);

  // Carrega detalhes ao abrir o modal de visualização
  useEffect(() => {
    if (!viewing?.id) {
      setViewingDetails(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setViewingLoading(true);
      const details: ViewingDetails = {};
      try {
        // 1. Funcionario (cpf + possíveis campos de assinatura — leitura defensiva)
        const { data: func } = await supabase
          .from("bd_funcionarios")
          .select("*")
          .eq("id", viewing.id)
          .maybeSingle();
        if (func) {
          details.cpf = (func as any).cpf ?? null;
          details.assinatura_hash = (func as any).assinatura_hash ?? null;
          details.assinatura_updated_at = (func as any).assinatura_updated_at ?? null;
          const assinaturaUrl: string | null = (func as any).assinatura_url ?? null;
          if (assinaturaUrl) {
            try {
              const path = assinaturaUrl.includes("/")
                ? assinaturaUrl.split("/").slice(-2).join("/")
                : assinaturaUrl;
              const { data: signed } = await supabase.storage
                .from("assinaturas-funcionarios")
                .createSignedUrl(path, 3600);
              details.assinatura_signed_url = signed?.signedUrl ?? null;
            } catch {
              /* bucket pode não existir ainda */
            }
          }
        }

        // 2. Biometria ativa
        const { data: bio } = await supabase
          .from("bd_funcionarios_biometria_facial")
          .select("id, descriptor, origem")
          .eq("funcionario_id", viewing.id)
          .eq("ativo", true)
          .maybeSingle();
        if (bio) {
          details.biometria_id = bio.id;
          details.biometria_origem = (bio as any).origem ?? null;
          if ((bio as any).descriptor) {
            try {
              const arr = (bio as any).descriptor as unknown as number[];
              const serialized = JSON.stringify(Array.isArray(arr) ? arr : Object.values(arr));
              const enc = new TextEncoder().encode(serialized);
              const buf = await crypto.subtle.digest("SHA-256", enc);
              const hex = Array.from(new Uint8Array(buf))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
              details.biometria_descriptor_hash = hex;
            } catch {
              /* ignore */
            }
          }
        }

        // 3. CPF hash (sensivel — pode ser bloqueado por RLS)
        try {
          const { data: sens } = await supabase
            .from("bd_funcionarios_sensivel")
            .select("cpf_hash")
            .eq("funcionario_id", viewing.id)
            .maybeSingle();
          if (sens) details.cpf_hash = (sens as any).cpf_hash ?? null;
        } catch {
          /* sem permissão */
        }

        // Fallback: se não veio cpf_hash do backend mas temos o CPF, calcula no frontend
        if (!details.cpf_hash && details.cpf) {
          try {
            const cpfNorm = String(details.cpf).replace(/\D/g, "");
            if (cpfNorm) {
              const enc = new TextEncoder().encode(cpfNorm);
              const buf = await crypto.subtle.digest("SHA-256", enc);
              details.cpf_hash = Array.from(new Uint8Array(buf))
                .map((b) => b.toString(16).padStart(2, "0"))
                .join("");
            }
          } catch {
            /* ignore */
          }
        }
      } catch (e) {
        console.error("Erro ao carregar detalhes da biometria:", e);
      } finally {
        if (!cancelled) {
          setViewingDetails(details);
          setViewingLoading(false);

          // Hash de auditoria consolidado (frontend, exibido apenas)
          try {
            const ts = new Date().toISOString();
            const { data: auth } = await supabase.auth.getUser();
            const uid = auth?.user?.id ?? "anon";
            const ip = "client";
            const concat = [
              details.cpf_hash || "",
              details.biometria_descriptor_hash || "",
              details.assinatura_hash || "",
              ip,
              uid,
              ts,
            ].join("|");
            const enc = new TextEncoder().encode(concat);
            const buf = await crypto.subtle.digest("SHA-256", enc);
            const hex = Array.from(new Uint8Array(buf))
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
            if (!cancelled) setHashAuditoria(hex);
          } catch {
            /* ignore */
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [viewing?.id]);

  // Helpers de formatação para o modal
  const formatCPF = (cpf?: string | null) => {
    if (!cpf) return "—";
    const d = cpf.replace(/\D/g, "");
    if (d.length !== 11) return cpf;
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  };
  const maskCPF = (cpf?: string | null, revealed = false) => {
    if (!cpf) return "—";
    const digits = cpf.replace(/\D/g, "");
    if (digits.length !== 11) return "—";
    return revealed ? formatCPF(cpf) : "***.***.***-**";
  };
  const truncHash = (h?: string | null) =>
    h && h.length > 8 ? `${h.slice(0, 4)}...${h.slice(-4)}` : h || "—";
  const truncId = (id?: string | null) => (id ? `${id.slice(0, 8)}...` : "—");
  const copyToClipboard = async (value?: string | null, label = "Hash") => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado`);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  // ---------- Carregar modelos ----------
  useEffect(() => {
    loadFaceApiModels().catch((e) => {
      console.error(e);
      toast.error("Falha ao carregar modelos de face-api");
    });
  }, []);

  // ---------- Helpers de paginação (Supabase aplica hard limit de 1000 por requisição) ----------
  const PAGE = 1000;

  /** Itera em chunks com .range() até esgotar. */
  async function fetchAllPaginated<T = any>(
    builder: () => any,
  ): Promise<T[]> {
    const out: T[] = [];
    let from = 0;
    for (let i = 0; i < 50; i++) {
      const { data, error } = await builder().range(from, from + PAGE - 1);
      if (error) throw error;
      const chunk = (data || []) as T[];
      out.push(...chunk);
      if (chunk.length < PAGE) break;
      from += PAGE;
    }
    return out;
  }

  /** Faz .in() em batches para contornar limites de tamanho de URL e de linhas. */
  async function fetchInBatches<T = any>(
    ids: string[],
    builder: (batchIds: string[]) => any,
    batchSize = 500,
  ): Promise<T[]> {
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      const slice = ids.slice(i, i + batchSize);
      const { data, error } = await builder(slice);
      if (error) throw error;
      out.push(...((data || []) as T[]));
    }
    return out;
  }

  // ---------- Queries (sem joins ambíguos) ----------
  const carregar = async () => {
    console.log("[BIOMETRIA][LOAD_START]");
    setLoading(true);
    setLoadError(null);
    try {
      // 1) Funcionários ativos — paginado para passar do limite de 1000
      console.log("[BIOMETRIA][LOAD_FUNCIONARIOS_START]");
      const funcs = await fetchAllPaginated<any>(() =>
        supabase
          .from("bd_funcionarios")
          .select("id, nome_completo, matricula, status, funcao_id, centro_custo_id, assinatura_url")
          .in("status", ["Ativo", "Ativo sem Registro"])
          .order("nome_completo", { ascending: true }),
      );
      console.log("[BIOMETRIA][LOAD_FUNCIONARIOS_OK]", { total: funcs?.length });

      const ids = funcs.map((f: any) => f.id);
      const funcaoIds = Array.from(
        new Set(funcs.map((f: any) => f.funcao_id).filter(Boolean)),
      ) as string[];
      const ccIds = Array.from(
        new Set(funcs.map((f: any) => f.centro_custo_id).filter(Boolean)),
      ) as string[];

      // 2) Lookups paralelos (em batches para evitar limite do .in)
      console.log("[BIOMETRIA][LOAD_BIOMETRIAS_START]");
      const [funcoesData, ccData, biosData] = await Promise.all([
        funcaoIds.length
          ? fetchInBatches<any>(funcaoIds, (slice) =>
              supabase.from("bd_funcoes").select("id, nome_funcao").in("id", slice),
            )
          : Promise.resolve([] as any[]),
        ccIds.length
          ? fetchInBatches<any>(ccIds, (slice) =>
              supabase
                .from("bd_centros_custo")
                .select("id, nome_centro_custo")
                .in("id", slice),
            )
          : Promise.resolve([] as any[]),
        ids.length
          ? fetchInBatches<any>(ids, (slice) =>
              supabase
                .from("bd_funcionarios_biometria_facial" as any)
                .select("funcionario_id, created_at, foto_url")
                .in("funcionario_id", slice)
                .eq("ativo", true)
                .eq("status_validacao", "aprovado"),
            )
          : Promise.resolve([] as any[]),
      ]);
      console.log("[BIOMETRIA][LOAD_BIOMETRIAS_OK]", { total: biosData?.length });

      const mapFuncao = new Map<string, string>(
        (funcoesData || []).map((r: any) => [r.id, r.nome_funcao]),
      );
      const mapCC = new Map<string, string>(
        (ccData || []).map((r: any) => [r.id, r.nome_centro_custo]),
      );
      const mapBio = new Map<string, { created_at: string; foto_url: string | null }>(
        (biosData || []).map((r: any) => [
          r.funcionario_id,
          { created_at: r.created_at, foto_url: r.foto_url },
        ]),
      );

      // Signed URLs em paralelo (apenas para quem tem foto)
      const signedMap = new Map<string, string>();
      const fotosParaAssinar = Array.from(mapBio.values())
        .map((v) => v.foto_url)
        .filter((p): p is string => !!p);
      await Promise.all(
        fotosParaAssinar.map(async (path) => {
          try {
            const { data: s } = await supabase.storage
              .from("biometria-facial")
              .createSignedUrl(path, 300);
            if (s?.signedUrl) signedMap.set(path, s.signedUrl);
          } catch {
            /* ignore */
          }
        }),
      );

      const rows: FuncionarioRow[] = funcs.map((f: any) => {
        const bio = mapBio.get(f.id);
        return {
          id: f.id,
          nome_completo: f.nome_completo,
          matricula: f.matricula,
          funcao_nome: f.funcao_id ? mapFuncao.get(f.funcao_id) || null : null,
          centro_custo_nome: f.centro_custo_id ? mapCC.get(f.centro_custo_id) || null : null,
          tem_biometria: !!bio,
          biometria_em: bio?.created_at || null,
          foto_url: bio?.foto_url || null,
          foto_signed_url: bio?.foto_url ? signedMap.get(bio.foto_url) || null : null,
          assinatura_url: f.assinatura_url || null,
        };
      });
      // Sem biometria primeiro (prioriza ação), depois alfabético
      rows.sort((a, b) => {
        if (a.tem_biometria !== b.tem_biometria) return a.tem_biometria ? 1 : -1;
        return a.nome_completo.localeCompare(b.nome_completo, "pt-BR");
      });
      console.log("[BIOMETRIA][SET_STATE]", {
        funcionariosTotal: rows.length,
        biometriasTotal: biosData?.length ?? 0,
      });
      setFuncionarios(rows);
    } catch (e: any) {
      console.error("[BIOMETRIA][LOAD_ERROR]", e);
      setLoadError(e?.message || "Erro ao carregar funcionários");
      toast.error(e?.message || "Erro ao carregar funcionários");
    } finally {
      console.log("[BIOMETRIA][LOAD_FINALLY]");
      setLoading(false);
    }
  };

  const carregarPendentes = async () => {
    console.log("[BIOMETRIA][PEND_START]");
    setLoadingPend(true);
    try {
      // 1) Pendentes — paginado por segurança
      const pend = await fetchAllPaginated<any>(() =>
        supabase
          .from("bd_funcionarios_biometria_facial" as any)
          .select("id, funcionario_id, origem, created_at, foto_url")
          .eq("ativo", true)
          .eq("status_validacao", "pendente")
          .order("created_at", { ascending: false }),
      );

      const funcIds = Array.from(
        new Set(pend.map((r: any) => r.funcionario_id).filter(Boolean)),
      ) as string[];

      // 2) Lookup de funcionários (em batches)
      const funcs = funcIds.length
        ? await fetchInBatches<any>(funcIds, (slice) =>
            supabase
              .from("bd_funcionarios")
              .select("id, nome_completo, matricula, centro_custo_id")
              .in("id", slice),
          )
        : [];

      const ccIds = Array.from(
        new Set(funcs.map((f: any) => f.centro_custo_id).filter(Boolean)),
      ) as string[];
      const ccs = ccIds.length
        ? await fetchInBatches<any>(ccIds, (slice) =>
            supabase
              .from("bd_centros_custo")
              .select("id, nome_centro_custo")
              .in("id", slice),
          )
        : [];

      const mapFunc = new Map<string, any>((funcs || []).map((f: any) => [f.id, f]));
      const mapCC = new Map<string, string>(
        (ccs || []).map((r: any) => [r.id, r.nome_centro_custo]),
      );

      // 3) Signed URLs para fotos
      const rows: PendenteRow[] = await Promise.all(
        pend.map(async (r: any) => {
          let signed: string | null = null;
          if (r.foto_url) {
            const { data: s } = await supabase.storage
              .from("biometria-facial")
              .createSignedUrl(r.foto_url, 300);
            signed = s?.signedUrl || null;
          }
          const f = mapFunc.get(r.funcionario_id);
          return {
            id: r.id,
            funcionario_id: r.funcionario_id,
            funcionario_nome: f?.nome_completo || "—",
            matricula: f?.matricula || null,
            centro_custo: f?.centro_custo_id ? mapCC.get(f.centro_custo_id) || null : null,
            origem: r.origem,
            created_at: r.created_at,
            foto_url: r.foto_url,
            foto_signed_url: signed,
          };
        }),
      );
      console.log("[BIOMETRIA][PEND_OK]", { total: rows.length });
      setPendentes(rows);
    } catch (e: any) {
      console.error("[BIOMETRIA][PEND_ERROR]", e);
      toast.error(e?.message || "Erro ao carregar pendentes");
    } finally {
      console.log("[BIOMETRIA][PEND_FINALLY]");
      setLoadingPend(false);
    }
  };

  useEffect(() => {
    carregar();
    carregarPendentes();
  }, []);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return funcionarios;
    return funcionarios.filter(
      (f) =>
        f.nome_completo.toLowerCase().includes(q) ||
        (f.matricula || "").toLowerCase().includes(q),
    );
  }, [funcionarios, busca]);

  const semBiometria = useMemo(
    () => filtrados.filter((f) => !f.tem_biometria),
    [filtrados],
  );
  const cadastrados = useMemo(
    () => filtrados.filter((f) => f.tem_biometria),
    [filtrados],
  );

  const funcionariosOptions = useMemo(
    () =>
      funcionarios.map((f) => ({
        value: f.id,
        label: `${f.nome_completo}${f.matricula ? ` — ${f.matricula}` : ""}${
          f.tem_biometria ? "  ✓" : ""
        }`,
      })),
    [funcionarios],
  );

  const funcSelecionado = useMemo(
    () => funcionarios.find((f) => f.id === funcSelecionadoId) || null,
    [funcionarios, funcSelecionadoId],
  );

  // ---------- Funções modulares de captura/processamento ----------

  /** Inicia a câmera com fallback robusto. */
  const startCamera = useCallback(async () => {
    if (cameraOn || cameraStarting) return;
    setCameraStarting(true);
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: cameraFacing }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (e1) {
        console.warn("[BIOMETRIA][CAMERA] facingMode falhou, fallback para qualquer câmera", e1);
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraOn(true);
      // Detectar se há mais de uma câmera (para mostrar botão de trocar)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoInputs = devices.filter((d) => d.kind === "videoinput");
        setHasMultipleCameras(videoInputs.length > 1);
      } catch {
        /* ignore */
      }
    } catch (e: any) {
      console.error("[BIOMETRIA][CAMERA] erro:", e);
      toast.error("Não foi possível acessar a câmera. Verifique as permissões.");
    } finally {
      setCameraStarting(false);
    }
  }, [cameraOn, cameraStarting, cameraFacing]);

  /** Alterna entre câmera frontal e traseira. */
  const switchCamera = useCallback(async () => {
    const next: "environment" | "user" = cameraFacing === "user" ? "environment" : "user";
    // Para a câmera atual
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
    setCameraFacing(next);
    // Reinicia com nova facing — pequeno delay para o estado atualizar
    setTimeout(async () => {
      setCameraStarting(true);
      try {
        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: next }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setCameraOn(true);
      } catch (e) {
        console.error("[BIOMETRIA][CAMERA-SWITCH] erro:", e);
        toast.error("Não foi possível trocar de câmera.");
      } finally {
        setCameraStarting(false);
      }
    }, 100);
  }, [cameraFacing]);

  /** Para a câmera e libera tracks. */
  const stopCamera = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraOn(false);
  }, []);

  /** Captura um frame do vídeo e devolve dataUrl + HTMLImageElement. */
  const captureFrame = useCallback(async (): Promise<{ dataUrl: string; img: HTMLImageElement }> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) throw new Error("camera_indisponivel");
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas_indisponivel");
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("img_load_failed"));
    });
    return { dataUrl, img };
  }, []);

  /** Processa uma imagem com face-api e devolve descriptor + score + box + landmarks. */
  const processDescriptor = useCallback(
    async (
      img: HTMLImageElement,
    ): Promise<{
      descriptor: Float32Array;
      score: number;
      box: { x: number; y: number; width: number; height: number };
      landmarks: faceapi.FaceLandmarks68;
    } | null> => {
      const det = await faceapi
        .detectSingleFace(
          img,
          new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 }),
        )
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (!det) return null;
      return {
        descriptor: det.descriptor as Float32Array,
        score: det.detection.score,
        box: det.detection.box,
        landmarks: det.landmarks,
      };
    },
    [],
  );

  /** Roda captura + detecção e atualiza estado de feedback. */
  const handleCaptureAndDetect = useCallback(
    async (source?: { dataUrl: string; img: HTMLImageElement }) => {
      setDetectStatus("processing");
      setDetectMessage("Analisando rosto...");
      setDetectScore(null);
      descriptorRef.current = null;
      setHasDescriptor(false);
      qualityRef.current = null;
      setQualityResult(null);
      try {
        const captured = source ?? (await captureFrame());
        console.log("[BIOMETRIA][CAPTURA] frame capturado", { len: captured.dataUrl.length });
        setPreviewUrl(captured.dataUrl);
        setFotoBase64(captured.dataUrl);

        const result = await processDescriptor(captured.img);
        console.log("[BIOMETRIA][DETECT] resultado", result);

        if (!result) {
          setDetectStatus("no_face");
          setDetectMessage("Nenhum rosto detectado. Reposicione e tente novamente.");
          return;
        }

        // === Fase 5 M4: Quality Gate (modo aviso, NÃO bloqueia) ===
        try {
          const q = evaluateFaceQuality(captured.img, {
            box: result.box,
            landmarks: result.landmarks,
            score: result.score,
          });
          qualityRef.current = q;
          setQualityResult(q);
          console.log("[BIOMETRIA][QUALITY_GATE]", {
            score: Number(q.scoreComposto.toFixed(3)),
            nivel: q.nivel,
            warnings: q.warnings,
            metricas: {
              detectorScore: Number(q.metricas.detectorScore.toFixed(3)),
              faceRatio: Number(q.metricas.faceRatio.toFixed(3)),
              yaw: Number(q.metricas.yaw.toFixed(1)),
              pitch: Number(q.metricas.pitch.toFixed(1)),
              blur: Number(q.metricas.blur.toFixed(1)),
              brilho: Number(q.metricas.brilho.toFixed(1)),
              crop: q.metricas.cropResolution,
            },
          });
        } catch (qErr) {
          console.warn("[BIOMETRIA][QUALITY_GATE] falhou:", qErr);
          qualityRef.current = null;
          setQualityResult(null);
        }

        if (result.score < QUALITY_THRESHOLD) {
          setDetectScore(result.score);
          setDetectStatus("low_quality");
          setDetectMessage(
            "Qualidade da imagem insuficiente. Tente novamente com melhor iluminação.",
          );
          return;
        }
        descriptorRef.current = result.descriptor;
        setHasDescriptor(true);
        setDetectScore(result.score);
        setDetectStatus("ok");
        setDetectMessage(`Rosto detectado com sucesso (${Math.round(result.score * 100)}%).`);
        console.log("[BIOMETRIA][SAVE] habilitado", { score: result.score });
      } catch (e: any) {
        console.error("[BIOMETRIA][DETECT] erro:", e);
        setDetectStatus("error");
        setDetectMessage(e?.message || "Erro ao processar imagem");
        setHasDescriptor(false);
      }
    },
    [captureFrame, processDescriptor],
  );

  /** Captura via webcam — botão "Capturar Foto". */
  const handleCapturarWebcam = async () => {
    if (!cameraOn) {
      toast.error("Inicie a câmera primeiro");
      return;
    }
    await handleCaptureAndDetect();
  };

  /** Upload de arquivo (fallback). */
  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl: string = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => rej(r.error);
      r.readAsDataURL(file);
    });
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = dataUrl;
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("img_load_failed"));
    });
    await handleCaptureAndDetect({ dataUrl, img });
    // Limpar input para permitir re-seleção do mesmo arquivo
    e.target.value = "";
  };

  // ---------- Modal lifecycle ----------
  const abrirModalNovo = () => {
    setFuncSelecionadoId("");
    resetCaptura();
    setModalAberto(true);
  };

  const abrirModalParaFunc = async (f: FuncionarioRow) => {
    setFuncSelecionadoId(f.id);
    resetCaptura();
    setModalAberto(true);
    // Carrega assinatura existente (signed URL) se houver
    if (f.assinatura_url) {
      try {
        const { data } = await supabase.storage
          .from("assinaturas-funcionarios")
          .createSignedUrl(f.assinatura_url, 600);
        if (data?.signedUrl) setAssinaturaPreview(data.signedUrl);
      } catch {
        /* ignore */
      }
    }
  };

  const resetCaptura = () => {
    setPreviewUrl(null);
    setFotoBase64(null);
    descriptorRef.current = null;
    setHasDescriptor(false);
    setDetectStatus("idle");
    setDetectScore(null);
    setDetectMessage("");
    qualityRef.current = null;
    setQualityResult(null);
    if (assinaturaPreview && assinaturaPreview.startsWith("blob:")) URL.revokeObjectURL(assinaturaPreview);
    setAssinaturaPreview(null);
    setAssinaturaFile(null);
  };

  const fecharModal = () => {
    setModalAberto(false);
    setConfirmCloseAberto(false);
    stopCamera();
    resetCaptura();
  };

  /** Tenta fechar — pede confirmação se houver trabalho em andamento. */
  const tentarFechar = () => {
    const temTrabalho =
      !!funcSelecionadoId ||
      !!fotoBase64 ||
      !!descriptorRef.current ||
      detectStatus !== "idle" ||
      cameraOn;
    if (temTrabalho) {
      setConfirmCloseAberto(true);
    } else {
      fecharModal();
    }
  };

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // ---------- Salvar ----------
  const executarCadastroBiometria = async () => {
    if (!funcSelecionado) return;
    if (!descriptorRef.current || detectStatus !== "ok") return;

    console.log("[BIOMETRIA][SAVE] enviando", {
      funcionario_id: funcSelecionado.id,
      score: detectScore,
    });

    const qScore = qualityRef.current?.scoreComposto;
    const { data, error } = await supabase.functions.invoke("cadastrar-biometria-facial", {
      body: {
        origem: "admin_upload",
        funcionario_id: funcSelecionado.id,
        descriptor: Array.from(descriptorRef.current),
        foto_base64: fotoBase64,
        qualidade_score:
          typeof qScore === "number" && qScore >= 0 && qScore <= 1 ? qScore : null,
      },
    });
    if (error) throw new Error(error.message);
    if (!data?.success) throw new Error(data?.error || "Falha ao cadastrar");

    // Atualização otimística — marca o funcionário como cadastrado imediatamente
    const nowIso = new Date().toISOString();
    setFuncionarios((prev) => {
      const next = prev.map((f) =>
        f.id === funcSelecionado.id
          ? { ...f, tem_biometria: true, biometria_em: nowIso }
          : f,
      );
      next.sort((a, b) => {
        if (a.tem_biometria !== b.tem_biometria) return a.tem_biometria ? 1 : -1;
        return a.nome_completo.localeCompare(b.nome_completo, "pt-BR");
      });
      return next;
    });
  };

  /** Executa o salvamento condicional (biometria e/ou assinatura). */
  const executarCadastro = async () => {
    if (!funcSelecionado) return;

    const alterouBiometria = !!fotoBase64 && !!descriptorRef.current && detectStatus === "ok";
    const alterouAssinatura = !!assinaturaFile;

    if (!alterouBiometria && !alterouAssinatura) {
      toast.error("Nenhuma alteração realizada");
      return;
    }

    setProcessando(true);
    const sucessos: string[] = [];
    const erros: string[] = [];

    try {
      if (alterouBiometria) {
        try {
          await executarCadastroBiometria();
          sucessos.push("biometria");
        } catch (e: any) {
          console.error("[BIOMETRIA][SAVE] erro:", e);
          erros.push(`Biometria: ${e?.message || "erro"}`);
        }
      }

      if (alterouAssinatura && assinaturaFile) {
        try {
          await salvarAssinaturaParaFuncionario(funcSelecionado.id, assinaturaFile);
          sucessos.push("assinatura");
          // Atualização otimística
          setFuncionarios((prev) =>
            prev.map((f) =>
              f.id === funcSelecionado.id
                ? { ...f, assinatura_url: `${funcSelecionado.id}/assinatura.png` }
                : f,
            ),
          );
        } catch (err: any) {
          console.error("[ASSINATURA][SAVE] erro:", err);
          erros.push(`Assinatura: ${err?.message || "erro"}`);
        }
      }

      if (sucessos.length > 0) {
        const partes = sucessos
          .map((s) => (s === "biometria" ? "Biometria" : "Assinatura"))
          .join(" e ");
        toast.success(`${partes} de ${funcSelecionado.nome_completo} salva(s) com sucesso`);
      }
      if (erros.length > 0) {
        erros.forEach((m) => toast.error(m));
      }

      if (sucessos.length > 0 && erros.length === 0) {
        if (sucessos.includes("biometria")) {
          const novoId = funcSelecionado.id;
          setActiveTab("cadastrados");
          setHighlightId(novoId);
          setTimeout(() => {
            setHighlightId((curr) => (curr === novoId ? null : curr));
          }, 4000);
        }
        fecharModal();
        Promise.all([carregar(), carregarPendentes()]).catch(() => {});
      }
    } finally {
      setProcessando(false);
    }
  };

  const cadastrar = async () => {
    if (!funcSelecionado) {
      toast.error("Selecione um funcionário");
      return;
    }

    const alterouBiometria = !!fotoBase64 && !!descriptorRef.current && detectStatus === "ok";
    const alterouAssinatura = !!assinaturaFile;

    if (!alterouBiometria && !alterouAssinatura) {
      toast.error("Nenhuma alteração realizada");
      return;
    }

    // Confirma substituição apenas se for sobrescrever biometria existente
    if (alterouBiometria && funcSelecionado.tem_biometria) {
      setConfirmReplace(true);
      return;
    }
    await executarCadastro();
  };

  // ---------- Ações lista ----------
  const executarRemocao = async (f: FuncionarioRow) => {
    try {
      const { error } = await supabase
        .from("bd_funcionarios_biometria_facial" as any)
        .update({ ativo: false })
        .eq("funcionario_id", f.id)
        .eq("ativo", true);
      if (error) throw error;
      toast.success("Biometria removida");
      await carregar();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover");
    }
  };

  const aprovarPendente = async (p: PendenteRow) => {
    setAcaoPend(p.id);
    try {
      await supabase
        .from("bd_funcionarios_biometria_facial" as any)
        .update({ ativo: false })
        .eq("funcionario_id", p.funcionario_id)
        .eq("status_validacao", "aprovado")
        .eq("ativo", true);

      const { data: claims } = await supabase.auth.getClaims();
      const userId = (claims as any)?.claims?.sub || null;

      const { error } = await supabase
        .from("bd_funcionarios_biometria_facial" as any)
        .update({
          status_validacao: "aprovado",
          validado_por_user_id: userId,
          validado_em: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (error) throw error;
      toast.success(`Cadastro de ${p.funcionario_nome} aprovado`);
      await Promise.all([carregar(), carregarPendentes()]);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aprovar");
    } finally {
      setAcaoPend(null);
    }
  };

  const executarRejeicao = async (p: PendenteRow) => {
    setAcaoPend(p.id);
    try {
      const { data: claims } = await supabase.auth.getClaims();
      const userId = (claims as any)?.claims?.sub || null;

      const { error } = await supabase
        .from("bd_funcionarios_biometria_facial" as any)
        .update({
          status_validacao: "rejeitado",
          ativo: false,
          validado_por_user_id: userId,
          validado_em: new Date().toISOString(),
        })
        .eq("id", p.id);
      if (error) throw error;
      toast.success("Cadastro rejeitado");
      await carregarPendentes();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao rejeitar");
    } finally {
      setAcaoPend(null);
    }
  };

  const totalCadastrados = funcionarios.filter((f) => f.tem_biometria).length;
  const biometriaValida =
    detectStatus === "ok" && hasDescriptor && (detectScore ?? 0) >= QUALITY_THRESHOLD;
  const alterouBiometria = !!fotoBase64 && biometriaValida;
  const alterouAssinatura = !!assinaturaFile;
  const podeSalvar =
    !!funcSelecionado && !processando && (alterouBiometria || alterouAssinatura);

  return (
    <MainLayout>
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScanFace className="h-5 w-5" /> Biometria Facial
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Cadastre rostos e valide auto-cadastros vindos do totem.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Badge variant="secondary" className="text-sm w-fit">
                {totalCadastrados} / {funcionarios.length} aprovados
              </Badge>
              <Button onClick={abrirModalNovo} className="gap-2 w-full sm:w-auto">
                <Plus className="h-4 w-4" /> Cadastrar Biometria
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full sm:w-auto overflow-x-auto whitespace-nowrap flex justify-start">
              <TabsTrigger value="pendentes" className="gap-2 shrink-0">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">Pendentes</span>
                <span className="inline sm:hidden">Pend.</span>
                {pendentes.length > 0 && (
                  <Badge className="ml-1 bg-amber-500 text-white">{pendentes.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="cadastrados" className="gap-2 shrink-0">
                <span className="hidden sm:inline">Cadastrados</span>
                <span className="inline sm:hidden">Cad.</span>
                <Badge variant="secondary" className="ml-1">{cadastrados.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="sem_biometria" className="gap-2 shrink-0">
                <span className="hidden sm:inline">Sem biometria</span>
                <span className="inline sm:hidden">Sem bio.</span>
                {semBiometria.length > 0 && (
                  <Badge className="ml-1 bg-rose-500 text-white">{semBiometria.length}</Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* === SEM BIOMETRIA === */}
            <TabsContent value="sem_biometria" className="mt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou matrícula..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <FuncionariosList
                  rows={semBiometria}
                  abrirModalParaFunc={abrirModalParaFunc}
                  setConfirmRemove={setConfirmRemove}
                  onView={setViewing}
                  highlightId={highlightId}
                  emptyMsg="Todos os funcionários ativos já têm biometria cadastrada. ✓"
                />
              )}
            </TabsContent>

            {/* === CADASTRADOS === */}
            <TabsContent value="cadastrados" className="mt-4">
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome ou matrícula..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              {loadError && !loading && (
                <Alert variant="destructive" className="mb-4">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erro ao carregar funcionários</AlertTitle>
                  <AlertDescription className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                    <span className="flex-1">{loadError}</span>
                    <Button size="sm" variant="outline" onClick={carregar}>
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <FuncionariosList
                  rows={cadastrados}
                  abrirModalParaFunc={abrirModalParaFunc}
                  setConfirmRemove={setConfirmRemove}
                  onView={setViewing}
                  highlightId={highlightId}
                  emptyMsg="Nenhum funcionário cadastrado encontrado."
                />
              )}
            </TabsContent>


            {/* === PENDENTES === */}
            <TabsContent value="pendentes" className="mt-4">
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md p-3 text-xs text-amber-800 dark:text-amber-200 mb-4">
                Cadastros feitos pelo próprio funcionário no totem (auto-enrolamento). Eles{" "}
                <strong>não funcionam</strong> no reconhecimento até serem aprovados aqui.
                Confirme visualmente que a foto corresponde ao funcionário antes de aprovar.
              </div>

              {loadingPend ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : pendentes.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
                  Nenhum cadastro pendente. ✓
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {pendentes.map((p) => (
                    <div
                      key={p.id}
                      className="border rounded-lg p-3 flex gap-3 items-start bg-card"
                    >
                      <div className="w-20 h-20 sm:w-24 sm:h-24 shrink-0 bg-muted rounded-md overflow-hidden flex items-center justify-center">
                        {p.foto_signed_url ? (
                          <img
                            src={p.foto_signed_url}
                            alt={p.funcionario_nome}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Camera className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.funcionario_nome}</p>
                        <p className="text-sm sm:text-xs text-muted-foreground">
                          {p.matricula || "—"} • {p.centro_custo || "—"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enviado em {new Date(p.created_at).toLocaleString("pt-BR")}
                        </p>
                        <div className="flex gap-2 mt-3">
                          <Button
                            size="sm"
                            onClick={() => aprovarPendente(p)}
                            disabled={acaoPend === p.id}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white flex-1 min-h-[44px]"
                          >
                            {acaoPend === p.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 mr-1" />
                            )}
                            Aprovar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setConfirmRejeitar(p)}
                            disabled={acaoPend === p.id}
                            className="text-destructive border-destructive/30 hover:bg-destructive/10 flex-1 min-h-[44px]"
                          >
                            <ShieldX className="h-4 w-4 mr-1" />
                            Rejeitar
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ============== MODAL ============== */}
      <Dialog
        open={modalAberto}
        onOpenChange={(o) => {
          if (!o) tentarFechar();
          else setModalAberto(true);
        }}
      >
        <DialogContent
          className="max-w-2xl w-[calc(100vw-1rem)] sm:w-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-3 sm:p-6"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Cadastro biométrico</DialogTitle>
            <DialogDescription>
              Selecione o funcionário, capture uma foto frontal com boa iluminação e apenas um rosto
              visível.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Seleção de funcionário */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Funcionário</label>
              <Combobox
                options={funcionariosOptions}
                value={funcSelecionadoId}
                onChange={setFuncSelecionadoId}
                placeholder="Selecione um funcionário"
                searchPlaceholder="Buscar por nome ou matrícula..."
                emptyText="Nenhum funcionário encontrado"
              />
              {funcSelecionado?.tem_biometria && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ Este funcionário já possui biometria ativa. Salvar irá substituir.
                </p>
              )}
            </div>

            {/* Câmera + Preview */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="border rounded-lg p-2 bg-muted/30 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-2">Câmera</p>
                <div className="relative aspect-[4/3] bg-black rounded overflow-hidden flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={cameraOn ? "w-full h-full object-cover" : "hidden"}
                  />
                  {!cameraOn && (
                    <div className="text-muted-foreground text-xs flex flex-col items-center gap-2">
                      <CameraOff className="h-8 w-8" />
                      Câmera desligada
                    </div>
                  )}
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2 mt-2">
                  {!cameraOn ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={startCamera}
                      disabled={cameraStarting}
                      className="flex-1"
                    >
                      {cameraStarting ? (
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4 mr-1" />
                      )}
                      Iniciar câmera
                    </Button>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        onClick={handleCapturarWebcam}
                        disabled={detectStatus === "processing"}
                        className="flex-1 min-h-[44px]"
                      >
                        {detectStatus === "processing" ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <ScanFace className="h-4 w-4 mr-1" />
                        )}
                        Capturar foto
                      </Button>
                      {hasMultipleCameras && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={switchCamera}
                          disabled={cameraStarting}
                          title={cameraFacing === "user" ? "Trocar para traseira" : "Trocar para frontal"}
                          className="min-h-[44px]"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={stopCamera} className="min-h-[44px]">
                        <CameraOff className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="border rounded-lg p-2 bg-muted/30 flex flex-col">
                <p className="text-xs font-medium text-muted-foreground mb-2">Pré-visualização</p>
                <div className="aspect-[4/3] bg-black/5 dark:bg-white/5 rounded overflow-hidden flex items-center justify-center">
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Capture ou envie uma foto
                    </span>
                  )}
                </div>
                <div className="mt-2">
                  <label className="block">
                    <span className="sr-only">Enviar arquivo</span>
                    <Input type="file" accept="image/*" capture="environment" onChange={handleArquivo} />
                  </label>
                </div>
              </div>
            </div>

            {/* Status atual de cadastro */}
            {funcSelecionado && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant={funcSelecionado.tem_biometria ? "success" : "secondary"}>
                  {funcSelecionado.tem_biometria ? "Biometria já cadastrada" : "Biometria não cadastrada"}
                </Badge>
                <Badge variant={funcSelecionado.assinatura_url ? "success" : "secondary"}>
                  {funcSelecionado.assinatura_url ? "Assinatura cadastrada" : "Assinatura não cadastrada"}
                </Badge>
                {alterouBiometria && (
                  <Badge variant="warning">Biometria — alteração pendente</Badge>
                )}
                {alterouAssinatura && (
                  <Badge variant="warning">Assinatura — alteração pendente</Badge>
                )}
              </div>
            )}

            {/* Assinatura do Funcionário */}
            <div className="mt-6 border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold">Assinatura do Funcionário</h3>
                {funcSelecionado?.assinatura_url && !alterouAssinatura && (
                  <span className="text-xs text-muted-foreground">Já cadastrada — envie um novo PNG para substituir</span>
                )}
              </div>
              <Input
                type="file"
                accept="image/png"
                onChange={handleUploadAssinatura}
              />
              {assinaturaPreview && (
                <div className="mt-2 bg-black/5 dark:bg-white/5 rounded p-2 inline-block">
                  <img
                    src={assinaturaPreview}
                    alt="Assinatura"
                    className="h-16 object-contain"
                  />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Apenas PNG até 100KB. Preferência: fundo transparente.
              </p>
            </div>

            {/* Status da detecção */}
            {detectStatus !== "idle" && (
              <div
                className={
                  "rounded-md p-3 text-sm flex items-start gap-2 " +
                  (detectStatus === "ok"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : detectStatus === "processing"
                      ? "bg-muted border text-muted-foreground"
                      : "bg-destructive/10 border border-destructive/30 text-destructive")
                }
              >
                {detectStatus === "ok" ? (
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                ) : detectStatus === "processing" ? (
                  <Loader2 className="h-4 w-4 mt-0.5 shrink-0 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{detectMessage}</p>
                  {detectScore !== null && detectStatus !== "ok" && (
                    <p className="text-xs opacity-80 mt-0.5">
                      Score atual: {Math.round(detectScore * 100)}% (mínimo:{" "}
                      {Math.round(QUALITY_THRESHOLD * 100)}%)
                    </p>
                  )}
                </div>
                {(detectStatus === "low_quality" ||
                  detectStatus === "no_face" ||
                  detectStatus === "error") &&
                  cameraOn && (
                    <Button size="sm" variant="ghost" onClick={handleCapturarWebcam}>
                      <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Recapturar
                    </Button>
                  )}
              </div>
            )}

            {/* Fase 5 M4: Badge de qualidade biométrica (informativo, não bloqueia) */}
            {qualityResult && (
              <div
                className={
                  "rounded-md px-3 py-2 text-xs flex items-start gap-2 border " +
                  (qualityResult.nivel === "boa"
                    ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                    : qualityResult.nivel === "media"
                      ? "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                      : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200")
                }
                aria-live="polite"
              >
                <div className="flex-1">
                  <p className="font-medium">
                    Qualidade biométrica: {qualityResult.nivel.toUpperCase()} (
                    {Math.round(qualityResult.scoreComposto * 100)}%)
                  </p>
                  {qualityResult.mensagens.length > 0 && (
                    <p className="opacity-80 mt-0.5">
                      {qualityResult.mensagens.slice(0, 2).join(" • ")}
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              ⚠️ Dado biométrico é informação sensível (LGPD). Apenas SuperAdm e AdmRH têm acesso.
              Cadastros via admin entram já aprovados.
            </p>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <Button variant="outline" onClick={tentarFechar} disabled={processando} className="w-full sm:w-auto min-h-[44px]">
              Cancelar
            </Button>
            <Button onClick={cadastrar} disabled={!podeSalvar} className="w-full sm:w-auto min-h-[44px]">
              {processando ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" /> Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={confirmCloseAberto}
        onClose={() => setConfirmCloseAberto(false)}
        onConfirm={fecharModal}
        title="Descartar cadastro?"
        description="As informações capturadas (foto e detecção) serão perdidas. Deseja realmente sair?"
        confirmText="Descartar"
        cancelText="Continuar cadastro"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={confirmReplace}
        onClose={() => setConfirmReplace(false)}
        onConfirm={async () => {
          setConfirmReplace(false);
          await executarCadastro();
        }}
        title="Substituir biometria existente?"
        description={`Já existe uma biometria ativa para ${funcSelecionado?.nome_completo || ""}. A nova substituirá a anterior.`}
        confirmText="Substituir"
        cancelText="Cancelar"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={async () => {
          if (confirmRemove) {
            const f = confirmRemove;
            setConfirmRemove(null);
            await executarRemocao(f);
          }
        }}
        title="Remover biometria?"
        description={`Remover cadastro biométrico de ${confirmRemove?.nome_completo || ""}?`}
        confirmText="Remover"
        cancelText="Cancelar"
        variant="danger"
      />

      <ConfirmDialog
        isOpen={!!confirmRejeitar}
        onClose={() => setConfirmRejeitar(null)}
        onConfirm={async () => {
          if (confirmRejeitar) {
            const p = confirmRejeitar;
            setConfirmRejeitar(null);
            await executarRejeicao(p);
          }
        }}
        title="Rejeitar cadastro?"
        description={`Rejeitar cadastro de ${confirmRejeitar?.funcionario_nome || ""}? O registro será marcado como inativo.`}
        confirmText="Rejeitar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Modal de visualização da biometria */}
      <Dialog open={!!viewing} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detalhes da Biometria</DialogTitle>
            <DialogDescription>
              Informações completas do cadastro biométrico do funcionário.
            </DialogDescription>
          </DialogHeader>

          {/* Cabeçalho consolidado: foto + dados do funcionário */}
          <div className="flex gap-4 items-start">
            {viewing?.foto_signed_url ? (
              <img
                src={viewing.foto_signed_url}
                alt={viewing.nome_completo}
                className="h-24 w-24 rounded-lg object-cover bg-muted border shrink-0"
              />
            ) : (
              <div className="h-24 w-24 rounded-lg bg-muted border flex items-center justify-center text-muted-foreground shrink-0">
                <User className="h-8 w-8" />
              </div>
            )}
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-base font-semibold truncate">{viewing?.nome_completo}</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">CPF:</span>
                <span className="font-mono">{maskCPF(viewingDetails?.cpf, cpfRevealed)}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={!viewingDetails?.cpf}
                  onClick={() => setCpfRevealed((v) => !v)}
                  title={cpfRevealed ? "Ocultar CPF" : "Mostrar CPF"}
                  aria-label={cpfRevealed ? "Ocultar CPF" : "Mostrar CPF"}
                >
                  {cpfRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                <span className="font-medium">Centro de Custo:</span>{" "}
                {viewing?.centro_custo_nome || "—"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                <span className="font-medium">Função:</span> {viewing?.funcao_nome || "—"}
              </p>
              {viewingLoading && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Carregando detalhes…
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* 🔐 Dados Biométricos */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-primary" /> Dados Biométricos
            </h3>
            <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 text-sm">
              <dt className="text-muted-foreground">Cadastrado em:</dt>
              <dd>
                {viewing?.biometria_em
                  ? new Date(viewing.biometria_em).toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                    })
                  : "—"}
              </dd>
              <dt className="text-muted-foreground">Origem:</dt>
              <dd className="capitalize">{viewingDetails?.biometria_origem || "—"}</dd>
              <dt className="text-muted-foreground">ID:</dt>
              <dd className="font-mono text-xs">{truncId(viewingDetails?.biometria_id)}</dd>
            </dl>
          </section>

          <Separator />

          {/* 🛡️ Segurança */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" /> Segurança
            </h3>
            <dl className="grid grid-cols-[140px_1fr_auto] gap-y-1.5 gap-x-2 text-sm items-center">
              <dt className="text-muted-foreground">Hash Biometria:</dt>
              <dd className="font-mono text-xs">
                {truncHash(viewingDetails?.biometria_descriptor_hash)}
              </dd>
              <dd>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!viewingDetails?.biometria_descriptor_hash}
                  onClick={() =>
                    copyToClipboard(viewingDetails?.biometria_descriptor_hash, "Hash Biometria")
                  }
                  title="Copiar hash"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>

              <dt className="text-muted-foreground">Hash CPF:</dt>
              <dd className="font-mono text-xs">
                {viewingDetails?.cpf_hash
                  ? truncHash(viewingDetails.cpf_hash)
                  : viewingLoading
                    ? "Calculando..."
                    : "Indisponível"}
              </dd>
              <dd>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!viewingDetails?.cpf_hash}
                  onClick={() => copyToClipboard(viewingDetails?.cpf_hash, "Hash CPF")}
                  title="Copiar hash"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>

              <dt className="text-muted-foreground">Hash Assinatura:</dt>
              <dd className="font-mono text-xs">{truncHash(viewingDetails?.assinatura_hash)}</dd>
              <dd>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!viewingDetails?.assinatura_hash}
                  onClick={() =>
                    copyToClipboard(viewingDetails?.assinatura_hash, "Hash Assinatura")
                  }
                  title="Copiar hash"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>

              <dt className="text-muted-foreground">Hash Auditoria:</dt>
              <dd className="font-mono text-xs">{truncHash(hashAuditoria)}</dd>
              <dd>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  disabled={!hashAuditoria}
                  onClick={() => copyToClipboard(hashAuditoria, "Hash Auditoria")}
                  title="Copiar hash"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </dd>
            </dl>
            <p className="text-[10px] text-muted-foreground">
              Auditoria = SHA-256(hash_cpf | hash_biometria | hash_assinatura | ip | user_id |
              timestamp).
            </p>
          </section>

          <Separator />

          {/* ✍️ Assinatura */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <PenTool className="h-4 w-4 text-primary" /> Assinatura
            </h3>
            {viewingDetails?.assinatura_signed_url ? (
              <div className="space-y-2">
                <div className="bg-muted rounded p-2 inline-block border">
                  <img
                    src={viewingDetails.assinatura_signed_url}
                    alt="Assinatura"
                    className="h-20 object-contain"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Atualizado em:{" "}
                  {viewingDetails.assinatura_updated_at
                    ? new Date(viewingDetails.assinatura_updated_at).toLocaleString("pt-BR", {
                        timeZone: "America/Sao_Paulo",
                      })
                    : "—"}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground italic">Assinatura não cadastrada</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!viewing) return;
                    const f = funcionarios.find((x) => x.id === viewing.id);
                    if (f) {
                      setViewing(null);
                      abrirModalParaFunc(f);
                    }
                  }}
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Cadastrar assinatura
                </Button>
              </div>
            )}
          </section>

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </MainLayout>
  );
};

interface FuncionariosListProps {
  rows: FuncionarioRow[];
  abrirModalParaFunc: (f: FuncionarioRow) => void;
  setConfirmRemove: (f: FuncionarioRow | null) => void;
  onView: (f: FuncionarioRow) => void;
  highlightId?: string | null;
  emptyMsg: string;
}

const FuncionariosList: React.FC<FuncionariosListProps> = ({
  rows,
  abrirModalParaFunc,
  setConfirmRemove,
  onView,
  highlightId,
  emptyMsg,
}) => {
  if (rows.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground border rounded-lg">
        {emptyMsg}
      </div>
    );
  }
  return (
    <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
      {rows.map((f) => {
        const isHighlighted = highlightId === f.id;
        return (
        <div
          key={f.id}
          className={
            "flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 transition-colors duration-1000 " +
            (isHighlighted
              ? "bg-emerald-100 dark:bg-emerald-900/40"
              : "hover:bg-muted/50")
          }
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-14 h-14 sm:w-12 sm:h-12 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center">
              {f.foto_signed_url ? (
                <img
                  src={f.foto_signed_url}
                  alt={f.nome_completo}
                  className="w-full h-full object-cover"
                />
              ) : (
                <ScanFace className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-medium truncate">{f.nome_completo}</p>
              <p className="text-sm sm:text-xs text-muted-foreground truncate">
                {f.matricula || "—"} • {f.funcao_nome || "—"} • {f.centro_custo_nome || "—"}
                {f.tem_biometria && f.biometria_em && (
                  <> • Cadastrado em {new Date(f.biometria_em).toLocaleDateString("pt-BR")}</>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
            {f.tem_biometria ? (
              <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300 hidden sm:inline-flex">
                ✓ Cadastrado
              </Badge>
            ) : (
              <Badge variant="outline" className="text-rose-600 border-rose-300 dark:text-rose-300 dark:border-rose-700 hidden sm:inline-flex">
                Sem cadastro
              </Badge>
            )}
            {f.tem_biometria ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onView(f)}
                  title="Visualizar"
                  aria-label="Visualizar biometria"
                >
                  <Eye className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => abrirModalParaFunc(f)}
                  title="Editar"
                  aria-label="Editar biometria"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setConfirmRemove(f)}
                  title="Excluir"
                  aria-label="Excluir biometria"
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => abrirModalParaFunc(f)}
                className="flex-1 sm:flex-none min-h-[44px]"
              >
                Cadastrar
              </Button>
            )}
          </div>
        </div>
        );
      })}
    </div>
  );
};

export default BiometriaFacial;
