import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ApontamentoCaminhao,
  ApontamentoInspecao,
  CabecalhoApontamentoPayload,
  ChecklistValor,
  getSignedFotoUrl,
  fetchLocalizacaoByApontamento,
  type LocalizacaoApontamentoPayload,
  type LocalizacaoApontamentoRow,
} from "@/services/apontamentoCaminhoesService";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { CATEGORIA_IDS } from "@/constants/categorias";
import { mapSituacaoToDatabase, mapSituacaoFromDatabase } from "@/utils/situacaoMapping";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import type { FormSubmitPayload, DetalhadoSubmit } from "@/hooks/useApontamentoCaminhoes";
import type { VeiculoDropdownItem } from "@/hooks/useApontamentoCaminhoes";
import {
  CHECKLIST_CE_TEMPLATES,
  resolveTemplateCE,
  type ChecklistCeTemplateCodigo,
} from "@/constants/checklistCeTemplates";
import ChecklistEquipmentHeader from "./checklist/ChecklistEquipmentHeader";
import ChecklistDinamico, {
  type ChecklistDetalhadoState,
  novoEstadoDetalhadoOK,
} from "./checklist/ChecklistDinamico";
import { AlertTriangle, Camera, X, MapPin, Loader2, MapPinOff } from "lucide-react";
import ChecklistLegadoAgrupado, {
  novoEstadoLegadoOK,
} from "./checklist/ChecklistLegadoAgrupado";
import { captureGeo } from "@/utils/registroManual/captureGeo";

type ChecklistMode = "bloqueado" | "legado" | "detalhado-create" | "detalhado-edit";


const CHECKLIST_FIELDS: {
  key: keyof Pick<
    ApontamentoInspecao,
    | "nivel_oleo"
    | "nivel_agua"
    | "nivel_combustivel"
    | "pressao_pneus"
    | "estado_pneus"
    | "luzes_funcionamento"
    | "freios_funcionamento"
    | "direcao_funcionamento"
    | "equipamentos_seguranca"
    | "limpeza_veiculo"
  >;
  label: string;
}[] = [
  { key: "nivel_oleo", label: "Nível de Óleo" },
  { key: "nivel_agua", label: "Nível de Água" },
  { key: "nivel_combustivel", label: "Nível de Combustível" },
  { key: "pressao_pneus", label: "Pressão dos Pneus" },
  { key: "estado_pneus", label: "Estado dos Pneus" },
  { key: "luzes_funcionamento", label: "Luzes" },
  { key: "freios_funcionamento", label: "Freios" },
  { key: "direcao_funcionamento", label: "Direção" },
  { key: "equipamentos_seguranca", label: "Equipamentos de Segurança" },
  { key: "limpeza_veiculo", label: "Limpeza do Veículo" },
];

type ChecklistState = Record<(typeof CHECKLIST_FIELDS)[number]["key"], ChecklistValor | "">;

const emptyChecklist = (): ChecklistState =>
  CHECKLIST_FIELDS.reduce(
    (acc, f) => ({ ...acc, [f.key]: "" }),
    {} as ChecklistState
  );

interface FotoExistente {
  path: string;
  url: string | null;
  loading: boolean;
}

interface FotoNova {
  file: File;
  previewUrl: string;
  localId: string;
}

interface ApontamentoCaminhoesFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: FormSubmitPayload) => Promise<void>;
  currentApontamento: {
    apontamento: ApontamentoCaminhao | null;
    inspecao: ApontamentoInspecao | null;
  };
  veiculosOptions: VeiculoDropdownItem[];
  operadoresOptions?: { id: string; label: string }[];
  centrosCustoOptions: { id: string; label: string; searchText?: string }[];
  isLoading: boolean;
  currentUser: any;
  getUltimoHorimetro: (caminhaoId: string) => Promise<number | null>;
}

