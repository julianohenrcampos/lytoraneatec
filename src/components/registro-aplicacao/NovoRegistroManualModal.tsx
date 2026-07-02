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
import { Trash2, Pencil, AlertTriangle, Info, Lock, ImagePlus, X, Save } from "lucide-react";
import { toast } from "sonner";
import { useCriarRegistroManual } from "@/hooks/registro-aplicacao/useCriarRegistroManual";
import {
  useCaminhoesParaAplicacao,
  useMotoristasParaAplicacao,
  useEquipesParaAplicacao,
} from "@/hooks/registro-aplicacao/useCadastrosManual";
import {
  useRegistroManualDrafts,
  type RegistroManualDraft,
} from "@/hooks/registro-aplicacao/useRegistroManualDrafts";
import { getCurrentBrazilianDate } from "@/utils/timezoneUtils";
import AddressAutocomplete, {
  type AddressResult,
} from "@/components/shared/AddressAutocomplete";
import { useIsMobile } from "@/hooks/use-mobile";

const STEPS: { value: string; label: string }[] = [
  { value: "iniciais", label: "Dados Iniciais" },
  { value: "carga", label: "Dados da Carga" },
  { value: "apontamento", label: "Apontamento" },
  { value: "lista", label: "Lista" },
  { value: "imagens", label: "Imagens" },
  { value: "final", label: "Finalização" },
];

type Atividade = "tapa_buraco" | "pavimentacao_mecanizada" | "fresagem";
type EstadoInterno = "rascunho" | "em_andamento" | "finalizando";
type Bordo = "Direito" | "Esquerdo" | "Centro" | "Único" | "Embocadura";
type OrigemLoc = "digitado" | "geocode" | "mapa" | "manual" | "";

const BORDOS: Bordo[] = ["Direito", "Esquerdo", "Centro", "Único", "Embocadura"];
const TIPOS_TRACO = ["5A", "4C"] as const;
const TIPOS_PINTURA = ["Imprimação", "RR-1C"] as const;

const MAX_IMAGENS = 6;
const MAX_IMG_BYTES = 5 * 1024 * 1024;
const DENSIDADE_DEFAULT = 2.4;

const TIPOS_POR_ATIVIDADE: Record<Atividade, string[]> = {
  tapa_buraco: ["buraco"],
  pavimentacao_mecanizada: ["faixa", "trecho", "bordo", "embocadura"],
  fresagem: ["faixa", "trecho"],
};

