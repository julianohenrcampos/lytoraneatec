import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Trash2,
  Pencil,
  AlertTriangle,
  Info,
  Lock,
  ImagePlus,
  X,
  Save,
  MapPin,
  Play,
  Camera,
  Plus,
  ChevronDown,
} from "lucide-react";

import { toast } from "sonner";
import { useCriarRegistroManual } from "@/hooks/registro-aplicacao/useCriarRegistroManual";
import {
  useCaminhoesParaAplicacao,
  useMotoristasParaAplicacao,
  useEquipesParaAplicacao,
} from "@/hooks/registro-aplicacao/useCadastrosManual";
import {
  useRegistroManualDrafts,
} from "@/hooks/registro-aplicacao/useRegistroManualDrafts";
import { getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import AddressAutocomplete, {
  type AddressResult,
} from "@/components/shared/AddressAutocomplete";
import { useIsMobile } from "@/hooks/use-mobile";
import { normalizeRuaKey, describeRua } from "@/utils/registroManual/ruaKey";
import { captureGeo, type GeoCapture } from "@/utils/registroManual/captureGeo";
import { useGeocoding } from "@/hooks/useGeocoding";
import { extrairLogradouro } from "@/utils/registroManual/parseLogradouro";
import { useCarregarRegistroManual } from "@/hooks/registro-aplicacao/useCarregarRegistroManual";
import { useExcluirRegistroManual } from "@/hooks/registro-aplicacao/useExcluirRegistroManual";
import {
  computeToneladasBuracosComResiduo,
  classificarEspessuraMedia,
  type BuracoRateioRef,
  type EspessuraClassificacao,
} from "@/utils/registroAplicacao/rateioTonelada";

// ============================================================================
// Helpers de exibição da espessura média (frontend-only)
// ============================================================================
function formatBR(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "-";
  return n.toFixed(digits).replace(".", ",");
}

const EspessuraBadge: React.FC<{ classificacao: EspessuraClassificacao }> = ({
  classificacao,
}) => {
  const cls =
    classificacao.tone === "success"
      ? "bg-emerald-600 text-white hover:bg-emerald-600"
      : classificacao.tone === "warning"
      ? "bg-amber-500 text-white hover:bg-amber-500"
      : classificacao.tone === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive"
      : "bg-muted text-muted-foreground";
  return (
    <Badge
      variant="outline"
      className={`text-xs shrink-0 border-transparent ${cls}`}
      title={classificacao.mensagem}
    >
      {classificacao.label}
    </Badge>
  );
};


const STEPS: { value: string; label: string }[] = [
  { value: "iniciais", label: "Dados Iniciais" },
  { value: "carga", label: "Carga" },
  { value: "apontamento", label: "Apontamento" },
  { value: "listaRuas", label: "Lista Ruas" },
  { value: "listaApontamentos", label: "Lista Apontamentos" },
  { value: "final", label: "Finalização" },
];

type Atividade = "tapa_buraco" | "pavimentacao_mecanizada" | "fresagem";
type EstadoInterno = "rascunho" | "em_andamento" | "finalizando";
type Bordo = "Direito" | "Esquerdo" | "Centro" | "Único" | "Embocadura";
type OrigemLoc = "digitado" | "geocode" | "mapa" | "manual" | "";

const BORDOS: Bordo[] = ["Direito", "Esquerdo", "Centro", "Único", "Embocadura"];
const TIPOS_TRACO = ["5A", "4C"] as const;
const TIPOS_PINTURA = ["Imprimação", "RR-1C"] as const;

const MAX_FOTOS_BURACO = 6;
const MAX_IMG_BYTES = 5 * 1024 * 1024;
const DENSIDADE_DEFAULT = 2.4;
const ESPESSURA_PADRAO_CM = 5;

const TIPOS_POR_ATIVIDADE: Record<Atividade, string[]> = {
  tapa_buraco: ["buraco"],
  pavimentacao_mecanizada: ["faixa", "trecho", "bordo", "embocadura"],
  fresagem: ["faixa", "trecho"],
};

const rotuloItem = (tipo_item: string, seq: number): string => {
  const nn = String(seq).padStart(2, "0");
  const t = (tipo_item || "").toLowerCase();
  switch (t) {
    case "buraco":
      return `Buraco ${nn}`;
    case "faixa":
      return `Faixa ${nn}`;
    case "trecho":
      return `Trecho ${nn}`;
    case "bordo":
      return `Bordo ${nn}`;
    case "embocadura":
      return `Embocadura ${nn}`;
    default:
      return `Item ${nn}`;
  }
};

const genLocalId = () =>
  `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

interface CentroCustoOpt {
  id: string;
  codigo_centro_custo?: string;
  nome_centro_custo?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  centrosCusto: CentroCustoOpt[];
  draftId?: string | null;
  editRegistroId?: string | null;
}

interface DadosIniciaisState {
  centroCustoId: string;
  atividade: Atividade;
  data: string;
  horaChegada: string;
  equipeId: string;
  condominio: "sim" | "nao" | "";
}

interface DadosCargaState {
  caminhaoId: string;
  frota: string;
  placa: string;
  motoristaId: string;
  totalCargaT: string;
  temperaturaMassa: string;
  tipoTraco: (typeof TIPOS_TRACO)[number] | "";
  tipoPintura: (typeof TIPOS_PINTURA)[number] | "";
}

interface BuracoLocal {
  idLocal: string;
  sequenciaAplicacao: number;
  sequenciaRua: number;
  bordo: Bordo | "";
  comprimento: string;
  larguraMedia: string;
  toneladaAplicada: string; // preenchido no rateio pós-finalização; livre pré
  espessura: string;
  temperaturaAplicacao: string;
  tipo_item: string;
  observacao: string;
  areaCalculada: number;
  gps: GeoCapture | null;
  fotos: File[]; // in-memory
  fotosCount: number; // persistido no draft
  fotosPaths?: string[]; // paths existentes no bucket (modo edição)
}

interface RuaLocal {
  idLocal: string;
  chaveNorm: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep?: string;
  latitude: number | null;
  longitude: number | null;
  accuracy?: number | null;
  capturedAt?: string | null;
  origemLocalizacao: OrigemLoc;
  iniciadaEm: string;
  buracos: BuracoLocal[];
}

interface RuaFormState {
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  capturedAt: string | null;
  origemLocalizacao: OrigemLoc;
}

interface BuracoFormState {
  bordo: Bordo | "";
  comprimento: string;
  larguraMedia: string;
  toneladaAplicada: string;
  espessura: string;
  lastEdited: "tonelada" | "espessura" | "";
  temperaturaAplicacao: string;
  tipo_item: string;
  observacao: string;
  fotos: File[];
}

const emptyIniciais = (): DadosIniciaisState => ({
  centroCustoId: "",
  atividade: "tapa_buraco",
  data: "",
  horaChegada: "",
  equipeId: "",
  condominio: "",
});

const emptyCarga = (): DadosCargaState => ({
  caminhaoId: "",
  frota: "",
  placa: "",
  motoristaId: "",
  totalCargaT: "",
  temperaturaMassa: "",
  tipoTraco: "",
  tipoPintura: "",
});

const emptyRuaForm = (): RuaFormState => ({
  logradouro: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  latitude: null,
  longitude: null,
  accuracy: null,
  capturedAt: null,
  origemLocalizacao: "",
});

const emptyBuracoForm = (tipo: string): BuracoFormState => ({
  bordo: "",
  comprimento: "",
  larguraMedia: "",
  toneladaAplicada: "",
  espessura: String(ESPESSURA_PADRAO_CM),
  lastEdited: "",
  temperaturaAplicacao: "",
  tipo_item: tipo,
  observacao: "",
  fotos: [],
});

const NovoRegistroManualModal: React.FC<Props> = ({
  open,
  onOpenChange,
  centrosCusto,
  draftId = null,
  editRegistroId = null,
}) => {
  const [tab, setTab] = useState<string>("iniciais");
  const [estado, setEstado] = useState<EstadoInterno>("rascunho");
  const [iniciaisOk, setIniciaisOk] = useState(false);
  const [ini, setIni] = useState<DadosIniciaisState>(emptyIniciais());
  const [carga, setCarga] = useState<DadosCargaState>(emptyCarga());

  const [ruas, setRuas] = useState<RuaLocal[]>([]);
  const [ruaAtualId, setRuaAtualId] = useState<string | null>(null);
  const [ruaForm, setRuaForm] = useState<RuaFormState>(emptyRuaForm());
  const [buracoForm, setBuracoForm] = useState<BuracoFormState>(emptyBuracoForm("buraco"));
  const [editBuracoRef, setEditBuracoRef] = useState<{ ruaId: string; buracoId: string } | null>(null);

  const [obsFinal, setObsFinal] = useState<string>("");
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
  const [capturandoGeo, setCapturandoGeo] = useState(false);
  const [ruaFormOpen, setRuaFormOpen] = useState(false);
  const [editingRuaId, setEditingRuaId] = useState<string | null>(null);
  const [buracoFormOpen, setBuracoFormOpen] = useState(false);
  const [calculoAberto, setCalculoAberto] = useState(false);
  // B.3.5-D.M2 — toggle para capturar (ou não) coordenadas do apontamento
  const [capturarGpsBuraco, setCapturarGpsBuraco] = useState<boolean>(true);

  // B.3.5-D — auto-preenchimento por geolocalização
  type AutoLocStatus = "idle" | "loading" | "ok" | "aproximado" | "erro";
  const [autoLoc, setAutoLoc] = useState<{ status: AutoLocStatus; message?: string }>({ status: "idle" });
  const { reverse: reverseGeocode } = useGeocoding();

  // Limpa banner de auto-preenchimento quando o form de rua fecha
  useEffect(() => {
    if (!ruaFormOpen) setAutoLoc({ status: "idle" });
  }, [ruaFormOpen]);

  const isMobile = useIsMobile();

  const stepIndex = Math.max(0, STEPS.findIndex((s) => s.value === tab));
  const currentStepLabel = STEPS[stepIndex]?.label ?? "";

  const caminhoesQ = useCaminhoesParaAplicacao(open);
  const motoristasQ = useMotoristasParaAplicacao(open);
  const equipesQ = useEquipesParaAplicacao(open);

  const { saveDraft, loadDraft, removeDraft } = useRegistroManualDrafts();

  const isEditMode = !!editRegistroId;
  const editableQ = useCarregarRegistroManual(open ? editRegistroId : null);
  const excluirManualMutation = useExcluirRegistroManual();
  const [hydratedEditId, setHydratedEditId] = useState<string | null>(null);

  const ccGeoQ = useQuery({
    queryKey: ["novo-registro-manual", "cc-geo", ini.centroCustoId],
    enabled: open && !!ini.centroCustoId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bd_centros_custo")
        .select(
          "id, latitude, longitude, endereco_cidade, endereco_estado, endereco_bairro, endereco_cep"
        )
        .eq("id", ini.centroCustoId)
        .maybeSingle();
      if (error) {
        console.error("[REGISTRO_APLICACAO_MANUAL][CC_GEO]", error);
        return null;
      }
      return data;
    },
  });

  const enderecoContext = useMemo(() => {
    const cc = ccGeoQ.data;
    const hasLat = cc && typeof cc.latitude === "number" && Number.isFinite(cc.latitude);
    const hasLng = cc && typeof cc.longitude === "number" && Number.isFinite(cc.longitude);
    const proximity: [number, number] | undefined =
      hasLat && hasLng ? [cc!.longitude as number, cc!.latitude as number] : undefined;
    const cidade = (ruaForm.cidade || cc?.endereco_cidade || "").trim() || undefined;
    const uf = (ruaForm.uf || cc?.endereco_estado || "").trim() || undefined;
    const bairro = (ruaForm.bairro || cc?.endereco_bairro || "").trim() || undefined;
    if (!proximity && !cidade && !uf && !bairro) return undefined;
    return { proximity, cidade, uf, bairro };
  }, [ccGeoQ.data, ruaForm.cidade, ruaForm.uf, ruaForm.bairro]);

  const tiposPermitidos = useMemo(() => TIPOS_POR_ATIVIDADE[ini.atividade], [ini.atividade]);

  const mutation = useCriarRegistroManual({
    onSuccess: () => {
      if (currentDraftId) removeDraft(currentDraftId);
      // Edit mode: delete old record after successful create
      if (editRegistroId) {
        excluirManualMutation.mutate(editRegistroId, {
          onSuccess: () => {
            toast.success("Registro atualizado.");
          },
          onError: () => {
            toast.warning(
              "Novo registro criado, mas o antigo não pôde ser excluído. Remova-o manualmente."
            );
          },
        });
      }
      hardReset();
      onOpenChange(false);
    },
  });

  // ============== Combobox options ==============
  const centrosCustoOpts = useMemo(
    () =>
      centrosCusto.map((cc) => {
        const codigo = (cc.codigo_centro_custo || "").trim();
        const nome = (cc.nome_centro_custo || "").trim();
        return {
          value: cc.id,
          label: codigo || nome || cc.id,
          searchText: `${codigo} ${nome}`.trim() || cc.id,
        };
      }),
    [centrosCusto]
  );

  const equipesOpts = useMemo(() => {
    const base = (equipesQ.data || []).map((e) => ({ value: e.id, label: e.nome_equipe }));
    if (isEditMode && ini.equipeId && !base.some((o) => o.value === ini.equipeId)) {
      const nomeHist = editableQ.data?.historico.equipeNome || "";
      base.unshift({
        value: ini.equipeId,
        label: `${nomeHist || "Equipe"} (histórico)`,
      });
    }
    return base;
  }, [equipesQ.data, isEditMode, ini.equipeId, editableQ.data]);

  const caminhoesOpts = useMemo(() => {
    const base = (caminhoesQ.data || []).map((c) => ({
      value: c.id,
      label: (c.frota || c.numero_frota || "s/frota") + (c.placa ? ` — ${c.placa}` : ""),
    }));
    if (isEditMode && carga.caminhaoId && !base.some((o) => o.value === carga.caminhaoId)) {
      const labelHist = editableQ.data?.historico.caminhaoLabel || "";
      base.unshift({
        value: carga.caminhaoId,
        label: `${labelHist || "Caminhão"} (histórico)`,
      });
    }
    return base;
  }, [caminhoesQ.data, isEditMode, carga.caminhaoId, editableQ.data]);

  const motoristasOpts = useMemo(() => {
    const base = (motoristasQ.data || []).map((m) => ({
      value: m.id,
      label: m.nome_completo,
      searchText: `${m.nome_completo} ${m.funcao_nome ?? ""}`.trim(),
    }));
    if (isEditMode && carga.motoristaId && !base.some((o) => o.value === carga.motoristaId)) {
      const nomeHist = editableQ.data?.historico.motoristaNome || "";
      base.unshift({
        value: carga.motoristaId,
        label: `${nomeHist || "Motorista"} (histórico)`,
        searchText: nomeHist,
      });
    }
    return base;
  }, [motoristasQ.data, isEditMode, carga.motoristaId, editableQ.data]);

  // ============== hardReset ==============
  const hardReset = () => {
    setTab("iniciais");
    setEstado("rascunho");
    setIniciaisOk(false);
    setIni(emptyIniciais());
    setCarga(emptyCarga());
    setRuas([]);
    setRuaAtualId(null);
    setRuaForm(emptyRuaForm());
    setBuracoForm(emptyBuracoForm("buraco"));
    setEditBuracoRef(null);
    setObsFinal("");
    setCurrentDraftId(null);
    setRuaFormOpen(false);
    setEditingRuaId(null);
    setBuracoFormOpen(false);
    setCalculoAberto(false);
  };


  // ============== Open effect / draft hydration ==============
  useEffect(() => {
    if (!open) return;
    // Edit mode tem seu próprio effect abaixo. Não sobrescreve com defaults.
    if (editRegistroId) return;

    if (draftId) {
      const d = loadDraft(draftId);
      if (d) {
        setCurrentDraftId(d.id);
        setTab(d.lastTab || "iniciais");
        setIni({ ...emptyIniciais(), ...(d.ini || {}) });
        setCarga({ ...emptyCarga(), ...(d.carga || {}) });

        // Preferência: shape v2 (ruas[]). Fallback: migrar legado (itens[]) para uma única rua sintética.
        let ruasHidr: RuaLocal[] = [];
        if (Array.isArray(d.ruas) && d.ruas.length) {
          ruasHidr = d.ruas.map((r: any) => ({
            ...r,
            buracos: (r.buracos || []).map((b: any) => ({
              ...b,
              fotos: [], // Files não são persistidos
            })),
          }));
        } else if (Array.isArray(d.itens) && d.itens.length) {
          const iniAny: any = d.ini || {};
          const chave = normalizeRuaKey({
            logradouro: iniAny.logradouro,
            bairro: iniAny.bairro,
            cidade: iniAny.cidade,
            uf: iniAny.uf,
          });
          const ruaId = genLocalId();
          ruasHidr = [
            {
              idLocal: ruaId,
              chaveNorm: chave,
              logradouro: iniAny.logradouro || "",
              bairro: iniAny.bairro || "",
              cidade: iniAny.cidade || "",
              uf: iniAny.uf || "",
              cep: iniAny.cep || "",
              latitude: iniAny.latitude ?? null,
              longitude: iniAny.longitude ?? null,
              origemLocalizacao: iniAny.origemLocalizacao || "",
              iniciadaEm: new Date().toISOString(),
              buracos: (d.itens || []).map((it: any, i: number) => ({
                idLocal: genLocalId(),
                sequenciaAplicacao: it.seq ?? i + 1,
                sequenciaRua: i + 1,
                bordo: it.bordo || "",
                comprimento: String(it.comprimento ?? ""),
                larguraMedia: String(it.larguraMedia ?? ""),
                toneladaAplicada: String(it.toneladaAplicada ?? ""),
                espessura: String(it.espessura ?? ""),
                temperaturaAplicacao: String(it.temperaturaAplicacao ?? ""),
                tipo_item: it.tipo_item || "buraco",
                observacao: it.observacao || "",
                areaCalculada: Number(it.areaCalculada || 0),
                gps: null,
                fotos: [],
                fotosCount: 0,
              })),
            },
          ];
        }
        setRuas(ruasHidr);
        setRuaAtualId(d.ruaAtualId ?? ruasHidr[ruasHidr.length - 1]?.idLocal ?? null);
        setRuaForm(emptyRuaForm());
        setBuracoForm(
          emptyBuracoForm(d.ini?.atividade === "tapa_buraco" ? "buraco" : "faixa")
        );
        setEditBuracoRef(null);
        setObsFinal(d.obsFinal || "");
        setIniciaisOk(true);
        setEstado("rascunho");
        return;
      }
    }

    const iso = getCurrentBrazilianDate();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setCurrentDraftId(null);
    setTab("iniciais");
    setEstado("rascunho");
    setIniciaisOk(false);
    setIni({ ...emptyIniciais(), data: iso, horaChegada: hhmm });
    setCarga(emptyCarga());
    setRuas([]);
    setRuaAtualId(null);
    setRuaForm(emptyRuaForm());
    setBuracoForm(emptyBuracoForm("buraco"));
    setEditBuracoRef(null);
    setObsFinal("");
  }, [open, draftId, loadDraft]);

  // ============== Edit mode hydration ==============
  useEffect(() => {
    if (!open) {
      setHydratedEditId(null);
      return;
    }
    if (!editRegistroId) return;
    const ed = editableQ.data;
    if (!ed) return;
    if (hydratedEditId === editRegistroId) return; // já hidratado

    setCurrentDraftId(null);
    setTab("iniciais");
    setIni({
      centroCustoId: ed.ini.centroCustoId,
      atividade: ed.ini.atividade,
      data: ed.ini.data,
      horaChegada: ed.ini.horaChegada,
      equipeId: ed.ini.equipeId,
      condominio: ed.ini.condominio,
    });
    setCarga({
      caminhaoId: ed.carga.caminhaoId,
      frota: ed.carga.frota,
      placa: ed.carga.placa,
      motoristaId: ed.carga.motoristaId,
      totalCargaT: ed.carga.totalCargaT,
      temperaturaMassa: ed.carga.temperaturaMassa,
      tipoTraco: (ed.carga.tipoTraco as any) || "",
      tipoPintura: (ed.carga.tipoPintura as any) || "",
    });

    const ruasHidr: RuaLocal[] = ed.ruas.map((r) => {
      const chave = normalizeRuaKey({
        logradouro: r.logradouro,
        bairro: r.bairro,
        cidade: r.cidade,
        uf: r.uf,
      });
      return {
        idLocal: r.idLocal,
        chaveNorm: chave,
        logradouro: r.logradouro,
        bairro: r.bairro,
        cidade: r.cidade,
        uf: r.uf,
        cep: "",
        latitude: r.latitude,
        longitude: r.longitude,
        accuracy: r.accuracy ?? null,
        capturedAt: r.capturedAt ?? null,
        origemLocalizacao: r.latitude != null ? "geocode" : "",
        iniciadaEm: new Date().toISOString(),
        buracos: r.buracos.map((b) => ({
          idLocal: b.idLocal,
          sequenciaAplicacao: b.sequenciaAplicacao,
          sequenciaRua: b.sequenciaRua,
          bordo: (b.bordo as any) || "",
          comprimento: b.comprimento,
          larguraMedia: b.larguraMedia,
          toneladaAplicada: b.toneladaAplicada,
          espessura: b.espessura,
          temperaturaAplicacao: b.temperaturaAplicacao,
          tipo_item: b.tipo_item,
          observacao: b.observacao,
          areaCalculada: b.areaCalculada,
          gps: b.gps
            ? {
                latitude: b.gps.latitude,
                longitude: b.gps.longitude,
                accuracy: b.gps.accuracy ?? 0,
                capturedAt: new Date().toISOString(),
                source: "device",
              }
            : null,
          fotos: [],
          fotosCount: b.fotosPaths?.length || 0,
          fotosPaths: b.fotosPaths || [],
        })),
      };
    });

    setRuas(ruasHidr);
    setRuaAtualId(ruasHidr[ruasHidr.length - 1]?.idLocal ?? null);
    setRuaForm(emptyRuaForm());
    setBuracoForm(
      emptyBuracoForm(ed.ini.atividade === "tapa_buraco" ? "buraco" : "faixa")
    );
    setEditBuracoRef(null);
    setObsFinal(ed.obsFinal || "");
    setIniciaisOk(true);
    setEstado("em_andamento");
    setHydratedEditId(editRegistroId);
    console.log("[REGISTRO_MANUAL][EDIT_HYDRATE]", {
      registroId: editRegistroId,
      ruas: ruasHidr.length,
      buracos: ruasHidr.reduce((s, r) => s + r.buracos.length, 0),
    });
  }, [open, editRegistroId, editableQ.data, hydratedEditId]);

  useEffect(() => {
    const tipoPadrao = ini.atividade === "tapa_buraco" ? "buraco" : tiposPermitidos[0];
    setBuracoForm((prev) => ({
      ...prev,
      tipo_item: tiposPermitidos.includes(prev.tipo_item) ? prev.tipo_item : tipoPadrao,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ini.atividade]);

  // ============== Draft persistence ==============
  const buildDraftInput = () => {
    const ccSel = centrosCusto.find((c) => c.id === ini.centroCustoId);
    // Não serializar File[]
    const ruasSerial = ruas.map((r) => ({
      ...r,
      buracos: r.buracos.map((b) => ({ ...b, fotos: [] })),
    }));
    const firstRua = ruas[0];
    return {
      id: currentDraftId || undefined,
      lastTab: tab,
      ini,
      carga,
      ruas: ruasSerial,
      ruaAtualId,
      itens: [], // legado — vazio na v2
      obsFinal,
      imagensCount: ruas.reduce((s, r) => s + r.buracos.reduce((s2, b) => s2 + b.fotosCount, 0), 0),
      logradouro: firstRua?.logradouro || null,
      centroCustoId: ini.centroCustoId || null,
      centroCustoCodigo: (ccSel?.codigo_centro_custo || "").trim() || null,
      centroCustoNome: (ccSel?.nome_centro_custo || "").trim() || null,
      data: ini.data || null,
      atividade: ini.atividade || null,
    };
  };

  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    if (!iniciaisOk) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const id = saveDraft(buildDraftInput());
      if (!currentDraftId) setCurrentDraftId(id);
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, iniciaisOk, tab, ini, carga, ruas, obsFinal, currentDraftId, saveDraft]);

  const salvarRascunhoManual = () => {
    const id = saveDraft(buildDraftInput());
    if (!currentDraftId) setCurrentDraftId(id);
    toast.success("Rascunho salvo neste dispositivo.");
  };

  const temTrabalhoPendente = () =>
    ruas.some((r) => r.buracos.length > 0) || estado === "em_andamento" || iniciaisOk;

  const handleOpenChange = (v: boolean) => {
    if (v) return onOpenChange(true);
    if (temTrabalhoPendente()) {
      setConfirmCloseOpen(true);
      return;
    }
    hardReset();
    onOpenChange(false);
  };

  const handleManterRascunho = () => {
    const id = saveDraft(buildDraftInput());
    if (!currentDraftId) setCurrentDraftId(id);
    setConfirmCloseOpen(false);
    hardReset();
    onOpenChange(false);
  };

  const handleDescartarRascunho = () => {
    if (currentDraftId) removeDraft(currentDraftId);
    setConfirmCloseOpen(false);
    hardReset();
    onOpenChange(false);
  };

  // ============== ABA 1 — Dados Iniciais ==============
  const validarIniciais = (): string | null => {
    if (!ini.centroCustoId) return "Centro de custo é obrigatório.";
    if (!ini.atividade) return "Atividade é obrigatória.";
    if (!ini.data) return "Data é obrigatória.";
    if (!ini.equipeId) return "Equipe é obrigatória.";
    return null;
  };

  const salvarIniciais = () => {
    const err = validarIniciais();
    if (err) return toast.error(err);
    setIniciaisOk(true);
    toast.success("Dados iniciais validados.");
    setTab("carga");
  };

  // ============== ABA 2 — Carga ==============
  const onCaminhaoChange = (id: string) => {
    const c = caminhoesQ.data?.find((x) => x.id === id);
    setCarga((prev) => ({
      ...prev,
      caminhaoId: id,
      frota: c?.frota || c?.numero_frota || "",
      placa: c?.placa || "",
    }));
  };

  const validarCarga = (): string | null => {
    if (!carga.caminhaoId) return "Caminhão/Frota é obrigatório.";
    if (!carga.motoristaId) return "Motorista é obrigatório.";
    if (!Number(carga.totalCargaT) || Number(carga.totalCargaT) <= 0)
      return "Total da carga (t) é obrigatório e maior que 0.";
    if (!Number(carga.temperaturaMassa)) return "Temperatura da massa é obrigatória.";
    if (!carga.tipoTraco) return "Tipo de traço é obrigatório.";
    if (!carga.tipoPintura) return "Tipo de pintura é obrigatório.";
    return null;
  };

  const iniciarAplicacao = () => {
    const errCarga = validarCarga();
    if (errCarga) return toast.error(errCarga);
    setEstado("em_andamento");
    toast.info("Aplicação iniciada. Comece pela primeira rua.");
    setTab("apontamento");
  };

  // ============== ABA 3 — Apontamento (Rua + Buraco) ==============
  const onRuaAddressSelected = (r: AddressResult) => {
    setRuaForm((prev) => ({
      ...prev,
      logradouro: r.endereco_rua || r.endereco_completo || prev.logradouro,
      bairro: r.endereco_bairro || prev.bairro,
      cidade: r.endereco_cidade || prev.cidade,
      uf: r.endereco_estado || prev.uf,
      cep: r.endereco_cep || prev.cep,
      latitude: typeof r.latitude === "number" ? r.latitude : prev.latitude,
      longitude: typeof r.longitude === "number" ? r.longitude : prev.longitude,
      origemLocalizacao:
        r.geocoding_source === "manual"
          ? "mapa"
          : r.geocoding_status === "manual"
          ? "mapa"
          : "geocode",
    }));
  };

  // B.3.5-D — tenta auto-preencher a rua atual via GPS + reverse geocode
  const tentarAutoPreencherRua = async (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    if (editingRuaId) return; // nunca sobrescreve edição
    if (!force) {
      // não sobrescrever form já preenchido (manual ou auto anterior)
      if (ruaForm.logradouro.trim() || ruaForm.bairro.trim() || ruaForm.latitude != null) return;
    }
    setAutoLoc({ status: "loading", message: "Buscando localização..." });
    console.log("[REGISTRO_MANUAL][GEO_START] auto-rua");
    const geo = await captureGeo({ timeoutMs: 20000, maximumAge: 30000 });
    if (!geo.ok || !geo.data) {
      const code = geo.errorCode;
      const msg =
        code === "permission_denied"
          ? "Localização bloqueada. Ative a permissão nas configurações do navegador/PWA ou preencha manualmente."
          : code === "insecure_context"
          ? "Contexto não seguro — acesse via HTTPS para usar GPS. Preencha manualmente."
          : geo.error ||
            "Não foi possível obter a localização automaticamente. Verifique a permissão de localização ou preencha manualmente.";
      setAutoLoc({ status: "erro", message: msg });
      return;
    }
    const { latitude, longitude, accuracy, capturedAt } = geo.data;
    console.log("[REGISTRO_MANUAL][REVERSE_GEOCODE_START]", { accuracy });
    try {
      const rev = await reverseGeocode(latitude, longitude);
      const logr = extrairLogradouro(rev);
      console.log("[REGISTRO_MANUAL][REVERSE_GEOCODE_SUCCESS]", {
        hasLogradouro: !!logr,
        bairro: !!rev?.endereco_bairro,
        cidade: !!rev?.endereco_cidade,
        uf: !!rev?.endereco_estado,
      });
      const hasCoords = Number.isFinite(latitude) && Number.isFinite(longitude);
      setRuaForm((prev) => ({
        ...prev,
        logradouro: logr || prev.logradouro,
        bairro: rev?.endereco_bairro || prev.bairro,
        cidade: rev?.endereco_cidade || prev.cidade,
        uf: rev?.endereco_estado || prev.uf,
        cep: rev?.endereco_cep || prev.cep,
        latitude: hasCoords ? latitude : prev.latitude,
        longitude: hasCoords ? longitude : prev.longitude,
        accuracy: hasCoords && Number.isFinite(accuracy) ? accuracy : prev.accuracy,
        capturedAt: hasCoords ? capturedAt : prev.capturedAt,
        origemLocalizacao: "geocode",
      }));
      if (!logr && !rev) {
        setAutoLoc({
          status: "erro",
          message: "Não foi possível identificar a rua. Preencha manualmente.",
        });
        return;
      }
      if (Number.isFinite(accuracy) && accuracy > 100) {
        setAutoLoc({
          status: "aproximado",
          message: `Localização aproximada (±${Math.round(accuracy)}m). Confira o nome da rua antes de salvar.`,
        });
      } else {
        setAutoLoc({
          status: "ok",
          message: "Rua sugerida pela localização atual. Confira antes de salvar.",
        });
      }
    } catch (e) {
      console.error("[REGISTRO_MANUAL][REVERSE_GEOCODE_ERROR]", e);
      setAutoLoc({
        status: "erro",
        message: "Não foi possível identificar a localização. Preencha a rua manualmente.",
      });
    }
  };

  const handleAdicionarRuaClick = () => {
    setRuaFormOpen(true);
    // dispara sem await; UX é o banner que aparece no form
    void tentarAutoPreencherRua({ force: false });
  };


  const ruaAtual = useMemo(
    () => ruas.find((r) => r.idLocal === ruaAtualId) || null,
    [ruas, ruaAtualId]
  );

  const iniciarRuaAtual = () => {
    if (estado !== "em_andamento") return toast.error('Clique em "Iniciar Aplicação" na aba Carga.');
    const logr = ruaForm.logradouro.trim();
    const bair = ruaForm.bairro.trim();
    if (!logr) return toast.error("Logradouro é obrigatório para iniciar a rua.");
    if (!bair) return toast.error("Bairro é obrigatório para iniciar a rua.");
    const chave = normalizeRuaKey({ logradouro: logr, bairro: bair, cidade: ruaForm.cidade, uf: ruaForm.uf });

    // Edição: atualiza rua existente em-place
    if (editingRuaId) {
      // impede duplicação: se outra rua já usa esta chave, migra buracos para lá
      const outra = ruas.find((r) => r.idLocal !== editingRuaId && r.chaveNorm === chave);
      if (outra) {
        setRuas((prev) => {
          const alvo = prev.find((r) => r.idLocal === editingRuaId);
          if (!alvo) return prev;
          const seqOffset = outra.buracos.reduce((m, b) => Math.max(m, b.sequenciaRua), 0);
          const migrados = alvo.buracos.map((b, i) => ({ ...b, sequenciaRua: seqOffset + i + 1 }));
          return prev
            .filter((r) => r.idLocal !== editingRuaId)
            .map((r) => (r.idLocal === outra.idLocal ? { ...r, buracos: [...r.buracos, ...migrados] } : r));
        });
        setRuaAtualId(outra.idLocal);
        toast.info(`Rua unificada com "${describeRua(outra)}".`);
      } else {
        setRuas((prev) =>
          prev.map((r) =>
            r.idLocal !== editingRuaId
              ? r
              : {
                  ...r,
                  chaveNorm: chave,
                  logradouro: logr,
                  bairro: bair,
                  cidade: ruaForm.cidade.trim(),
                  uf: ruaForm.uf.trim(),
                  cep: ruaForm.cep.trim(),
                  latitude: ruaForm.latitude,
                  longitude: ruaForm.longitude,
                  accuracy: ruaForm.accuracy ?? null,
                  capturedAt: ruaForm.capturedAt ?? null,
                  origemLocalizacao: ruaForm.origemLocalizacao,
                }
          )
        );
        toast.success("Rua atualizada.");
      }
      setEditingRuaId(null);
      setRuaForm(emptyRuaForm());
      setRuaFormOpen(false);
      return;
    }

    const existente = ruas.find((r) => r.chaveNorm === chave);
    if (existente) {
      setRuaAtualId(existente.idLocal);
      setRuaForm(emptyRuaForm());
      setRuaFormOpen(false);
      toast.info(`Rua reutilizada: ${describeRua(existente)}.`);
      return;
    }
    const nova: RuaLocal = {
      idLocal: genLocalId(),
      chaveNorm: chave,
      logradouro: logr,
      bairro: bair,
      cidade: ruaForm.cidade.trim(),
      uf: ruaForm.uf.trim(),
      cep: ruaForm.cep.trim(),
      latitude: ruaForm.latitude,
      longitude: ruaForm.longitude,
      accuracy: ruaForm.accuracy ?? null,
      capturedAt: ruaForm.capturedAt ?? null,
      origemLocalizacao: ruaForm.origemLocalizacao,
      iniciadaEm: new Date().toISOString(),
      buracos: [],
    };
    setRuas((prev) => [...prev, nova]);
    setRuaAtualId(nova.idLocal);
    setRuaForm(emptyRuaForm());
    setRuaFormOpen(false);
    toast.success(`Rua iniciada: ${describeRua(nova)}.`);
  };


  const trocarParaRua = (ruaId: string) => {
    const r = ruas.find((x) => x.idLocal === ruaId);
    if (!r) return;
    setRuaAtualId(ruaId);
    setRuaForm(emptyRuaForm());
    setRuaFormOpen(false);
    setBuracoFormOpen(false);
    setTab("apontamento");
    toast.info(`Rua atual: ${describeRua(r)}.`);
  };


  // Cálculo bidirecional area/tonelada/espessura no formulário do buraco
  const areaCalc = useMemo(() => {
    const c = Number(buracoForm.comprimento) || 0;
    const l = Number(buracoForm.larguraMedia) || 0;
    if (c > 0 && l > 0) return Number((c * l).toFixed(4));
    return 0;
  }, [buracoForm.comprimento, buracoForm.larguraMedia]);

  useEffect(() => {
    const dens = DENSIDADE_DEFAULT;
    if (!areaCalc || dens <= 0) return;
    const source = buracoForm.lastEdited || "espessura";
    if (source === "espessura") {
      const espCmStr = buracoForm.espessura || String(ESPESSURA_PADRAO_CM);
      const espM = (Number(espCmStr) || 0) / 100;
      if (espM > 0) {
        const ton = Number((areaCalc * espM * dens).toFixed(3));
        setBuracoForm((prev) => {
          const next: Partial<BuracoFormState> = {};
          if (prev.toneladaAplicada !== String(ton)) next.toneladaAplicada = String(ton);
          if (!prev.espessura) next.espessura = String(ESPESSURA_PADRAO_CM);
          return Object.keys(next).length ? { ...prev, ...next } : prev;
        });
      }
    } else if (source === "tonelada") {
      const ton = Number(buracoForm.toneladaAplicada) || 0;
      if (ton > 0) {
        const espM = ton / (areaCalc * dens);
        const espCm = Number((espM * 100).toFixed(2));
        setBuracoForm((prev) =>
          prev.espessura === String(espCm) ? prev : { ...prev, espessura: String(espCm) }
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCalc, buracoForm.espessura, buracoForm.toneladaAplicada, buracoForm.lastEdited]);

  const onFotosChange = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const validas: File[] = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" não é imagem válida.`);
        continue;
      }
      if (f.size > MAX_IMG_BYTES) {
        toast.error(`"${f.name}" excede 5 MB.`);
        continue;
      }
      validas.push(f);
    }
    setBuracoForm((prev) => {
      const next = [...prev.fotos, ...validas];
      if (next.length > MAX_FOTOS_BURACO) {
        toast.error(`Máximo de ${MAX_FOTOS_BURACO} fotos por apontamento.`);
        return { ...prev, fotos: next.slice(0, MAX_FOTOS_BURACO) };
      }
      return { ...prev, fotos: next };
    });
  };

  const removerFotoAtual = (idx: number) => {
    setBuracoForm((prev) => ({ ...prev, fotos: prev.fotos.filter((_, i) => i !== idx) }));
  };

  const validarBuraco = (): string | null => {
    if (!ruaAtualId || !ruaAtual)
      return 'Inicie ou selecione uma rua antes de salvar o apontamento.';
    if (areaCalc <= 0)
      return "Informe Comprimento e Largura (> 0).";
    if (!buracoForm.tipo_item) return "Tipo do item é obrigatório.";
    if (!tiposPermitidos.includes(buracoForm.tipo_item))
      return `Tipo inválido para atividade ${ini.atividade}.`;
    return null;
  };

  const apontamentoTemGps = (b?: BuracoLocal | null) =>
    !!b &&
    !!b.gps &&
    Number.isFinite(b.gps.latitude as number) &&
    Number.isFinite(b.gps.longitude as number);

  const salvarApontamento = async () => {
    if (estado !== "em_andamento") return toast.error('Clique em "Iniciar Aplicação" antes.');
    const err = validarBuraco();
    if (err) return toast.error(err);

    // B.3.5-D.M3 — edição de apontamento com GPS já salvo preserva coordenadas
    const buracoEmEdicao = editBuracoRef
      ? ruas
          .find((r) => r.idLocal === editBuracoRef.ruaId)
          ?.buracos.find((b) => b.idLocal === editBuracoRef.buracoId) || null
      : null;
    const preservarGpsExistente = !!editBuracoRef && apontamentoTemGps(buracoEmEdicao);

    // B.3.5-D.M2 — captura de GPS controlada por toggle
    let gps: GeoCapture | null = null;
    if (preservarGpsExistente) {
      console.log("[REGISTRO_MANUAL][BURACO_GEO_CAPTURE] edicao_com_gps_preservado");
    } else if (capturarGpsBuraco) {
      setCapturandoGeo(true);
      const geoResult = await captureGeo({ timeoutMs: 20000, maximumAge: 30000 });
      setCapturandoGeo(false);
      gps = geoResult.data;
      console.log("[REGISTRO_MANUAL][BURACO_GEO_CAPTURE]", {
        ok: geoResult.ok,
        accuracy: gps?.accuracy,
        errorCode: geoResult.errorCode,
      });
      // Fallback: se GPS do buraco falhar, usa coordenada da rua (se houver)
      if (!gps && ruaAtual && typeof ruaAtual.latitude === "number" && typeof ruaAtual.longitude === "number"
          && Number.isFinite(ruaAtual.latitude) && Number.isFinite(ruaAtual.longitude)) {
        gps = {
          latitude: ruaAtual.latitude,
          longitude: ruaAtual.longitude,
          accuracy: Number.isFinite(ruaAtual.accuracy as number) ? (ruaAtual.accuracy as number) : 9999,
          capturedAt: new Date().toISOString(),
          source: "device",
        };
        console.log("[REGISTRO_MANUAL][BURACO_GEO_CAPTURE] fallback→rua", { accuracy: gps.accuracy });
      }
      if (!geoResult.ok && !gps) {
        toast.warning(`GPS não capturado (${geoResult.error}). Apontamento salvo mesmo assim.`);
      } else if (gps && gps.accuracy > 150) {
        toast.warning(`GPS impreciso: ±${Math.round(gps.accuracy)}m. Considere reposicionar.`);
      }
    } else {
      console.log("[REGISTRO_MANUAL][BURACO_GEO_CAPTURE] desativado pelo usuário");
    }

    if (editBuracoRef) {
      // Editar buraco existente — mantém sequências
      setRuas((prev) =>
        prev.map((r) =>
          r.idLocal !== editBuracoRef.ruaId
            ? r
            : {
                ...r,
                buracos: r.buracos.map((b) =>
                  b.idLocal !== editBuracoRef.buracoId
                    ? b
                    : {
                        ...b,
                        bordo: buracoForm.bordo,
                        comprimento: buracoForm.comprimento,
                        larguraMedia: buracoForm.larguraMedia,
                        toneladaAplicada: buracoForm.toneladaAplicada,
                        espessura: buracoForm.espessura,
                        temperaturaAplicacao: buracoForm.temperaturaAplicacao,
                        tipo_item: buracoForm.tipo_item,
                        observacao: buracoForm.observacao,
                        areaCalculada: areaCalc,
                        fotos: buracoForm.fotos,
                        fotosCount: buracoForm.fotos.length,
                        gps: b.gps || gps, // preserva GPS anterior se existir
                      }
                ),
              }
        )
      );
      toast.success("Apontamento atualizado.");
      setEditBuracoRef(null);
    } else {
      const rua = ruaAtual!;
      const seqRua = (rua.buracos.reduce((m, b) => Math.max(m, b.sequenciaRua), 0) || 0) + 1;
      const seqGlobal =
        ruas.reduce(
          (m, r) => Math.max(m, r.buracos.reduce((mm, b) => Math.max(mm, b.sequenciaAplicacao), 0)),
          0
        ) + 1;
      const novo: BuracoLocal = {
        idLocal: genLocalId(),
        sequenciaAplicacao: seqGlobal,
        sequenciaRua: seqRua,
        bordo: buracoForm.bordo,
        comprimento: buracoForm.comprimento,
        larguraMedia: buracoForm.larguraMedia,
        toneladaAplicada: buracoForm.toneladaAplicada,
        espessura: buracoForm.espessura,
        temperaturaAplicacao: buracoForm.temperaturaAplicacao,
        tipo_item: buracoForm.tipo_item,
        observacao: buracoForm.observacao,
        areaCalculada: areaCalc,
        gps,
        fotos: buracoForm.fotos,
        fotosCount: buracoForm.fotos.length,
      };
      setRuas((prev) =>
        prev.map((r) => (r.idLocal === rua.idLocal ? { ...r, buracos: [...r.buracos, novo] } : r))
      );
      toast.success(
        `${rotuloItem(novo.tipo_item, novo.sequenciaRua)} salvo em ${describeRua(rua)}.`
      );
    }
    const tipoPadrao = ini.atividade === "tapa_buraco" ? "buraco" : tiposPermitidos[0];
    setBuracoForm(emptyBuracoForm(tipoPadrao));
    setBuracoFormOpen(false);
    setCalculoAberto(false);
  };

  const editarBuraco = (ruaId: string, buracoId: string) => {
    const r = ruas.find((x) => x.idLocal === ruaId);
    const b = r?.buracos.find((x) => x.idLocal === buracoId);
    if (!r || !b) return;
    setRuaAtualId(ruaId);
    setBuracoForm({
      bordo: b.bordo,
      comprimento: b.comprimento,
      larguraMedia: b.larguraMedia,
      toneladaAplicada: b.toneladaAplicada,
      espessura: b.espessura,
      lastEdited: "",
      temperaturaAplicacao: b.temperaturaAplicacao,
      tipo_item: b.tipo_item,
      observacao: b.observacao,
      fotos: b.fotos,
    });
    setEditBuracoRef({ ruaId, buracoId });
    setBuracoFormOpen(true);
    setTab("apontamento");
  };


  const removerBuraco = (ruaId: string, buracoId: string) => {
    if (!window.confirm("Remover este apontamento?")) return;
    setRuas((prev) =>
      prev.map((r) => {
        if (r.idLocal !== ruaId) return r;
        // Recalcula sequencia_rua compactando (Fase A local — não persistido)
        const restantes = r.buracos.filter((b) => b.idLocal !== buracoId);
        return {
          ...r,
          buracos: restantes.map((b, i) => ({ ...b, sequenciaRua: i + 1 })),
        };
      })
    );
    // Recalcula sequencia_aplicacao global cronológica após remoção
    setRuas((prev) => {
      const flat: { r: number; b: number }[] = [];
      prev.forEach((r, ri) =>
        r.buracos.forEach((b, bi) => flat.push({ r: ri, b: bi }))
      );
      // ordena pela sequenciaAplicacao original
      const withOrig = flat
        .map((p) => ({ ...p, seq: prev[p.r].buracos[p.b].sequenciaAplicacao }))
        .sort((a, b) => a.seq - b.seq);
      const next = prev.map((r) => ({ ...r, buracos: r.buracos.map((b) => ({ ...b })) }));
      withOrig.forEach((p, i) => {
        next[p.r].buracos[p.b].sequenciaAplicacao = i + 1;
      });
      return next;
    });
  };

  const editarRua = (ruaId: string) => {
    const r = ruas.find((x) => x.idLocal === ruaId);
    if (!r) return;
    setRuaAtualId(ruaId);
    setEditingRuaId(ruaId);
    setRuaForm({
      logradouro: r.logradouro,
      bairro: r.bairro,
      cidade: r.cidade,
      uf: r.uf,
      cep: r.cep || "",
      latitude: r.latitude,
      longitude: r.longitude,
      accuracy: r.accuracy ?? null,
      capturedAt: r.capturedAt ?? null,
      origemLocalizacao: r.origemLocalizacao,
    });
    setRuaFormOpen(true);
    setTab("apontamento");
  };

  const removerRua = (ruaId: string) => {
    const r = ruas.find((x) => x.idLocal === ruaId);
    if (!r) return;
    const qtd = r.buracos.length;
    if (
      !window.confirm(
        qtd > 0
          ? `Remover a rua "${describeRua(r)}" com ${qtd} apontamento${qtd === 1 ? "" : "s"}? Esta ação não pode ser desfeita.`
          : `Remover a rua "${describeRua(r)}"?`
      )
    )
      return;
    setRuas((prev) => {
      const filtradas = prev.filter((x) => x.idLocal !== ruaId);
      // Recompacta sequencia_aplicacao global
      const flatSeq: { r: number; b: number; seq: number }[] = [];
      filtradas.forEach((rr, ri) =>
        rr.buracos.forEach((bb, bi) => flatSeq.push({ r: ri, b: bi, seq: bb.sequenciaAplicacao }))
      );
      flatSeq.sort((a, b) => a.seq - b.seq);
      const next = filtradas.map((rr) => ({ ...rr, buracos: rr.buracos.map((bb) => ({ ...bb })) }));
      flatSeq.forEach((p, i) => {
        next[p.r].buracos[p.b].sequenciaAplicacao = i + 1;
      });
      return next;
    });
    if (ruaAtualId === ruaId) setRuaAtualId(null);
  };

  // ============== Totais / cálculos ==============
  const totais = useMemo(() => {
    const totalCargaT = Number(carga.totalCargaT) || 0;
    const areaTotal = ruas.reduce(
      (s, r) => s + r.buracos.reduce((s2, b) => s2 + (b.areaCalculada || 0), 0),
      0
    );
    const qtdBuracos = ruas.reduce((s, r) => s + r.buracos.length, 0);
    const espessuraMediaCm =
      areaTotal > 0 && totalCargaT > 0
        ? (totalCargaT * 100) / (areaTotal * DENSIDADE_DEFAULT)
        : 0;
    // Rateio estrito por buraco com resíduo — usado tanto no preview quanto no payload.
    const refs: BuracoRateioRef[] = [];
    ruas.forEach((r) =>
      r.buracos.forEach((b) =>
        refs.push({
          idLocal: b.idLocal,
          ruaIdLocal: r.idLocal,
          sequenciaAplicacao: b.sequenciaAplicacao,
          areaCalculada: b.areaCalculada || 0,
        })
      )
    );
    const mapaTonBuracos = totalCargaT > 0 ? computeToneladasBuracosComResiduo(refs, totalCargaT, 3) : {};
    const ruasComTotais = ruas.map((r) => {
      const areaRua = r.buracos.reduce((s, b) => s + (b.areaCalculada || 0), 0);
      const toneladaRua = r.buracos.reduce((s, b) => s + (mapaTonBuracos[b.idLocal] ?? 0), 0);
      return { rua: r, areaRua, toneladaRua };
    });
    return {
      totalCargaT,
      areaTotal,
      qtdBuracos,
      qtdRuas: ruas.length,
      espessuraMediaCm,
      ruasComTotais,
    };
  }, [ruas, carga.totalCargaT]);

  const ultimaTempAplicacao = useMemo<number | null>(() => {
    for (let i = ruas.length - 1; i >= 0; i--) {
      const bs = ruas[i].buracos;
      for (let j = bs.length - 1; j >= 0; j--) {
        const t = Number(bs[j].temperaturaAplicacao);
        if (!Number.isNaN(t) && t > 0) return t;
      }
    }
    return null;
  }, [ruas]);

  // ============== Finalização (RPC v2 — payload hierárquico) ==============
  const validarFinalizacao = (): string | null => {
    if (!iniciaisOk) return "Preencha os Dados Iniciais.";
    const errCarga = validarCarga();
    if (errCarga) return errCarga;
    if (ruas.length === 0) return "Adicione pelo menos 1 rua.";
    for (const r of ruas) {
      if (r.buracos.length === 0)
        return `A rua "${describeRua(r)}" não tem apontamentos.`;
      if (!r.bairro || !r.bairro.trim())
        return `A rua "${describeRua(r)}" está sem bairro.`;
    }
    if (totais.totalCargaT <= 0) return "Total da carga precisa ser > 0.";
    if (totais.areaTotal <= 0) return "Área total precisa ser > 0.";
    return null;
  };

  const finalizar = () => {
    const err = validarFinalizacao();
    if (err) return toast.error(err);
    setEstado("finalizando");

    const tempMassa = Number(carga.temperaturaMassa);
    const cargaT = totais.totalCargaT;

    // Rateio estrito com resíduo — garante Σ tonelada_buraco === totalCargaT (3 casas).
    const refs: BuracoRateioRef[] = [];
    ruas.forEach((r) => {
      r.buracos.forEach((b) => {
        refs.push({
          idLocal: b.idLocal,
          ruaIdLocal: r.idLocal,
          sequenciaAplicacao: b.sequenciaAplicacao,
          areaCalculada: b.areaCalculada || 0,
        });
      });
    });
    const mapaTon = cargaT > 0 ? computeToneladasBuracosComResiduo(refs, cargaT, 3) : {};

    // Helper: só inclui gps se latitude E longitude forem numéricos finitos.
    const gpsRua = (r: RuaLocal) => {
      const lat = r.latitude;
      const lng = r.longitude;
      if (typeof lat === "number" && typeof lng === "number"
          && Number.isFinite(lat) && Number.isFinite(lng)) {
        const out: { latitude: number; longitude: number; accuracy?: number; capturedAt?: string } = {
          latitude: lat,
          longitude: lng,
        };
        if (typeof r.accuracy === "number" && Number.isFinite(r.accuracy)) out.accuracy = r.accuracy;
        if (r.capturedAt) out.capturedAt = r.capturedAt;
        return out;
      }
      return undefined;
    };
    const gpsBuraco = (b: BuracoLocal) => {
      const g = b.gps;
      if (!g) return undefined;
      const lat = g.latitude;
      const lng = g.longitude;
      if (typeof lat === "number" && typeof lng === "number"
          && Number.isFinite(lat) && Number.isFinite(lng)) {
        const out: { latitude: number; longitude: number; accuracy?: number; capturedAt?: string } = {
          latitude: lat,
          longitude: lng,
        };
        if (typeof g.accuracy === "number" && Number.isFinite(g.accuracy)) out.accuracy = g.accuracy;
        if (g.capturedAt) out.capturedAt = g.capturedAt;
        return out;
      }
      return undefined;
    };

    // Re-numera sequencia_aplicacao 1..N contígua na ordem visual (rua a rua).
    // sequencia_rua é re-numerada 1..N por rua.
    let seqAplGlobal = 0;
    const ruasPayload = ruas.map((r, idx) => {
      const buracosPayload = r.buracos.map((b, bi) => {
        seqAplGlobal += 1;
        const areaB = b.areaCalculada || 0;
        let ton: number;
        if (cargaT > 0) {
          ton = mapaTon[b.idLocal] ?? 0;
        } else {
          const tonManual = Number(b.toneladaAplicada);
          ton = Number.isFinite(tonManual) && tonManual > 0 ? tonManual : 0;
        }
        const tempAp = Number(b.temperaturaAplicacao);
        const out: any = {
          idLocal: b.idLocal,
          tipo_item: b.tipo_item || "buraco",
          sequencia_aplicacao: seqAplGlobal,
          sequencia_rua: bi + 1,
          comprimento: Number(b.comprimento) || 0,
          largura_media: Number(b.larguraMedia) || 0,
          area_aplicada: areaB > 0 ? areaB : null,
          tonelada_aplicada: ton || 0,
          bordo: b.bordo || null,
          observacao: b.observacao || null,
        };
        if (Number.isFinite(tempAp) && tempAp > 0) out.temperatura_aplicacao = tempAp;
        const g = gpsBuraco(b);
        if (g) out.gps = g;
        return out;
      });

      const ruaOut: any = {
        idLocal: r.idLocal,
        ordem_rua: idx + 1,
        logradouro: r.logradouro,
        bairro: r.bairro,
        cidade: r.cidade || null,
        uf: r.uf || null,
        buracos: buracosPayload,
      };
      const g = gpsRua(r);
      if (g) ruaOut.gps = g;
      return ruaOut;
    });

    // Diagnóstico GPS: quantas ruas/buracos têm gps no payload final
    const _totalBuracos = ruasPayload.reduce((s, r) => s + (r.buracos?.length || 0), 0);
    const _buracosComGps = ruasPayload.reduce(
      (s, r) => s + (r.buracos?.filter((b: any) => !!b.gps).length || 0),
      0
    );
    const _ruasComGps = ruasPayload.filter((r: any) => !!r.gps).length;
    console.log("[REGISTRO_MANUAL][PAYLOAD_GEO_CHECK]", {
      totalRuas: ruasPayload.length,
      ruasComGps: _ruasComGps,
      totalBuracos: _totalBuracos,
      buracosComGps: _buracosComGps,
    });


    // Contexto operacional como OBJETO — a RPC v2 anexa como [CONTEXTO_OPERACIONAL]
    // ao final de observacoes_gerais. NÃO concatenar aqui.
    const eq = equipesQ.data?.find((e) => e.id === ini.equipeId);
    const mot = motoristasQ.data?.find((m) => m.id === carga.motoristaId);
    const contextoOperacional: Record<string, unknown> = {
      equipe_id: ini.equipeId || null,
      equipe_nome: eq?.nome_equipe || null,
      caminhao_id: carga.caminhaoId || null,
      frota: carga.frota || null,
      placa: carga.placa || null,
      motorista_id: carga.motoristaId || null,
      motorista_nome: mot?.nome_completo || null,
      total_carga_t: cargaT,
      temperatura_massa: Number.isFinite(tempMassa) && tempMassa > 0 ? tempMassa : null,
      tipo_traco: carga.tipoTraco || null,
      tipo_pintura: carga.tipoPintura || null,
      condominio:
        ini.condominio === "sim" ? "sim" :
        ini.condominio === "nao" ? "nao" : null,
      totais: {
        qtd_ruas: totais.qtdRuas,
        qtd_buracos: totais.qtdBuracos,
        area_total_m2: Number(totais.areaTotal.toFixed(4)),
        espessura_media_cm: Number(totais.espessuraMediaCm.toFixed(2)),
      },
    };

    const obsTexto = (obsFinal || "").trim();

    // B.3.5-B — Fotos NUNCA entram no p_payload. Coletadas em mapa separado por idLocal.
    const fotosPorBuracoIdLocal: Record<string, File[]> = {};
    let buracosCount = 0;
    let buracosComFotos = 0;
    let totalFiles = 0;
    ruas.forEach((r) => {
      r.buracos.forEach((b) => {
        buracosCount += 1;
        if (b.fotos && b.fotos.length > 0) {
          fotosPorBuracoIdLocal[b.idLocal] = b.fotos;
          buracosComFotos += 1;
          totalFiles += b.fotos.length;
        }
      });
    });

    console.log("[REGISTRO_MANUAL][FOTOS_FORM_STATE]", {
      ruasCount: ruas.length,
      buracosCount,
      buracosComFotos,
      fotosPorBuracoIdLocalKeys: Object.keys(fotosPorBuracoIdLocal),
      totalFiles,
    });
    console.log("[REGISTRO_MANUAL][FOTOS_PAYLOAD_MAP]", {
      keys: Object.keys(fotosPorBuracoIdLocal),
      totalFiles,
    });

    mutation.mutate(
      {
        payload: {
          cabecalho: {
            centro_custo_id: ini.centroCustoId,
            atividade: ini.atividade,
            data_aplicacao: ini.data,
            hora_chegada_local: ini.horaChegada || null,
            temperatura_chegada:
              Number.isFinite(tempMassa) && tempMassa > 0 ? tempMassa : null,
            temperatura_aplicacao: ultimaTempAplicacao,
            total_carga_t: cargaT,
            observacoes_gerais: obsTexto || null,
            contexto_operacional: contextoOperacional,
          },
          ruas: ruasPayload,
        },
        fotosPorBuracoIdLocal,
      },
      { onError: () => setEstado("em_andamento") }
    );
  };

  // ============== RENDER helpers ==============
  const disabledFechar = estado === "finalizando" || mutation.isPending;
  const blocked = !iniciaisOk;

  const AlertBloqueio = (
    <Alert>
      <Lock className="h-4 w-4" />
      <AlertDescription>Valide os dados iniciais antes de continuar.</AlertDescription>
    </Alert>
  );

  const btnSalvarRascunho = (
    <Button
      variant="ghost"
      size="sm"
      onClick={salvarRascunhoManual}
      disabled={disabledFechar}
      className="gap-2 w-full sm:w-auto"
    >
      <Save className="h-4 w-4" />
      Salvar rascunho
    </Button>
  );

  const proximoRotuloBuraco = useMemo(() => {
    if (editBuracoRef) {
      const r = ruas.find((x) => x.idLocal === editBuracoRef.ruaId);
      const b = r?.buracos.find((x) => x.idLocal === editBuracoRef.buracoId);
      if (b) return `Editando ${rotuloItem(b.tipo_item, b.sequenciaRua)}`;
    }
    const rua = ruaAtual;
    if (!rua) return "Próximo: (defina a rua primeiro)";
    const seq = (rua.buracos.reduce((m, b) => Math.max(m, b.sequenciaRua), 0) || 0) + 1;
    return `Próximo: ${rotuloItem(buracoForm.tipo_item, seq)} em ${describeRua(rua)}`;
  }, [editBuracoRef, ruas, ruaAtual, buracoForm.tipo_item]);

  const renderFooterParts = (): { secondary: React.ReactNode[]; primary: React.ReactNode } => {
    const closeBtn = (
      <Button
        key="close"
        variant="outline"
        onClick={() => handleOpenChange(false)}
        disabled={disabledFechar}
        className="w-full sm:w-auto"
      >
        Fechar
      </Button>
    );
    const voltarBtn = (target: string) => (
      <Button
        key="voltar"
        variant="ghost"
        onClick={() => setTab(target)}
        disabled={blocked}
        className="w-full sm:w-auto"
      >
        Voltar
      </Button>
    );
    const rasc = React.cloneElement(btnSalvarRascunho, { key: "rasc" });

    if (tab === "iniciais") {
      return {
        secondary: [closeBtn, iniciaisOk ? rasc : null].filter(Boolean) as React.ReactNode[],
        primary: (
          <Button onClick={salvarIniciais} className="w-full sm:w-auto">
            Salvar e continuar
          </Button>
        ),
      };
    }
    if (tab === "carga") {
      return {
        secondary: [closeBtn, voltarBtn("iniciais"), rasc],
        primary:
          estado === "em_andamento" ? (
            <Button onClick={() => setTab("apontamento")} disabled={blocked} className="w-full sm:w-auto">
              Ir para apontamento
            </Button>
          ) : (
            <Button onClick={iniciarAplicacao} disabled={blocked} className="w-full sm:w-auto gap-2">
              <Play className="h-4 w-4" />
              Iniciar aplicação
            </Button>
          ),
      };
    }
    if (tab === "apontamento") {
      return {
        secondary: [closeBtn, voltarBtn("carga"), rasc],
        primary: (
          <Button
            onClick={() => setTab("listaRuas")}
            disabled={blocked}
            className="w-full sm:w-auto"
          >
            Ver lista de ruas
          </Button>
        ),
      };
    }
    if (tab === "listaRuas") {
      return {
        secondary: [
          closeBtn,
          <Button
            key="novoap"
            variant="ghost"
            onClick={() => setTab("apontamento")}
            disabled={blocked}
            className="w-full sm:w-auto"
          >
            Novo apontamento
          </Button>,
          rasc,
        ],
        primary: (
          <Button
            onClick={() => setTab("listaApontamentos")}
            disabled={blocked || totais.qtdBuracos === 0}
            className="w-full sm:w-auto"
          >
            Ver apontamentos
          </Button>
        ),
      };
    }
    if (tab === "listaApontamentos") {
      return {
        secondary: [closeBtn, voltarBtn("listaRuas"), rasc],
        primary: (
          <Button
            onClick={() => setTab("final")}
            disabled={blocked || totais.qtdBuracos === 0}
            className="w-full sm:w-auto"
          >
            Ir para finalização
          </Button>
        ),
      };
    }
    // final
    return {
      secondary: [closeBtn, voltarBtn("listaApontamentos"), rasc],
      primary: (
        <Button
          onClick={finalizar}
          disabled={blocked || mutation.isPending || totais.qtdBuracos === 0}
          className="w-full sm:w-auto"
        >
          {mutation.isPending ? "Salvando..." : "Salvar Registro"}
        </Button>
      ),
    };
  };

  const renderFooter = () => {
    const { secondary, primary } = renderFooterParts();
    return (
      <div className="flex flex-col-reverse gap-2 w-full sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">{secondary}</div>
        <div className="w-full sm:w-auto">{primary}</div>
      </div>
    );
  };

  // Previews de fotos do buraco em edição
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  useEffect(() => {
    const urls = buracoForm.fotos.map((f) => URL.createObjectURL(f));
    setFotosUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [buracoForm.fotos]);

  // Lista linear de todos os buracos (para aba Lista Apontamentos)
  const buracosLinear = useMemo(() => {
    const all: { rua: RuaLocal; buraco: BuracoLocal }[] = [];
    ruas.forEach((r) => r.buracos.forEach((b) => all.push({ rua: r, buraco: b })));
    return all.sort((a, b) => a.buraco.sequenciaAplicacao - b.buraco.sequenciaAplicacao);
  }, [ruas]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="w-[calc(100vw-16px)] sm:w-auto sm:max-w-5xl max-h-[calc(100dvh-16px)] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 pr-8 text-base sm:text-lg leading-tight">
              <span className="break-words">{isEditMode ? "Editar Registro Manual de Aplicação" : "Novo Registro Manual de Aplicação"}</span>
              <Badge className="text-[10px] sm:text-xs px-1.5 py-0.5 self-start" variant="outline">
                Nº será atribuído
              </Badge>
              <Badge
                className="text-[10px] sm:text-xs px-1.5 py-0.5 self-start"
                variant={
                  estado === "em_andamento"
                    ? "destructive"
                    : estado === "finalizando"
                    ? "default"
                    : "secondary"
                }
              >
                {estado === "rascunho"
                  ? currentDraftId
                    ? "Rascunho salvo"
                    : "Rascunho local"
                  : estado === "em_andamento"
                  ? "Em andamento"
                  : "Finalizando..."}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {isMobile && (
            <div className="shrink-0 px-4 pt-3 pb-2 border-b space-y-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Etapa {stepIndex + 1} de {STEPS.length}
                </div>
                <div className="text-base font-semibold truncate">{currentStepLabel}</div>
              </div>
              <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 sm:px-6 py-4 min-w-0">
            <Tabs value={tab} onValueChange={setTab} className="w-full min-w-0">
              {!isMobile && (
                <TabsList className="grid grid-cols-6 w-full">
                  <TabsTrigger value="iniciais">1. Dados Iniciais</TabsTrigger>
                  <TabsTrigger value="carga">2. Carga</TabsTrigger>
                  <TabsTrigger value="apontamento">3. Apontamento</TabsTrigger>
                  <TabsTrigger value="listaRuas">4. Ruas ({ruas.length})</TabsTrigger>
                  <TabsTrigger value="listaApontamentos">
                    5. Apontamentos ({totais.qtdBuracos})
                  </TabsTrigger>
                  <TabsTrigger value="final">6. Finalização</TabsTrigger>
                </TabsList>
              )}

              {/* ============ ABA 1: Dados Iniciais ============ */}
              <TabsContent value="iniciais" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Centro de Custo *</Label>
                    <Combobox
                      options={centrosCustoOpts}
                      value={ini.centroCustoId}
                      onChange={(v) => setIni({ ...ini, centroCustoId: v })}
                      placeholder="Selecione ou digite código/nome"
                      searchPlaceholder="Buscar por código ou nome..."
                      emptyText="Nenhum centro de custo encontrado"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Atividade *</Label>
                    <Select
                      value={ini.atividade}
                      onValueChange={(v) => setIni({ ...ini, atividade: v as Atividade })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tapa_buraco">Tapa-buraco</SelectItem>
                        <SelectItem value="pavimentacao_mecanizada">Pavimentação mecanizada</SelectItem>
                        <SelectItem value="fresagem">Fresagem</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input type="date" value={ini.data} onChange={(e) => setIni({ ...ini, data: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Hora de chegada</Label>
                    <Input type="time" value={ini.horaChegada} onChange={(e) => setIni({ ...ini, horaChegada: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <Label>Equipe *</Label>
                    <Combobox
                      options={equipesOpts}
                      value={ini.equipeId}
                      onChange={(v) => setIni({ ...ini, equipeId: v })}
                      placeholder={equipesQ.isLoading ? "Carregando..." : "Selecione a equipe"}
                      searchPlaceholder="Buscar equipe..."
                      emptyText="Nenhuma equipe encontrada"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Condomínio</Label>
                    <Select value={ini.condominio} onValueChange={(v) => setIni({ ...ini, condominio: v as any })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao">Não</SelectItem>
                        <SelectItem value="sim">Sim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="h-3 w-3 mt-0.5" />
                  <span>
                    Logradouros, bairros, coordenadas e apontamentos são declarados nas próximas etapas
                    (Apontamento → Rua atual). Cada rua recebe sua própria numeração de buracos.
                  </span>
                </div>
              </TabsContent>

              {/* ============ ABA 2: Carga ============ */}
              <TabsContent value="carga" className="space-y-4">
                {blocked && AlertBloqueio}
                <div className={blocked ? "opacity-60 pointer-events-none" : ""}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Caminhão / Frota *</Label>
                      <Combobox
                        options={caminhoesOpts}
                        value={carga.caminhaoId}
                        onChange={onCaminhaoChange}
                        placeholder={caminhoesQ.isLoading ? "Carregando..." : "Selecione o caminhão"}
                        searchPlaceholder="Buscar por frota ou placa..."
                        emptyText="Nenhum caminhão encontrado"
                        disabled={blocked}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Placa</Label>
                      <Input value={carga.placa} readOnly className="bg-muted" disabled={blocked} />
                    </div>

                    <div className="space-y-2">
                      <Label>Motorista *</Label>
                      <Combobox
                        options={motoristasOpts}
                        value={carga.motoristaId}
                        onChange={(v) => setCarga({ ...carga, motoristaId: v })}
                        placeholder={motoristasQ.isLoading ? "Carregando..." : "Selecione o motorista"}
                        searchPlaceholder="Buscar por nome..."
                        emptyText="Nenhum motorista encontrado"
                        disabled={blocked}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Total da carga (t) *</Label>
                      <Input
                        type="number" step="0.001" min={0}
                        value={carga.totalCargaT}
                        onChange={(e) => setCarga({ ...carga, totalCargaT: e.target.value })}
                        disabled={blocked}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Temperatura da massa (°C) *</Label>
                      <Input
                        type="number" step="0.1"
                        value={carga.temperaturaMassa}
                        onChange={(e) => setCarga({ ...carga, temperaturaMassa: e.target.value })}
                        disabled={blocked}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de traço *</Label>
                      <Select
                        value={carga.tipoTraco}
                        onValueChange={(v) => setCarga({ ...carga, tipoTraco: v as any })}
                        disabled={blocked}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_TRACO.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Tipo de pintura *</Label>
                      <Select
                        value={carga.tipoPintura}
                        onValueChange={(v) => setCarga({ ...carga, tipoPintura: v as any })}
                        disabled={blocked}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {TIPOS_PINTURA.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* ============ ABA 3: Apontamento (Rua + Buraco) ============ */}
              <TabsContent value="apontamento" className="space-y-4">
                {blocked && AlertBloqueio}
                {estado !== "em_andamento" && !blocked && (
                  <Alert>
                    <Play className="h-4 w-4" />
                    <AlertDescription>
                      Volte à aba <b>Carga</b> e clique em <b>Iniciar aplicação</b>.
                    </AlertDescription>
                  </Alert>
                )}

                <div className={blocked || estado !== "em_andamento" ? "opacity-60 pointer-events-none" : ""}>
                  {/* -- A) RUA ATUAL (colapsável) -- */}
                  <Card>
                    <CardContent className="pt-4 space-y-3">

                      {ruas.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-xs text-muted-foreground mr-1">Trocar para:</span>
                          {ruas.map((r) => (
                            <Button
                              key={r.idLocal}
                              type="button"
                              size="sm"
                              variant={r.idLocal === ruaAtualId ? "default" : "outline"}
                              className="h-6 text-xs"
                              onClick={() => trocarParaRua(r.idLocal)}
                            >
                              {describeRua(r)} ({r.buracos.length})
                            </Button>
                          ))}
                        </div>
                      )}

                      <Collapsible open={ruaFormOpen} onOpenChange={setRuaFormOpen}>
                        {!ruaFormOpen && (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full gap-2"
                            disabled={estado !== "em_andamento"}
                            onClick={handleAdicionarRuaClick}
                          >
                            <Plus className="h-4 w-4" />
                            {ruas.length === 0 ? "Adicionar rua" : "Nova rua"}
                          </Button>
                        )}
                        <CollapsibleContent className="space-y-3 pt-2">

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="space-y-1 md:col-span-2">
                              <Label className="text-xs">Logradouro *</Label>
                              <AddressAutocomplete
                                value={ruaForm.logradouro}
                                initialLatitude={ruaForm.latitude ?? undefined}
                                initialLongitude={ruaForm.longitude ?? undefined}
                                onAddressSelected={onRuaAddressSelected}
                                placeholder="Digite o endereço da rua..."
                                context={enderecoContext}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Bairro *</Label>
                              <Input
                                value={ruaForm.bairro}
                                onChange={(e) =>
                                  setRuaForm({
                                    ...ruaForm,
                                    bairro: e.target.value,
                                    origemLocalizacao: ruaForm.origemLocalizacao || "manual",
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Cidade</Label>
                              <Input
                                value={ruaForm.cidade}
                                onChange={(e) =>
                                  setRuaForm({
                                    ...ruaForm,
                                    cidade: e.target.value,
                                    origemLocalizacao: ruaForm.origemLocalizacao || "manual",
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">UF</Label>
                              <Input
                                value={ruaForm.uf}
                                maxLength={2}
                                onChange={(e) =>
                                  setRuaForm({
                                    ...ruaForm,
                                    uf: e.target.value.toUpperCase(),
                                    origemLocalizacao: ruaForm.origemLocalizacao || "manual",
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setRuaForm(emptyRuaForm());
                                setRuaFormOpen(false);
                                setEditingRuaId(null);
                                setAutoLoc({ status: "idle" });
                              }}
                              className="w-full sm:w-auto"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={iniciarRuaAtual}
                              className="gap-2 w-full sm:w-auto"
                              disabled={estado !== "em_andamento"}
                            >
                              <MapPin className="h-4 w-4" />
                              Salvar rua
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>

                    </CardContent>
                  </Card>


                  {/* -- B) BURACO / APONTAMENTO (colapsável) -- */}
                  <Card className="mt-3">
                    <CardContent className="pt-4 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="font-semibold text-sm">Buraco / apontamento</h4>
                        <div className="text-xs text-muted-foreground">{proximoRotuloBuraco}</div>
                      </div>

                      {!ruaAtualId && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            Adicione ou selecione uma <b>rua</b> antes de iniciar apontamentos.
                          </AlertDescription>
                        </Alert>
                      )}

                      <Collapsible open={buracoFormOpen} onOpenChange={setBuracoFormOpen}>
                        {!buracoFormOpen && (
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              className="w-full gap-2"
                              disabled={estado !== "em_andamento" || !ruaAtualId}
                            >
                              <Play className="h-4 w-4" />
                              Iniciar aplicação
                            </Button>
                          </CollapsibleTrigger>
                        )}
                        <CollapsibleContent className="space-y-3 pt-2">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {ini.atividade !== "tapa_buraco" && (
                              <div className="space-y-1">
                                <Label className="text-xs">Tipo *</Label>
                                <Select
                                  value={buracoForm.tipo_item}
                                  onValueChange={(v) => setBuracoForm({ ...buracoForm, tipo_item: v })}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    {tiposPermitidos.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
                                  </SelectContent>
                                </Select>
                              </div>
                            )}

                            <div className="space-y-1">
                              <Label className="text-xs">Bordo</Label>
                              <Select
                                value={buracoForm.bordo}
                                onValueChange={(v) => setBuracoForm({ ...buracoForm, bordo: v as Bordo })}
                              >
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                  {BORDOS.map((b) => (<SelectItem key={b} value={b}>{b}</SelectItem>))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Comprimento (m) *</Label>
                              <Input type="number" step="0.01" min={0}
                                value={buracoForm.comprimento}
                                onChange={(e) => setBuracoForm({ ...buracoForm, comprimento: e.target.value })}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Largura média (m) *</Label>
                              <Input type="number" step="0.01" min={0}
                                value={buracoForm.larguraMedia}
                                onChange={(e) => setBuracoForm({ ...buracoForm, larguraMedia: e.target.value })}
                              />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Área (m²) — calculada</Label>
                              <Input value={areaCalc || ""} readOnly className="bg-muted" />
                            </div>

                            <div className="space-y-1">
                              <Label className="text-xs">Temp. aplicação (°C)</Label>
                              <Input type="number" step="0.1" min={0}
                                value={buracoForm.temperaturaAplicacao}
                                onChange={(e) => setBuracoForm({ ...buracoForm, temperaturaAplicacao: e.target.value })}
                              />
                            </div>

                            <div className="space-y-1 md:col-span-3">
                              <Label className="text-xs">Observação do apontamento</Label>
                              <Textarea rows={2}
                                value={buracoForm.observacao}
                                onChange={(e) => setBuracoForm({ ...buracoForm, observacao: e.target.value })}
                              />
                            </div>
                          </div>

                          {/* Cálculo estimado (read-only, colapsado por padrão) */}
                          <Collapsible open={calculoAberto} onOpenChange={setCalculoAberto}>
                            <CollapsibleTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full justify-between text-xs"
                              >
                                Cálculo estimado (área · tonelada · espessura)
                                <ChevronDown className={`h-3 w-3 transition-transform ${calculoAberto ? "rotate-180" : ""}`} />
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="grid grid-cols-3 gap-3 pt-2 text-xs">
                              {(() => {
                                const cargaT = Number(carga.totalCargaT) || 0;
                                const areaTotalAtual = ruas.reduce(
                                  (s, r) => s + r.buracos.reduce((s2, b) => s2 + (b.areaCalculada || 0), 0),
                                  0
                                ) + (areaCalc || 0);
                                const tonEstimada =
                                  cargaT > 0 && areaTotalAtual > 0 && areaCalc > 0
                                    ? cargaT * (areaCalc / areaTotalAtual)
                                    : areaCalc * (ESPESSURA_PADRAO_CM / 100) * DENSIDADE_DEFAULT;
                                const espEstimada =
                                  cargaT > 0 && areaTotalAtual > 0
                                    ? (cargaT * 100) / (areaTotalAtual * DENSIDADE_DEFAULT)
                                    : ESPESSURA_PADRAO_CM;
                                return (
                                  <>
                                    <div className="rounded-md border p-2 bg-muted/40">
                                      <div className="text-muted-foreground">Área</div>
                                      <div className="font-semibold">{areaCalc.toFixed(2)} m²</div>
                                    </div>
                                    <div className="rounded-md border p-2 bg-muted/40">
                                      <div className="text-muted-foreground">Tonelada estimada</div>
                                      <div className="font-semibold">{tonEstimada.toFixed(3)} t</div>
                                    </div>
                                    <div className="rounded-md border p-2 bg-muted/40">
                                      <div className="text-muted-foreground">Espessura média</div>
                                      <div className="font-semibold">{espEstimada.toFixed(2)} cm</div>
                                    </div>
                                    <div className="col-span-3 text-[10px] text-muted-foreground">
                                      Rateio proporcional por área. A tonelada final é ajustada no envio para
                                      somar exatamente <b>{cargaT.toFixed(3)} t</b> (carga do caminhão).
                                    </div>
                                  </>
                                );
                              })()}
                            </CollapsibleContent>
                          </Collapsible>



                          {/* B.3.5-D.M2 — Toggle captura de GPS do apontamento */}
                          <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <div>
                                <Label className="text-xs font-medium">Capturar coordenadas (GPS)</Label>
                                <p className="text-[10px] text-muted-foreground">
                                  Desative se estiver fora do local ou não quiser registrar a posição.
                                </p>
                              </div>
                            </div>
                            <Switch
                              checked={capturarGpsBuraco}
                              onCheckedChange={setCapturarGpsBuraco}
                              aria-label="Capturar coordenadas do apontamento"
                            />
                          </div>

                          {/* Fotos do buraco */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label className="text-xs">Fotos do apontamento</Label>
                              <span className="text-[10px] text-muted-foreground">
                                {buracoForm.fotos.length} / {MAX_FOTOS_BURACO}
                              </span>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => document.getElementById("foto-buraco-input")?.click()}
                                disabled={buracoForm.fotos.length >= MAX_FOTOS_BURACO}
                              >
                                <Camera className="h-4 w-4" />
                                Registrar imagem
                              </Button>
                              <input
                                id="foto-buraco-input"
                                type="file"
                                accept="image/*"
                                multiple
                                capture="environment"
                                className="hidden"
                                onChange={(e) => {
                                  onFotosChange(e.target.files);
                                  e.target.value = "";
                                }}
                              />
                              <span className="text-[11px] text-muted-foreground self-center">
                                Fotos ficam vinculadas a este apontamento (local — não enviadas ao servidor na Fase A).
                              </span>
                            </div>
                            {buracoForm.fotos.length > 0 && (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                {buracoForm.fotos.map((f, idx) => (
                                  <div key={idx} className="relative border rounded-md overflow-hidden bg-muted/30">
                                    <img
                                      src={fotosUrls[idx]}
                                      alt={f.name}
                                      className="w-full h-20 object-cover"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removerFotoAtual(idx)}
                                      className="absolute top-0.5 right-0.5 bg-background/90 border rounded-full p-0.5 shadow"
                                      aria-label="Remover foto"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col sm:flex-row sm:justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const tipoPadrao = ini.atividade === "tapa_buraco" ? "buraco" : tiposPermitidos[0];
                                setBuracoForm(emptyBuracoForm(tipoPadrao));
                                setEditBuracoRef(null);
                                setBuracoFormOpen(false);
                                setCalculoAberto(false);
                              }}
                              className="w-full sm:w-auto"
                            >
                              Cancelar
                            </Button>
                            <Button
                              type="button"
                              onClick={salvarApontamento}
                              disabled={estado !== "em_andamento" || !ruaAtualId || capturandoGeo}
                              className="gap-2 w-full sm:w-auto"
                            >
                              <ImagePlus className="h-4 w-4" />
                              {capturandoGeo ? "Capturando GPS..." : editBuracoRef ? "Atualizar apontamento" : "Salvar apontamento"}
                            </Button>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>

                </div>
              </TabsContent>

              {/* ============ ABA 4: Lista Ruas ============ */}
              <TabsContent value="listaRuas" className="space-y-3">
                {blocked && AlertBloqueio}
                {ruas.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhuma rua iniciada ainda.</div>
                ) : (
                  <div className="space-y-2">
                    {totais.ruasComTotais.map(({ rua, areaRua, toneladaRua }) => (
                      <Card key={rua.idLocal}>
                        <CardContent className="pt-4 space-y-2">
                          <div className="flex items-start justify-between gap-2 flex-wrap">
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-sm break-words">{rua.logradouro}</div>
                              <div className="text-xs text-muted-foreground break-words">
                                {rua.bairro || "-"}{rua.cidade ? ` · ${rua.cidade}` : ""}{rua.uf ? ` / ${rua.uf}` : ""}
                              </div>
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0">
                              {rua.buracos.length} buracos
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Área total:</span>{" "}
                              {areaRua.toFixed(2)} m²
                            </div>
                            <div>
                              <span className="text-muted-foreground">Tonelada estimada:</span>{" "}
                              {toneladaRua.toFixed(3)} t
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-muted-foreground">Espessura média:</span>{" "}
                              <span>{totais.espessuraMediaCm > 0 ? formatBR(totais.espessuraMediaCm) : "-"} cm</span>
                              <EspessuraBadge classificacao={classificarEspessuraMedia(totais.espessuraMediaCm)} />
                            </div>

                            <div>
                              <span className="text-muted-foreground">Fotos:</span>{" "}
                              {rua.buracos.reduce((s, b) => s + b.fotosCount, 0)}
                            </div>
                          </div>
                          <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => trocarParaRua(rua.idLocal)}
                              disabled={estado !== "em_andamento"}
                              className="w-full sm:w-auto"
                            >
                              Continuar aplicando nesta rua
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => editarRua(rua.idLocal)}
                              disabled={estado !== "em_andamento"}
                              className="w-full sm:w-auto gap-1"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar rua
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removerRua(rua.idLocal)}
                              disabled={estado !== "em_andamento"}
                              className="w-full sm:w-auto gap-1 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remover rua
                            </Button>
                          </div>

                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <Info className="h-3 w-3" />
                  Tonelada por rua é <b>estimada por rateio de área</b> (não há balança por rua).
                </div>
              </TabsContent>

              {/* ============ ABA 5: Lista Apontamentos ============ */}
              <TabsContent value="listaApontamentos" className="space-y-3">
                {blocked && AlertBloqueio}
                {buracosLinear.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Nenhum apontamento salvo ainda.</div>
                ) : (
                  <>
                    {/* Mobile: cards */}
                    <div className="md:hidden space-y-2">
                      {buracosLinear.map(({ rua, buraco }) => (
                        <Card key={buraco.idLocal}>
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-sm truncate">
                                  {describeRua(rua)} · {rotuloItem(buraco.tipo_item, buraco.sequenciaRua)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  Seq geral {buraco.sequenciaAplicacao}
                                  {buraco.bordo ? ` · ${buraco.bordo}` : ""}
                                </div>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <Button size="icon" variant="ghost" onClick={() => editarBuraco(rua.idLocal, buraco.idLocal)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => removerBuraco(rua.idLocal, buraco.idLocal)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                              <div><span className="text-muted-foreground">Comp:</span> {buraco.comprimento || "-"} m</div>
                              <div><span className="text-muted-foreground">Larg:</span> {buraco.larguraMedia || "-"} m</div>
                              <div><span className="text-muted-foreground">Área:</span> {buraco.areaCalculada || "-"} m²</div>
                              <div><span className="text-muted-foreground">Esp:</span> {buraco.espessura || "-"} cm</div>
                              <div className="col-span-2">
                                <span className="text-muted-foreground">GPS:</span>{" "}
                                {buraco.gps
                                  ? `${buraco.gps.latitude.toFixed(5)}, ${buraco.gps.longitude.toFixed(5)} (±${Math.round(buraco.gps.accuracy)}m)`
                                  : "não capturado"}
                              </div>
                              <div><span className="text-muted-foreground">Fotos:</span> {buraco.fotosCount}</div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Desktop: tabela */}
                    <div className="hidden md:block border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Seq geral</TableHead>
                            <TableHead>Rua</TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Bordo</TableHead>
                            <TableHead className="text-right">Comp (m)</TableHead>
                            <TableHead className="text-right">Larg (m)</TableHead>
                            <TableHead className="text-right">Área (m²)</TableHead>
                            <TableHead className="text-right">Esp (cm)</TableHead>
                            <TableHead>GPS</TableHead>
                            <TableHead>Fotos</TableHead>
                            <TableHead>Ações</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {buracosLinear.map(({ rua, buraco }) => (
                            <TableRow key={buraco.idLocal}>
                              <TableCell>{buraco.sequenciaAplicacao}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{describeRua(rua)}</TableCell>
                              <TableCell>{rotuloItem(buraco.tipo_item, buraco.sequenciaRua)}</TableCell>
                              <TableCell>{buraco.bordo || "-"}</TableCell>
                              <TableCell className="text-right">{buraco.comprimento || "-"}</TableCell>
                              <TableCell className="text-right">{buraco.larguraMedia || "-"}</TableCell>
                              <TableCell className="text-right">{buraco.areaCalculada || "-"}</TableCell>
                              <TableCell className="text-right">{buraco.espessura || "-"}</TableCell>
                              <TableCell className="text-xs">
                                {buraco.gps
                                  ? `±${Math.round(buraco.gps.accuracy)}m`
                                  : "-"}
                              </TableCell>
                              <TableCell>{buraco.fotosCount}</TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => editarBuraco(rua.idLocal, buraco.idLocal)}>
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => removerBuraco(rua.idLocal, buraco.idLocal)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </>
                )}
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-amber-600" />
                  Numeração <b>Buraco NN</b> é por rua. <b>Seq geral</b> é cronológica no registro.
                  Fotos serão enviadas ao salvar o registro.
                </div>
              </TabsContent>

              {/* ============ ABA 6: Finalização ============ */}
              <TabsContent value="final" className="space-y-3">
                {blocked && AlertBloqueio}
                <div className={blocked ? "opacity-60 pointer-events-none" : ""}>
                  <Card>
                    <CardContent className="pt-4 space-y-1 text-sm">
                      <h4 className="font-semibold text-sm mb-2">Registro</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        <div><b>Nº aplicação manual:</b> <span className="text-muted-foreground">a atribuir na finalização (Fase B)</span></div>
                        <div><b>Data:</b> {ini.data}</div>
                        <div><b>Hora chegada:</b> {ini.horaChegada || "-"}</div>
                        <div><b>Atividade:</b> {ini.atividade}</div>
                        <div><b>Centro de custo:</b> {(() => {
                          const cc = centrosCusto.find((c) => c.id === ini.centroCustoId);
                          if (!cc) return "-";
                          const cod = (cc.codigo_centro_custo || "").trim();
                          const nome = (cc.nome_centro_custo || "").trim();
                          return cod && nome ? `[${cod}] ${nome}` : (cod || nome || "-");
                        })()}</div>
                        <div><b>Equipe:</b> {equipesQ.data?.find((e) => e.id === ini.equipeId)?.nome_equipe || "-"}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 space-y-1 text-sm">
                      <h4 className="font-semibold text-sm mb-2">Caminhão</h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        <div><b>Caminhão/Frota:</b> {carga.frota || "-"}</div>
                        <div><b>Placa:</b> {carga.placa || "-"}</div>
                        <div className="break-words"><b>Motorista:</b> {motoristasQ.data?.find((m) => m.id === carga.motoristaId)?.nome_completo || "-"}</div>
                        <div><b>Total carga:</b> {carga.totalCargaT} t</div>
                        <div><b>Temp. massa:</b> {carga.temperaturaMassa} °C</div>
                        <div><b>Última temp. aplicação:</b> {ultimaTempAplicacao ?? "-"} °C</div>
                        <div><b>Traço:</b> {carga.tipoTraco || "-"}</div>
                        <div><b>Pintura:</b> {carga.tipoPintura || "-"}</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="pt-4 space-y-3 text-sm">
                      <h4 className="font-semibold text-sm">Resumo técnico da aplicação</h4>
                      {(() => {
                        const classif = classificarEspessuraMedia(totais.espessuraMediaCm);
                        return (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                            <div><b>Área total aplicada:</b> {formatBR(totais.areaTotal)} m²</div>
                            <div><b>Carga total:</b> {totais.totalCargaT > 0 ? `${formatBR(totais.totalCargaT)} t` : "—"}</div>
                            <div><b>Densidade:</b> 2,4 t/m³</div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <b>Espessura média:</b>
                              <span>{totais.espessuraMediaCm > 0 ? `${formatBR(totais.espessuraMediaCm)} cm` : "—"}</span>
                              <EspessuraBadge classificacao={classif} />
                            </div>
                            <div className="sm:col-span-2 text-xs text-muted-foreground">
                              {classif.mensagem}
                            </div>
                          </div>
                        );
                      })()}
                      <div className="pt-2 border-t grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <div>Total de ruas: <span className="text-foreground font-medium">{totais.qtdRuas}</span></div>
                        <div>Total de buracos: <span className="text-foreground font-medium">{totais.qtdBuracos}</span></div>
                      </div>
                      {totais.ruasComTotais.length > 0 && (
                        <div className="mt-1 border-t pt-2">
                          <div className="text-xs font-semibold text-muted-foreground mb-1">
                            Tonelada estimada por rua
                          </div>
                          <ul className="text-xs space-y-0.5">
                            {totais.ruasComTotais.map(({ rua, areaRua, toneladaRua }) => (
                              <li key={rua.idLocal}>
                                <b>{describeRua(rua)}</b>: {formatBR(areaRua)} m² · {formatBR(toneladaRua, 3)} t
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>


                  <div className="space-y-2">
                    <Label>Observações finais do apontador</Label>
                    <Textarea rows={3} value={obsFinal} onChange={(e) => setObsFinal(e.target.value)} disabled={blocked} />
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <div className="shrink-0 border-t bg-background px-4 sm:px-6 py-3">{renderFooter()}</div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent className="w-[calc(100vw-2rem)] max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Existe um apontamento em andamento</AlertDialogTitle>
            <AlertDialogDescription>
              Este registro possui um rascunho local salvo neste dispositivo. Você pode continuar
              editando ou fechar e manter o rascunho para continuar depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <AlertDialogCancel className="mt-0">Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={handleManterRascunho}>
              Fechar e manter rascunho
            </AlertDialogAction>
            {currentDraftId && (
              <AlertDialogAction
                onClick={handleDescartarRascunho}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Descartar rascunho
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
};

export default NovoRegistroManualModal;