/** Uploader compacto de fotos gerais (modo legado). */
const FotosGeraisLegado: React.FC<{
  fotosExistentes: FotoExistente[];
  fotosNovas: FotoNova[];
  disabled?: boolean;
  onAddFiles: (files: File[]) => void;
  onRemoveNova: (localId: string) => void;
  onRemoveExistente: (path: string) => void;
}> = ({
  fotosExistentes,
  fotosNovas,
  disabled,
  onAddFiles,
  onRemoveNova,
  onRemoveExistente,
}) => {
  const inputId = "checklist-legado-fotos-gerais";
  return (
    <div className="space-y-2 mt-4">
      <Label>Fotos de avarias / evidências</Label>
      <div className="flex flex-wrap gap-2">
        {fotosExistentes.map((f) => (
          <div
            key={f.path}
            className="relative w-20 h-20 border rounded overflow-hidden bg-muted"
          >
            {f.url ? (
              <img src={f.url} alt="" className="object-cover w-full h-full" />
            ) : f.loading ? (
              <div className="w-full h-full animate-pulse" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground">
                Indisponível
              </div>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemoveExistente(f.path)}
                className="absolute top-0 right-0 bg-black/60 text-white rounded-bl px-1"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
        {fotosNovas.map((f) => (
          <div
            key={f.localId}
            className="relative w-20 h-20 border rounded overflow-hidden bg-muted"
          >
            <img src={f.previewUrl} alt="" className="object-cover w-full h-full" />
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemoveNova(f.localId)}
                className="absolute top-0 right-0 bg-black/60 text-white rounded-bl px-1"
                aria-label="Remover foto"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}
      </div>
      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          if (!e.target.files || e.target.files.length === 0) return;
          onAddFiles(Array.from(e.target.files));
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled}
        onClick={() => document.getElementById(inputId)?.click()}
      >
        <Camera className="h-4 w-4 mr-1" />
        Adicionar foto
      </Button>
    </div>
  );
};


const ApontamentoCaminhoesForm: React.FC<ApontamentoCaminhoesFormProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentApontamento,
  veiculosOptions,
  centrosCustoOptions,
  isLoading,
  currentUser,
  getUltimoHorimetro,
}) => {
  const [activeTab, setActiveTab] = useState("dados");
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());



  const [cabecalho, setCabecalho] = useState<Partial<CabecalhoApontamentoPayload>>({});
  const [checklist, setChecklist] = useState<ChecklistState>(emptyChecklist());
  const [avarias, setAvarias] = useState<string>("");
  const [observacoes, setObservacoes] = useState<string>("");
  const [fotosExistentes, setFotosExistentes] = useState<FotoExistente[]>([]);
  const [pathsRemovidos, setPathsRemovidos] = useState<string[]>([]);
  const [fotosNovas, setFotosNovas] = useState<FotoNova[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // R3 — estado do checklist detalhado
  const [detalhadoState, setDetalhadoState] = useState<ChecklistDetalhadoState | null>(null);
  const [detalhadoTemplate, setDetalhadoTemplate] = useState<ChecklistCeTemplateCodigo | null>(null);
  const [detalhadoVersao, setDetalhadoVersao] = useState<number>(1);
  const [detalhadoRemovidos, setDetalhadoRemovidos] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);
  const [pendingVeiculoChange, setPendingVeiculoChange] = useState<string | null>(null);

  // L1..L9 — Localização GPS
  type GeoStatus = "idle" | "capturing" | "captured" | "error";
  const [geoStatus, setGeoStatus] = useState<GeoStatus>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);
  const capturedGeoRef = useRef<LocalizacaoApontamentoPayload | null>(null);
  const [capturedGeoDisplay, setCapturedGeoDisplay] =
    useState<LocalizacaoApontamentoPayload | null>(null);
  const [existingGeo, setExistingGeo] = useState<LocalizacaoApontamentoRow | null>(null);
  const [existingGeoLoading, setExistingGeoLoading] = useState(false);

  const isEditing = !!currentApontamento.apontamento?.id;
  const isHistoricalEdit = useMemo(() => {
    if (!isEditing) return false;
    const d = currentApontamento.apontamento?.data;
    if (!d) return false;
    const today = format(new Date(), "yyyy-MM-dd");
    return String(d) < today;
  }, [isEditing, currentApontamento.apontamento?.data]);

  // UUID estável do draft
  const draftIdRef = useRef<string | null>(null);
  const detalhadoTemplateRef = useRef<ChecklistCeTemplateCodigo | null>(null);
  const initialObservacoesGeraisRef = useRef<string | null>(null);
  const avariaPreloadedRef = useRef<boolean>(false);
  // Guard composto ${modo}:${templateCodigo}:${ativoId} — evita
  // reinicializar OK em: troca de aba, rerender, edição de item,
  // upload de foto, retentativa. Reseta em: modal fechado, novo
  // CREATE, troca de ativo confirmada, submit concluído.
  const initGuardRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      draftIdRef.current = null;
      detalhadoTemplateRef.current = null;
      initGuardRef.current = null;
      capturedGeoRef.current = null;
      setCapturedGeoDisplay(null);
      setGeoStatus("idle");
      setGeoError(null);
      setExistingGeo(null);
      return;
    }
    if (isEditing && currentApontamento.apontamento?.id) {
      draftIdRef.current = currentApontamento.apontamento.id;
    } else if (!draftIdRef.current) {
      draftIdRef.current =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }
  }, [isOpen, isEditing, currentApontamento.apontamento?.id]);

  // L1..L9 — carregar localização existente em EDIT (não reenviada; só exibida)
  useEffect(() => {
    if (!isOpen || !isEditing) return;
    const id = currentApontamento.apontamento?.id;
    if (!id) return;
    let cancel = false;
    setExistingGeoLoading(true);
    fetchLocalizacaoByApontamento(id)
      .then((row) => {
        if (!cancel) setExistingGeo(row);
      })
      .finally(() => {
        if (!cancel) setExistingGeoLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [isOpen, isEditing, currentApontamento.apontamento?.id]);

  const doCaptureGeo = async (): Promise<LocalizacaoApontamentoPayload | null> => {
    setGeoStatus("capturing");
    setGeoError(null);
    const res = await captureGeo({
      highAccuracy: true,
      timeoutMs: 15000,
      maximumAge: 30000,
    });
    if (!res.ok || !res.data) {
      setGeoStatus("error");
      setGeoError(res.error || "Não foi possível obter a localização.");
      capturedGeoRef.current = null;
      setCapturedGeoDisplay(null);
      return null;
    }
    const loc: LocalizacaoApontamentoPayload = {
      latitude: res.data.latitude,
      longitude: res.data.longitude,
      precisao_metros:
        typeof res.data.accuracy === "number" ? res.data.accuracy : null,
      capturado_em: res.data.capturedAt,
    };
    capturedGeoRef.current = loc;
    setCapturedGeoDisplay(loc);
    setGeoStatus("captured");
    return loc;
  };

  useEffect(() => {
    if (!isOpen) return;

    if (isEditing && currentApontamento.apontamento) {
      const ap = currentApontamento.apontamento;
      const insp = currentApontamento.inspecao;
      const mappedSituacao = ap.situacao ? mapSituacaoFromDatabase(ap.situacao) : "";
      setCabecalho({
        caminhao_equipamento_id: ap.caminhao_equipamento_id || undefined,
        operador_id: ap.operador_id || undefined,
        centro_custo_id: ap.centro_custo_id || undefined,
        data: ap.data,
        hora_inicial: ap.hora_inicial,
        hora_final: ap.hora_final,
        horimetro_inicial: ap.horimetro_inicial,
        horimetro_final: ap.horimetro_final,
        situacao: mappedSituacao,
        abastecimento: ap.abastecimento,
      });
      if (ap.data) setDate(new Date(ap.data));

      // Hidratação: detalhado vs legado
      const respostas = (insp as any)?.checklist_respostas;
      const codigoSalvo = (insp as any)?.checklist_codigo as string | undefined;
      const versaoSalva = Number((insp as any)?.checklist_versao || 1);
      if (respostas && codigoSalvo && CHECKLIST_CE_TEMPLATES[codigoSalvo as ChecklistCeTemplateCodigo]) {
        // Detalhado
        const tpl = CHECKLIST_CE_TEMPLATES[codigoSalvo as ChecklistCeTemplateCodigo];
        const st: ChecklistDetalhadoState = {};
        tpl.grupos.forEach((g) =>
          g.itens.forEach((i) => {
            st[i.codigo] = { observacao: "", fotosSalvas: [], fotosNovas: [] };
          })
        );
        const grupos = (respostas as any)?.grupos || [];
        for (const g of grupos) {
          for (const it of g?.itens || []) {
            const cod = String(it?.codigo || "");
            if (!st[cod]) continue;
            st[cod] = {
              status: it?.status || undefined,
              observacao: it?.observacao || "",
              fotosSalvas: Array.isArray(it?.fotos) ? [...it.fotos] : [],
              fotosNovas: [],
            };
          }
        }
        setDetalhadoState(st);
        setDetalhadoTemplate(codigoSalvo as ChecklistCeTemplateCodigo);
        setDetalhadoVersao(versaoSalva);
        setObservacoes((respostas as any)?.observacoes_gerais || insp?.observacoes_gerais || "");
        setDetalhadoRemovidos([]);
        // limpa legado
        setChecklist(emptyChecklist());
        setAvarias("");
        setFotosExistentes([]);
        setPathsRemovidos([]);
        setFotosNovas([]);
      } else {
        // Legado
        setDetalhadoState(null);
        setDetalhadoTemplate(null);
        setDetalhadoRemovidos([]);
        const nextChecklist = emptyChecklist();
        if (insp) {
          CHECKLIST_FIELDS.forEach((f) => {
            const v = (insp as any)[f.key];
            if (v === "OK" || v === "NAO_OK" || v === "NA") nextChecklist[f.key] = v;
          });
        }
        setChecklist(nextChecklist);
        const avariaTxt = insp?.avarias_observadas || "";
        const obsGeraisTxt = insp?.observacoes_gerais || "";
        setAvarias(avariaTxt);
        initialObservacoesGeraisRef.current = obsGeraisTxt || null;
        if (!obsGeraisTxt && avariaTxt) {
          setObservacoes(avariaTxt);
          avariaPreloadedRef.current = true;
        } else {
          setObservacoes(obsGeraisTxt);
          avariaPreloadedRef.current = false;
        }
        const paths = (insp?.fotos_inspecao as string[] | null) || [];
        setFotosExistentes(paths.map((p) => ({ path: p, url: null, loading: true })));
        setPathsRemovidos([]);
        setFotosNovas([]);
      }
    } else {
      const now = new Date();
      setCabecalho({
        data: format(now, "yyyy-MM-dd"),
        operador_id: currentUser?.funcionario_id || undefined,
        hora_inicial: format(now, "HH:mm"),
        hora_final: null,
        horimetro_inicial: null,
        horimetro_final: null,
        situacao: "",
        abastecimento: null,
        caminhao_equipamento_id: undefined,
        centro_custo_id: undefined,
      });
      setDate(now);
      setChecklist(novoEstadoLegadoOK() as ChecklistState);
      setAvarias("");
      setObservacoes("");
      initialObservacoesGeraisRef.current = null;
      avariaPreloadedRef.current = false;
      setFotosExistentes([]);
      setPathsRemovidos([]);
      setFotosNovas([]);
      setDetalhadoState(null);
      setDetalhadoTemplate(null);
      setDetalhadoRemovidos([]);
    }
    setActiveTab("dados");
    setValidationError(null);
    setShowValidation(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isEditing, currentApontamento.apontamento?.id]);

  useEffect(() => {
    let cancel = false;
    (async () => {
      const toLoad = fotosExistentes.filter((f) => f.loading);
      if (toLoad.length === 0) return;
      const urls = await Promise.all(toLoad.map((f) => getSignedFotoUrl(f.path)));
      if (cancel) return;
      setFotosExistentes((prev) =>
        prev.map((f) => {
          if (!f.loading) return f;
          const idx = toLoad.findIndex((x) => x.path === f.path);
          return { ...f, url: urls[idx] ?? null, loading: false };
        })
      );
    })();
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fotosExistentes.length]);

  useEffect(() => {
    return () => {
      fotosNovas.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setCab = (patch: Partial<CabecalhoApontamentoPayload>) =>
    setCabecalho((p) => ({ ...p, ...patch }));

  const hasDetalhadoAnswers = useMemo(() => {
    if (!detalhadoState) return false;
    return Object.values(detalhadoState).some((i) => !!i.status);
  }, [detalhadoState]);

  const applyVeiculoChange = (value: string) => {
    setCab({ caminhao_equipamento_id: value });
    fetchUltimoHorimetro(value);
    // Template resolvido por useMemo/useEffect abaixo (CREATE).
  };

  const handleSelectVeiculo = (value: string) => {
    if (!isEditing && hasDetalhadoAnswers && value !== cabecalho.caminhao_equipamento_id) {
      setPendingVeiculoChange(value);
      return;
    }
    applyVeiculoChange(value);
  };
  const confirmVeiculoChange = () => {
    if (pendingVeiculoChange) applyVeiculoChange(pendingVeiculoChange);
    setPendingVeiculoChange(null);
  };
  const cancelVeiculoChange = () => setPendingVeiculoChange(null);


  const fetchUltimoHorimetro = async (caminhaoId: string) => {
    if (!caminhaoId) return;
    try {
      const h = await getUltimoHorimetro(caminhaoId);
      if (h !== null) setCab({ horimetro_inicial: h });
    } catch {
      // silencioso
    }
  };

  const handleChecklist = (
    key: (typeof CHECKLIST_FIELDS)[number]["key"],
    value: ChecklistValor
  ) => {
    setChecklist((p) => ({ ...p, [key]: value }));
  };

  // Uploads de fotos legadas foram removidos com o novo layout agrupado.
  // fotosExistentes continua sendo enviado no payload para preservar o
  // histórico do registro; nada é adicionado ou removido pela UI atual.

  const badgeStatus = useMemo<"conforme" | "nao_conforme" | "incompleta">(() => {
    const respostas = CHECKLIST_FIELDS.map((f) => checklist[f.key]);
    if (respostas.some((r) => r === "")) return "incompleta";
    if (respostas.some((r) => r === "NAO_OK")) return "nao_conforme";
    return "conforme";
  }, [checklist]);

  const veiculoSelecionado = useMemo(
    () => veiculosOptions.find((item) => item.id === cabecalho.caminhao_equipamento_id),
    [veiculosOptions, cabecalho.caminhao_equipamento_id]
  );
  const isVeiculo = useMemo(
    () => veiculoSelecionado?.categoria_ativo_id === CATEGORIA_IDS.VEICULO,
    [veiculoSelecionado]
  );
  const medidorInicialLabel = isVeiculo ? "KM Inicial" : "Horímetro Inicial";
  const medidorFinalLabel = isVeiculo ? "KM Final" : "Horímetro Final";

  const veiculoComboOptions: ComboboxOption[] = useMemo(
    () =>
      veiculosOptions.map((v) => ({
        value: v.id,
        label: v.label,
        searchText: v.searchText,
      })),
    [veiculosOptions]
  );

  const ccComboOptions: ComboboxOption[] = useMemo(
    () =>
      centrosCustoOptions.map((c) => ({
        value: c.id,
        label: c.label,
        searchText: c.searchText ?? c.label,
      })),
    [centrosCustoOptions]
  );

  // ---- R3: derivação explícita do modo do checklist ----
  const templateCreateResolved = useMemo(
    () =>
      !isEditing
        ? resolveTemplateCE(veiculoSelecionado?.subcategoria_ativo_id ?? null)
        : null,
    [isEditing, veiculoSelecionado?.subcategoria_ativo_id]
  );
  const templateCreateCodigo = templateCreateResolved?.codigo ?? null;

  const dadosFaltantes = useMemo<string[]>(() => {
    const arr: string[] = [];
    if (!cabecalho.caminhao_equipamento_id) arr.push("Caminhão/Equipamento");
    if (!cabecalho.centro_custo_id) arr.push("Centro de Custo");
    if (!(date || cabecalho.data)) arr.push("Data");
    if (!cabecalho.operador_id) arr.push("Operador");
    const med = cabecalho.horimetro_inicial;
    if (med === null || med === undefined || (typeof med === "number" && Number.isNaN(med))) {
      arr.push(isVeiculo ? "KM Inicial" : "Horímetro Inicial");
    }
    return arr;
  }, [
    cabecalho.caminhao_equipamento_id,
    cabecalho.centro_custo_id,
    cabecalho.data,
    cabecalho.operador_id,
    cabecalho.horimetro_inicial,
    date,
    isVeiculo,
  ]);

  const checklistMode = useMemo<ChecklistMode>(() => {
    if (isEditing) {
      const respostas = (currentApontamento.inspecao as any)?.checklist_respostas;
      const cod = (currentApontamento.inspecao as any)?.checklist_codigo as
        | string
        | undefined;
      if (
        respostas &&
        cod &&
        CHECKLIST_CE_TEMPLATES[cod as ChecklistCeTemplateCodigo]
      ) {
        return "detalhado-edit";
      }
      return "legado";
    }
    if (dadosFaltantes.length > 0) return "bloqueado";
    return templateCreateCodigo ? "detalhado-create" : "legado";
  }, [isEditing, currentApontamento.inspecao, dadosFaltantes, templateCreateCodigo]);

  // Seed do estado detalhado em CREATE quando o guard composto muda.
  // A chave inclui o ativoId, portanto uma troca de ativo confirmada
  // (que aplica novo caminhao_equipamento_id) força novo template OK.
  useEffect(() => {
    if (isEditing) return;
    const ativoId = cabecalho.caminhao_equipamento_id || "";
    if (templateCreateCodigo && templateCreateResolved && ativoId) {
      const guard = `create:${templateCreateCodigo}:${ativoId}`;
      if (initGuardRef.current === guard && detalhadoTemplateRef.current === templateCreateCodigo) {
        // Mesmo guard — preservar draft (troca de aba, rerender, foto, obs).
        return;
      }
      initGuardRef.current = guard;
      detalhadoTemplateRef.current = templateCreateCodigo;
      setDetalhadoTemplate(templateCreateCodigo);
      setDetalhadoVersao(templateCreateResolved.versao);
      setDetalhadoState(novoEstadoDetalhadoOK(templateCreateCodigo));
      setDetalhadoRemovidos([]);
    } else {
      initGuardRef.current = null;
      detalhadoTemplateRef.current = null;
      setDetalhadoTemplate(null);
      setDetalhadoState(null);
      setDetalhadoRemovidos([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, templateCreateCodigo, cabecalho.caminhao_equipamento_id]);




  const validarCabecalho = (): string | null => {
    const dataStr = date ? format(date, "yyyy-MM-dd") : cabecalho.data;
    if (!cabecalho.caminhao_equipamento_id) return "Selecione o Caminhão/Equipamento.";
    if (!cabecalho.operador_id) return "Operador não identificado.";
    if (!cabecalho.centro_custo_id) return "Selecione o Centro de Custo.";
    if (!dataStr) return "Selecione a data.";
    if (!cabecalho.situacao) return "Selecione a Situação.";
    return null;
  };

  const validarChecklist = (): string | null => {
    if (badgeStatus === "incompleta") return "Complete todos os itens do checklist.";
    if (badgeStatus === "nao_conforme" && !avarias.trim() && !observacoes.trim())
      return "Há itens Não conformes. Preencha Avarias observadas ou Observações gerais.";
    return null;
  };

  const onChangeDetalhadoItem = (
    codigo: string,
    patch: Partial<{
      status: ChecklistValor;
      observacao: string;
      fotosSalvas: string[];
      fotosNovas: { localId: string; file: File; previewUrl: string }[];
    }>
  ) => {
    setDetalhadoState((prev) => {
      if (!prev) return prev;
      const curr = prev[codigo] || { observacao: "", fotosSalvas: [], fotosNovas: [] };
      if (patch.fotosSalvas) {
        const removidas = curr.fotosSalvas.filter((p) => !patch.fotosSalvas!.includes(p));
        if (removidas.length > 0) {
          setDetalhadoRemovidos((r) => Array.from(new Set([...r, ...removidas])));
        }
      }
      return { ...prev, [codigo]: { ...curr, ...patch } };
    });
  };

  const validarDetalhado = (): string | null => {
    if (!detalhadoTemplate || !detalhadoState) return null;
    const tpl = CHECKLIST_CE_TEMPLATES[detalhadoTemplate];
    const itens = tpl.grupos.flatMap((g) => g.itens);
    for (const i of itens.filter((x) => x.obrigatorio)) {
      const s = detalhadoState[i.codigo];
      if (!s?.status) return "Complete todos os itens obrigatórios do checklist.";
    }
    for (const i of itens) {
      const s = detalhadoState[i.codigo];
      if (!s) continue;
      if (s.status === "NAO_OK" && !s.observacao.trim())
        return `Descreva a observação para o item "${i.descricao}".`;
      if (
        s.status === "NAO_OK" &&
        i.exigeFotoNaoOk &&
        s.fotosSalvas.length + s.fotosNovas.length === 0
      )
        return `Anexe ao menos uma foto para o item "${i.descricao}".`;
    }
    return null;
  };

  const handleAvancarChecklist = () => {
    if (dadosFaltantes.length > 0) {
      setShowValidation(true);
      setValidationError(
        `Complete os Dados Operacionais: ${dadosFaltantes.join(", ")}.`
      );
      setActiveTab("dados");
      return;
    }
    setValidationError(null);
    setActiveTab("checklist");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setShowValidation(true);

    if (checklistMode === "bloqueado") {
      setValidationError(
        `Complete os Dados Operacionais: ${dadosFaltantes.join(", ")}.`
      );
      setActiveTab("dados");
      return;
    }

    const errHead = validarCabecalho();
    if (errHead) {
      setValidationError(errHead);
      setActiveTab("dados");
      return;
    }
    const isDetalhado =
      checklistMode === "detalhado-create" || checklistMode === "detalhado-edit";
    const errChecklist = isDetalhado ? validarDetalhado() : validarChecklist();
    if (errChecklist) {
      setValidationError(errChecklist);
      setActiveTab("checklist");
      return;
    }

    const apontamentoId = draftIdRef.current;
    if (!apontamentoId) {
      setValidationError("Não foi possível gerar o identificador do apontamento.");
      return;
    }


    // L1..L9 — CREATE exige GPS. Retry preserva captura.
    // EDIT com localização existente NÃO envia o bloco.
    // EDIT sem localização: usuário precisa clicar "Capturar localização".
    let localizacaoParaEnviar: LocalizacaoApontamentoPayload | null = null;
    if (!isEditing) {
      let loc = capturedGeoRef.current;
      if (!loc) {
        loc = await doCaptureGeo();
      }
      if (!loc) {
        setValidationError(
          "Não foi possível obter a localização (GPS). Ative o GPS e tente novamente."
        );
        setActiveTab("checklist");
        return;
      }
      localizacaoParaEnviar = loc;
    } else if (capturedGeoRef.current) {
      // EDIT com captura explícita solicitada pelo usuário.
      localizacaoParaEnviar = capturedGeoRef.current;
    }

    const dataStr = date ? format(date, "yyyy-MM-dd") : (cabecalho.data as string);
    const situacaoDb =
      mapSituacaoToDatabase(cabecalho.situacao as string) || (cabecalho.situacao as string);

    const cabecalhoPayload: CabecalhoApontamentoPayload = {
      caminhao_equipamento_id: cabecalho.caminhao_equipamento_id as string,
      operador_id: cabecalho.operador_id as string,
      centro_custo_id: cabecalho.centro_custo_id as string,
      data: dataStr as string,
      hora_inicial: cabecalho.hora_inicial ?? null,
      hora_final: cabecalho.hora_final ?? null,
      horimetro_inicial:
        cabecalho.horimetro_inicial === undefined ? null : cabecalho.horimetro_inicial,
      horimetro_final:
        cabecalho.horimetro_final === undefined ? null : cabecalho.horimetro_final,
      situacao: situacaoDb as string,
      abastecimento: cabecalho.abastecimento === undefined ? null : cabecalho.abastecimento,
      ...(localizacaoParaEnviar ? { localizacao: localizacaoParaEnviar } : {}),
    };

    const inspecaoPayload = {
      nivel_oleo: checklist.nivel_oleo as ChecklistValor,
      nivel_agua: checklist.nivel_agua as ChecklistValor,
      nivel_combustivel: checklist.nivel_combustivel as ChecklistValor,
      pressao_pneus: checklist.pressao_pneus as ChecklistValor,
      estado_pneus: checklist.estado_pneus as ChecklistValor,
      luzes_funcionamento: checklist.luzes_funcionamento as ChecklistValor,
      freios_funcionamento: checklist.freios_funcionamento as ChecklistValor,
      direcao_funcionamento: checklist.direcao_funcionamento as ChecklistValor,
      equipamentos_seguranca: checklist.equipamentos_seguranca as ChecklistValor,
      limpeza_veiculo: checklist.limpeza_veiculo as ChecklistValor,
      avarias_observadas: avarias.trim() || null,
      observacoes_gerais: (() => {
        const obsTxt = observacoes.trim();
        const avTxt = (avarias || "").trim();
        // EDIT legado: se o campo único foi pré-carregado a partir de
        // avarias_observadas (observacoes_gerais originalmente vazia) e o
        // usuário não editou, não duplicar no banco.
        if (
          isEditing &&
          !initialObservacoesGeraisRef.current &&
          avariaPreloadedRef.current &&
          obsTxt === avTxt
        ) {
          return null;
        }
        return obsTxt || null;
      })(),
      fotos_inspecao: [],
    };

    let detalhado: DetalhadoSubmit | undefined;
    if (isDetalhado && detalhadoTemplate && detalhadoState) {
      const tpl = CHECKLIST_CE_TEMPLATES[detalhadoTemplate];
      const itensSubmit = tpl.grupos.flatMap((g) =>
        g.itens.map((i) => {
          const s = detalhadoState[i.codigo];
          return {
            item_codigo: i.codigo,
            status: (s?.status || "NA") as ChecklistValor,
            observacao: s?.observacao?.trim() || null,
            fotosSalvas: s?.fotosSalvas || [],
            fotosNovas: (s?.fotosNovas || []).map((f) => f.file),
            fotosRemovidas: [],
          };
        })
      );
      detalhado = {
        template_codigo: detalhadoTemplate,
        template_versao: detalhadoVersao,
        observacoes_gerais: observacoes.trim() || null,
        itens: itensSubmit.filter((i) => detalhadoState[i.item_codigo]?.status),
      };
      if (detalhadoRemovidos.length > 0 && detalhado.itens.length > 0) {
        detalhado.itens[0].fotosRemovidas = [...detalhadoRemovidos];
      }
    }

    const payload: FormSubmitPayload = {
      apontamentoId,
      cabecalho: cabecalhoPayload,
      inspecao: inspecaoPayload,
      arquivosNovos: isDetalhado ? [] : fotosNovas.map((f) => f.file),
      pathsMantidos: isDetalhado ? [] : fotosExistentes.map((f) => f.path),
      pathsRemovidos: isDetalhado ? [] : pathsRemovidos,
      detalhado,
    };

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      fotosNovas.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      if (detalhadoState) {
        Object.values(detalhadoState).forEach((it) =>
          it.fotosNovas.forEach((f) => URL.revokeObjectURL(f.previewUrl))
        );
      }
    } catch {
      // hooks já tratam
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasDraftChanges =
    !isEditing &&
    (Boolean(cabecalho.caminhao_equipamento_id) ||
      Boolean(cabecalho.centro_custo_id) ||
      CHECKLIST_FIELDS.some((f) => checklist[f.key] !== "") ||
      fotosNovas.length > 0 ||
      pathsRemovidos.length > 0);

  const handleDialogClose = () => {
    if (isSubmitting) return;
    if (hasDraftChanges) {
      setShowCancelDialog(true);
    } else {
      onClose();
    }
  };
  const handleConfirmCancel = () => {
    fotosNovas.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setShowCancelDialog(false);
    onClose();
  };




  const getCurrentOperatorName = () =>
    currentUser?.nome_completo || currentUser?.email || "Não identificado";

  return (
    <>
      <Dialog
        open={isOpen}
        onOpenChange={(o) => {
          if (!o) handleDialogClose();
        }}
      >
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Editar Apontamento" : "Novo Apontamento"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Edite as informações do apontamento de caminhão/equipamento."
                : "Registre um novo apontamento de caminhões e equipamentos."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <Tabs
              value={activeTab}
              onValueChange={(v) => {
                if (v === "checklist" && checklistMode === "bloqueado") {
                  setShowValidation(true);
                  setValidationError(
                    `Complete os Dados Operacionais: ${dadosFaltantes.join(", ")}.`
                  );
                  setActiveTab("dados");
                  return;
                }
                setActiveTab(v);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="dados">Dados Operacionais</TabsTrigger>
                <TabsTrigger
                  value="checklist"
                  disabled={checklistMode === "bloqueado"}
                >
                  Checklist
                  {checklistMode === "detalhado-create" ||
                  checklistMode === "detalhado-edit" ? (
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-primary/10 text-primary"
                    >
                      Detalhado
                    </Badge>
                  ) : checklistMode === "legado" ? (
                    <Badge
                      variant="outline"
                      className="ml-2"
                      title={
                        isEditing
                          ? "Registro histórico no formato legado."
                          : "Esta subcategoria ainda não possui um modelo específico."
                      }
                    >
                      {isEditing ? "Legado" : "Genérico"}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {date ? format(date, "dd/MM/yyyy") : <span>Selecione uma data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Operador</Label>
                    <div className="flex items-center p-3 bg-muted rounded-md">
                      <span className="text-sm">{getCurrentOperatorName()}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isEditing
                        ? "Operador preservado do registro original"
                        : "Operador definido como o usuário logado"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Caminhão/Equipamento *</Label>
                    <Combobox
                      options={veiculoComboOptions}
                      value={cabecalho.caminhao_equipamento_id || ""}
                      onChange={handleSelectVeiculo}
                      placeholder="Selecione o veículo/equipamento"
                      searchPlaceholder="Buscar por frota, placa ou equipamento..."
                      emptyText="Nenhum veículo ou equipamento encontrado"
                      disabled={isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Centro de Custo *</Label>
                    <Combobox
                      options={ccComboOptions}
                      value={cabecalho.centro_custo_id || ""}
                      onChange={(v) => setCab({ centro_custo_id: v })}
                      placeholder="Selecione o centro de custo"
                      searchPlaceholder="Buscar por código ou nome..."
                      emptyText="Nenhum centro de custo encontrado"
                    />
                  </div>


                  <div className="space-y-2">
                    <Label>{medidorInicialLabel}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cabecalho.horimetro_inicial ?? ""}
                      onChange={(e) =>
                        setCab({
                          horimetro_inicial:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                      disabled={isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{medidorFinalLabel}</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cabecalho.horimetro_final ?? ""}
                      onChange={(e) =>
                        setCab({
                          horimetro_final:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora Inicial</Label>
                    <Input
                      type="time"
                      value={cabecalho.hora_inicial || ""}
                      onChange={(e) => setCab({ hora_inicial: e.target.value })}
                      disabled={isEditing}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora Final</Label>
                    <Input
                      type="time"
                      value={cabecalho.hora_final || ""}
                      onChange={(e) => setCab({ hora_final: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Situação *</Label>
                    <Select
                      value={cabecalho.situacao || ""}
                      onValueChange={(v) => setCab({ situacao: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a situação" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Operando">Operando</SelectItem>
                        <SelectItem value="Em Manutenção">Em Manutenção</SelectItem>
                        <SelectItem value="Parado">Parado</SelectItem>
                        <SelectItem value="Intempérie">Intempérie</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Abastecimento (litros)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={cabecalho.abastecimento ?? ""}
                      onChange={(e) =>
                        setCab({
                          abastecimento:
                            e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div className="flex justify-between mt-8">
                  <Button type="button" variant="outline" onClick={handleDialogClose}>
                    Cancelar
                  </Button>
                  <Button type="button" onClick={handleAvancarChecklist}>
                    Próximo <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="checklist" className="space-y-4 mt-4">
                {checklistMode === "bloqueado" ? (
                  <div className="border rounded-md p-6 bg-muted/40 flex flex-col items-start gap-3">
                    <div className="flex items-center gap-2 text-amber-700">
                      <AlertTriangle className="h-5 w-5" />
                      <span className="font-semibold">Complete os Dados Operacionais</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Para abrir o checklist, preencha os campos abaixo na aba anterior:
                    </p>
                    <ul className="list-disc pl-5 text-sm">
                      {dadosFaltantes.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                    <Button type="button" onClick={() => setActiveTab("dados")}>
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Voltar para Dados Operacionais
                    </Button>
                  </div>
                ) : (
                  <>
                    <ChecklistEquipmentHeader
                      key={veiculoSelecionado?.id ?? "sem-veiculo"}
                      veiculo={veiculoSelecionado || null}
                      operadorNome={getCurrentOperatorName()}
                      data={date ? format(date, "yyyy-MM-dd") : cabecalho.data ?? null}
                      medidorLabel={medidorInicialLabel}
                      medidorValor={cabecalho.horimetro_inicial ?? null}
                      centroCustoLabel={
                        ccComboOptions.find((c) => c.value === cabecalho.centro_custo_id)
                          ?.label || null
                      }
                    />

                    {(checklistMode === "detalhado-create" ||
                      checklistMode === "detalhado-edit") &&
                    detalhadoTemplate &&
                    detalhadoState ? (
                      <>
                        <ChecklistDinamico
                          templateCodigo={detalhadoTemplate}
                          state={detalhadoState}
                          onChangeItem={(codigo, patch) =>
                            onChangeDetalhadoItem(codigo, patch as any)
                          }
                          showValidation={showValidation}
                          showInitialHint={!isEditing}
                          disabled={isSubmitting}
                        />
                        <div className="space-y-2 mt-4">
                          <Label>Observações gerais</Label>
                          <Textarea
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            placeholder="Observações consolidadas do checklist"
                            rows={3}
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <ChecklistLegadoAgrupado
                          values={checklist}
                          onChange={(k, v) => handleChecklist(k, v)}
                          showValidation={showValidation}
                          showInitialHint={!isEditing}
                          disabled={isSubmitting}
                        />
                        <div className="space-y-2 mt-4">
                          <Label>Observações gerais</Label>
                          <Textarea
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            placeholder="Descreva observações, avarias ou notas do checklist"
                            rows={3}
                          />
                        </div>
                        <FotosGeraisLegado
                          fotosExistentes={fotosExistentes}
                          fotosNovas={fotosNovas}
                          disabled={isSubmitting}
                          onAddFiles={(files) => {
                            const novas: FotoNova[] = files
                              .filter(
                                (f) =>
                                  ["image/jpeg", "image/png", "image/webp"].includes(
                                    f.type
                                  ) && f.size <= 5 * 1024 * 1024
                              )
                              .map((file) => ({
                                file,
                                previewUrl: URL.createObjectURL(file),
                                localId: `${Date.now()}-${Math.random()
                                  .toString(36)
                                  .slice(2)}`,
                              }));
                            setFotosNovas((prev) => [...prev, ...novas]);
                          }}
                          onRemoveNova={(localId) => {
                            setFotosNovas((prev) => {
                              const alvo = prev.find((x) => x.localId === localId);
                              if (alvo) URL.revokeObjectURL(alvo.previewUrl);
                              return prev.filter((x) => x.localId !== localId);
                            });
                          }}
                          onRemoveExistente={(path) => {
                            setFotosExistentes((prev) =>
                              prev.filter((f) => f.path !== path)
                            );
                            setPathsRemovidos((prev) =>
                              prev.includes(path) ? prev : [...prev, path]
                            );
                          }}
                        />
                      </>
                    )}
                  </>
                )}

                {/* L1..L9 — Bloco de status GPS */}
                <div className="mt-4 border rounded-md p-3 bg-muted/30">
                  {isEditing ? (
                    existingGeoLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Verificando localização deste apontamento…
                      </div>
                    ) : existingGeo ? (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPin className="h-4 w-4 mt-0.5 text-primary" />
                        <div className="flex-1">
                          <div className="font-medium">
                            Localização já registrada neste apontamento
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Capturada em{" "}
                            {format(
                              new Date(existingGeo.data_registro),
                              "dd/MM/yyyy HH:mm"
                            )}
                            {existingGeo.precisao_gps != null
                              ? ` · precisão aproximada: ${Math.round(
                                  Number(existingGeo.precisao_gps)
                                )} m`
                              : ""}
                          </div>
                        </div>
                      </div>
                    ) : isHistoricalEdit ? (
                      <div className="flex items-start gap-2 text-sm">
                        <MapPinOff className="h-4 w-4 mt-0.5 text-muted-foreground" />
                        <div className="text-muted-foreground">
                          Este apontamento não possui localização registrada. Não é
                          possível reconstruir retroativamente a posição original.
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPinOff className="h-4 w-4 mt-0.5" />
                          Este apontamento ainda não possui localização registrada.
                        </div>
                        {geoStatus === "captured" && capturedGeoDisplay ? (
                          <div className="text-xs text-emerald-700">
                            Localização capturada
                            {capturedGeoDisplay.precisao_metros != null
                              ? ` — precisão aproximada: ${Math.round(
                                  capturedGeoDisplay.precisao_metros
                                )} m`
                              : ""}
                            . Será registrada agora ao salvar.
                          </div>
                        ) : geoStatus === "error" ? (
                          <div className="text-xs text-destructive">
                            {geoError || "Não foi possível obter a localização."}
                          </div>
                        ) : null}
                        <div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={geoStatus === "capturing" || isSubmitting}
                            onClick={() => {
                              void doCaptureGeo();
                            }}
                          >
                            {geoStatus === "capturing" ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                Capturando…
                              </>
                            ) : (
                              <>
                                <MapPin className="h-4 w-4 mr-1" />
                                {geoStatus === "captured"
                                  ? "Capturar novamente"
                                  : "Capturar localização deste apontamento"}
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex flex-col gap-2">
                      {geoStatus === "idle" && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mt-0.5" />
                          A localização (GPS) será capturada no momento do salvamento.
                        </div>
                      )}
                      {geoStatus === "capturing" && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Capturando localização…
                        </div>
                      )}
                      {geoStatus === "captured" && capturedGeoDisplay && (
                        <div className="flex items-start gap-2 text-sm text-emerald-700">
                          <MapPin className="h-4 w-4 mt-0.5" />
                          <div>
                            Localização capturada
                            {capturedGeoDisplay.precisao_metros != null
                              ? ` — precisão aproximada: ${Math.round(
                                  capturedGeoDisplay.precisao_metros
                                )} m`
                              : ""}
                            .
                          </div>
                        </div>
                      )}
                      {geoStatus === "error" && (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-start gap-2 text-sm text-destructive">
                            <MapPinOff className="h-4 w-4 mt-0.5" />
                            <div>
                              {geoError ||
                                "Não foi possível obter a localização (GPS)."}
                            </div>
                          </div>
                          <div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isSubmitting}
                              onClick={() => {
                                void doCaptureGeo();
                              }}
                            >
                              <MapPin className="h-4 w-4 mr-1" />
                              Tentar novamente
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {validationError && (
                  <p className="text-sm text-destructive mt-2">{validationError}</p>
                )}

                <div className="flex justify-between mt-8">
                  <Button type="button" variant="outline" onClick={() => setActiveTab("dados")}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Voltar
                  </Button>
                  <div className="space-x-2">
                    <Button type="button" variant="outline" onClick={handleDialogClose}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={isSubmitting || isLoading}>
                      {isSubmitting ? "Salvando..." : "Salvar"}
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={showCancelDialog}
        onClose={() => setShowCancelDialog(false)}
        onConfirm={handleConfirmCancel}
        title="Cancelar Apontamento"
        description="Deseja realmente cancelar? Todas as alterações serão perdidas."
        confirmText="Sim, cancelar"
        cancelText="Voltar"
        variant="warning"
      />

      <ConfirmDialog
        isOpen={!!pendingVeiculoChange}
        onClose={cancelVeiculoChange}
        onConfirm={confirmVeiculoChange}
        title="Trocar Equipamento?"
        description="Ao trocar o equipamento o checklist atual será descartado. Deseja continuar?"
        confirmText="Sim, trocar"
        cancelText="Manter"
        variant="warning"
      />
    </>
  );
};

export default ApontamentoCaminhoesForm;
