import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import type { AtestadoRow } from "@/types/atestadoMedico";

interface Props {
  rows: AtestadoRow[];
  onVer: (row: AtestadoRow) => void;
}

interface AlertaGrupo {
  codigo: string;
  titulo: string;
  rows: AtestadoRow[];
}

function temAlerta(r: AtestadoRow, codigo: string): boolean {
  const alertas = Array.isArray(r.alertas_gerados) ? r.alertas_gerados : [];
  return alertas.some((a) => a?.codigo === codigo);
}

export default function AtestadosDashboardAlertas({ rows, onVer }: Props) {
  const grupos = useMemo<AlertaGrupo[]>(() => {
    const defs: { codigo: string; titulo: string; match: (r: AtestadoRow) => boolean }[] = [
      { codigo: "fora_prazo", titulo: "Fora do prazo de 24h", match: (r) => !r.dentro_prazo_24h },
      { codigo: "email_erro", titulo: "E-mail com erro", match: (r) => r.notificacao_email_status === "erro" },
      { codigo: "afastamento_5_dias", titulo: "Afastamento ≥ 5 dias", match: (r) => (r.dias_afastamento ?? 0) >= 5 },
      { codigo: "recorrencia_mes", titulo: "Recorrência no mês", match: (r) => temAlerta(r, "recorrencia_mes") },
      { codigo: "acompanhamento_60d", titulo: "Acompanhamento 60 dias", match: (r) => temAlerta(r, "acompanhamento_60d") },
      { codigo: "limite_acompanhamento_filho", titulo: "Limite acompanhamento de filho", match: (r) => temAlerta(r, "limite_acompanhamento_filho") },
      { codigo: "limite_acompanhamento_esposa_gestante", titulo: "Limite acompanhamento esposa gestante", match: (r) => temAlerta(r, "limite_acompanhamento_esposa_gestante") },
    ];
    return defs
      .map((d) => ({ codigo: d.codigo, titulo: d.titulo, rows: rows.filter(d.match) }))
      .filter((g) => g.rows.length > 0);
  }, [rows]);

  if (grupos.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alertas operacionais</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum alerta operacional no conjunto filtrado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Alertas operacionais</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {grupos.map((g) => (
          <div key={g.codigo} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{g.titulo}</span>
              <Badge variant="destructive">{g.rows.length}</Badge>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.rows.slice(0, 12).map((r) => (
                <Button
                  key={r.id}
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1"
                  onClick={() => onVer(r)}
                >
                  <Eye className="w-3 h-3" />
                  {r.protocolo} — {r.nome_snapshot.split(" ")[0]}
                </Button>
              ))}
              {g.rows.length > 12 && (
                <span className="text-xs text-muted-foreground self-center">
                  +{g.rows.length - 12} outros
                </span>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
