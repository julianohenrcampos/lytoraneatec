import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Camera, Edit, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import type { JornadaDiariaRow } from "@/hooks/admin/useJornadasDiarias";
import { usePermission } from "@/hooks/usePermission";

interface BatidaDetalhe {
  id: string;
  tipo_batida: string;
  data_hora_considerada: string;
  modo_registro: string | null;
  latitude: number | null;
  longitude: number | null;
  dentro_raio: boolean | null;
  distancia_centro_metros: number | null;
  foto_url: string | null;
  status_validacao: string | null;
  score_risco: number | null;
  justificativa: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  jornada: JornadaDiariaRow | null;
  onChanged?: () => void;
}

const tipoLabel: Record<string, string> = {
  entrada: "Entrada",
  intervalo_inicio: "Início Intervalo",
  intervalo_fim: "Fim Intervalo",
  saida: "Saída",
};

const ModalDetalheJornada: React.FC<Props> = ({ isOpen, onClose, jornada, onChanged }) => {
  const [batidas, setBatidas] = useState<BatidaDetalhe[]>([]);
  const [loading, setLoading] = useState(false);
  const [fotoUrls, setFotoUrls] = useState<Record<string, string>>({});
  const { isSuperAdmin, hasActionPermission, permissions } = usePermission();
  const canAjustarBatida =
    isSuperAdmin ||
    permissions.includes("ponto_aprovar_ajuste") ||
    hasActionPermission("ponto_aprovar_ajuste", "aprovar");

  useEffect(() => {
    if (!isOpen || !jornada) return;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from("bd_ponto_batidas")
        .select("id, tipo_batida, data_hora_considerada, modo_registro, latitude, longitude, dentro_raio, distancia_centro_metros, foto_url, status_validacao, score_risco, justificativa")
        .eq("funcionario_id", jornada.funcionarioId)
        .eq("data_operacional", jornada.dataOperacional)
        .order("data_hora_considerada", { ascending: true });

      if (error) {
        toast.error("Erro ao carregar batidas");
        setLoading(false);
        return;
      }
      setBatidas((data || []) as BatidaDetalhe[]);

      // signed urls para fotos
      const urls: Record<string, string> = {};
      for (const b of data || []) {
        if (b.foto_url) {
          // tenta gerar signed URL do bucket ponto-fotos
          const path = (b.foto_url as string).replace(/^.*\/object\/(public|sign)\/[^/]+\//, "");
          const bucket = (b.foto_url as string).includes("biometric") ? "biometric-facial" : "ponto-fotos";
          const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
          if (signed?.signedUrl) urls[b.id] = signed.signedUrl;
          else urls[b.id] = b.foto_url as string;
        }
      }
      setFotoUrls(urls);
      setLoading(false);
    })();
  }, [isOpen, jornada]);

  const handleJustificar = async (batida: BatidaDetalhe) => {
    if (!canAjustarBatida) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    const just = window.prompt("Justificativa:", batida.justificativa || "");
    if (just === null) return;
    const { error } = await supabase
      .from("bd_ponto_batidas")
      .update({ justificativa: just })
      .eq("id", batida.id);
    if (error) {
      toast.error("Erro ao justificar");
      return;
    }
    toast.success("Justificativa salva");
    setBatidas(prev => prev.map(b => b.id === batida.id ? { ...b, justificativa: just } : b));
    onChanged?.();
  };

  const handleExcluir = async (batida: BatidaDetalhe) => {
    if (!canAjustarBatida) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    const motivo = window.prompt("Motivo da exclusão (obrigatório):", "");
    if (!motivo || !motivo.trim()) {
      toast.error("Motivo é obrigatório");
      return;
    }
    const { error } = await supabase
      .from("bd_ponto_batidas")
      .update({ status_validacao: "invalidada", justificativa: motivo })
      .eq("id", batida.id);
    if (error) {
      toast.error("Erro ao excluir batida");
      return;
    }
    toast.success("Batida invalidada");
    setBatidas(prev => prev.map(b => b.id === batida.id ? { ...b, status_validacao: "invalidada", justificativa: motivo } : b));
    onChanged?.();
  };

  const handleEditarHora = async (batida: BatidaDetalhe) => {
    if (!canAjustarBatida) {
      toast.error("Você não tem permissão para esta ação.");
      return;
    }
    const atual = format(new Date(batida.data_hora_considerada), "HH:mm");
    const nova = window.prompt("Nova hora (HH:mm):", atual);
    if (!nova || !/^\d{2}:\d{2}$/.test(nova)) return;
    const justificativa = window.prompt("Justificativa para alteração:", "");
    if (!justificativa) {
      toast.error("Justificativa obrigatória");
      return;
    }
    const [hh, mm] = nova.split(":").map(Number);
    const d = new Date(batida.data_hora_considerada);
    d.setHours(hh, mm, 0, 0);
    const { error } = await supabase
      .from("bd_ponto_batidas")
      .update({ data_hora_considerada: d.toISOString(), justificativa })
      .eq("id", batida.id);
    if (error) {
      toast.error("Erro ao editar hora");
      return;
    }
    toast.success("Hora atualizada");
    setBatidas(prev => prev.map(b => b.id === batida.id ? { ...b, data_hora_considerada: d.toISOString(), justificativa } : b));
    onChanged?.();
  };

  if (!jornada) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {jornada.funcionario_nome} — {jornada.dataOperacional.split("-").reverse().join("/")}
          </DialogTitle>
          <div className="text-sm text-muted-foreground">
            {jornada.funcionario_matricula && <span>Mat. {jornada.funcionario_matricula} · </span>}
            {jornada.funcao && <span>{jornada.funcao} · </span>}
            {jornada.centro_custo_nome && <span>{jornada.centro_custo_nome}</span>}
          </div>
        </DialogHeader>

        {loading ? (
          <div className="py-12 text-center text-muted-foreground">Carregando batidas...</div>
        ) : batidas.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">Nenhuma batida registrada</div>
        ) : (
          <div className="space-y-3">
            {batidas.map((b) => {
              const invalidada = b.status_validacao === "invalidada";
              return (
                <div
                  key={b.id}
                  className={`border rounded-lg p-4 ${invalidada ? "opacity-50 bg-muted" : ""}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="font-semibold">
                          {tipoLabel[b.tipo_batida] ?? b.tipo_batida}
                        </Badge>
                        <span className="text-lg font-mono font-bold">
                          {format(new Date(b.data_hora_considerada), "HH:mm:ss")}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {b.modo_registro ?? "—"}
                        </Badge>
                        {invalidada && <Badge variant="destructive">Invalidada</Badge>}
                        {b.score_risco != null && b.score_risco > 50 && (
                          <Badge variant="destructive">Risco {b.score_risco}</Badge>
                        )}
                      </div>

                      {(b.latitude != null && b.longitude != null) && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <a
                            href={`https://www.google.com/maps?q=${b.latitude},${b.longitude}`}
                            target="_blank"
                            rel="noreferrer"
                            className="underline flex items-center gap-1"
                          >
                            {Number(b.latitude).toFixed(5)}, {Number(b.longitude).toFixed(5)}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                          {b.dentro_raio === true && <Badge className="bg-green-600">Dentro do raio</Badge>}
                          {b.dentro_raio === false && (
                            <Badge variant="destructive">
                              Fora do raio{b.distancia_centro_metros ? ` (${Math.round(b.distancia_centro_metros)}m)` : ""}
                            </Badge>
                          )}
                        </div>
                      )}

                      {b.justificativa && (
                        <div className="text-sm bg-muted/50 rounded p-2 border-l-2 border-primary">
                          <strong>Justificativa:</strong> {b.justificativa}
                        </div>
                      )}
                    </div>

                    {fotoUrls[b.id] && (
                      <div className="shrink-0">
                        <img
                          src={fotoUrls[b.id]}
                          alt="Foto da batida"
                          className="h-20 w-20 object-cover rounded border"
                        />
                      </div>
                    )}
                  </div>

                  {!invalidada && (
                    <div className="flex gap-2 mt-3 pt-3 border-t">
                      <Button size="sm" variant="outline" onClick={() => handleEditarHora(b)} disabled={!canAjustarBatida}>
                        <Edit className="h-3 w-3 mr-1" /> Editar hora
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleJustificar(b)} disabled={!canAjustarBatida}>
                        <MessageSquare className="h-3 w-3 mr-1" /> Justificar
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleExcluir(b)} disabled={!canAjustarBatida}>
                        <Trash2 className="h-3 w-3 mr-1" /> Excluir
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ModalDetalheJornada;
