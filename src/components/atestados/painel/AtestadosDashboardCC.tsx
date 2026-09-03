import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FilterX } from "lucide-react";
import type { AtestadoRow, AtestadosPainelFilters } from "@/types/atestadoMedico";

interface Props {
  rows: AtestadoRow[];
  filters: AtestadosPainelFilters;
  onFiltersChange: (filters: AtestadosPainelFilters) => void;
}

const CORES = ["#DD2C00", "#F59E0B", "#10B981", "#6B7280", "#B45309", "#374151"];

function truncar(texto: string, max = 32): string {
  return texto.length > max ? `${texto.slice(0, max - 1)}…` : texto;
}

/** Extrai o código do CC do snapshot: trecho antes de " — " (ex.: "L471", "CONL100"). */
function extrairCodigo(nome: string | null): string {
  if (!nome) return "—";
  const sep = nome.indexOf(" — ");
  if (sep > 0) return nome.slice(0, sep).trim();
  return nome.split(" ")[0] ?? nome;
}

function mask(m: string): string {
  if (!m) return "";
  if (m.length <= 3) return m;
  return `${m.slice(0, 2)}${"*".repeat(Math.max(0, m.length - 3))}${m.slice(-1)}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export default function AtestadosDashboardCC({ rows, filters, onFiltersChange }: Props) {
  const agregado = useMemo(() => {
    const map = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.centro_custo_snapshot ?? "Sem CC";
      map.set(k, (map.get(k) ?? 0) + 1);
    });
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({
        name,
        codigo: extrairCodigo(name),
        value,
        pct: rows.length ? (value / rows.length) * 100 : 0,
      }));
  }, [rows]);

  const top10 = agregado.slice(0, 10);
  const ccAtivo = filters.centro_custo?.trim() ?? "";

  /** Lista de documentos: mais recentes primeiro (início de afastamento, depois envio). */
  const documentos = useMemo(() => {
    return [...rows].sort((a, b) => {
      const da = a.data_inicio_afastamento ?? a.enviado_em;
      const db = b.data_inicio_afastamento ?? b.enviado_em;
      return db.localeCompare(da);
    });
  }, [rows]);

  const alternarFiltro = (cc: string) => {
    if (ccAtivo === cc) {
      onFiltersChange({ ...filters, centro_custo: undefined });
    } else {
      onFiltersChange({ ...filters, centro_custo: cc });
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Centros de custo</CardTitle>
        {ccAtivo && (
          <button
            type="button"
            onClick={() => onFiltersChange({ ...filters, centro_custo: undefined })}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <FilterX className="w-3.5 h-3.5" />
            Limpar filtro: <Badge variant="secondary">{truncar(ccAtivo)}</Badge>
          </button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {agregado.length === 0 ? (
          <div className="flex items-center justify-center h-[320px] text-muted-foreground text-sm">
            Sem dados disponíveis
          </div>
        ) : (
          <>
            {/* Gráfico de colunas verticais — largura total, eixo X com apenas o código */}
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={top10} margin={{ left: 8, right: 24, bottom: 4 }}>
                <XAxis
                  type="category"
                  dataKey="codigo"
                  fontSize={11}
                  interval={0}
                  tickLine={false}
                />
                <YAxis type="number" allowDecimals={false} fontSize={11} width={40} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "6px",
                    fontSize: "12px",
                  }}
                  labelFormatter={(_, payload) => {
                    const nome = (payload?.[0]?.payload as { name?: string } | undefined)?.name;
                    return nome ?? "";
                  }}
                />
                <Bar
                  dataKey="value"
                  name="Documentos"
                  radius={[4, 4, 0, 0]}
                  cursor="pointer"
                  onClick={(data) => {
                    const nome = (data as unknown as { name?: string })?.name;
                    if (nome) alternarFiltro(nome);
                  }}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    fontSize={12}
                    fontWeight={600}
                    fill="hsl(var(--foreground))"
                  />
                  {top10.map((entry, i) => (
                    <Cell
                      key={entry.name}
                      fill={CORES[i % CORES.length]}
                      opacity={ccAtivo && ccAtivo !== entry.name ? 0.35 : 1}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Lista de documentos (padrão da listagem principal) */}
            <div className="max-h-[360px] overflow-y-auto rounded-md border">
              <Table className="table-fixed">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[32%]">Colaborador</TableHead>
                    <TableHead className="w-[15%] text-center">Matrícula</TableHead>
                    <TableHead className="w-[15%] text-center">Centro de custo</TableHead>
                    <TableHead className="w-[13%] text-center">Emissão</TableHead>
                    <TableHead className="w-[15%] text-center">Início afast.</TableHead>
                    <TableHead className="w-[10%] text-center">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documentos.map((r) => {
                    const cc = r.centro_custo_snapshot ?? "Sem CC";
                    const ativo = ccAtivo === cc;
                    return (
                      <TableRow
                        key={r.id}
                        onClick={() => alternarFiltro(cc)}
                        title={cc}
                        className={`cursor-pointer hover:bg-muted/60 ${
                          ativo ? "bg-primary/10 hover:bg-primary/10" : ""
                        }`}
                      >
                        <TableCell className={`truncate ${ativo ? "font-semibold" : ""}`}>
                          {r.nome_snapshot}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {mask(r.matricula_snapshot)}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs">
                          {extrairCodigo(r.centro_custo_snapshot)}
                        </TableCell>
                        <TableCell className="text-center text-xs">{fmtDate(r.data_emissao)}</TableCell>
                        <TableCell className="text-center text-xs">
                          {fmtDate(r.data_inicio_afastamento)}
                        </TableCell>
                        <TableCell className="text-center">{r.dias_afastamento}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
