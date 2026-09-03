import { useMemo } from "react";
import { DonutChart } from "@/components/charts/DonutChart";
import type { AtestadoRow } from "@/types/atestadoMedico";

interface Props {
  rows: AtestadoRow[];
}

const CORES = ["#DD2C00", "#F59E0B", "#10B981", "#6B7280", "#B45309", "#374151"];

export default function AtestadosDashboardCharts({ rows }: Props) {
  const porTipo = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.tipo_documento_descricao ?? "Atestado Médico";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value], i) => ({ name, value, color: CORES[i % CORES.length] }));
  }, [rows]);

  const porPrazo = useMemo(() => {
    const dentro = rows.filter((r) => r.dentro_prazo_24h).length;
    return [
      { name: "Dentro de 24h", value: dentro, color: "#10B981" },
      { name: "Fora do prazo", value: rows.length - dentro, color: "#DD2C00" },
    ];
  }, [rows]);

  const porEmail = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => map.set(r.notificacao_email_status, (map.get(r.notificacao_email_status) ?? 0) + 1));
    const corPorStatus: Record<string, string> = {
      enviada: "#10B981",
      pendente: "#F59E0B",
      erro: "#DD2C00",
    };
    return [...map.entries()].map(([name, value]) => ({
      name,
      value,
      color: corPorStatus[name] ?? "#6B7280",
    }));
  }, [rows]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <DonutChart
        data={porTipo}
        title="Por tipo de documento"
        centerLabel={`${rows.length}`}
        height={240}
      />
      <DonutChart
        data={porPrazo}
        title="Por prazo de envio"
        centerLabel={`${rows.length}`}
        height={240}
      />
      <DonutChart
        data={porEmail}
        title="Por status de e-mail"
        centerLabel={`${rows.length}`}
        height={240}
      />
    </div>
  );
}
