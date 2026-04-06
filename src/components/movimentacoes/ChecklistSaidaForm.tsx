import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Camera, CheckCircle2, XCircle, Minus, Loader2 } from "lucide-react";
import { registrarCheckoutSaida, fetchMovimentacaoComDetalhes, CHECKLIST_ITENS_PADRAO, COMBUSTIVEL_OPTIONS } from "@/services/movimentacaoService";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Props {
  movimentacaoId: string;
}

type CheckStatus = "OK" | "NOK" | "NA";

const ChecklistSaidaForm: React.FC<Props> = ({ movimentacaoId }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [movData, setMovData] = useState<any>(null);

  const [horimetro, setHorimetro] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [checklist, setChecklist] = useState<Record<string, CheckStatus>>(
    Object.fromEntries(CHECKLIST_ITENS_PADRAO.map((i) => [i.key, "OK" as CheckStatus]))
  );
  const [fotos, setFotos] = useState<string[]>([]);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  useEffect(() => {
    fetchMovimentacaoComDetalhes(movimentacaoId)
      .then((d) => setMovData(d))
      .catch((e) => toast.error("Erro ao carregar movimentação: " + e.message))
      .finally(() => setLoading(false));
  }, [movimentacaoId]);

  const handleCapturarGeo = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocalização não suportada neste dispositivo.");
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(pos.coords.latitude);
        setLongitude(pos.coords.longitude);
        setGeoLoading(false);
        toast.success("Localização capturada!");
      },
      (err) => {
        setGeoLoading(false);
        toast.error("Erro ao capturar localização: " + err.message);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleFotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        setFotos((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemoveFoto = (index: number) => {
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleChecklist = (key: string) => {
    setChecklist((prev) => {
      const order: CheckStatus[] = ["OK", "NOK", "NA"];
      const current = prev[key];
      const next = order[(order.indexOf(current) + 1) % 3];
      return { ...prev, [key]: next };
    });
  };

  const handleSubmit = async () => {
    if (fotos.length === 0) {
      toast.error("É obrigatório anexar pelo menos uma foto.");
      return;
    }
    if (!latitude || !longitude) {
      toast.error("É obrigatório capturar a geolocalização.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      await registrarCheckoutSaida({
        movimentacao_id: movimentacaoId,
        horimetro: horimetro ? Number(horimetro) : undefined,
        combustivel: combustivel || undefined,
        checklist_json: checklist,
        fotos_json: fotos,
        latitude,
        longitude,
        responsavel_id: user.id,
      });

      toast.success("Checklist de saída registrado com sucesso!");
      navigate("/gestao-maquinas/central-transporte");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const mov = movData?.movimentacao;

  return (
    <div className="space-y-4 max-w-lg mx-auto pb-8">
      {/* Header */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Checklist de Saída</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><strong>Movimentação:</strong> {movimentacaoId.slice(0, 8)}</p>
          {mov && (
            <>
              <p><strong>Status:</strong> <Badge variant="secondary">{mov.status}</Badge></p>
              <p><strong>Deslocamento:</strong> {mov.tipo_deslocamento || "—"}</p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Horímetro + Combustível */}
      <Card>
        <CardContent className="pt-4 space-y-3">
          <div>
            <Label>Horímetro</Label>
            <Input type="number" placeholder="Ex: 12345" value={horimetro} onChange={(e) => setHorimetro(e.target.value)} />
          </div>
          <div>
            <Label>Combustível</Label>
            <Select value={combustivel} onValueChange={setCombustivel}>
              <SelectTrigger><SelectValue placeholder="Nível..." /></SelectTrigger>
              <SelectContent>
                {COMBUSTIVEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Checklist */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Inspeção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CHECKLIST_ITENS_PADRAO.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => toggleChecklist(item.key)}
              className="w-full flex items-center justify-between p-3 rounded-md border hover:bg-muted/50 transition-colors"
            >
              <span className="text-sm">{item.label}</span>
              {checklist[item.key] === "OK" && <Badge className="bg-primary text-primary-foreground"><CheckCircle2 className="h-3 w-3 mr-1" /> OK</Badge>}
              {checklist[item.key] === "NOK" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" /> NOK</Badge>}
              {checklist[item.key] === "NA" && <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" /> N/A</Badge>}
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Fotos */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4" /> Fotos *
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept="image/*" capture="environment" multiple onChange={handleFotoUpload} />
          {fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {fotos.map((foto, i) => (
                <div key={i} className="relative">
                  <img src={foto} alt={`Foto ${i + 1}`} className="w-full h-20 object-cover rounded-md border" />
                  <button
                    type="button"
                    onClick={() => handleRemoveFoto(i)}
                    className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full w-5 h-5 flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geolocalização */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <MapPin className="h-4 w-4" /> Geolocalização *
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" onClick={handleCapturarGeo} disabled={geoLoading} className="w-full gap-2">
            {geoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
            {latitude ? "Recapturar Localização" : "Capturar Localização"}
          </Button>
          {latitude && longitude && (
            <p className="text-xs text-muted-foreground text-center">
              Lat: {latitude.toFixed(6)} | Lng: {longitude.toFixed(6)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={saving} className="w-full" size="lg">
        {saving ? "Registrando..." : "Registrar Saída"}
      </Button>
    </div>
  );
};

export default ChecklistSaidaForm;