const rotuloSeq = (tipo_item: string, seq: number): string => {
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

interface CentroCustoOpt {
  id: string;
  codigo_centro_custo?: string;
  nome_centro_custo?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  centrosCusto: CentroCustoOpt[];
  /** Se fornecido, o modal carrega o rascunho local com este id ao abrir. */
  draftId?: string | null;
}

interface DadosIniciaisState {
  centroCustoId: string;
  atividade: Atividade;
  data: string;
  horaChegada: string;
  equipeId: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  condominio: "sim" | "nao" | "";
  latitude: number | null;
  longitude: number | null;
  origemLocalizacao: OrigemLoc;
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

interface ApontamentoLocal {
  bordo: Bordo | "";
  comprimento: string;
  larguraMedia: string;
  toneladaAplicada: string;
  espessura: string;
  densidade: string;
  lastEdited: "tonelada" | "espessura" | "";
  temperaturaAplicacao: string;
  tipo_item: string;
  observacao: string;
}

interface ItemSalvo extends ApontamentoLocal {
  seq: number;
  areaCalculada: number;
}

const emptyIniciais = (): DadosIniciaisState => ({
  centroCustoId: "",
  atividade: "tapa_buraco",
  data: "",
  horaChegada: "",
  equipeId: "",
  logradouro: "",
  bairro: "",
  cidade: "",
  uf: "",
  cep: "",
  condominio: "",
  latitude: null,
  longitude: null,
  origemLocalizacao: "",
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

const ESPESSURA_PADRAO_CM = 5;

const emptyApont = (tipo: string): ApontamentoLocal => ({
  bordo: "",
  comprimento: "",
  larguraMedia: "",
  toneladaAplicada: "",
  espessura: String(ESPESSURA_PADRAO_CM),
  densidade: String(DENSIDADE_DEFAULT),
  lastEdited: "",
  temperaturaAplicacao: "",
  tipo_item: tipo,
  observacao: "",
});

const NovoRegistroManualModal: React.FC<Props> = ({
  open,
  onOpenChange,
  centrosCusto,
  draftId = null,
}) => {
  const [tab, setTab] = useState<string>("iniciais");
  const [estado, setEstado] = useState<EstadoInterno>("rascunho");
  const [iniciaisOk, setIniciaisOk] = useState(false);
  const [ini, setIni] = useState<DadosIniciaisState>(emptyIniciais());
  const [carga, setCarga] = useState<DadosCargaState>(emptyCarga());
  const [apont, setApont] = useState<ApontamentoLocal>(emptyApont("buraco"));
  const [itens, setItens] = useState<ItemSalvo[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [obsFinal, setObsFinal] = useState<string>("");
  const [imagens, setImagens] = useState<File[]>([]);
  const [imagensUrls, setImagensUrls] = useState<string[]>([]);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const isMobile = useIsMobile();
  const stepIndex = Math.max(
    0,
    STEPS.findIndex((s) => s.value === tab)
  );
  const currentStepLabel = STEPS[stepIndex]?.label ?? "";

  const caminhoesQ = useCaminhoesParaAplicacao(open);
  const motoristasQ = useMotoristasParaAplicacao(open);
  const equipesQ = useEquipesParaAplicacao(open);

  const { saveDraft, loadDraft, removeDraft } = useRegistroManualDrafts();

  // Contexto geo do Centro de Custo selecionado (SOMENTE LEITURA).
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
    const cidade = (ini.cidade || cc?.endereco_cidade || "").trim() || undefined;
    const uf = (ini.uf || cc?.endereco_estado || "").trim() || undefined;
    const bairro = (ini.bairro || cc?.endereco_bairro || "").trim() || undefined;
    if (!proximity && !cidade && !uf && !bairro) return undefined;
    return { proximity, cidade, uf, bairro };
  }, [ccGeoQ.data, ini.cidade, ini.uf, ini.bairro]);

  const tiposPermitidos = useMemo(() => TIPOS_POR_ATIVIDADE[ini.atividade], [ini.atividade]);

  const mutation = useCriarRegistroManual({
    onSuccess: () => {
      // Ao concluir com sucesso, descarta rascunho persistido (se houver).
      if (currentDraftId) removeDraft(currentDraftId);
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


  const equipesOpts = useMemo(
    () => (equipesQ.data || []).map((e) => ({ value: e.id, label: e.nome_equipe })),
    [equipesQ.data]
  );

  const caminhoesOpts = useMemo(
    () =>
      (caminhoesQ.data || []).map((c) => ({
        value: c.id,
        label:
          (c.frota || c.numero_frota || "s/frota") + (c.placa ? ` — ${c.placa}` : ""),
      })),
    [caminhoesQ.data]
  );

  const motoristasOpts = useMemo(
    () =>
      (motoristasQ.data || []).map((m) => ({
        value: m.id,
        label: m.nome_completo,
        searchText: `${m.nome_completo} ${m.funcao_nome ?? ""}`.trim(),
      })),
    [motoristasQ.data]
  );

  // ============== Images previews ==============
  useEffect(() => {
    const urls = imagens.map((f) => URL.createObjectURL(f));
    setImagensUrls(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [imagens]);

  const hardReset = () => {
    setTab("iniciais");
    setEstado("rascunho");
    setIniciaisOk(false);
    setIni(emptyIniciais());
    setCarga(emptyCarga());
    setApont(emptyApont("buraco"));
    setItens([]);
    setEditIdx(null);
    setObsFinal("");
    setImagens([]);
    setCurrentDraftId(null);
  };

  // ============== Open effect / draft hydration ==============
  useEffect(() => {
    if (!open) return;

    if (draftId) {
      const d = loadDraft(draftId);
      if (d) {
        setCurrentDraftId(d.id);
        setTab(d.lastTab || "iniciais");
        setIni({ ...emptyIniciais(), ...(d.ini || {}) });
        setCarga({ ...emptyCarga(), ...(d.carga || {}) });
        setItens(Array.isArray(d.itens) ? d.itens : []);
        setObsFinal(d.obsFinal || "");
        setIniciaisOk(true);
        setEstado("rascunho");
        setImagens([]);
        setApont(emptyApont(d.ini?.atividade === "tapa_buraco" ? "buraco" : "faixa"));
        setEditIdx(null);
        return;
      }
    }

    // Fresh open
    const iso = getCurrentBrazilianDate();
    const now = new Date();
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setCurrentDraftId(null);
    setTab("iniciais");
    setEstado("rascunho");
    setIniciaisOk(false);
    setIni({ ...emptyIniciais(), data: iso, horaChegada: hhmm });
    setCarga(emptyCarga());
    setApont(emptyApont("buraco"));
    setItens([]);
    setEditIdx(null);
    setObsFinal("");
    setImagens([]);
  }, [open, draftId, loadDraft]);

  useEffect(() => {
    const tipoPadrao = ini.atividade === "tapa_buraco" ? "buraco" : tiposPermitidos[0];
    setApont((prev) => ({
      ...prev,
      tipo_item: tiposPermitidos.includes(prev.tipo_item) ? prev.tipo_item : tipoPadrao,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ini.atividade]);

  // ============== Draft persistence helpers ==============
  const buildDraftInput = () => {
    const ccSel = centrosCusto.find((c) => c.id === ini.centroCustoId);
    return {
      id: currentDraftId || undefined,
      lastTab: tab,
      ini,
      carga,
      itens,
      obsFinal,
      imagensCount: imagens.length,
      centroCustoId: ini.centroCustoId || null,
      centroCustoCodigo: (ccSel?.codigo_centro_custo || "").trim() || null,
      centroCustoNome: (ccSel?.nome_centro_custo || "").trim() || null,
    };
  };

  // ============== Auto-save (debounced) ==============
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!open) return;
    if (!iniciaisOk) return; // só começa a auto-salvar quando iniciais foram validados
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const id = saveDraft(buildDraftInput());
      if (!currentDraftId) setCurrentDraftId(id);
    }, 1000);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, iniciaisOk, tab, ini, carga, itens, obsFinal, imagens.length, currentDraftId, saveDraft]);

  const salvarRascunhoManual = () => {
    const id = saveDraft(buildDraftInput());
    if (!currentDraftId) setCurrentDraftId(id);
    toast.success("Rascunho salvo neste dispositivo.");
  };

  const temTrabalhoPendente = () =>
    itens.length > 0 || estado === "em_andamento" || iniciaisOk;

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
    // Garante persistência antes de fechar (auto-save pode estar pendente).
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



  // ---------- ABA 1 ----------
  const validarIniciais = (): string | null => {
    if (!ini.centroCustoId) return "Centro de custo é obrigatório.";
    if (!ini.atividade) return "Atividade é obrigatória.";
    if (!ini.data) return "Data é obrigatória.";
    if (!ini.equipeId) return "Equipe é obrigatória.";
    if (!ini.logradouro.trim()) return "Logradouro é obrigatório.";
    if (!ini.bairro.trim()) return "Bairro é obrigatório.";
    return null;
  };

  const salvarIniciais = () => {
    const err = validarIniciais();
    if (err) {
      toast.error(err);
      return;
    }
    setIniciaisOk(true);
    toast.success("Dados iniciais validados. Eles serão gravados ao finalizar o apontamento.");
    setTab("carga");
  };

  const onAddressSelected = (r: AddressResult) => {
    setIni((prev) => ({
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

  // ---------- ABA 2 ----------
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

  // ---------- ABA 3: cálculo bidirecional ----------
  const areaCalc = useMemo(() => {
    const c = Number(apont.comprimento) || 0;
    const l = Number(apont.larguraMedia) || 0;
    if (c > 0 && l > 0) return Number((c * l).toFixed(4));
    return 0;
  }, [apont.comprimento, apont.larguraMedia]);

  // Recalcula tonelada ⇄ espessura conforme a última entrada do usuário.
  // Quando nenhum dos dois foi tocado (lastEdited === ""), assume espessura padrão (5 cm)
  // e sugere tonelada = area × (5/100) × densidade_padrao.
  useEffect(() => {
    const dens = DENSIDADE_DEFAULT;
    if (!areaCalc || dens <= 0) return;

    const source = apont.lastEdited || "espessura";

    if (source === "espessura") {
      const espCmStr = apont.espessura || String(ESPESSURA_PADRAO_CM);
      const espM = (Number(espCmStr) || 0) / 100; // cm -> m
      if (espM > 0) {
        const ton = Number((areaCalc * espM * dens).toFixed(3));
        setApont((prev) => {
          const next: Partial<ApontamentoLocal> = {};
          if (prev.toneladaAplicada !== String(ton)) next.toneladaAplicada = String(ton);
          if (!prev.espessura) next.espessura = String(ESPESSURA_PADRAO_CM);
          return Object.keys(next).length ? { ...prev, ...next } : prev;
        });
      }
    } else if (source === "tonelada") {
      const ton = Number(apont.toneladaAplicada) || 0;
      if (ton > 0) {
        const espM = ton / (areaCalc * dens);
        const espCm = Number((espM * 100).toFixed(2));
        setApont((prev) =>
          prev.espessura === String(espCm) ? prev : { ...prev, espessura: String(espCm) }
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [areaCalc, apont.espessura, apont.toneladaAplicada, apont.lastEdited]);

  const iniciarAplicacao = () => {
    if (!iniciaisOk) return toast.error("Preencha os Dados Iniciais primeiro.");
    const errCarga = validarCarga();
    if (errCarga) return toast.error(errCarga);
    setEstado("em_andamento");
    toast.info("Aplicação iniciada. O modal está bloqueado contra fechamento acidental.");
  };

  const validarApontamento = (): string | null => {
    if (areaCalc <= 0) return "Informe Comprimento e Largura (> 0). A área é calculada automaticamente.";
    if (!apont.tipo_item) return "Tipo do item é obrigatório.";
    if (!tiposPermitidos.includes(apont.tipo_item))
      return `Tipo inválido para atividade ${ini.atividade}.`;
    return null;
  };

  const salvarApontamento = () => {
    if (estado !== "em_andamento") return toast.error('Clique em "Iniciar Aplicação" antes.');
    const err = validarApontamento();
    if (err) return toast.error(err);
    if (editIdx != null) {
      setItens((prev) =>
        prev.map((it, i) =>
          i === editIdx ? { ...it, ...apont, areaCalculada: areaCalc } : it
        )
      );
      toast.success(`${rotuloSeq(apont.tipo_item, editIdx + 1)} atualizado.`);
      setEditIdx(null);
    } else {
      const seq = itens.length + 1;
      setItens((prev) => [...prev, { ...apont, seq, areaCalculada: areaCalc }]);
      toast.success(`${rotuloSeq(apont.tipo_item, seq)} salvo na lista.`);
    }
    const tipoPadrao = ini.atividade === "tapa_buraco" ? "buraco" : tiposPermitidos[0];
    setApont(emptyApont(tipoPadrao));
    setTab("lista");
  };

  const editarItem = (idx: number) => {
    const it = itens[idx];
    setApont({
      bordo: it.bordo,
      comprimento: it.comprimento,
      larguraMedia: it.larguraMedia,
      toneladaAplicada: it.toneladaAplicada,
      espessura: it.espessura,
      densidade: it.densidade || String(DENSIDADE_DEFAULT),
      lastEdited: it.lastEdited || "",
      temperaturaAplicacao: it.temperaturaAplicacao,
      tipo_item: it.tipo_item,
      observacao: it.observacao || "",
    });
    setEditIdx(idx);
    setTab("apontamento");
  };

  const removerItem = (idx: number) => {
    if (!window.confirm("Remover este apontamento da lista?")) return;
    setItens((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, seq: i + 1 })));
  };

  // ---------- ABA IMAGENS ----------
  const onImagensChange = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files);
    const validas: File[] = [];
    for (const f of arr) {
      if (!f.type.startsWith("image/")) {
        toast.error(`"${f.name}" não é uma imagem válida.`);
        continue;
      }
      if (f.size > MAX_IMG_BYTES) {
        toast.error(`"${f.name}" excede 5 MB.`);
        continue;
      }
      validas.push(f);
    }
    setImagens((prev) => {
      const next = [...prev, ...validas];
      if (next.length > MAX_IMAGENS) {
        toast.error(`Máximo de ${MAX_IMAGENS} imagens. Ignorando extras.`);
        return next.slice(0, MAX_IMAGENS);
      }
      return next;
    });
  };

  const removerImagem = (idx: number) => {
    setImagens((prev) => prev.filter((_, i) => i !== idx));
  };

  // ---------- ABA 5 ----------
  const totais = useMemo(() => {
    const ton = itens.reduce((s, i) => s + (Number(i.toneladaAplicada) || 0), 0);
    const area = itens.reduce((s, i) => s + (i.areaCalculada || 0), 0);
    return { ton, area, qtd: itens.length };
  }, [itens]);

  const ultimaTempAplicacao = useMemo<number | null>(() => {
    for (let i = itens.length - 1; i >= 0; i--) {
      const t = Number(itens[i].temperaturaAplicacao);
      if (!Number.isNaN(t) && t > 0) return t;
    }
    return null;
  }, [itens]);

  const buildBlocoContexto = (): string => {
    const eq = equipesQ.data?.find((e) => e.id === ini.equipeId);
    const mot = motoristasQ.data?.find((m) => m.id === carga.motoristaId);
    const linhas = [
      "[CONTEXTO_OPERACIONAL]",
      `Equipe: ${eq?.nome_equipe || ini.equipeId || "-"}`,
      `Caminhão/Frota: ${carga.frota || carga.caminhaoId || "-"}`,
      `Placa: ${carga.placa || "-"}`,
      `Motorista: ${mot?.nome_completo || carga.motoristaId || "-"}`,
      `Total carga: ${carga.totalCargaT || "-"} t`,
      
      `Tipo de traço: ${carga.tipoTraco || "-"}`,
      `Tipo de pintura: ${carga.tipoPintura || "-"}`,
      `Logradouro: ${ini.logradouro || "-"}`,
      `Bairro: ${ini.bairro || "-"}`,
      `Cidade: ${ini.cidade || "-"}`,
      `UF: ${ini.uf || "-"}`,
      `CEP: ${ini.cep || "-"}`,
      `Condomínio: ${ini.condominio === "sim" ? "Sim" : ini.condominio === "nao" ? "Não" : "-"}`,
      `Latitude: ${ini.latitude ?? "-"}`,
      `Longitude: ${ini.longitude ?? "-"}`,
      `Origem localização: ${ini.origemLocalizacao || "-"}`,
      `Imagens anexadas: ${imagens.length}`,
      "[/CONTEXTO_OPERACIONAL]",
    ];
    const espessuras = itens
      .map((it) =>
        it.espessura
          ? `- ${rotuloSeq(it.tipo_item, it.seq)}: ${it.espessura} cm`
          : ""
      )
      .filter(Boolean)
      .join("\n");
    const obsItens = itens
      .map((it) => (it.observacao?.trim() ? `- ${rotuloSeq(it.tipo_item, it.seq)}: ${it.observacao.trim()}` : ""))
      .filter(Boolean)
      .join("\n");
    const obsBloco = [
      "[OBSERVACOES_APONTADOR]",
      obsFinal.trim() || "(sem observações finais)",
      espessuras ? `\nEspessura por apontamento:\n${espessuras}` : "",
      obsItens ? `\nPor apontamento:\n${obsItens}` : "",
      "[/OBSERVACOES_APONTADOR]",
    ].join("\n");
    return `${linhas.join("\n")}\n\n${obsBloco}`;
  };

  const finalizar = () => {
    if (!iniciaisOk) return toast.error("Preencha os Dados Iniciais.");
    const errCarga = validarCarga();
    if (errCarga) return toast.error(errCarga);
    if (itens.length === 0) return toast.error("Adicione ao menos 1 apontamento antes de finalizar.");
    setEstado("finalizando");
    const tempMassa = Number(carga.temperaturaMassa);
    mutation.mutate(
      {
        cabecalho: {
          centro_custo_id: ini.centroCustoId,
          atividade: ini.atividade,
          data_aplicacao: ini.data,
          hora_chegada_local: ini.horaChegada || null,
          logradouro_aplicado: ini.logradouro.trim(),
          temperatura_chegada: !Number.isNaN(tempMassa) && tempMassa > 0 ? tempMassa : null,
          temperatura_aplicacao: ultimaTempAplicacao,
          observacoes_gerais: buildBlocoContexto(),
        },
        detalhes: itens.map((it) => ({
          tipo_item: it.tipo_item,
          logradouro_nome: ini.logradouro.trim(),
          area_aplicada: it.areaCalculada > 0 ? it.areaCalculada : null,
          comprimento: Number(it.comprimento) || null,
          largura_media: Number(it.larguraMedia) || null,
          tonelada_aplicada: Number(it.toneladaAplicada) || 0,
          bordo: it.bordo || null,
        })),
      },
      { onError: () => setEstado("em_andamento") }
    );
  };

  // ---------- RENDER ----------
  const disabledFechar = estado === "finalizando" || mutation.isPending;
  const blocked = !iniciaisOk;

  const AlertBloqueio = (
    <Alert>
      <Lock className="h-4 w-4" />
      <AlertDescription>Valide os dados iniciais antes de continuar.</AlertDescription>
    </Alert>
  );

  const proximoRotulo = editIdx != null
    ? rotuloSeq(itens[editIdx]?.tipo_item || apont.tipo_item, editIdx + 1)
    : rotuloSeq(apont.tipo_item, itens.length + 1);

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

  // Footer contextual — returns { secondary: nodes[], primary: node }
  const renderFooterParts = (): {
    secondary: React.ReactNode[];
    primary: React.ReactNode;
  } => {
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
        primary: (
          <Button
            onClick={() => {
              const err = validarCarga();
              if (err) return toast.error(err);
              setTab("apontamento");
            }}
            disabled={blocked}
            className="w-full sm:w-auto"
          >
            Continuar
          </Button>
        ),
      };
    }
    if (tab === "apontamento") {
      return {
        secondary: [closeBtn, voltarBtn("carga"), rasc],
        primary: (
          <Button
            onClick={salvarApontamento}
            disabled={blocked || estado !== "em_andamento"}
            className="w-full sm:w-auto"
          >
            {editIdx != null ? "Atualizar apontamento" : "Salvar apontamento"}
          </Button>
        ),
      };
    }
    if (tab === "lista") {
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
            onClick={() => setTab("imagens")}
            disabled={blocked || itens.length === 0}
            className="w-full sm:w-auto"
          >
            Continuar
          </Button>
        ),
      };
    }
    if (tab === "imagens") {
      return {
        secondary: [closeBtn, voltarBtn("lista"), rasc],
        primary: (
          <Button
            onClick={() => setTab("final")}
            disabled={blocked || itens.length === 0}
            className="w-full sm:w-auto"
          >
            Ir para finalização
          </Button>
        ),
      };
    }
    // final
    return {
      secondary: [closeBtn, voltarBtn("imagens"), rasc],
      primary: (
        <Button
          onClick={finalizar}
          disabled={blocked || mutation.isPending || itens.length === 0}
          className="w-full sm:w-auto"
        >
          {mutation.isPending ? "Enviando..." : "Finalizar Apontamento"}
        </Button>
      ),
    };
  };

  const renderFooter = () => {
    const { secondary, primary } = renderFooterParts();
    return (
      <div className="flex flex-col-reverse gap-2 w-full sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {secondary}
        </div>
        <div className="w-full sm:w-auto">{primary}</div>
      </div>
    );
  };


  return (
    <>
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="w-[calc(100vw-16px)] sm:w-auto sm:max-w-5xl max-h-[calc(100dvh-16px)] sm:max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0"
      >
        <DialogHeader className="shrink-0 px-4 sm:px-6 pt-4 pb-3 border-b">
          <DialogTitle className="flex flex-col sm:flex-row sm:items-center gap-2 pr-8 text-base sm:text-lg leading-tight">
            <span className="break-words">Novo Registro Manual de Aplicação</span>
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
              <div className="text-base font-semibold truncate">
                {currentStepLabel}
              </div>
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
              <TabsTrigger value="lista">4. Lista ({itens.length})</TabsTrigger>
              <TabsTrigger value="imagens">5. Imagens ({imagens.length})</TabsTrigger>
              <TabsTrigger value="final">6. Finalização</TabsTrigger>
            </TabsList>
          )}


          {/* ============ ABA 1 ============ */}
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

              <div className="space-y-2 md:col-span-2">
                <Label>Logradouro *</Label>
                <AddressAutocomplete
                  value={ini.logradouro}
                  initialLatitude={ini.latitude ?? undefined}
                  initialLongitude={ini.longitude ?? undefined}
                  onAddressSelected={onAddressSelected}
                  placeholder="Digite o endereço da obra..."
                  context={enderecoContext}
                />
              </div>

              <div className="space-y-2">
                <Label>
                  Bairro <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={ini.bairro}
                  required
                  aria-required="true"
                  onChange={(e) =>
                    setIni({
                      ...ini,
                      bairro: e.target.value,
                      origemLocalizacao: ini.origemLocalizacao || "manual",
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={ini.cidade}
                  onChange={(e) =>
                    setIni({
                      ...ini,
                      cidade: e.target.value,
                      origemLocalizacao: ini.origemLocalizacao || "manual",
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5" />
              <span>
                Bairro, cidade e coordenadas são mantidos localmente e anexados às observações no
                salvamento final. Os dados iniciais serão gravados somente ao finalizar o apontamento.
              </span>
            </div>
          </TabsContent>

          {/* ============ ABA 2 ============ */}
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

          {/* ============ ABA 3 ============ */}
          <TabsContent value="apontamento" className="space-y-4">
            {blocked && AlertBloqueio}
            <div className={blocked ? "opacity-60 pointer-events-none" : ""}>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  {editIdx != null ? `Editando ${proximoRotulo}` : `Próximo: ${proximoRotulo}`}
                </div>
                {estado !== "em_andamento" ? (
                  <Button onClick={iniciarAplicacao} disabled={blocked}>Iniciar Aplicação</Button>
                ) : (
                  <Badge variant="destructive">Em andamento</Badge>
                )}
              </div>

              <Card className="mt-3">
                <CardContent className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 min-w-0">
                  {ini.atividade !== "tapa_buraco" && (
                    <div className="space-y-1">
                      <Label className="text-xs">Tipo *</Label>
                      <Select
                        value={apont.tipo_item}
                        onValueChange={(v) => setApont({ ...apont, tipo_item: v })}
                        disabled={blocked || estado !== "em_andamento"}
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
                      value={apont.bordo}
                      onValueChange={(v) => setApont({ ...apont, bordo: v as Bordo })}
                      disabled={blocked || estado !== "em_andamento"}
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
                      value={apont.comprimento}
                      onChange={(e) => setApont({ ...apont, comprimento: e.target.value })}
                      disabled={blocked || estado !== "em_andamento"}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Largura média (m) *</Label>
                    <Input type="number" step="0.01" min={0}
                      value={apont.larguraMedia}
                      onChange={(e) => setApont({ ...apont, larguraMedia: e.target.value })}
                      disabled={blocked || estado !== "em_andamento"}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Área (m²) — calculada</Label>
                    <Input value={areaCalc || ""} readOnly className="bg-muted" disabled={blocked} />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Tonelada aplicada (t)</Label>
                    <Input type="number" step="0.001" min={0}
                      value={apont.toneladaAplicada}
                      onChange={(e) => setApont({ ...apont, toneladaAplicada: e.target.value, lastEdited: "tonelada" })}
                      disabled={blocked || estado !== "em_andamento"}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Espessura (cm)</Label>
                    <Input type="number" step="0.1" min={0}
                      value={apont.espessura}
                      onChange={(e) => setApont({ ...apont, espessura: e.target.value, lastEdited: "espessura" })}
                      disabled={blocked || estado !== "em_andamento"}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Temp. aplicação (°C)</Label>
                    <Input type="number" step="0.1"
                      value={apont.temperaturaAplicacao}
                      onChange={(e) => setApont({ ...apont, temperaturaAplicacao: e.target.value })}
                      disabled={blocked || estado !== "em_andamento"}
                    />
                  </div>

                  <div className="md:col-span-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground">
                      A tonelada e a espessura são sugeridas automaticamente com base na área e no
                      padrão de aplicação. Você pode ajustar manualmente se necessário.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setApont((prev) => ({
                          ...prev,
                          espessura: String(ESPESSURA_PADRAO_CM),
                          toneladaAplicada: "",
                          lastEdited: "",
                        }))
                      }
                      disabled={blocked || estado !== "em_andamento"}
                    >
                      Recalcular
                    </Button>
                  </div>


                  <div className="space-y-1 md:col-span-3">
                    <Label className="text-xs">Observação do apontamento atual</Label>
                    <Textarea rows={2}
                      value={apont.observacao}
                      onChange={(e) => setApont({ ...apont, observacao: e.target.value })}
                      disabled={blocked || estado !== "em_andamento"}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============ ABA 4 ============ */}
          <TabsContent value="lista" className="space-y-4">
            {blocked && AlertBloqueio}
            <div className={blocked ? "opacity-60 pointer-events-none" : ""}>
              {itens.length === 0 ? (
                <div className="text-sm text-muted-foreground">Nenhum apontamento salvo ainda.</div>
              ) : (
                <>
                  {/* Mobile: cards */}
                  <div className="md:hidden space-y-2">
                    {itens.map((it, idx) => (
                      <Card key={idx}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-sm truncate">
                                {rotuloSeq(it.tipo_item, it.seq)}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {it.tipo_item}
                                {it.bordo ? ` · ${it.bordo}` : ""}
                              </div>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => editarItem(idx)}
                                disabled={blocked}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => removerItem(idx)}
                                disabled={blocked}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                            <div>
                              <span className="text-muted-foreground">Comp:</span>{" "}
                              {it.comprimento || "-"} m
                            </div>
                            <div>
                              <span className="text-muted-foreground">Larg:</span>{" "}
                              {it.larguraMedia || "-"} m
                            </div>
                            <div>
                              <span className="text-muted-foreground">Área:</span>{" "}
                              {it.areaCalculada || "-"} m²
                            </div>
                            <div>
                              <span className="text-muted-foreground">Ton:</span>{" "}
                              {it.toneladaAplicada || "-"} t
                            </div>
                            <div>
                              <span className="text-muted-foreground">Esp:</span>{" "}
                              {it.espessura || "-"} cm
                            </div>
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
                          <TableHead>Seq</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Bordo</TableHead>
                          <TableHead className="text-right">Comp (m)</TableHead>
                          <TableHead className="text-right">Larg (m)</TableHead>
                          <TableHead className="text-right">Área (m²)</TableHead>
                          <TableHead className="text-right">Ton (t)</TableHead>
                          <TableHead className="text-right">Esp (cm)</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((it, idx) => (
                          <TableRow key={idx}>
                            <TableCell>{rotuloSeq(it.tipo_item, it.seq)}</TableCell>
                            <TableCell>{it.tipo_item}</TableCell>
                            <TableCell>{it.bordo || "-"}</TableCell>
                            <TableCell className="text-right">{it.comprimento || "-"}</TableCell>
                            <TableCell className="text-right">{it.larguraMedia || "-"}</TableCell>
                            <TableCell className="text-right">{it.areaCalculada || "-"}</TableCell>
                            <TableCell className="text-right">{it.toneladaAplicada || "-"}</TableCell>
                            <TableCell className="text-right">{it.espessura || "-"}</TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" onClick={() => editarItem(idx)} disabled={blocked}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button size="icon" variant="ghost" onClick={() => removerItem(idx)} disabled={blocked}>
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


              <div className="text-xs text-muted-foreground flex items-center gap-2 mt-2">
                <AlertTriangle className="h-3 w-3 text-amber-600" />
                Itens ficam em memória local. Só serão persistidos no banco ao clicar em "Finalizar Apontamento".
              </div>
            </div>
          </TabsContent>

          {/* ============ ABA IMAGENS ============ */}
          <TabsContent value="imagens" className="space-y-4">
            {blocked && AlertBloqueio}
            <div className={blocked ? "opacity-60 pointer-events-none" : ""}>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Atenção:</strong> as imagens ficam apenas neste dispositivo
                  (rascunho local). Ainda não há upload para o servidor — elas
                  <strong> não serão salvas</strong> junto com o registro ao finalizar.
                  Máximo {MAX_IMAGENS} imagens, 5 MB cada.
                </AlertDescription>
              </Alert>

              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mt-3">
                <Label htmlFor="imgs-input" className="inline-flex w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 w-full sm:w-auto"
                    onClick={() => document.getElementById("imgs-input")?.click()}
                    disabled={imagens.length >= MAX_IMAGENS}
                  >
                    <ImagePlus className="h-4 w-4" />
                    Adicionar imagens
                  </Button>
                </Label>
                <input
                  id="imgs-input"
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  onChange={(e) => {
                    onImagensChange(e.target.files);
                    e.target.value = "";
                  }}
                />
                <span className="text-sm text-muted-foreground">
                  {imagens.length} / {MAX_IMAGENS}
                </span>
              </div>

              {imagens.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {imagens.map((f, idx) => (
                    <div key={idx} className="relative border rounded-md overflow-hidden bg-muted/30">
                      <img
                        src={imagensUrls[idx]}
                        alt={f.name}
                        className="w-full h-32 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removerImagem(idx)}
                        className="absolute top-1 right-1 bg-background/90 border rounded-full p-1 shadow"
                        aria-label="Remover imagem"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <div className="p-1 text-[10px] truncate">{f.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ============ ABA 6 ============ */}
          <TabsContent value="final" className="space-y-4">
            {blocked && AlertBloqueio}
            <div className={blocked ? "opacity-60 pointer-events-none" : ""}>
              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <h4 className="font-semibold text-sm mb-2">Dados iniciais</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    <div className="break-words"><b>Centro de custo:</b> {(() => {
                      const cc = centrosCusto.find((c) => c.id === ini.centroCustoId);
                      if (!cc) return "-";
                      const cod = (cc.codigo_centro_custo || "").trim();
                      const nome = (cc.nome_centro_custo || "").trim();
                      return cod && nome ? `[${cod}] ${nome}` : (cod || nome || "-");
                    })()}</div>
                    <div><b>Atividade:</b> {ini.atividade}</div>
                    <div><b>Data:</b> {ini.data}</div>
                    <div><b>Hora chegada:</b> {ini.horaChegada || "-"}</div>
                    <div><b>Equipe:</b> {equipesQ.data?.find((e) => e.id === ini.equipeId)?.nome_equipe || "-"}</div>
                    <div className="break-words"><b>Logradouro:</b> {ini.logradouro}</div>
                    <div><b>Bairro:</b> {ini.bairro || "-"}</div>
                    <div><b>Cidade:</b> {ini.cidade || "-"}</div>
                    <div><b>Condomínio:</b> {ini.condominio === "sim" ? "Sim" : ini.condominio === "nao" ? "Não" : "-"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <h4 className="font-semibold text-sm mb-2">Carga</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    <div><b>Caminhão/Frota:</b> {carga.frota || "-"}</div>
                    <div><b>Placa:</b> {carga.placa || "-"}</div>
                    <div className="break-words"><b>Motorista:</b> {motoristasQ.data?.find((m) => m.id === carga.motoristaId)?.nome_completo || "-"}</div>
                    <div><b>Total da carga:</b> {carga.totalCargaT} t</div>
                    <div><b>Temp. massa:</b> {carga.temperaturaMassa} °C</div>
                    <div><b>Última temp. aplicação:</b> {ultimaTempAplicacao ?? "-"} °C</div>
                    <div><b>Traço:</b> {carga.tipoTraco || "-"}</div>
                    <div><b>Pintura:</b> {carga.tipoPintura || "-"}</div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 space-y-1 text-sm">
                  <h4 className="font-semibold text-sm mb-2">Totais</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                    <div><b>Qtd apontamentos:</b> {totais.qtd}</div>
                    <div><b>Área total (m²):</b> {totais.area.toFixed(2)}</div>
                    <div><b>Tonelada aplicada (t):</b> {totais.ton.toFixed(3)}</div>
                    <div><b>Imagens anexadas:</b> {imagens.length}</div>
                  </div>
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

        <div className="shrink-0 border-t bg-background px-4 sm:px-6 py-3">
          {renderFooter()}
        </div>

      </DialogContent>
    </Dialog>

    <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Existe um apontamento em andamento</AlertDialogTitle>
          <AlertDialogDescription>
            Este registro possui um rascunho local salvo neste dispositivo. Você pode continuar
            editando ou fechar e manter o rascunho para continuar depois.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          {currentDraftId && (
            <AlertDialogAction
              onClick={handleDescartarRascunho}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Descartar rascunho
            </AlertDialogAction>
          )}
          <AlertDialogAction onClick={handleManterRascunho}>
            Fechar e manter rascunho
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>
  );
};

export default NovoRegistroManualModal;
