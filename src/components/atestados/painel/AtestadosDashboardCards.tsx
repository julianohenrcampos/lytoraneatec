import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  Clock,
  AlertTriangle,
  MailWarning,
  CalendarClock,
  Repeat,
} from "lucide-react";
import type { AtestadoRow } from "@/types/atestadoMedico";

interface Props {
  rows: AtestadoRow[];
}

function temAlerta(r: AtestadoRow, codigos: string[]): boolean {
  const alertas = Array.isArray(r.alertas_gerados) ? r.alertas_gerados : [];
  return alertas.some((a) => a && codigos.includes(a.codigo));
}

export function calcularMetricas(rows: AtestadoRow[]) {
  const total = rows.length;
  const dentro = rows.filter((r) => r.dentro_prazo_24h).length;
  const fora = total - dentro;
  const emailErro = rows.filter((r) => r.notificacao_email_status === "erro").length;
  const emailEnviado = rows.filter((r) => r.notificacao_email_status === "enviada").length;
  const emailPendente = rows.filter((r) => r.notificacao_email_status === "pendente").length;
  const afast5 = rows.filter((r) => (r.dias_afastamento ?? 0) >= 5).length;
  const recorrencia = rows.filter((r) =>
    temAlerta(r, [
      "recorrencia_mes",
      "acompanhamento_60d",
      "limite_acompanhamento_filho",
      "limite_acompanhamento_esposa_gestante",
    ]),
  ).length;
  const totalDias = rows.reduce((s, r) => s + (r.dias_afastamento ?? 0), 0);
  return {
    total,
    dentro,
    fora,
    emailErro,
    emailEnviado,
    emailPendente,
    afast5,
    recorrencia,
    totalDias,
    pctDentro: total ? (dentro / total) * 100 : 0,
    pctFora: total ? (fora / total) * 100 : 0,
  };
}

export default function AtestadosDashboardCards({ rows }: Props) {
  const m = calcularMetricas(rows);

  const cards = [
    {
      titulo: "Total de documentos",
      valor: m.total,
      detalhe: `${m.totalDias.toLocaleString("pt-BR")} dias de afastamento no total`,
      icone: FileText,
      cor: "text-foreground",
    },
    {
      titulo: "Dentro do prazo",
      valor: m.dentro,
      detalhe: `${m.pctDentro.toFixed(1)}% do total`,
      icone: Clock,
      cor: "text-success",
    },
    {
      titulo: "Fora do prazo",
      valor: m.fora,
      detalhe: `${m.pctFora.toFixed(1)}% do total`,
      icone: AlertTriangle,
      cor: "text-destructive",
    },
    {
      titulo: "E-mails com erro",
      valor: m.emailErro,
      detalhe: `${m.emailEnviado} enviados · ${m.emailPendente} pendentes`,
      icone: MailWarning,
      cor: "text-destructive",
    },
    {
      titulo: "Afastamentos ≥ 5 dias",
      valor: m.afast5,
      detalhe: "Exigem atenção da Saúde",
      icone: CalendarClock,
      cor: "text-warning",
    },
    {
      titulo: "Alertas de recorrência",
      valor: m.recorrencia,
      detalhe: "Recorrência / acompanhamento / limites",
      icone: Repeat,
      cor: "text-warning",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {cards.map((c) => (
        <Card key={c.titulo}>
          <CardHeader className="pb-1 pt-3 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <c.icone className={`w-3.5 h-3.5 ${c.cor}`} />
              {c.titulo}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <div className={`text-2xl font-bold ${c.cor}`}>
              {c.valor.toLocaleString("pt-BR")}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">{c.detalhe}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
